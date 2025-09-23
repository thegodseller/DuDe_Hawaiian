# DuDe Hawaiian Installation Report

## พอร์ตที่ใช้งาน
- 3000 (host) → webui (Docker, nginx serve static + proxy /api)
- 8090 (host) → front_dude (Docker, FastAPI gateway + SSE)
- 8081 (host) → doc_dude (Docker, FastAPI OCR/RAG)
- 8082 (host) → vision_dude (Docker, stub health)
- 8083 (host) → messenger_dude (Docker, stub health)
- 8084 (host) → medic_dude (Docker, stub health)
- 8005 (host) → chroma (Docker, vector DB API)
- 11434 (host) → Ollama บนเครื่องโฮสต์ (ขึ้นกับการติดตั้งผู้ใช้)

> ทุก service (ยกเว้น Ollama) ทำงานใน Docker container ตาม docker-compose.yml. Ollama เป็นบริการนอก Compose ที่ต้องรันบน host เอง

## ไทม์ไลน์งาน (2025-09)
- **23 ก.ย. 2025**
  - เตรียมโครงสร้าง Compose ให้เรียกใช้ `Dockerfile.ocr_igpu`
  - สร้าง Dockerfile.ocr_igpu สำหรับ Doc Dude พร้อม OpenVINO runtime + OCR models
  - แก้ปัญหา build ของ webui (`npm ci`) โดยอัปเดต package-lock
  - ทดสอบ build webui และ compose บางบริการ
- **24 ก.ย. 2025**
  - ปรับปรุง doc_dude ให้รองรับ OCR ภาพ/PDF/DOCX + embedding + Chroma ingestion และ JSON logging พร้อม Correlation-ID
  - ยกเครื่อง front_dude ให้ทำหน้าที่ gateway (SSE, rate limit, CORS, logging, health aggregator)
  - เพิ่ม logging middleware ให้ messenger_dude / medic_dude / vision_dude
  - ปรับ docker-compose.yml, เพิ่ม dependency ใน requirements, อัปเดต README และออกแบบ Web UI โฉมใหม่พร้อม streaming และปุ่มตรวจสุขภาพ
  - build docker images (doc_dude, front_dude) และทดสอบ npm build สำหรับ webui

