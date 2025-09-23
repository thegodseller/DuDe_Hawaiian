"""Front Dude Gateway
- จัดการ CORS + Rate Limit + Logging (JSON + Correlation-ID)
- Proxy เรียก Doc Dude เพื่อทำ RAG/OCR
- ให้บริการ SSE streaming สำหรับหน้าสนทนา
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from contextvars import ContextVar
from typing import Dict, List, Optional

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
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


def setup_logger() -> logging.Logger:
    logger = logging.getLogger("front_dude")
    logger.setLevel(logging.INFO)
    formatter = JSONLogFormatter()

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    logger.handlers.clear()
    logger.addHandler(handler)

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()
    logging.getLogger("uvicorn").handlers.clear()
    logging.getLogger("uvicorn").addHandler(handler)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    return logger


logger = setup_logger()


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
        self.exclude_paths = {"/health", "/ready", "/agents/health", "/startup"}

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

AGENT_ENDPOINTS = {
    "doc_dude": f"{DOC_DUDE_URL}/ready",
    "messenger_dude": "http://messenger_dude:8080/health",
    "medic_dude": "http://medic_dude:8080/health",
    "vision_dude": "http://vision_dude:8080/health",
    "chroma": f"http://{CHROMA_HOST}:{CHROMA_PORT}/api/v1/heartbeat",
}

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_correlation_id() -> Optional[str]:
    try:
        return request_id_ctx.get()
    except LookupError:
        return None


async def post_json(url: str, payload: dict, timeout: float = 120) -> dict:
    headers = {"Content-Type": "application/json"}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()


async def post_file(url: str, file: UploadFile, collection: Optional[str]) -> dict:
    cid = get_correlation_id()
    headers = {}
    if cid:
        headers["X-Correlation-ID"] = cid
    data = {}
    if collection:
        data["collection"] = collection
    contents = await file.read()
    files = {"file": (file.filename, contents, file.content_type or "application/octet-stream")}
    async with httpx.AsyncClient(timeout=180) as client:
        response = await client.post(url, data=data, files=files, headers=headers)
        response.raise_for_status()
        return response.json()


async def fetch_health(url: str) -> dict:
    headers = {}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url, headers=headers)
            status = resp.status_code
            content_type = resp.headers.get("content-type", "")
            if content_type.startswith("application/json"):
                try:
                    data = resp.json()
                except ValueError:
                    data = {"raw": resp.text}
            else:
                data = {"raw": resp.text}
            return {"ok": status < 400, "status": status, "data": data}
    except Exception as exc:
        return {"ok": False, "status": None, "error": str(exc)}


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


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/ready")
async def ready():
    return {"ok": True, "doc_dude": DOC_DUDE_URL, "collection": DEFAULT_COLLECTION}


@app.get("/startup")
async def startup_status():
    return await ready()


@app.get("/agents/health")
async def agents_health():
    names = list(AGENT_ENDPOINTS.keys())
    tasks = [fetch_health(AGENT_ENDPOINTS[name]) for name in names]
    responses = await asyncio.gather(*tasks, return_exceptions=False)
    results = {name: resp for name, resp in zip(names, responses)}
    return {"ok": all(item.get("ok") for item in results.values()), "agents": results}


@app.post("/chat")
async def chat_stream(req: ChatRequest):
    async def event_generator():
        try:
            doc_result = await post_json(
                f"{DOC_DUDE_URL}/query",
                {"q": req.message, "top_k": req.top_k, "collection": DEFAULT_COLLECTION},
            )
            sources = doc_result.get("sources", [])
            answer = build_answer(req.message, sources, req.mode)
            for token in stream_tokens(answer):
                yield format_sse("token", {"value": token})
                await asyncio.sleep(STREAM_DELAY)
            yield format_sse(
                "complete",
                {
                    "answer": answer,
                    "sources": sources,
                    "question": req.message,
                },
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
            yield format_sse("error", {"detail": detail})
        except Exception as exc:  # pragma: no cover - runtime failure
            logger.exception("chat_stream_failed", extra={"fields": {"error": str(exc)}})
            yield format_sse("error", {"detail": "เกิดข้อผิดพลาดภายในระบบ"})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/search")
async def search(req: SearchRequest):
    data = await post_json(
        f"{DOC_DUDE_URL}/query",
        {"q": req.query, "top_k": req.top_k, "collection": req.collection or DEFAULT_COLLECTION},
    )
    return data


@app.post("/knowledge/upload")
async def knowledge_upload(file: UploadFile = File(...), collection: Optional[str] = Form(None)):
    try:
        result = await post_file(f"{DOC_DUDE_URL}/ingest", file, collection or DEFAULT_COLLECTION)
        return result
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail)


@app.post("/vision/analyze")
async def proxy_ocr(file: UploadFile = File(...)):
    try:
        result = await post_file(f"{DOC_DUDE_URL}/ocr", file, None)
        return result
    except httpx.HTTPStatusError as exc:
        detail = exc.response.json() if exc.response.headers.get("content-type", "").startswith("application/json") else exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=detail)
