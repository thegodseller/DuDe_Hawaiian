# ใช้ภาษาไทยในคอมเมนต์: Build Web UI (Vite React) ให้ผ่านแม้ package-lock ไม่ตรง
FROM node:20-alpine AS build

# 1) เตรียมโฟลเดอร์งาน
WORKDIR /app

# 2) ติดตั้ง dependency ตาม package.json (ไม่ใช้ npm ci)
#    - แยก COPY package.json/lock ก่อน เพื่อให้ layer cache ได้
COPY package.json package-lock.json ./
RUN npm install

# 3) คัดลอกซอร์สทั้งหมดแล้ว build
COPY . .
RUN npm run build

# 4) เสิร์ฟด้วย Nginx แบบ static + reverse proxy ถูกตั้งใน nginx.conf
FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
