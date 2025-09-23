# Web UI (Vite + Nginx) — DuDe Hawaiian

## รันด้วย Docker Compose
```bash
cd /Data/DuDe_Hawaiian
docker compose up -d --build webui
open http://localhost:3000
```

## การทำงาน
- เสิร์ฟไฟล์ static ด้วย Nginx
- แปลงเส้นทาง `/api/*` → reverse proxy ไป `front_dude:8080` ใน docker network
  - หมายเหตุ: โค้ดฝั่ง UI เรียก `fetch('/api/chat')` → เลี่ยงปัญหา CORS

## ปรับแต่ง
- ถ้าคุณเปลี่ยนพอร์ต Front ให้แก้ `webui/nginx/nginx.conf` ตรง `proxy_pass`
