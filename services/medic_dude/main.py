from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from contextlib import suppress
from contextvars import ContextVar
from datetime import datetime
from typing import Dict, Optional

import httpx
from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter as PromCounter, generate_latest
from prometheus_client.parser import text_string_to_metric_families
from starlette.middleware.base import BaseHTTPMiddleware

SERVICE_NAME = "Medic Dude"

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
    "medic_dude_requests_total",
    "Request count for Medic Dude",
    ["endpoint"],
)
ALERT_COUNTER = PromCounter(
    "medic_dude_alerts_total",
    "จำนวนการแจ้งเตือนที่ Medic Dude ตรวจพบ",
    ["target", "reason"],
)

MONITOR_INTERVAL = float(os.getenv("MEDIC_MONITOR_INTERVAL", "30"))
ALERT_RAG_THRESHOLD = float(os.getenv("MEDIC_RAG_HIT_THRESHOLD", "0.4"))
ALERT_TOOL_FAILURE_THRESHOLD = float(os.getenv("MEDIC_TOOL_FAILURE_THRESHOLD", "0.2"))

DEFAULT_MONITOR_TARGETS = {
    "front_dude": "http://front_dude:8080/metrics",
    "doc_dude": "http://doc_dude:8080/metrics",
}


def _parse_monitor_targets(raw: Optional[str]) -> Dict[str, str]:
    if not raw:
        return DEFAULT_MONITOR_TARGETS
    targets: Dict[str, str] = {}
    for item in raw.split(","):
        if not item.strip():
            continue
        if ":" not in item:
            continue
        name, url = item.split(":", 1)
        targets[name.strip()] = url.strip()
    return targets or DEFAULT_MONITOR_TARGETS


METRICS_TARGETS = _parse_monitor_targets(os.getenv("MEDIC_MONITOR_TARGETS"))
monitor_task: Optional[asyncio.Task] = None
latest_observations: Dict[str, Dict[str, object]] = {}


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


@app.on_event("startup")
async def startup_event():
    global monitor_task
    monitor_task = asyncio.create_task(monitor_loop())
    logger.info(
        "startup",
        extra={"fields": {"targets": list(METRICS_TARGETS.keys())}},
    )


@app.on_event("shutdown")
async def shutdown_event():
    global monitor_task
    if monitor_task:
        monitor_task.cancel()
        with suppress(asyncio.CancelledError):
            await monitor_task


def get_correlation_id() -> Optional[str]:
    try:
        return request_id_ctx.get()
    except LookupError:
        return None


async def fetch_metrics(name: str, url: str) -> str:
    headers: Dict[str, str] = {}
    cid = get_correlation_id()
    if cid:
        headers["X-Correlation-ID"] = cid
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.text


def analyze_metrics(name: str, metrics_text: str) -> Dict[str, object]:
    observation: Dict[str, object] = {
        "ok": True,
        "checked_at": datetime.utcnow().isoformat(timespec="seconds"),
    }

    rag_hits = 0.0
    rag_total = 0.0
    tool_total = 0.0
    tool_fail = 0.0

    for family in text_string_to_metric_families(metrics_text):
        if family.name == "doc_dude_rag_results_total":
            for sample in family.samples:
                result = sample.labels.get("result")
                value = float(sample.value)
                if result == "hit":
                    rag_hits += value
                    rag_total += value
                elif result == "miss":
                    rag_total += value
        elif family.name == "front_dude_tool_calls_total":
            for sample in family.samples:
                status = sample.labels.get("status")
                value = float(sample.value)
                tool_total += value
                if status == "failed":
                    tool_fail += value

    if rag_total > 0:
        rag_rate = rag_hits / rag_total
        observation["rag_hit_rate"] = rag_rate
        if rag_rate < ALERT_RAG_THRESHOLD:
            observation["ok"] = False
            observation["rag_alert"] = f"rag_hit_rate {rag_rate:.2f}"
            ALERT_COUNTER.labels(target=name, reason="rag_hit_rate").inc()
            logger.warning(
                "rag_hit_rate_low",
                extra={"fields": {"target": name, "rag_hit_rate": rag_rate}},
            )

    if tool_total > 0:
        failure_rate = tool_fail / tool_total
        observation["tool_failure_rate"] = failure_rate
        if failure_rate > ALERT_TOOL_FAILURE_THRESHOLD:
            observation["ok"] = False
            observation["tool_alert"] = f"tool_failure_rate {failure_rate:.2f}"
            ALERT_COUNTER.labels(target=name, reason="tool_fail_rate").inc()
            logger.warning(
                "tool_failure_rate_high",
                extra={"fields": {"target": name, "failure_rate": failure_rate}},
            )

    return observation


async def monitor_loop() -> None:
    while True:
        try:
            for name, url in METRICS_TARGETS.items():
                observation = {
                    "target": name,
                    "metrics_url": url,
                }
                try:
                    text = await fetch_metrics(name, url)
                    derived = analyze_metrics(name, text)
                    observation.update(derived)
                except Exception as exc:
                    observation.update({"ok": False, "error": str(exc)})
                    ALERT_COUNTER.labels(target=name, reason="unreachable").inc()
                    logger.warning(
                        "metrics_fetch_failed",
                        extra={"fields": {"target": name, "error": str(exc)}},
                    )
                latest_observations[name] = observation
        except asyncio.CancelledError:  # pragma: no cover - shutdown
            break
        except Exception as exc:  # pragma: no cover - safeguard
            logger.exception("monitor_loop_error", extra={"fields": {"error": str(exc)}})
        await asyncio.sleep(MONITOR_INTERVAL)


@app.get("/health")
async def health():
    REQUEST_COUNTER.labels(endpoint="/health").inc()
    return {"ok": True, "service": SERVICE_NAME, "targets": list(METRICS_TARGETS.keys())}


@app.get("/ready")
async def ready():
    REQUEST_COUNTER.labels(endpoint="/ready").inc()
    return {"ok": True, "observations": latest_observations}


@app.get("/startup")
async def startup():
    REQUEST_COUNTER.labels(endpoint="/startup").inc()
    return await ready()


@app.get("/metrics")
async def metrics():
    payload = generate_latest()
    return Response(content=payload, media_type=CONTENT_TYPE_LATEST)
