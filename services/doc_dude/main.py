"""Doc Dude OCR + Ingestion service with Intel iGPU (OpenVINO).
- รองรับ OCR สำหรับภาพ, PDF, DOCX
- สร้าง embedding และส่งเข้า Chroma
- มี logging แบบ JSON + Correlation-ID
- มี health / ready endpoint
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import time
import uuid
from contextvars import ContextVar
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import httpx
import numpy as np
from docx import Document
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from openvino.runtime import Core
from pdf2image import convert_from_bytes

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Logging utilities
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


def setup_logging(log_dir: Path | None = None) -> logging.Logger:
    logger = logging.getLogger("doc_dude")
    logger.setLevel(logging.INFO)
    formatter = JSONLogFormatter()

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    logger.handlers.clear()
    logger.addHandler(handler)

    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_dir / "doc_dude.log")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.error").handlers.clear()
    logging.getLogger("uvicorn").handlers.clear()
    logging.getLogger("uvicorn").addHandler(handler)
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    return logger


class CorrelationIdLoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, logger: logging.Logger) -> None:
        super().__init__(app)
        self.logger = logger

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(correlation_id)
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
# Configuration
# ---------------------------------------------------------------------------

OV_DEVICE = os.getenv("OV_DEVICE", "GPU")
OV_NUM_STREAMS = int(os.getenv("OV_NUM_STREAMS", "1"))
OV_CACHE_DIR = os.getenv("OV_CACHE_DIR", "/opt/ov_cache")
DET_THRESHOLD = float(os.getenv("OCR_DET_THRESHOLD", "0.3"))
MIN_BOX = int(os.getenv("OCR_MIN_BOX", "12"))
MAX_CANDIDATES = int(os.getenv("OCR_MAX_CANDIDATES", "300"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/data/ocr_uploads"))
LOG_DIR = Path(os.getenv("LOG_DIR", "/var/log/ocr"))

CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "doc_dude_knowledge")
EMBED_MODEL_NAME = os.getenv(
    "EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)
SUPER_MEMORY_WEBHOOK = os.getenv("SUPER_MEMORY_WEBHOOK")
SUPER_MEMORY_TOKEN = os.getenv("SUPER_MEMORY_TOKEN")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

logger = setup_logging(LOG_DIR)

app = FastAPI(title="Doc Dude OCR")
app.add_middleware(CorrelationIdLoggingMiddleware, logger=logger)


# ---------------------------------------------------------------------------
# OCR pipeline (OpenVINO)
# ---------------------------------------------------------------------------

MODEL_DIR = Path("/models")
DET_XML = MODEL_DIR / "text-detection-0004.xml"
REC_XML = MODEL_DIR / "text-recognition-0012.xml"

core = Core()
if OV_CACHE_DIR:
    core.set_property({"CACHE_DIR": OV_CACHE_DIR})

exec_config: Dict[str, str] = {}
if OV_DEVICE.upper() == "GPU" and OV_NUM_STREAMS > 0:
    # Intel GPU plugin 2024+ ไม่ต้องตั้งค่า GPU_THROUGHPUT_STREAMS แล้ว
    exec_config = {}
elif OV_DEVICE.upper() == "CPU":
    exec_config = {"CPU_THREADS_NUM": "4"}

try:
    det_model = core.read_model(str(DET_XML))
    rec_model = core.read_model(str(REC_XML))
    det_exec = core.compile_model(det_model, device_name=OV_DEVICE, config=exec_config)
    rec_exec = core.compile_model(rec_model, device_name=OV_DEVICE, config=exec_config)
except Exception as exc:  # pragma: no cover - startup failure handling
    logger.exception("openvino_initialization_failed")
    raise

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"


def _read_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("ไม่สามารถอ่านไฟล์ภาพได้")
    return img


def _prepare_det(img: np.ndarray) -> Tuple[np.ndarray, Tuple[float, int, int, Tuple[int, int]]]:
    target = 704
    h, w = img.shape[:2]
    scale = min(target / h, target / w)
    nh, nw = int(h * scale), int(w * scale)
    canvas = np.zeros((target, target, 3), dtype=np.uint8)
    top, left = (target - nh) // 2, (target - nw) // 2
    canvas[top : top + nh, left : left + nw] = cv2.resize(img, (nw, nh))
    gray = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    return gray[None, None, :, :], (scale, top, left, (h, w))


def _postprocess_det(mask_logits: np.ndarray, meta: Tuple[float, int, int, Tuple[int, int]]):
    scale, top, left, (oh, ow) = meta
    mask = (mask_logits.squeeze() > DET_THRESHOLD).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: List[Tuple[int, int, int, int]] = []
    for contour in contours[:MAX_CANDIDATES]:
        x, y, width, height = cv2.boundingRect(contour)
        if width < MIN_BOX or height < MIN_BOX:
            continue
        x0 = max(int((x - left) / scale), 0)
        y0 = max(int((y - top) / scale), 0)
        x1 = min(int((x + width - left) / scale), ow)
        y1 = min(int((y + height - top) / scale), oh)
        if x1 > x0 and y1 > y0:
            boxes.append((x0, y0, x1, y1))
    boxes.sort(key=lambda b: (b[1], b[0]))
    return boxes


def _prepare_rec(crop: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (100, 32)).astype(np.float32) / 255.0
    return resized[None, None, :, :]


def _ctc_decode(logits: np.ndarray) -> str:
    sequence = logits.argmax(axis=2)[0]
    blank = len(ALPHABET)
    out: List[str] = []
    prev = -1
    for s in sequence:
        s_int = int(s)
        if s_int != prev and s_int != blank and 0 <= s_int < len(ALPHABET):
            out.append(ALPHABET[s_int])
        prev = s_int
    return "".join(out)


def run_ocr(image: np.ndarray) -> List[Dict[str, object]]:
    det_input, meta = _prepare_det(image)
    det_output = det_exec([det_input])[det_exec.outputs[0]]
    boxes = _postprocess_det(det_output, meta)
    results: List[Dict[str, object]] = []
    for (x0, y0, x1, y1) in boxes:
        crop = image[y0:y1, x0:x1]
        rec_input = _prepare_rec(crop)
        rec_output = rec_exec([rec_input])[rec_exec.outputs[0]]
        text = _ctc_decode(rec_output).strip()
        if text:
            results.append({"box": [x0, y0, x1, y1], "text": text})
    return results


# ---------------------------------------------------------------------------
# Embedding & Chroma integration
# ---------------------------------------------------------------------------

_embedder: Optional[SentenceTransformer] = None
_chroma_client: Optional[chromadb.HttpClient] = None
_collections: Dict[str, chromadb.api.models.Collection.Collection] = {}


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        logger.info("loading_embedding_model", extra={"fields": {"model": EMBED_MODEL_NAME}})
        _embedder = SentenceTransformer(EMBED_MODEL_NAME)
    return _embedder


def get_chroma_client() -> chromadb.HttpClient:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.HttpClient(
            host=CHROMA_HOST,
            port=CHROMA_PORT,
            settings=Settings(allow_reset=False, anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection(name: str) -> chromadb.api.models.Collection.Collection:
    if name in _collections:
        return _collections[name]
    client = get_chroma_client()
    collection = client.get_or_create_collection(name=name)
    _collections[name] = collection
    return collection


def chunk_text(text: str, chunk_size: int = 650, overlap: int = 80) -> List[str]:
    clean = "\n".join(line.strip() for line in text.splitlines() if line.strip())
    if not clean:
        return []
    chunks: List[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunk = clean[start:end]
        chunks.append(chunk)
        if end == len(clean):
            break
        start = end - overlap
        if start < 0:
            start = 0
    return chunks


def format_sources(documents: List[str], metadatas: List[dict], distances: List[float]):
    sources = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        item = {
            "text": doc,
            "score": float(dist),
            "metadata": meta,
        }
        sources.append(item)
    return sources


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/bmp", "image/webp"}
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".pdf", ".docx"}


def detect_file_type(filename: str, content_type: str | None) -> str:
    ext = Path(filename or "").suffix.lower()
    if content_type in SUPPORTED_IMAGE_TYPES or ext in {".png", ".jpg", ".jpeg", ".bmp", ".webp"}:
        return "image"
    if content_type == "application/pdf" or ext == ".pdf":
        return "pdf"
    if content_type in {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"} or ext == ".docx":
        return "docx"
    raise HTTPException(status_code=415, detail="ไฟล์ที่อัปโหลดยังไม่รองรับ (รองรับ: png/jpg/webp/pdf/docx)")


async def save_upload(filename: str, data: bytes) -> Path:
    safe_name = f"{uuid.uuid4().hex}_{Path(filename).name}"
    path = UPLOAD_DIR / safe_name
    await asyncio.to_thread(path.write_bytes, data)
    return path


async def convert_pdf_to_images(data: bytes) -> List[np.ndarray]:
    pages = await asyncio.to_thread(convert_from_bytes, data, dpi=220)
    images = [cv2.cvtColor(np.array(page), cv2.COLOR_RGB2BGR) for page in pages]
    return images


def extract_docx_text(data: bytes) -> str:
    document = Document(io.BytesIO(data))
    lines = [para.text.strip() for para in document.paragraphs if para.text.strip()]
    return "\n".join(lines)


async def maybe_notify_supermemory(payload: dict) -> None:
    if not SUPER_MEMORY_WEBHOOK:
        return
    headers = {"Content-Type": "application/json"}
    if SUPER_MEMORY_TOKEN:
        headers["Authorization"] = f"Bearer {SUPER_MEMORY_TOKEN}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(SUPER_MEMORY_WEBHOOK, json=payload, headers=headers)
    except Exception as exc:  # pragma: no cover - external dependency
        logger.warning(
            "supermemory_webhook_failed",
            extra={"fields": {"error": str(exc)}},
        )


# ---------------------------------------------------------------------------
# FastAPI routes
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    logger.info(
        "startup",
        extra={
            "fields": {
                "device": OV_DEVICE,
                "streams": OV_NUM_STREAMS,
                "chroma_host": CHROMA_HOST,
                "chroma_port": CHROMA_PORT,
                "collection": CHROMA_COLLECTION,
            }
        },
    )
    # Warm up embedder & collection
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, get_embedder)
    await loop.run_in_executor(None, get_collection, CHROMA_COLLECTION)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "device": OV_DEVICE,
        "streams": OV_NUM_STREAMS,
        "collection": CHROMA_COLLECTION,
    }


@app.get("/ready")
async def ready():
    try:
        collection = get_collection(CHROMA_COLLECTION)
        count = collection.count()
        return {
            "ok": True,
            "collection": CHROMA_COLLECTION,
            "documents": count,
            "embed_model": EMBED_MODEL_NAME,
        }
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/startup")
async def startup_status():
    return await ready()


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
    try:
        img = _read_image(raw)
        items = run_ocr(img)
        return JSONResponse({"ok": True, "count": len(items), "items": items})
    except Exception as exc:
        logger.exception("ocr_failed", extra={"fields": {"filename": file.filename}})
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/ingest")
async def ingest(file: UploadFile = File(...), collection: Optional[str] = None, request: Request | None = None):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")

    target_collection = collection or CHROMA_COLLECTION
    file_type = detect_file_type(file.filename, file.content_type)
    saved_path = await save_upload(file.filename or "upload", raw)
    doc_id = uuid.uuid4().hex
    correlation_id = request.headers.get("X-Correlation-ID") if request else None

    pages: List[Dict[str, object]] = []
    if file_type == "image":
        img = _read_image(raw)
        ocr_items = run_ocr(img)
        text = "\n".join(item["text"] for item in ocr_items)
        pages.append({"page": 1, "text": text, "ocr": ocr_items})
    elif file_type == "pdf":
        images = await convert_pdf_to_images(raw)
        for idx, image in enumerate(images, start=1):
            ocr_items = run_ocr(image)
            text = "\n".join(item["text"] for item in ocr_items)
            pages.append({"page": idx, "text": text, "ocr": ocr_items})
    elif file_type == "docx":
        text = extract_docx_text(raw)
        if not text:
            raise HTTPException(status_code=422, detail="DOCX ไม่มีข้อความให้ประมวลผล")
        pages.append({"page": 1, "text": text, "ocr": []})
    else:
        raise HTTPException(status_code=415, detail="ไฟล์ยังไม่รองรับ")

    all_chunks: List[str] = []
    metadata: List[dict] = []
    for page in pages:
        page_text: str = page["text"] or ""
        chunks = chunk_text(page_text)
        for idx, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            metadata.append(
                {
                    "document_id": doc_id,
                    "filename": file.filename,
                    "storage_path": str(saved_path),
                    "page": page.get("page", 1),
                    "chunk": idx,
                    "correlation_id": correlation_id,
                    "file_type": file_type,
                }
            )

    if not all_chunks:
        raise HTTPException(status_code=422, detail="ไม่พบข้อความจากไฟล์ที่อัปโหลด")

    embedder = get_embedder()
    loop = asyncio.get_running_loop()
    embeddings = await loop.run_in_executor(
        None, lambda: embedder.encode(all_chunks, convert_to_numpy=True)
    )
    collection_obj = get_collection(target_collection)
    chunk_ids = [f"{doc_id}:{meta['page']}:{meta['chunk']}" for meta in metadata]
    collection_obj.add(ids=chunk_ids, embeddings=embeddings.tolist(), documents=all_chunks, metadatas=metadata)

    payload = {
        "ok": True,
        "document_id": doc_id,
        "chunks": len(all_chunks),
        "collection": target_collection,
        "filename": file.filename,
        "saved_path": str(saved_path),
    }

    await maybe_notify_supermemory(
        {
            "document_id": doc_id,
            "filename": file.filename,
            "collection": target_collection,
            "chunks": len(all_chunks),
        }
    )

    logger.info(
        "ingest_completed",
        extra={
            "extra": {
                "document_id": doc_id,
                "collection": target_collection,
                "chunks": len(all_chunks),
                "filename": file.filename,
            }
        },
    )

    return JSONResponse(payload)


@app.post("/query")
async def query(payload: dict):
    question = payload.get("q") or payload.get("question")
    if not question:
        raise HTTPException(status_code=400, detail="ต้องระบุคำถาม q")
    top_k = int(payload.get("top_k", 4))
    collection_name = payload.get("collection") or CHROMA_COLLECTION
    collection_obj = get_collection(collection_name)

    results = collection_obj.query(query_texts=[question], n_results=top_k, include=["documents", "metadatas", "distances"])
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    sources = format_sources(documents, metadatas, distances)

    if documents:
        summary_parts = []
        for source in sources:
            meta = source["metadata"]
            snippet = source["text"][:180].replace("\n", " ")
            summary_parts.append(f"(หน้า {meta.get('page', '?')}) {snippet}")
        answer = " \n".join(summary_parts)
    else:
        answer = "ยังไม่พบข้อมูลที่เกี่ยวข้องในฐานความรู้"

    response = {
        "ok": True,
        "q": question,
        "answer": answer,
        "sources": sources,
        "collection": collection_name,
        "count": len(documents),
    }
    return JSONResponse(response)


@app.get("/collections")
async def list_collections():
    client = get_chroma_client()
    colls = client.list_collections()
    return {"collections": [c.name for c in colls]}
