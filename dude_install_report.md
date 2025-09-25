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
- **25 ก.ย. 2025**
  - เพิ่มระบบเลือก RAG อัตโนมัติ (Chroma ↔ Supermemory) ใน doc_dude พร้อมบันทึก trace ลง SQLite และปล่อย metrics (Prometheus)
  - ยกเครื่อง front_dude ให้ใช้ Tool Registry แบบ declarative, ตรวจ schema ผ่าน Pydantic, เก็บ metrics/trace, และเพิ่ม `/metrics`
  - ขยาย messenger_dude / medic_dude ให้ส่ง metrics JSON + correlation, เพิ่ม background monitor ใน Medic สำหรับอ่านค่าจาก service อื่นและแจ้งเตือน
  - เพิ่ม healthcheck ให้ทุก service ใน docker-compose.yml และเสริม requirements สำหรับ Prometheus client
  - เตรียม stack เพิ่มเติมใน `tHe_DuDe_service` ได้แก่ Frigate, Home Assistant, LINE Bot, n8n พร้อม compose/env/README สำหรับเชื่อมกับ DuDe
  - ตั้งค่า Cloudflare Tunnel (thegodseller.com) ด้วย config สำหรับ front_dude / linebot / n8n / homeassistant
  - เพิ่มสคริปต์ Context Engineering → JSON (`export_prps.py`) และคู่มือเชื่อมโยง playbook กับ DuDe
  - ปรับ `dude_yolov8` ให้มี README + `send_to_dude.py` สำหรับอัปโหลดผลตรวจจับเข้า DuDe
- **26 ก.ย. 2025**
  - สร้าง `dude-stack.yml` รวมบริการหลัก (front/doc/vision/messenger/medic + chroma) พร้อม volume/persistence และพอร์ตใหม่
  - พัฒนา `dude_control.py` (Tkinter) เป็นแผงควบคุม double-click สำหรับเปิด/ปิด/รีสตาร์ท service, ดู log ตาม module, และล้างไฟล์ขยะ
  - เสริม front_dude ด้วยระบบ multi-model router: config persistence (`model_router.json`), heuristics ตรวจโค้ด/ภาษาไทย, SSE routing event, และ API `/config/models`, `/router/preview`
  - ปรับ Web UI เพิ่มแท็บ “ตั้งค่า” ทางซ้ายให้ปรับ Multi-Model Setup, Routing, Memory, Context พร้อมแสดงเหตุผลการเลือกโมเดลในหน้าสนทนา
  - บันทึก Supermemory API key ลง `.env` เพื่อให้ doc_dude เรียกใช้งาน Supermemory backend ได้ทันที
  - เพิ่ม `FIRECRAWL_API_KEY` ลง `.env` เพื่อเตรียมพร้อมใช้งาน Firecrawl.dev สำหรับรวบรวมคอนเทนต์เข้าระบบ RAG
  - เปิดใช้งาน Intel oneAPI GPU ใน `doc_dude` (mount `/dev/dri`, ตั้ง `OV_DEVICE=GPU`) เพื่อเร่ง OpenVINO OCR
  - เพิ่มหน้า LIFF mini-app สำหรับอัปโหลดไฟล์ผ่าน LINE (เส้นทาง `/liff/upload`) พร้อม API proxy `/knowledge/upload`
  - ให้ LINE Bot ตอบลิงก์อัปโหลดเมื่อพิมพ์ "อัปโหลด"/"เพิ่มความรู้" และรับ metadata แนบกับไฟล์ที่ส่งเข้า RAG
  - ปรับ doc_dude ให้ fallback เป็นคำตอบว่างเมื่อ Supermemory ล่ม (ไม่ตัดการสนทนา) และเพิ่ม flag `fallback` ในผลลัพธ์
  - เชื่อมต่อ `messenger_dude` กับ LINE Messaging API (The DuDe Assistant) เพิ่ม webhook `/webhook/line` เรียก front_dude ตอบกลับ พร้อมตั้งค่า env `LINE_CHANNEL_SECRET` และ `LINE_CHANNEL_ACCESS_TOKEN`
