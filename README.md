# 🌸 Dude by Rowboat 🤖

> *"อาริกาโต๊ะ ก่อซาอิมาสุ! สวัสดีครับ ผม Dude เป็น AI ผู้ช่วยภาษาไทยแบบ Local-first นะครับ!"* 

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-pink.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Made with ❤️](https://img.shields.io/badge/Made%20with-❤️-red.svg?style=for-the-badge)](https://github.com/thegodseller/Dude-by-Rowboat)
[![Thai Language](https://img.shields.io/badge/Language-ภาษาไทย-blue.svg?style=for-the-badge)](https://th.wikipedia.org/wiki/ภาษาไทย)
[![Powered by Rowboat](https://img.shields.io/badge/Powered%20by-Rowboat-purple.svg?style=for-the-badge)](https://github.com/rowboatlabs/rowboat)

```
    🌸 さくら + 🇹🇭 ไทย = 🤖 Dude
  
∩───∩
  ( ◕   ◕ ) 
   (   ♡   )
    \__⌒__/
```

</div>

## ✨ Dude คืออะไรนะ? | What is Dude?

**Dude** เป็น AI ผู้ช่วยสุดน่ารักที่พูดภาษาไทยได้อย่างเก่ง! สร้างด้วยหัวใจของ **Rowboat Labs** และความรักของคนไทย 🥰

พัฒนาขึ้นเพื่อเป็นผู้ช่วยแบบ **Local-first** ที่ทำงานได้โดยไม่ต้องพึ่งพาอินเทอร์เน็ตตลอดเวลา - เหมาะสำหรับใครที่อยากมี AI ส่วนตัวที่ปลอดภัยและเป็นมิตร!

### 🎋 แนวคิด | Philosophy

```
🌸 Local-first → ข้อมูลคุณอยู่ที่คุณ
🎌 Privacy-focused → ความเป็นส่วนตัวสำคัญ  
🇹🇭 Thai-centric → เข้าใจวัฒนธรรมไทย
💝 Open Source → แบ่งปันด้วยหัวใจ
```

## 🚀 ความสามารถของ Dude | Features

### 🏮 **ผู้ช่วยหลัก** - **Frontdesk Agent**
- 🗣️ **คุยเป็นภาษาไทย** - เข้าใจบริบทไทย 100%
- 🧠 **ตอบคำถามได้เอง** - คำถามง่าย ๆ ไม่ต้องรอ
- 📚 **ค้นหาจากข้อมูล** - ใช้ RAG หาความรู้ภายใน
- 🌐 **ส่งต่อผู้เชี่ยวชาญ** - มีเอเจ้นต์พิเศษช่วย

### 🎎 **ทีมผู้เชี่ยวชาญ** - **Specialist Agents**

| เอเจ้นต์ | ความเชี่ยวชาญ | อีโมจิ |
|---------|-------------|--------|
| 📖 **docs-agent** | สรุปเอกสาร, ตอบคำถามจากไฟล์ | 📚 |
| 🌐 **web-api-agent** | ข้อมูลล่าสุดจากเว็บ | 🔍 |
| 📋 **planner-agent** | วางแผน, เป้าหมาย, Roadmap | 🗓️ |
| 💪 **health-agent** | สุขภาพ, ออกกำลังกาย | 🏃 |
| 💰 **finance-agent** | การเงิน, ลงทุน (แต่ไม่แนะนำซื้อ-ขาย) | 📊 |

### 🏺 **ความสามารถพิเศษ** - **Special Features**

```markdown
🎌 ภาษาไทยเท่านั้น    | Thai Only Policy
🏠 Local-first AI      | ทำงานในเครื่องคุณ
🔒 Privacy Protected   | ข้อมูลไม่หลุด
🌸 Kawaii Interface    | UI น่ารักแบบญี่ปุ่น
🤝 Multi-Agent        | หลายเอเจ้นต์ทำงานร่วมกัน
```

## 🛠️ ติดตั้งแบบง่าย ๆ | Easy Installation

### 📋 **สิ่งที่ต้องมี** | Requirements

```bash
🖥️  Ubuntu 24.04.3 LTS (แนะนำ)
🧠  RAM 12GB+ 
💾  Storage 128GB+ SSD
🔧  Docker + Docker Compose
🤖  Ollama (สำหรับ Local LLM)
```

### 🎯 **ติดตั้งแบบ One-Shot** | Quick Install

```bash
# 1. Clone โปรเจ็กต์
git clone https://github.com/thegodseller/Dude-by-Rowboat.git
cd Dude-by-Rowboat

# 2. Setup ครั้งแรก
./scripts/setup.sh

# 3. เริ่มใช้งาน
./scripts/start.sh

# 🎉 เสร็จแล้ว! เปิดบราวเซอร์ไปที่ http://localhost:3000
```

### 🔧 **ติดตั้งแบบละเอียด** | Detailed Setup

<details>
<summary>📖 คลิกเพื่ดูขั้นตอนละเอียด</summary>

```bash
# ติดตั้ง Dependencies
sudo apt update && sudo apt install -y docker.io docker-compose-plugin

# ดาวน์โหลด Ollama Models
ollama pull llama3.2:3b
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# Config Environment
cp .env.example .env
# แก้ไข .env ตามต้องการ

# เริ่ม Services
docker compose up -d

# ตรวจสอบสถานะ
docker compose ps
```

</details>

## 🎨 การใช้งาน | Usage

### 💬 **คุยกับ Dude แบบง่าย ๆ**

```
👤 คุณ: สวัสดี Dude!
🤖 Dude: สวัสดีครับ! ผม Dude ยินดีช่วยเหลือครับ 🌸

👤 คุณ: ช่วยวางแผนการทำงานให้หน่อย
🤖 Dude: ได้เลยครับ! ให้ส่งไปหา planner-agent ช่วยนะครับ...

👤 คุณ: หาข้อมูลเรื่อง AI ล่าสุด
🤖 Dude: เดี๋ยวหาให้นะครับ ผ่าน web-api-agent... 🔍
```

### 🎌 **LINE LIFF Integration**

Dude สามารถใช้งานผ่าน LINE LIFF ได้! ดูไฟล์ `line-liff-chat.html` สำหรับการตั้งค่า

## 🏗️ Architecture | สถาปัตยกรรม

```
🌸 User Interface (UI)
         ↓
🎋 Frontdesk Agent (ด่านหน้า)
         ↓
🎎 Specialist Agents
    ├── 📚 docs-agent
    ├── 🌐 web-api-agent  
    ├── 📋 planner-agent
    ├── 💪 health-agent
    └── 💰 finance-agent
         ↓
🏮 Local LLMs (Ollama)
    ├── llama3.2:3b
    ├── qwen2.5:7b
    └── nomic-embed-text
```

## 📁 โครงสร้างโฟลเดอร์ | Project Structure

```
Dude-by-Rowboat/
├── 🌸 README.md                 # คู่มือนี้แหละ!
├── 🎋 docker-compose.yml        # Docker services
├── 🎌 .env.example              # ตัวอย่าง config
├── 📂 scripts/                  # สคริปต์ setup
│   ├── setup.sh
│   ├── start.sh
│   └── stop.sh  
├── 📂 agents/                   # คอนฟิก agents
│   ├── frontdesk-agent.md
│   ├── docs-agent.md
│   └── ...
├── 📂 data/                     # ข้อมูล RAG
├── 📂 line-liff/               # LINE LIFF app
└── 📂 docs/                    # เอกสารต่าง ๆ
```

## 🤝 Contributing | มาร่วมพัฒนากัน!

เรายินดีรับการมีส่วนร่วมจากทุกคนนะครับ! 🥰

### 🎋 **วิธีช่วยเหลือ**

1. 🍴 **Fork** โปรเจ็กต์
2. 🌿 สร้าง **branch** ใหม่: `git checkout -b feature/amazing-feature`  
3. 💝 **Commit** การเปลี่ยนแปลง: `git commit -m 'Add amazing feature'`
4. 🚀 **Push** ไปยัง branch: `git push origin feature/amazing-feature`
5. 🌸 เปิด **Pull Request**

### 🏮 **Code of Conduct**

- 😊 **เป็นมิตร** - ใจเย็น ๆ นะครับ
- 🤗 **เคารพกัน** - ทุกคนมีความเห็นต่างกันได้
- 🌸 **สร้างสรรค์** - ช่วยกันทำให้ Dude ดีขึ้น
- 🎌 **โอเพ่นซอร์ส** - แบ่งปันด้วยหัวใจ

## 📜 License | ลิขสิทธิ์

โปรเจ็กต์นี้ใช้ **MIT License** - ดูไฟล์ [LICENSE](LICENSE) สำหรับรายละเอียด

```
🌸 ใช้ได้ฟรี | Free to use
🎋 แก้ไขได้ | Modifiable  
🏮 แจกจ่ายได้ | Redistributable
💝 ต้องระบุที่มา | Attribution required
```

## 🙏 Acknowledgments | กิตติกรรมประกาศ
- 🤖 Rowboat Labs — แพลตฟอร์มหลักที่สุดยอด  
- 🦙 Ollama — Local LLM ที่ใช้งานง่าย  
- 🌐 n8n — Automation ที่เจ๋ง  
- 🇹🇭 ชุมชนนักพัฒนาไทย — ที่ให้กำลังใจ  
- 🌸 ชุมชน Open Source — ที่แบ่งปันความรู้  
- 🕊️ **Nakarin Kwampian** — แรงบันดาลใจแรกที่ทำให้ dude ถือกำเนิดขึ้น
,เพราะ dude ก็คือนายนั่นแหละ

## 📞 ติดต่อ | Contact

- 📧 Email: chanukrit.kwa@thaimooc.ac.th
- 🐙 GitHub: [@thegodseller](https://github.com/thegodseller)
- 💬 Issues: [GitHub Issues](https://github.com/thegodseller/Dude-by-Rowboat/issues)

---

<div align="center">

### 🌸 ทำด้วยความรัก และความทรงจำ 🌸

**"AI สำหรับคนไทย🇹🇭 โดยวัยทอง"**

```
    🌸 ありがとうございます 🌸
         ขอบคุณครับ
    
    Made with ❤️ in Thailand
       Powered by Rowboat
```

⭐ **อย่าลืมกด Star ถ้าชอบนะครับ!** ⭐

</div>
