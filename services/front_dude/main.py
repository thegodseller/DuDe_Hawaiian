"""Front Dude Gateway
- จัดการ CORS + Rate Limit + Logging (JSON + Correlation-ID)
- Proxy เรียก Doc Dude เพื่อทำ RAG/OCR
- ให้บริการ SSE streaming สำหรับหน้าสนทนา
"""

from __future__ import annotations

import asyncio
import base64
import hmac
import json
import logging
import os
import re
import sqlite3
import time
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any, Dict, List, Optional, Type

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from prometheus_client import CONTENT_TYPE_LATEST, Counter as PromCounter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class JSONLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        try:
            cid = request_id_ctx.get()
        except LookupError:
            cid = None
        if cid:
            payload["correlation_id"] = cid
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        return json.dumps(payload, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Runtime feature configuration
# ---------------------------------------------------------------------------

CONFIG_BASE_PATH = Path(os.getenv("FRONT_CONFIG_ROOT", "/data/config"))
CONFIG_BASE_PATH.mkdir(parents=True, exist_ok=True)

FEATURE_CONFIG_PATH = CONFIG_BASE_PATH / "front_features.json"

DEFAULT_FEATURE_CONFIG: Dict[str, bool] = {
    "task_orchestration_enabled": True,
    "tool_registry_validation": True,
    "structured_logging_enabled": True,
    "eval_trace_enabled": True,
}

feature_config_lock = asyncio.Lock()
feature_config: Dict[str, bool] = {}


MODEL_CONFIG_PATH = CONFIG_BASE_PATH / "model_router.json"

DEFAULT_MODEL_CONFIG: Dict[str, Any] = {
    "multi_model": {
        "primary_thai": "scb10x/llama3.2-typhoon2-3b-instruct:latest",
        "secondary_thai": "qwen2.5:7b-instruct",
        "coding_specialist": "codellama:7b-python",
        "embedding": "nomic-embed-text:latest",
    },
    "routing": {
        "thai_conversation": "scb10x/llama3.2-typhoon2-3b-instruct:latest",
        "coding_tasks": "codellama:7b-python",
        "mixed_tasks": "qwen2.5:7b-instruct",
        "default_model": "scb10x/llama3.2-typhoon2-3b-instruct:latest",
        "code_keywords": [
            "def ",
            "class ",
            "import ",
            "console.log",
            "function ",
            "{",
            "};",
            "</",
            "```",
        ],
        "thai_threshold": 0.35,
    },
    "memory": {
        "max_loaded_models": 2,
        "flash_attention": True,
        "memory_limit": "10G",
    },
    "context": {
        "thai_code_context": (
            "คุณเป็น AI ที่เก่งทั้งภาษาไทยและการเขียนโปรแกรม\n"
            "ตอบเป็นภาษาไทยแต่โค้ดใช้ภาษาอังกฤษ\nอธิบายโค้ดอย่างกระชับเข้าใจง่าย"
        ),
        "max_history_messages": 6,
    },
}

model_config_lock = asyncio.Lock()
model_config: Dict[str, Any] = {}


def _ensure_feature_config_shape(raw: Dict[str, Any]) -> Dict[str, bool]:
    config = DEFAULT_FEATURE_CONFIG.copy()
    for key, default_value in DEFAULT_FEATURE_CONFIG.items():
        candidate = raw.get(key)
        if isinstance(candidate, bool):
            config[key] = candidate
        else:
            config[key] = default_value
    return config


def load_feature_config_from_disk() -> Dict[str, bool]:
    if FEATURE_CONFIG_PATH.exists():
        try:
            with FEATURE_CONFIG_PATH.open("r", encoding="utf-8") as fp:
                payload = json.load(fp) or {}
        except Exception:
            return DEFAULT_FEATURE_CONFIG.copy()
        return _ensure_feature_config_shape(payload)
    return DEFAULT_FEATURE_CONFIG.copy()


def save_feature_config_to_disk(config: Dict[str, bool]) -> None:
    with FEATURE_CONFIG_PATH.open("w", encoding="utf-8") as fp:
        json.dump(config, fp, ensure_ascii=False, indent=2)


feature_config = load_feature_config_from_disk()


def is_feature_enabled(name: str) -> bool:
    return feature_config.get(name, True)


def _ensure_model_config_shape(raw: Dict[str, Any]) -> Dict[str, Any]:
    reference = json.loads(json.dumps(DEFAULT_MODEL_CONFIG))

    def merge(base: Any, incoming: Any) -> Any:
        if isinstance(base, dict):
            result: Dict[str, Any] = {}
            for key, default_value in base.items():
                if isinstance(incoming, dict) and key in incoming:
                    result[key] = merge(default_value, incoming[key])
                else:
                    result[key] = default_value
            return result
        return incoming if incoming is not None else base

    return merge(reference, raw)


def load_model_config_from_disk() -> Dict[str, Any]:
    if MODEL_CONFIG_PATH.exists():
        try:
            with MODEL_CONFIG_PATH.open("r", encoding="utf-8") as fp:
                payload = json.load(fp) or {}
        except Exception:
            return DEFAULT_MODEL_CONFIG.copy()
        return _ensure_model_config_shape(payload)
    return DEFAULT_MODEL_CONFIG.copy()


def save_model_config_to_disk(config: Dict[str, Any]) -> None:
    with MODEL_CONFIG_PATH.open("w", encoding="utf-8") as fp:
        json.dump(config, fp, ensure_ascii=False, indent=2)


model_config = load_model_config_from_disk()


def get_model_config_snapshot() -> Dict[str, Any]:
    return json.loads(json.dumps(model_config))


def _deep_merge(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    result = json.loads(json.dumps(base))
    stack = [(result, updates)]
    while stack:
        current, incoming = stack.pop()
        for key, value in incoming.items():
            if isinstance(value, dict) and isinstance(current.get(key), dict):
                stack.append((current[key], value))
            else:
                current[key] = value
    return result


def setup_logger(structured_logging: bool) -> logging.Logger:
    logger = logging.getLogger("front_dude")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    if structured_logging:
        handler.setFormatter(JSONLogFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))

    logger.handlers.clear()
    logger.addHandler(handler)

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()
    logging.getLogger("uvicorn").handlers.clear()
    logging.getLogger("uvicorn").addHandler(handler)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    return logger


logger = setup_logger(feature_config["structured_logging_enabled"])


def get_feature_config_snapshot() -> Dict[str, bool]:
    return feature_config.copy()


async def apply_feature_config_updates(updates: Dict[str, bool]) -> Dict[str, bool]:
    global logger, feature_config
    if not updates:
        return get_feature_config_snapshot()
    async with feature_config_lock:
        feature_config = {**feature_config, **updates}
        snapshot = feature_config.copy()
        await asyncio.to_thread(save_feature_config_to_disk, snapshot)
        if "structured_logging_enabled" in updates:
            logger = setup_logger(feature_config["structured_logging_enabled"])
        logger.info(
            "feature_config_updated",
            extra={"fields": {"updates": updates}},
        )
        return snapshot


async def apply_model_config_updates(updates: Dict[str, Any]) -> Dict[str, Any]:
    global model_config
    if not updates:
        return get_model_config_snapshot()
    async with model_config_lock:
        merged = _deep_merge(model_config, updates)
        model_config = _ensure_model_config_shape(merged)
        snapshot = get_model_config_snapshot()
        await asyncio.to_thread(save_model_config_to_disk, snapshot)
        logger.info(
            "model_config_updated",
            extra={"fields": {"updates": updates}},
        )
        return snapshot


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, logger: logging.Logger) -> None:
        super().__init__(app)
        self.logger = logger

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(correlation_id)
        request.state.correlation_id = correlation_id
        start = time.time()
        try:
            response = await call_next(request)
        except Exception:
            duration = (time.time() - start) * 1000
            self.logger.exception(
                "request_failed",
                extra={
                    "fields": {
                        "path": request.url.path,
                        "method": request.method,
                        "duration_ms": round(duration, 2),
                    }
                },
            )
            raise
        finally:
            request_id_ctx.reset(token)
        duration = (time.time() - start) * 1000
        response.headers["X-Correlation-ID"] = correlation_id
        self.logger.info(
            "request_completed",
            extra={
                "fields": {
                    "path": request.url.path,
                    "method": request.method,
                    "status": response.status_code,
                    "duration_ms": round(duration, 2),
                }
            },
        )
        return response


