# แผนผังเอเจ้นและวิธีตั้งค่าอย่างย่อ

## โครงสร้างขั้นต่ำที่แนะนำ
- 1 Conversation Agent: `frontdesk-agent` (ด่านหน้า)
- ตัวเลือกที่ 5: `health-agent` แยกออกมาเมื่อเริ่มใช้งานติดตามสุขภาพจริง

## เหตุผล
- รวมทุกอย่างไว้เอเจ้นเดียว → ง่าย แต่ความถนัดปะปนกัน ตอบไม่คม
- แยกตามหน้าที่ → จัดโมเดล/สิทธิ์/ทรัพยากรได้ตรงงาน และขยายภายหลังง่าย

## ขั้นตอนคอนฟิกใน Rowboat UI
1) ไปที่ **Agents → + Conversation Agent** สร้าง `frontdesk-agent`
   - Primary: `${PRIMARY_MODEL}`
   - Secondary: `${SECONDARY_MODEL}`
   - เปิดการเรียกใช้เอเจ้นอื่น (can call other agents)
   - แนบเนื้อหาไฟล์ `prompts/frontdesk-agent.md` เป็น System Prompt
   - อัปโหลด `agents/routing-rules.json` ให้ router ใช้

2) สร้าง **Task Agent** แต่ละตัวตาม `agents-blueprint.yaml`
   - `docs-agent`: เปิด Data Store (VECTOR_DB_PATH), ตั้ง Embed เป็น `${EMBED_MODEL}`
   - `web-api-agent`: เปิดเครื่องมือ http/web-search และกำหนด allowlist โดเมน
   - `planner-agent`: ใช้ `${SECONDARY_MODEL}`
   - (ตัวเลือก) `health-agent`: ผูกไฟล์ `data/health-tracker.json`

3) แท็บ **Tools**
   - เพิ่ม `HTTP` และ `Web Search` หากต้องการข้อมูลล่าสุด
   - เชื่อม Composio หรือ API อื่น โดยเก็บคีย์ไว้ใน `.env`

4) แท็บ **Data**
   - ชี้ไปที่ `${VECTOR_DB_PATH}` เพื่อเก็บเวกเตอร์ความจำเอกสาร
   - ใช้ embed `${EMBED_MODEL}`, เปิด rerank เมื่อมีโมเดล

5) แท็บ **Variables**
   - เพิ่มตัวแปรที่อิง `.env` เช่น `PRIMARY_MODEL`, `EMBED_MODEL`, `VECTOR_DB_PATH`, คีย์ภายนอก

6) แท็บ **Triggers**
   - หากต้องการงานตามเวลา/เหตุการณ์ ให้ตั้ง Recurring หรือ External triggers

## โมเดลที่ควรติดตั้งเพิ่ม
- แนะนำอัปเกรดจาก `qwen2.5:1.5b` → `qwen2.5:7b`
- เพิ่ม `llama3.1:8b-instruct` เป็นคู่คิดเชิงเหตุผล/วางแผน
- เพิ่ม `qwen2.5-coder:7b` สำหรับงานโค้ด
- ฝั่ง embedding ใช้ `nomic-embed-text` (หรือ `bge-m3` ถ้ามี)
- ใช้สคริปต์ `pull-models.sh` เพื่อดึงทั้งหมด

## ขนาดเอเจ้นเริ่มต้น
- เริ่ม 5 ตัว: frontdesk + (docs, web-api, dev, planner). เพิ่ม health เมื่อพร้อม
- ถ้าทรัพยากรจำกัด: เริ่ม 3 ตัวก่อน (frontdesk + docs + dev) แล้วค่อยขยาย

## ความปลอดภัย
- หมุนคีย์ที่เคยเผยแพร่ทันที (FALLBACK_PROVIDER_API_KEY)
- ปิด `ALLOW_SHELL_EXEC` เป็นค่าเริ่มต้น
- จำกัดโดเมนที่ web-api-agent เข้าถึงได้

