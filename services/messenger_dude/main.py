from __future__ import annotations

import json
import logging
import time
import uuid
from contextvars import ContextVar

import base64
import hmac
import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter as PromCounter, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

SERVICE_NAME = "Messenger Dude"

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # type: ignore[override]
        payload = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)),
            "level": record.levelname.lower(),
            "message": record.getMessage(),
            "service": SERVICE_NAME,
        }
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
    logger = logging.getLogger(SERVICE_NAME.replace(" ", "_"))
    logger.setLevel(logging.INFO)
    formatter = JSONFormatter()
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


REQUEST_COUNTER = PromCounter(
    "messenger_dude_requests_total",
    "Request count for Messenger Dude",
    ["endpoint"],
)


class CorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(correlation_id)
        start = time.time()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("request_failed", extra={"fields": {"path": request.url.path}})
            request_id_ctx.reset(token)
            raise
        duration = (time.time() - start) * 1000
        response.headers["X-Correlation-ID"] = correlation_id
        logger.info(
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
        request_id_ctx.reset(token)
        return response


app = FastAPI(title=SERVICE_NAME)
app.add_middleware(CorrelationMiddleware)


LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "").strip()
LINE_CHANNEL_ACCESS_TOKEN = os.getenv("LINE_CHANNEL_ACCESS_TOKEN", "").strip()
FRONT_CHAT_URL = os.getenv("FRONT_CHAT_URL", "http://front_dude:8080/chat")
LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"
LINE_TIMEOUT = float(os.getenv("LINE_HTTP_TIMEOUT", "30"))

if not LINE_CHANNEL_SECRET or not LINE_CHANNEL_ACCESS_TOKEN:
    logger.warning("line_credentials_missing")


def verify_signature(signature: str, body: bytes) -> bool:
    if not LINE_CHANNEL_SECRET:
        return False
    mac = hmac.new(LINE_CHANNEL_SECRET.encode("utf-8"), body, digestmod="sha256")
    digest = base64.b64encode(mac.digest()).decode("utf-8")
    return hmac.compare_digest(digest, signature)


async def collect_chat_answer(message: str) -> str:
    payload = {"message": message, "mode": "chat", "top_k": 4}
    tokens: List[str] = []
    answer: str = ""
    event_buffer = ""

    async with httpx.AsyncClient(timeout=LINE_TIMEOUT) as client:
        headers = {"Content-Type": "application/json"}
        async with client.stream("POST", FRONT_CHAT_URL, json=payload, headers=headers) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_text():
                event_buffer += chunk
                while "\n\n" in event_buffer:
                    block, event_buffer = event_buffer.split("\n\n", 1)
                    event_type = "message"
                    data_payload: Dict[str, Any] | None = None
                    for line in block.split("\n"):
                        if line.startswith("event:"):
                            event_type = line.replace("event:", "").strip()
                        elif line.startswith("data:"):
                            try:
                                data_payload = json.loads(line.replace("data:", "").strip())
                            except json.JSONDecodeError:
                                data_payload = None
                    if not data_payload:
                        continue
                    if event_type == "token":
                        value = data_payload.get("value")
                        if isinstance(value, str):
                            tokens.append(value)
                    elif event_type == "complete":
                        answer = data_payload.get("answer") or ""
                    elif event_type == "error":
                        detail = data_payload.get("detail", "ระบบตอบกลับผิดพลาด")
                        raise RuntimeError(detail)

    if not answer:
        answer = " ".join(tokens).strip()
    if not answer:
        answer = "ยังไม่มีข้อมูลที่ตอบได้ในตอนนี้ ลองพิมพ์ใหม่อีกครั้งนะครับ"
    return answer


async def line_reply(reply_token: str, message: str) -> None:
    headers = {
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "replyToken": reply_token,
        "messages": [
            {
                "type": "text",
                "text": message[:995],  # LINE limit 1000 chars
            }
        ],
    }
    async with httpx.AsyncClient(timeout=LINE_TIMEOUT) as client:
        response = await client.post(LINE_REPLY_URL, headers=headers, json=payload)
        if response.status_code >= 300:
            logger.error(
                "line_reply_failed",
                extra={"fields": {"status": response.status_code, "body": response.text}},
            )
            raise HTTPException(status_code=500, detail="ส่งข้อความกลับ LINE ไม่สำเร็จ")


@app.post("/webhook/line")
async def line_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("x-line-signature", "")
    if not signature or not verify_signature(signature, body):
        raise HTTPException(status_code=401, detail="invalid signature")

    payload = json.loads(body.decode("utf-8"))
    events = payload.get("events") or []
    for event in events:
        if event.get("type") == "message" and event.get("message", {}).get("type") == "text":
            reply_token = event.get("replyToken")
            text = event["message"].get("text", "")
            if not reply_token:
                continue
            try:
                answer = await collect_chat_answer(text)
            except Exception as exc:  # pragma: no cover - external failures
                logger.exception("chat_collect_failed", extra={"fields": {"error": str(exc)}})
                answer = "ตอนนี้ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้งนะครับ"
            await line_reply(reply_token, answer)

    return JSONResponse({"ok": True})


@app.get("/health")
async def health():
    REQUEST_COUNTER.labels(endpoint="/health").inc()
    return {"ok": True, "service": SERVICE_NAME}


@app.get("/ready")
async def ready():
    REQUEST_COUNTER.labels(endpoint="/ready").inc()
    return {"ok": True}


@app.get("/startup")
async def startup():
    REQUEST_COUNTER.labels(endpoint="/startup").inc()
    return await ready()


@app.get("/metrics")
async def metrics():
    payload = generate_latest()
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)