# ---------------------------------------------------------------------------
# Rate limit middleware (Token Bucket)
# ---------------------------------------------------------------------------


class TokenBucket:
    def __init__(self, rate_per_sec: float, capacity: int) -> None:
        self.rate = rate_per_sec
        self.capacity = capacity
        self.tokens = float(capacity)
        self.updated = time.monotonic()

    def consume(self, amount: float = 1.0) -> bool:
        now = time.monotonic()
        elapsed = now - self.updated
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        self.updated = now
        if self.tokens >= amount:
            self.tokens -= amount
            return True
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, rate_per_min: int, burst: int, logger: logging.Logger) -> None:
        super().__init__(app)
        self.rate = max(rate_per_min, 1) / 60.0
        self.burst = max(burst, 1)
        self.logger = logger
        self.buckets: Dict[str, TokenBucket] = {}
        self.exclude_paths = {"/health", "/ready", "/agents/health", "/startup", "/metrics"}

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        path = request.url.path
        if path in self.exclude_paths:
            return await call_next(request)
        client_host = request.client.host if request.client else "anonymous"
        bucket = self.buckets.setdefault(client_host, TokenBucket(self.rate, self.burst))
        if not bucket.consume():
            self.logger.warning(
                "rate_limit_block",
                extra={"fields": {"client": client_host, "path": path}},
            )
            return JSONResponse(
                status_code=429,
                content={"ok": False, "detail": "Request rate exceeded, โปรดลองใหม่อีกครั้ง"},
                headers={"Retry-After": "1"},
            )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DOC_DUDE_URL = os.getenv("DOC_DUDE_URL", "http://doc_dude:8080")
CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = os.getenv("CHROMA_PORT", "8000")
DEFAULT_COLLECTION = os.getenv("CHROMA_COLLECTION", "doc_dude_knowledge")
CORS_ALLOWLIST = [origin.strip() for origin in os.getenv("CORS_ALLOWLIST", "http://localhost:3000").split(",") if origin.strip()]
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "60"))
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "30"))
STREAM_DELAY = float(os.getenv("STREAM_DELAY_SECONDS", "0.05"))
TRACE_DB_PATH = Path(os.getenv("FRONT_TRACE_DB_PATH", "/data/telemetry/front_traces.db"))
TRACE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
TOOL_DEFAULT_TIMEOUT = float(os.getenv("TOOL_DEFAULT_TIMEOUT", "120"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "").strip()
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
LINE_BASE_URL = os.getenv("LINE_BASE_URL", "https://api.line.me").rstrip("/")
LINE_TIMEOUT = float(os.getenv("LINE_HTTP_TIMEOUT", "30"))
LINE_REPLY_URL = f"{LINE_BASE_URL}/v2/bot/message/reply"


def _resolve_liff_upload_url() -> str:
    direct_url = os.getenv("LINE_LIFF_UPLOAD_URL", "").strip()
    if direct_url:
        return direct_url
    liff_id = (os.getenv("LINE_LIFF_UPLOAD_ID", "") or os.getenv("VITE_LIFF_UPLOAD_ID", "")).strip()
    if liff_id:
        return f"https://liff.line.me/{liff_id}"
    return ""


LINE_LIFF_UPLOAD_URL = _resolve_liff_upload_url()


def _normalize_for_keyword(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return re.sub(r"\s+", "", text).lower()


_DEFAULT_UPLOAD_KEYWORDS = [
    "อัปโหลด",
    "อัพโหลด",
    "เพิ่มความรู้",
    "เพิ่มข้อมูล",
    "upload",
    "ส่งไฟล์",
]


custom_upload_keywords = [
    entry.strip()
    for entry in os.getenv("LINE_UPLOAD_KEYWORDS", "").split(",")
    if entry.strip()
]


if custom_upload_keywords:
    upload_keyword_signatures = {_normalize_for_keyword(entry) for entry in custom_upload_keywords}
else:
    upload_keyword_signatures = {_normalize_for_keyword(entry) for entry in _DEFAULT_UPLOAD_KEYWORDS}


def is_upload_intent(text: str) -> bool:
    normalized = _normalize_for_keyword(text)
    if not normalized:
        return False
    return any(signature and signature in normalized for signature in upload_keyword_signatures)
LOCAL_TZ = os.getenv("LOCAL_TZ", "Asia/Bangkok")
try:
    LOCAL_TZINFO = ZoneInfo(LOCAL_TZ)
except Exception:  # pragma: no cover - fallback when timezone not available
    LOCAL_TZINFO = datetime.now().astimezone().tzinfo

app = FastAPI(title="Front Dude")
app.add_middleware(CorrelationIdMiddleware, logger=logger)
app.add_middleware(RateLimitMiddleware, rate_per_min=RATE_LIMIT_PER_MIN, burst=RATE_LIMIT_BURST, logger=logger)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWLIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID"],
)


# ---------------------------------------------------------------------------
# Tool registry + observability
# ---------------------------------------------------------------------------

REQUEST_COUNTER = PromCounter(
    "front_dude_requests_total",
    "จำนวนคำขอที่เข้ามาใน Front Dude",
    ["endpoint", "status"],
)
TOOL_LATENCY = Histogram(
    "front_dude_tool_latency_seconds",
    "ระยะเวลาการเรียกใช้งานเครื่องมือผ่าน Front Dude",
    ["intent"],
)
TOOL_CALL_COUNTER = PromCounter(
    "front_dude_tool_calls_total",
    "สถิติการเรียกใช้เครื่องมือ",
    ["intent", "status"],
)


@dataclass
class ToolDefinition:
    intent: str
    name: str
    method: str
    url: str
    schema: Optional[Type[BaseModel]] = None
    feature_flag: Optional[str] = None
    timeout: float = TOOL_DEFAULT_TIMEOUT
    category: Optional[str] = None


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.intent] = tool

    def get(self, intent: str) -> ToolDefinition:
        if intent not in self._tools:
            raise KeyError(f"ไม่พบเครื่องมือ intent={intent}")
        tool = self._tools[intent]
        if tool.feature_flag:
            flag_value = os.getenv(tool.feature_flag, "1").strip().lower()
            if flag_value in {"0", "false", "off"}:
                raise RuntimeError(f"เครื่องมือ {intent} ถูกปิดผ่าน feature flag")
        return tool

    def list_by_category(self, category: str) -> List[ToolDefinition]:
        return [tool for tool in self._tools.values() if tool.category == category]


tool_registry = ToolRegistry()
HEALTH_INTENT_CATEGORY = "health"


TRACE_SCHEMA = """
CREATE TABLE IF NOT EXISTS traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    request_id TEXT,
    intent TEXT,
    payload TEXT,
    response TEXT,
    latency_ms REAL
);
"""


@contextmanager
def trace_connection() -> Any:
    conn = sqlite3.connect(TRACE_DB_PATH, timeout=5)
    try:
        yield conn
    finally:
        conn.close()


def init_trace_db() -> None:
    with trace_connection() as conn:
        conn.execute(TRACE_SCHEMA)
        conn.commit()


def _write_front_trace(record: tuple) -> None:
    with trace_connection() as conn:
        conn.execute(
            """
            INSERT INTO traces
            (created_at, event_type, request_id, intent, payload, response, latency_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            record,
        )
        conn.commit()


async def record_trace(
    event_type: str,
    intent: str,
    request_id: Optional[str],
    payload: Dict[str, Any],
    response_payload: Dict[str, Any],
    latency_ms: float,
) -> None:
    if not is_feature_enabled("eval_trace_enabled"):
        return
    record = (
        datetime.utcnow().isoformat(timespec="milliseconds"),
        event_type,
        request_id,
        intent,
        json.dumps(payload, ensure_ascii=False),
        json.dumps(response_payload, ensure_ascii=False),
        float(latency_ms),
    )
    await asyncio.to_thread(_write_front_trace, record)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str = Field(..., description="ข้อความจากผู้ใช้")
    mode: str = Field("chat", description="chat หรือ doc")
    top_k: int = Field(4, ge=1, le=10)


class SearchRequest(BaseModel):
    query: str = Field(...)
    top_k: int = Field(4, ge=1, le=20)
    collection: Optional[str] = None


class DocQueryPayload(BaseModel):
    q: str = Field(..., description="คำถามสำหรับค้นหาใน Doc Dude")
    top_k: int = Field(4, ge=1, le=20)
    collection: Optional[str] = None


class FeatureConfigUpdate(BaseModel):
    task_orchestration_enabled: Optional[bool] = None
    tool_registry_validation: Optional[bool] = None
    structured_logging_enabled: Optional[bool] = None
    eval_trace_enabled: Optional[bool] = None


class MultiModelConfigUpdate(BaseModel):
    primary_thai: Optional[str] = None
    secondary_thai: Optional[str] = None
    coding_specialist: Optional[str] = None
    embedding: Optional[str] = None


class RoutingConfigUpdate(BaseModel):
    thai_conversation: Optional[str] = None
    coding_tasks: Optional[str] = None
    mixed_tasks: Optional[str] = None
    default_model: Optional[str] = None
    code_keywords: Optional[List[str]] = None
    thai_threshold: Optional[float] = Field(None, ge=0, le=1)


class MemoryConfigUpdate(BaseModel):
    max_loaded_models: Optional[int] = Field(None, ge=1)
    flash_attention: Optional[bool] = None
    memory_limit: Optional[str] = None


class ContextConfigUpdate(BaseModel):
    thai_code_context: Optional[str] = None
    max_history_messages: Optional[int] = Field(None, ge=0, le=100)


class ModelConfigUpdate(BaseModel):
    multi_model: Optional[MultiModelConfigUpdate] = None
    routing: Optional[RoutingConfigUpdate] = None
    memory: Optional[MemoryConfigUpdate] = None
    context: Optional[ContextConfigUpdate] = None


def register_default_tools() -> None:
    tool_registry.register(
        ToolDefinition(
            intent="doc.query",
            name="Doc Dude Query",
            method="POST_JSON",
            url=f"{DOC_DUDE_URL}/query",
            schema=DocQueryPayload,
            feature_flag="FEATURE_DOC_QUERY",
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="doc.ingest",
            name="Doc Dude Ingest",
            method="UPLOAD",
            url=f"{DOC_DUDE_URL}/ingest",
            feature_flag="FEATURE_DOC_INGEST",
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="doc.ocr",
            name="Doc Dude OCR",
            method="UPLOAD",
            url=f"{DOC_DUDE_URL}/ocr",
            feature_flag="FEATURE_DOC_OCR",
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="doc.health",
            name="Doc Dude Ready",
            method="GET_JSON",
            url=f"{DOC_DUDE_URL}/ready",
            category=HEALTH_INTENT_CATEGORY,
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="messenger.health",
            name="Messenger Dude Health",
            method="GET_JSON",
            url="http://messenger_dude:8080/health",
            category=HEALTH_INTENT_CATEGORY,
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="medic.health",
            name="Medic Dude Health",
            method="GET_JSON",
            url="http://medic_dude:8080/health",
            category=HEALTH_INTENT_CATEGORY,
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="vision.health",
            name="Vision Dude Health",
            method="GET_JSON",
            url="http://vision_dude:8080/health",
            category=HEALTH_INTENT_CATEGORY,
        )
    )
    tool_registry.register(
        ToolDefinition(
            intent="chroma.health",
            name="Chroma Heartbeat",
            method="GET_JSON",
            url=f"http://{CHROMA_HOST}:{CHROMA_PORT}/api/v1/heartbeat",
            category=HEALTH_INTENT_CATEGORY,
        )
    )


register_default_tools()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_correlation_id() -> Optional[str]:
    try:
        return request_id_ctx.get()
    except LookupError:
        return None


THAI_CHAR_PATTERN = re.compile(r"[\u0E00-\u0E7F]")
CODE_FENCE_PATTERN = re.compile(r"```[\s\S]*?```")


def _count_thai_characters(text: str) -> int:
    return len(THAI_CHAR_PATTERN.findall(text))


def _contains_code(text: str, keywords: List[str]) -> bool:
    lowered = text.lower()
    if CODE_FENCE_PATTERN.search(lowered):
        return True
    for keyword in keywords:
        if keyword.lower() in lowered:
            return True
    return False


def _is_thai_heavy(text: str, threshold: float) -> bool:
    if not text.strip():
        return False
    thai_count = _count_thai_characters(text)
    if thai_count == 0:
        return False
    ratio = thai_count / max(len(text), 1)
    return ratio >= max(0.0, min(threshold, 1.0))


def select_model_for_message(message: str) -> Dict[str, Any]:
    snapshot = get_model_config_snapshot()
    routing = snapshot["routing"]
    multi_model = snapshot["multi_model"]
    context_cfg = snapshot["context"]

    thai_threshold = float(routing.get("thai_threshold", 0.35))
    code_keywords = routing.get("code_keywords", [])

    has_code = _contains_code(message, code_keywords)
    thai_heavy = _is_thai_heavy(message, thai_threshold)

    if has_code and thai_heavy:
        chosen = routing.get("mixed_tasks") or multi_model.get("secondary_thai")
        reason = "thai_mixed_code"
    elif has_code:
        chosen = routing.get("coding_tasks") or multi_model.get("coding_specialist")
        reason = "coding_detected"
    elif thai_heavy:
        chosen = routing.get("thai_conversation") or multi_model.get("primary_thai")
        reason = "thai_conversation"
    else:
        chosen = routing.get("default_model") or multi_model.get("primary_thai")
        reason = "default"

    if not chosen:
        chosen = multi_model.get("primary_thai")

    context_applied = None
    if has_code and thai_heavy:
        context_applied = context_cfg.get("thai_code_context")

    return {
        "model": chosen,
        "reason": reason,
        "has_code": has_code,
        "thai_heavy": thai_heavy,
        "context": context_applied,
    }


def _summarize_sources_for_prompt(sources: List[dict], limit: int = 3, max_chars: int = 1800) -> str:
    if not sources:
        return ""
    snippets: List[str] = []
    for idx, src in enumerate(sources[:limit], start=1):
        text = (src.get("text") or "").strip()
        if not text:
            continue
        meta = src.get("metadata", {})
        filename = meta.get("filename") or "unknown"
        page = meta.get("page")
        header_parts = [f"ชิ้นที่ {idx}"]
        if filename:
            header_parts.append(f"ไฟล์: {filename}")
        if page is not None:
            header_parts.append(f"หน้า {page}")
        header = " | ".join(header_parts)
        snippets.append(f"{header}\n{text}")
    context_text = "\n\n".join(snippets)
    if len(context_text) > max_chars:
        context_text = context_text[: max_chars - 3] + "..."
    return context_text


def verify_line_signature(signature: str, body: bytes) -> bool:
    if not LINE_CHANNEL_SECRET:
        return False
    mac = hmac.new(LINE_CHANNEL_SECRET.encode("utf-8"), body, digestmod="sha256")
    expected = base64.b64encode(mac.digest()).decode("utf-8")
    return hmac.compare_digest(expected, signature)


async def generate_llm_answer(
    model: str,
    question: str,
    *,
    context_text: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> str:
    if not model:
        raise RuntimeError("ยังไม่ได้ตั้งค่าโมเดลสำหรับการตอบสนทนา")

    current_time_str = datetime.now(LOCAL_TZINFO).strftime("%d %b %Y %H:%M")
    base_system_prompt = (
        "คุณคือผู้ช่วยที่พูดไทยเป็นหลัก ใช้น้ำเสียงสุภาพและจริงใจ. "
        f"เวลาปัจจุบันของคุณคือ {current_time_str} (เขตเวลา {LOCAL_TZ}). "
        "หากผู้ใช้ทักทาย ให้ทักทายตอบ. หากไม่ได้ให้ข้อมูลพอ ให้ตอบตามความรู้ทั่วไปอย่างตรงไปตรงมาพร้อมแนะนำให้เพิ่มข้อมูลในระบบถ้าจำเป็น."
    )
    if system_prompt:
        base_system_prompt = base_system_prompt + "\n" + system_prompt

    payload: Dict[str, Any] = {
        "model": model,
        "prompt": question,
        "stream": False,
    }

    if context_text:
        prompt = (
            "บริบท:\n"
            f"{context_text}\n\n"
            "ตอบคำถามต่อไปนี้โดยใช้ข้อมูลข้างต้น หากไม่พบคำตอบ ให้ตอบตามความรู้ทั่วไปให้สุภาพและเป็นภาษาไทย:\n"
            f"{question}"
        )
        payload["prompt"] = prompt
    else:
        payload["prompt"] = (
            "ตอบคำถามต่อไปนี้เป็นภาษาไทยอย่างสุภาพ หากเป็นการทักทายให้ทักทายกลับ:"\
            f"\n{question}"
        )

    payload["system"] = base_system_prompt

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
        response.raise_for_status()
    data = response.json()
    text = data.get("response")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("โมเดลไม่ส่งข้อความกลับมา")
    return text.strip()


async def build_chat_response(message: str) -> Dict[str, Any]:
    intent_payload = {
        "q": message,
        "top_k": 4,
        "collection": DEFAULT_COLLECTION,
    }
    route_info = select_model_for_message(message)
    selected_model = route_info.get("model")
    context_applied = route_info.get("context")
    status = "success"
    started = time.perf_counter()
    doc_result: Dict[str, Any] = {}
    try:
        doc_result = await execute_tool("doc.query", intent_payload)
        sources = doc_result.get("sources", [])
        context_text = _summarize_sources_for_prompt(sources)
        try:
            answer = await generate_llm_answer(
                selected_model,
                message,
                context_text=context_text,
                system_prompt=context_applied,
            )
        except Exception as llm_error:
            logger.warning(
                "llm_generation_failed",
                extra={"fields": {"error": str(llm_error), "model": selected_model}},
            )
            answer = build_answer(message, sources, "chat")
        return {
            "answer": answer,
            "model": selected_model,
            "reason": route_info.get("reason"),
            "sources": sources,
        }
    except Exception:
        status = "failed"
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        REQUEST_COUNTER.labels(endpoint="/chat", status=status).inc()
        try:
            await record_trace(
                "endpoint",
                "/chat",
                get_correlation_id(),
                intent_payload,
                {"status": status, "model": selected_model, "reason": route_info.get("reason")},
                duration_ms,
            )
        except Exception:
            logger.exception("record_trace_failed")


async def send_line_reply(
    reply_token: str,
    message: str | Dict[str, Any] | List[str | Dict[str, Any]],
) -> None:
    if not LINE_CHANNEL_ACCESS_TOKEN:
        raise RuntimeError("ยังไม่ได้ตั้งค่า LINE channel access token")
    headers = {
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    def _coerce_message(entry: str | Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(entry, str):
            return {"type": "text", "text": entry[:995]}
        if isinstance(entry, dict):
            payload = entry.copy()
            if payload.get("type") == "text" and "text" in payload:
                payload["text"] = str(payload["text"])[:995]
            return payload
        raise TypeError("Unsupported LINE message payload")

    if isinstance(message, list):
        messages_payload = [_coerce_message(entry) for entry in message][:5]
    else:
        messages_payload = [_coerce_message(message)]

    payload = {
        "replyToken": reply_token,
        "messages": messages_payload,
    }
    async with httpx.AsyncClient(timeout=LINE_TIMEOUT) as client:
        response = await client.post(LINE_REPLY_URL, headers=headers, json=payload)
        if response.status_code >= 300:
            logger.error(
                "line_reply_failed",
                extra={"fields": {"status": response.status_code, "body": response.text}},
            )
            raise HTTPException(status_code=500, detail="LINE reply failed")


async def post_json(
    url: str,
    payload: Dict[str, Any],
    *,
    timeout: float = 120,
    headers: Optional[Dict[str, str]] = None,
) -> dict:
    base_headers = {"Content-Type": "application/json"}
    if headers:
        base_headers.update(headers)
    cid = get_correlation_id()
    if cid:
        base_headers.setdefault("X-Correlation-ID", cid)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=base_headers)
        response.raise_for_status()
        return response.json()


async def post_file(
    url: str,
    file: UploadFile,
    *,
    fields: Optional[Dict[str, Any]] = None,
    timeout: float = 180,
) -> dict:
    cid = get_correlation_id()
    headers: Dict[str, str] = {}
    if cid:
        headers["X-Correlation-ID"] = cid
    data = fields or {}
    contents = await file.read()
    files = {"file": (file.filename, contents, file.content_type or "application/octet-stream")}
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, data=data, files=files, headers=headers)
        response.raise_for_status()
        return response.json()


async def get_json(url: str, *, timeout: float = 10) -> dict:
    headers: Dict[str, str] = {}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        if response.headers.get("content-type", "").startswith("application/json"):
            return response.json()
        return {"raw": response.text, "status": response.status_code}


async def execute_tool(
    intent: str,
    payload: Optional[Dict[str, Any]] = None,
    *,
    file: Optional[UploadFile] = None,
    form_fields: Optional[Dict[str, Any]] = None,
) -> dict:
    if not is_feature_enabled("task_orchestration_enabled"):
        raise RuntimeError("Task orchestration ถูกปิดผ่านการตั้งค่า")
    tool = tool_registry.get(intent)
    validated_payload: Dict[str, Any] = payload or {}
    if tool.schema and payload is not None and is_feature_enabled("tool_registry_validation"):
        model = tool.schema(**payload)
        if isinstance(model, BaseModel):
            validated_payload = model.model_dump()
        else:
            validated_payload = model  # type: ignore[assignment]

    started = time.perf_counter()
    status = "success"
    response_summary: Dict[str, Any] = {}
    try:
        if tool.method == "POST_JSON":
            result = await post_json(
                tool.url,
                validated_payload,
                timeout=tool.timeout,
            )
        elif tool.method == "UPLOAD":
            if file is None:
                raise ValueError("ต้องระบุไฟล์สำหรับเครื่องมือนี้")
            result = await post_file(
                tool.url,
                file,
                fields=form_fields,
                timeout=tool.timeout,
            )
        elif tool.method in {"GET", "GET_JSON"}:
            result = await get_json(tool.url, timeout=tool.timeout)
        else:
            raise ValueError(f"เครื่องมือ {intent} ยังไม่รองรับ method {tool.method}")

        if isinstance(result, dict):
            response_summary = {
                "status": "success",
                "keys": list(result.keys())[:8],
            }
        else:
            response_summary = {"status": "success"}
        return result
    except Exception as exc:
        status = "failed"
        response_summary = {"status": "failed", "error": str(exc)}
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        TOOL_LATENCY.labels(intent=intent).observe(duration_ms / 1000)
        TOOL_CALL_COUNTER.labels(intent=intent, status=status).inc()
        await record_trace(
            "tool_call",
            intent,
            get_correlation_id(),
            validated_payload,
            response_summary,
            duration_ms,
        )


def format_sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def build_answer(question: str, sources: List[dict], mode: str) -> str:
    if not sources:
        return "ยังไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้ ลองเพิ่มข้อมูลหรือเปลี่ยนคำถามดูนะครับ"
    intro = "ข้อมูลที่เกี่ยวข้อง:" if mode == "doc" else "นี่คือข้อมูลที่ผมพบ:";
    snippets = []
    for src in sources:
        meta = src.get("metadata", {})
        page = meta.get("page", "?")
        text = (src.get("text") or "").replace("\n", " ")
        if len(text) > 200:
            text = text[:200] + "..."
        snippets.append(f"หน้า {page}: {text}")
    return intro + "\n" + "\n".join(snippets)


def stream_tokens(answer: str) -> List[str]:
    tokens = answer.split()
    if not tokens:
        return [answer]
    return tokens


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, init_trace_db)
    logger.info(
        "startup",
        extra={
            "fields": {
                "doc_dude_url": DOC_DUDE_URL,
                "default_collection": DEFAULT_COLLECTION,
            }
        },
    )


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/ready")
async def ready():
    return {"ok": True, "doc_dude": DOC_DUDE_URL, "collection": DEFAULT_COLLECTION}


@app.get("/startup")
async def startup_status():
    return await ready()


@app.get("/config/features")
async def get_feature_config_route():
    return {"config": get_feature_config_snapshot()}


@app.post("/config/features")
async def update_feature_config_route(payload: FeatureConfigUpdate):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    snapshot = await apply_feature_config_updates(updates)
    return {"ok": True, "config": snapshot}


@app.get("/config/models")
async def get_model_config_route():
    return {"config": get_model_config_snapshot()}


@app.post("/config/models")
async def update_model_config_route(payload: ModelConfigUpdate):
    updates = payload.model_dump(exclude_none=True)
    snapshot = await apply_model_config_updates(updates)
    return {"ok": True, "config": snapshot}


@app.post("/router/preview")
async def preview_routing(payload: ChatRequest):
    routing = select_model_for_message(payload.message)
    return {"ok": True, "routing": routing}


@app.post("/webhook/line")
async def line_webhook_entry(request: Request):
    body = await request.body()
    signature = request.headers.get("x-line-signature", "")
    if not signature or not verify_line_signature(signature, body):
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid payload")

    events = payload.get("events") or []
    for event in events:
        if event.get("type") != "message":
            continue
        message = event.get("message") or {}
        if message.get("type") != "text":
            continue
        reply_token = event.get("replyToken")
        if not reply_token:
            continue
        user_text = message.get("text", "")
        if is_upload_intent(user_text):
            if LINE_LIFF_UPLOAD_URL:
                upload_message = (
                    "เปิดหน้า mini-app สำหรับอัปโหลดไฟล์ RAG ได้ที่นี่เลยครับ 👇\n"
                    f"{LINE_LIFF_UPLOAD_URL}\n\n"
                    "เลือกหมวดหมู่ > แนบไฟล์ > กดยืนยัน แล้วกลับมาถามข้อมูลได้ทันทีครับ"
                )
                await send_line_reply(reply_token, upload_message)
            else:
                logger.warning("liff_upload_url_missing")
                await send_line_reply(
                    reply_token,
                    "ยังไม่ได้ตั้งค่าลิงก์อัปโหลดในระบบ กรุณาติดต่อผู้ดูแลเพื่อเปิดใช้งาน",
                )
            continue

        try:
            result = await build_chat_response(user_text)
            answer = result.get("answer") or ""
        except Exception as exc:
            logger.exception("line_chat_failed", extra={"fields": {"error": str(exc)}})
            answer = "ตอนนี้ระบบตอบกลับไม่ได้ ลองใหม่อีกครั้งนะครับ"
        await send_line_reply(reply_token, answer)

    return JSONResponse({"ok": True})


@app.get("/agents/health")
async def agents_health():
    tools = tool_registry.list_by_category(HEALTH_INTENT_CATEGORY)
    results: Dict[str, Dict[str, Any]] = {}
    overall_ok = True
    started = time.perf_counter()
    for tool in tools:
        try:
            data = await execute_tool(tool.intent)
            results[tool.intent] = {"ok": True, "data": data}
        except Exception as exc:
            overall_ok = False
            results[tool.intent] = {"ok": False, "error": str(exc)}
    duration_ms = (time.perf_counter() - started) * 1000
    status_label = "success" if overall_ok else "failed"
    REQUEST_COUNTER.labels(endpoint="/agents/health", status=status_label).inc()
    await record_trace(
        "endpoint",
        "/agents/health",
        get_correlation_id(),
        {"monitored": [tool.intent for tool in tools]},
        {"status": status_label},
        duration_ms,
    )
    return {"ok": overall_ok, "agents": results}


@app.post("/chat")
async def chat_stream(req: ChatRequest):
    intent_payload = {
        "q": req.message,
        "top_k": req.top_k,
        "collection": DEFAULT_COLLECTION,
    }
    route_info = select_model_for_message(req.message)
    selected_model = route_info.get("model")

    async def event_generator():
        start = time.perf_counter()
        status = "success"
        context_applied = route_info.get("context")
        try:
            doc_result = await execute_tool("doc.query", intent_payload)
            sources = doc_result.get("sources", [])
            context_text = _summarize_sources_for_prompt(sources)
            try:
                answer = await generate_llm_answer(
                    selected_model,
                    req.message,
                    context_text=context_text,
                    system_prompt=context_applied,
                )
            except Exception as llm_error:
                logger.warning(
                    "llm_generation_failed",
                    extra={"fields": {"error": str(llm_error), "model": selected_model}},
                )
                answer = build_answer(req.message, sources, req.mode)
            yield format_sse(
                "routing",
                {
                    "model": selected_model,
                    "reason": route_info.get("reason"),
                    "has_code": route_info.get("has_code"),
                    "thai_heavy": route_info.get("thai_heavy"),
                    "context": context_applied,
                    "source_count": len(sources),
                },
            )
            for token in stream_tokens(answer):
                yield format_sse("token", {"value": token})
                await asyncio.sleep(STREAM_DELAY)
            yield format_sse(
                "complete",
                {
                    "answer": answer,
                    "sources": sources,
                    "question": req.message,
                    "model": selected_model,
                    "routing_reason": route_info.get("reason"),
                    "context": context_applied,
                },
            )
        except httpx.HTTPStatusError as exc:
            status = "failed"
            if exc.response.headers.get("content-type", "").startswith("application/json"):
                detail = exc.response.json()
            else:
                detail = exc.response.text
            yield format_sse("error", {"detail": detail})
        except RuntimeError as exc:
            status = "failed"
            yield format_sse("error", {"detail": str(exc)})
        except Exception as exc:  # pragma: no cover - runtime failure
            status = "failed"
            logger.exception("chat_stream_failed", extra={"fields": {"error": str(exc)}})
            yield format_sse("error", {"detail": "เกิดข้อผิดพลาดภายในระบบ"})
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            REQUEST_COUNTER.labels(endpoint="/chat", status=status).inc()
            await record_trace(
                "endpoint",
                "/chat",
                get_correlation_id(),
                intent_payload,
                {"status": status, "model": selected_model, "reason": route_info.get("reason")},
                duration_ms,
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/search")
async def search(req: SearchRequest):
    payload = {
        "q": req.query,
        "top_k": req.top_k,
        "collection": req.collection or DEFAULT_COLLECTION,
    }
    status = "success"
    started = time.perf_counter()
    try:
        result = await execute_tool("doc.query", payload)
        return result
    except httpx.HTTPStatusError as exc:
        status = "failed"
        detail = (
            exc.response.json()
            if exc.response.headers.get("content-type", "").startswith("application/json")
            else exc.response.text
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except RuntimeError as exc:
        status = "failed"
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        status = "failed"
        logger.exception("search_failed", extra={"fields": {"error": str(exc)}})
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        REQUEST_COUNTER.labels(endpoint="/search", status=status).inc()
        await record_trace(
            "endpoint",
            "/search",
            get_correlation_id(),
            payload,
            {"status": status},
            duration_ms,
        )


@app.post("/knowledge/upload")
async def knowledge_upload(
    file: UploadFile = File(...),
    collection: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    source: Optional[str] = Form(None),
):
    target_collection = collection or DEFAULT_COLLECTION
    payload_meta = {
        "collection": target_collection,
        "filename": file.filename,
        "note": note,
        "source": source,
    }
    metadata_fields: Dict[str, Any] = {}
    if note:
        metadata_fields["note"] = note
    if source:
        metadata_fields["source"] = source
    form_fields: Dict[str, Any] = {"collection": target_collection}
    if metadata_fields:
        form_fields["metadata"] = json.dumps(metadata_fields, ensure_ascii=False)
    status = "success"
    started = time.perf_counter()
    try:
        result = await execute_tool(
            "doc.ingest",
            {"collection": target_collection},
            file=file,
            form_fields=form_fields,
        )
        return result
    except httpx.HTTPStatusError as exc:
        status = "failed"
        detail = (
            exc.response.json()
            if exc.response.headers.get("content-type", "").startswith("application/json")
            else exc.response.text
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except RuntimeError as exc:
        status = "failed"
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        status = "failed"
        logger.exception("knowledge_upload_failed", extra={"fields": {"error": str(exc)}})
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        REQUEST_COUNTER.labels(endpoint="/knowledge/upload", status=status).inc()
        await record_trace(
            "endpoint",
            "/knowledge/upload",
            get_correlation_id(),
            payload_meta,
            {"status": status},
            duration_ms,
        )


@app.post("/vision/analyze")
async def proxy_ocr(file: UploadFile = File(...)):
    status = "success"
    started = time.perf_counter()
    try:
        result = await execute_tool("doc.ocr", file=file)
        return result
    except httpx.HTTPStatusError as exc:
        status = "failed"
        detail = (
            exc.response.json()
            if exc.response.headers.get("content-type", "").startswith("application/json")
            else exc.response.text
        )
        raise HTTPException(status_code=exc.response.status_code, detail=detail) from exc
    except RuntimeError as exc:
        status = "failed"
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        status = "failed"
        logger.exception("vision_proxy_failed", extra={"fields": {"error": str(exc)}})
        raise
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        REQUEST_COUNTER.labels(endpoint="/vision/analyze", status=status).inc()
        await record_trace(
            "endpoint",
            "/vision/analyze",
            get_correlation_id(),
            {"filename": file.filename},
            {"status": status},
            duration_ms,
        )


@app.get("/metrics")
async def metrics():
    payload = generate_latest()
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)
