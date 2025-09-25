#!/usr/bin/env python3
"""Interactive control panel for DuDe Hawaiian services.

Double-click or execute this script to open a GTK-less Tkinter menu that lets
you start/stop/restart stacks, inspect logs, and remove temporary caches.  The
script delegates all service orchestration to docker compose using the
``dude-stack.yml`` file that lives next to this script.
"""
from __future__ import annotations

import json
import queue
import shutil
import subprocess
import threading
import tkinter as tk
import tkinter.ttk as ttk
from datetime import datetime
from pathlib import Path
from tkinter import messagebox
from typing import Dict, Iterable, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent
COMPOSE_FILE = PROJECT_ROOT / "dude-stack.yml"

PRIMARY_GROUP = ["medic_dude", "chroma", "doc_dude", "front_dude"]
VISION_GROUP = ["medic_dude", "vision_dude", "messenger_dude"]
ALL_SERVICES = [
    "medic_dude",
    "doc_dude",
    "front_dude",
    "messenger_dude",
    "vision_dude",
    "chroma",
]

SERVICE_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "front_dude": {
        "emoji": "🧭",
        "title": "Front Dude (Gateway)",
        "detail": "FastAPI gateway รวม RAG / intelligent routing / LINE webhook ที่พอร์ต 18080",
    },
    "doc_dude": {
        "emoji": "📚",
        "title": "Doc Dude",
        "detail": "บริการ RAG + OCR (OpenVINO) จัดการ ingest และค้นเอกสาร",
    },
    "messenger_dude": {
        "emoji": "💬",
        "title": "Messenger Dude",
        "detail": "Bridge ไปยัง LINE / ช่องทางแชทอื่น ๆ",
    },
    "vision_dude": {
        "emoji": "👁️",
        "title": "Vision Dude",
        "detail": "งาน vision / วิเคราะห์ภาพ (เช่น YOLO / LLaVA) พร้อม OCR",
    },
    "medic_dude": {
        "emoji": "🩺",
        "title": "Medic Dude",
        "detail": "Health monitor + self-healing ช่วยเช็ก service อื่น ๆ",
    },
    "chroma": {
        "emoji": "🗄️",
        "title": "Chroma Vector DB",
        "detail": "Vector store เก็บ embedding ของ Doc Dude",
    },
}

HOST_SERVICES: List[Dict[str, str]] = [
    {
        "name": "ollama",
        "display": "Ollama (Host) 🧠",
        "unit": "ollama.service",
        "scope": "system",
        "description": "เซิร์ฟเวอร์โมเดลบนโฮสต์ เปิดที่ http://localhost:11434",
    },
    {
        "name": "cloudflared",
        "display": "Cloudflare Tunnel ☁️",
        "unit": "cloudflared.service",
        "scope": "system",
        "description": "เปิดอุโมงค์ webhook.thegodseller.com สำหรับ LINE",
    },
]

HOST_SERVICE_BY_NAME = {svc["name"]: svc for svc in HOST_SERVICES}

CMD_QUEUE: "queue.Queue[tuple[str, int, str, str]]" = queue.Queue()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def compose_command(*extra: str) -> list[str]:
    base = ["docker", "compose", "-f", str(COMPOSE_FILE)]
    return base + list(extra)


def systemctl_command(action: str, service: Dict[str, str]) -> list[str]:
    cmd = ["systemctl"]
    if service.get("scope") == "user":
        cmd.append("--user")
    cmd.extend([action, service["unit"]])
    return cmd


def run_async(label: str, *compose_args: str) -> None:
    """Run docker compose command in a worker thread and queue the result."""

    def worker() -> None:
        try:
            proc = subprocess.run(
                compose_command(*compose_args),
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            CMD_QUEUE.put((label, proc.returncode, proc.stdout, proc.stderr))
        except FileNotFoundError as exc:
            CMD_QUEUE.put((label, -1, "", f"ไม่พบคำสั่ง: {exc}"))
        except Exception as exc:  # pragma: no cover - protective guard
            CMD_QUEUE.put((label, -1, "", f"เกิดข้อผิดพลาด: {exc}"))

    threading.Thread(target=worker, daemon=True).start()


def run_host_async(label: str, command: Iterable[str]) -> None:
    """Execute a host-level command (e.g. systemctl) asynchronously."""

    def worker() -> None:
        try:
            proc = subprocess.run(
                list(command),
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            CMD_QUEUE.put((label, proc.returncode, proc.stdout, proc.stderr))
        except FileNotFoundError as exc:
            CMD_QUEUE.put((label, -1, "", f"ไม่พบคำสั่ง: {exc}"))
        except Exception as exc:  # pragma: no cover - protective guard
            CMD_QUEUE.put((label, -1, "", f"เกิดข้อผิดพลาด: {exc}"))

    threading.Thread(target=worker, daemon=True).start()


def append_log(widget: tk.Text, message: str) -> None:
    widget.configure(state="normal")
    widget.insert(tk.END, message + "\n")
    widget.see(tk.END)
    widget.configure(state="disabled")


# ---------------------------------------------------------------------------
# Status helpers
# ---------------------------------------------------------------------------


def _friendly_state(state: str) -> str:
    mapping = {
        "running": "กำลังทำงาน",
        "exited": "หยุดแล้ว",
        "paused": "หยุดชั่วคราว",
        "dead": "ตายแล้ว",
    }
    return mapping.get(state.lower(), state)


def fetch_compose_status() -> List[Dict[str, str]]:
    cmd = compose_command("ps", "--format", "json")
    try:
        proc = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True, check=True)
        data = json.loads(proc.stdout or "[]")
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        # fallback to plain text output
        proc = subprocess.run(compose_command("ps"), cwd=PROJECT_ROOT, capture_output=True, text=True, check=False)
        lines = proc.stdout.strip().splitlines()[2:]
        data = []
        for line in lines:
            parts = line.split()
            if not parts:
                continue
            name = parts[0]
            state = parts[4] if len(parts) > 4 else "unknown"
            service = name.split("-")[-1]
            data.append({
                "Name": name,
                "Service": service,
                "State": state,
                "Status": " ".join(parts[4:]) if len(parts) > 4 else state,
                "Ports": "",
            })
    results = []
    for entry in data:
        service = entry.get("Service") or entry.get("name") or "?"
        state = entry.get("State") or entry.get("state") or "unknown"
        status = entry.get("Status") or entry.get("status") or state
        ports = entry.get("Publishers") or entry.get("Ports") or ""
        results.append(
            {
                "service": service,
                "state": _friendly_state(state),
                "raw_state": state,
                "detail": status,
                "ports": ports,
                "type": "docker",
            }
        )
    return results


def parse_systemctl_props(payload: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for line in payload.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            result[key.strip()] = value.strip()
    return result


def fetch_host_statuses() -> List[Dict[str, str]]:
    statuses: List[Dict[str, str]] = []
    if shutil.which("systemctl") is None:
        return statuses
    for svc in HOST_SERVICES:
        cmd = systemctl_command("show", svc) + ["--property", "ActiveState,SubState,ActiveEnterTimestamp", "--no-page"]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if proc.returncode != 0:
                state = proc.stderr.strip() or "ไม่พบข้อมูล"
                statuses.append(
                    {
                        "service": svc["name"],
                        "display": svc["display"],
                        "state": state,
                        "raw_state": "error",
                        "detail": state,
                        "type": "host",
                        "description": svc.get("description", ""),
                    }
                )
                continue
            props = parse_systemctl_props(proc.stdout)
            state = props.get("ActiveState", "unknown")
            sub = props.get("SubState", "")
            entered = props.get("ActiveEnterTimestamp", "")
            if entered:
                try:
                    parsed = datetime.strptime(entered, "%a %Y-%m-%d %H:%M:%S %Z")
                    entered = parsed.strftime("%d %b %Y %H:%M")
                except ValueError:
                    entered = entered
            statuses.append(
                {
                    "service": svc["name"],
                    "display": svc["display"],
                    "state": _friendly_state(state),
                    "raw_state": state,
                    "detail": f"{sub or state} @ {entered}" if entered else sub or state,
                    "type": "host",
                    "description": svc.get("description", ""),
                }
            )
        except Exception as exc:  # pragma: no cover - defensive
            statuses.append(
                {
                    "service": svc["name"],
                    "display": svc["display"],
                    "state": "เกิดข้อผิดพลาด",
                    "raw_state": "error",
                    "detail": str(exc),
                    "type": "host",
                    "description": svc.get("description", ""),
                }
            )
    return statuses


def _sanitize_value(value: str) -> str:
    if not value:
        return "-"
    if len(value) > 48:
        return value[:45] + "..."
    return value


def load_env_snapshot() -> Dict[str, str]:
    env_path = PROJECT_ROOT / ".env"
    snapshot: Dict[str, str] = {}
    if not env_path.exists():
        return snapshot
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.upper().endswith("TOKEN") or key.upper().endswith("SECRET"):
            snapshot[key] = "(ซ่อน)"
        else:
            snapshot[key] = _sanitize_value(value)
    return snapshot

# ---------------------------------------------------------------------------
# Log window
# ---------------------------------------------------------------------------


class LogWindow:
    def __init__(self, master: tk.Tk, service: str) -> None:
        self.service = service
        self.window = tk.Toplevel(master)
        self.window.title(f"Log: {service}")
        self.window.geometry("720x440")
        self.text = tk.Text(self.window, bg="#101418", fg="#f0f4f8")
        self.text.pack(fill=tk.BOTH, expand=True)
        self.text.insert(tk.END, f"กำลังเปิด log ของ {service}\n\n")
        self.text.configure(state="disabled")
        self.process: subprocess.Popen[str] | None = None
        self._stop_event = threading.Event()
        self.window.protocol("WM_DELETE_WINDOW", self.close)
        threading.Thread(target=self._stream_logs, daemon=True).start()

    def _stream_logs(self) -> None:
        try:
            self.process = subprocess.Popen(
                compose_command("logs", "-f", self.service),
                cwd=PROJECT_ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
        except FileNotFoundError as exc:
            self._write(f"ไม่พบคำสั่ง: {exc}")
            return
        except Exception as exc:  # pragma: no cover - protective guard
            self._write(f"เปิด log ไม่สำเร็จ: {exc}")
            return

        assert self.process.stdout is not None
        for line in self.process.stdout:
            if self._stop_event.is_set():
                break
            self._write(line.rstrip())
        self._write("\nสิ้นสุด log")

    def _write(self, message: str) -> None:
        def _append() -> None:
            self.text.configure(state="normal")
            self.text.insert(tk.END, message + "\n")
            self.text.see(tk.END)
            self.text.configure(state="disabled")

        self.window.after(0, _append)

    def close(self) -> None:
        self._stop_event.set()
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.window.destroy()


class CommandOutputWindow:
    def __init__(self, title: str, command: Iterable[str]) -> None:
        self.window = tk.Toplevel()
        self.window.title(title)
        self.window.geometry("720x460")
        self.text = tk.Text(self.window, bg="#111827", fg="#e0f2fe")
        self.text.pack(fill=tk.BOTH, expand=True)
        self.text.insert(tk.END, f"คำสั่ง: {' '.join(command)}\n\n")
        self.text.configure(state="disabled")
        threading.Thread(target=self._run, args=(list(command),), daemon=True).start()

    def _run(self, command: List[str]) -> None:
        try:
            proc = subprocess.run(command, capture_output=True, text=True, check=False)
            stdout = proc.stdout or ""
            stderr = proc.stderr or ""
            exit_code = proc.returncode
        except Exception as exc:  # pragma: no cover
            stdout = ""
            stderr = str(exc)
            exit_code = -1

        def updater() -> None:
            self.text.configure(state="normal")
            if stdout:
                self.text.insert(tk.END, stdout)
            if stderr:
                self.text.insert(tk.END, "\n[stderr]\n" + stderr)
            self.text.insert(tk.END, f"\n(exit code {exit_code})")
            self.text.configure(state="disabled")

        self.window.after(0, updater)


# ---------------------------------------------------------------------------
# GUI actions
# ---------------------------------------------------------------------------


def open_stack(log_widget: tk.Text) -> None:
    dialog = tk.Toplevel()
    dialog.title("เปิดบริการ")
    dialog.geometry("420x240")
    dialog.configure(bg="#fff7ed")

    tk.Label(
        dialog,
        text="เลือกชุดบริการที่ต้องการเปิด",
        font=("Tahoma", 12, "bold"),
        bg="#fff7ed",
    ).pack(pady=10)

    hint = tk.Label(
        dialog,
        text="🌈 ปรับใช้ docker compose แบบเดียวกับการรันในเทอร์มินัล",
        font=("Tahoma", 10),
        fg="#7c3aed",
        bg="#fff7ed",
    )
    hint.pack(pady=(0, 12))

    def start_primary() -> None:
        append_log(log_widget, "⏳ กำลังเปิด medic + doc + front (พร้อม chroma)")
        run_async("เปิด Front & Doc", "up", "-d", "--build", *PRIMARY_GROUP)

    def start_vision() -> None:
        append_log(log_widget, "⏳ กำลังเปิด medic + vision + messenger")
        run_async("เปิด Vision & Messenger", "up", "-d", "--build", *VISION_GROUP)

    def start_front_only() -> None:
        append_log(log_widget, "⏳ กำลังเปิด front_dude (พร้อม build)")
        run_async("เปิด front_dude", "up", "-d", "--build", "front_dude")

    def start_doc_only() -> None:
        append_log(log_widget, "⏳ กำลังเปิด doc_dude (พร้อม medic)")
        run_async("เปิด doc_dude", "up", "-d", "--build", "medic_dude", "doc_dude")

    button_style = {
        "width": 34,
        "bg": "#fde68a",
        "activebackground": "#fcd34d",
        "fg": "#7c2d12",
        "font": ("Tahoma", 11, "bold"),
        "relief": tk.RAISED,
    }

    tk.Button(dialog, text="🚀 Front Dude + Doc Dude", command=start_primary, **button_style).pack(pady=5)
    tk.Button(dialog, text="🖼️ Vision Mode + Messenger", command=start_vision, **button_style).pack(pady=5)
    tk.Button(dialog, text="🎯 เฉพาะ Front Dude", command=start_front_only, **button_style).pack(pady=5)
    tk.Button(dialog, text="📄 เฉพาะ Doc Dude", command=start_doc_only, **button_style).pack(pady=5)
    tk.Button(dialog, text="ปิดหน้าต่าง", command=dialog.destroy, width=20).pack(pady=10)


def stop_all(log_widget: tk.Text) -> None:
    if not messagebox.askyesno("ยืนยัน", "ต้องการปิดทุกบริการหรือไม่?"):
        return
    append_log(log_widget, "⏳ กำลังหยุดทุกบริการ")
    run_async("ปิดทุกบริการ", "stop", *ALL_SERVICES)


def restart_all(log_widget: tk.Text) -> None:
    append_log(log_widget, "⏳ รีสตาร์ททุกบริการ")
    run_async("รีสตาร์ท", "restart", *ALL_SERVICES)


def show_logs(master: tk.Tk) -> None:
    chooser = tk.Toplevel(master)
    chooser.title("เลือกบริการที่ต้องการดู log")
    chooser.geometry("300x320")

    tk.Label(chooser, text="เลือกบริการ", font=("Tahoma", 11)).pack(pady=10)

    for svc in ALL_SERVICES:
        tk.Button(
            chooser,
            text=svc,
            width=24,
            command=lambda name=svc: LogWindow(master, name),
        ).pack(pady=4)

    tk.Button(chooser, text="ปิดหน้าต่าง", command=chooser.destroy).pack(pady=12)


def clean_junk(log_widget: tk.Text) -> None:
    if not messagebox.askyesno(
        "ยืนยัน",
        "ต้องการล้างไฟล์ขยะ (pyc / __pycache__ / log เก่า) หรือไม่?",
    ):
        return

    removed = []
    for cache_dir in PROJECT_ROOT.rglob("__pycache__"):
        try:
            shutil.rmtree(cache_dir)
            removed.append(str(cache_dir))
        except OSError:
            continue
    for pyc_file in PROJECT_ROOT.rglob("*.py[co]"):
        try:
            pyc_file.unlink()
            removed.append(str(pyc_file))
        except OSError:
            continue
    ocr_log_dir = PROJECT_ROOT / "data" / "ocr_logs"
    if ocr_log_dir.is_dir():
        for log_file in ocr_log_dir.glob("*.log"):
            try:
                log_file.unlink()
                removed.append(str(log_file))
            except OSError:
                continue

    append_log(log_widget, f"✨ ทำความสะอาดเสร็จสิ้น ({len(removed)} รายการ)")


def open_info_window() -> None:
    window = tk.Toplevel()
    window.title("DuDe Hawaiian Info")
    window.geometry("640x520")
    window.configure(bg="#fef9ff")

    tk.Label(
        window,
        text="DuDe Hawaiian – System Map",
        font=("Tahoma", 14, "bold"),
        fg="#6d28d9",
        bg="#fef9ff",
    ).pack(pady=10)

    info_text = tk.Text(window, wrap="word", bg="#ede9fe", fg="#1e1b4b", font=("Tahoma", 10))
    info_text.pack(fill=tk.BOTH, expand=True, padx=16, pady=12)
    info_text.insert(
        tk.END,
        "🌺 โครงสร้างหลัก\n"
        f"• โฟลเดอร์โปรเจ็กต์: {PROJECT_ROOT}\n"
        f"• Docker Compose: {COMPOSE_FILE}\n"
        "• Web UI (React): webui/ → เสิร์ฟด้วย container dude_hawaiian-webui (พอร์ต 3000)\n"
        "• Front API: front_dude (FastAPI) → http://localhost:18080 /webhook/line, /chat, /config/*\n"
        "• Doc Dude API: doc_dude → http://localhost:28080 สำหรับ ingest / OCR\n"
        "• Messenger Dude: สะพานไป LINE, รับ webhook จาก front_dude\n"
        "• MCP / Tools: ลงทะเบียนใน front_dude → tool registry เรียก doc_dude, medic_dude\n"
        "• Host services: Ollama + Cloudflare tunnel ทำงานนอก docker\n\n"
    )

    env_snapshot = load_env_snapshot()
    if env_snapshot:
        info_text.insert(tk.END, "🛠️ ENV เด่น ๆ (อ่านจาก .env)\n")
        highlight_keys = [
            "TZ",
            "OLLAMA_BASE_URL",
            "LLM_COPILOT",
            "LLM_PRIMARY",
            "LLM_EMBEDDING",
            "VECTOR_DB",
            "DOC_DUDE_URL",
            "FRONT_DUDE_URL",
            "LINE_CHANNEL_SECRET",
            "LINE_CHANNEL_ACCESS_TOKEN",
            "LINE_LIFF_UPLOAD_URL",
        ]
        for key in highlight_keys:
            if key in env_snapshot:
                info_text.insert(tk.END, f"• {key}: {env_snapshot[key]}\n")
        info_text.insert(tk.END, "...ดูเพิ่มเติมได้ที่ไฟล์ .env\n\n")
    else:
        info_text.insert(tk.END, "ไม่พบไฟล์ .env ในโปรเจ็กต์\n\n")

    info_text.insert(tk.END, "🤖 Agent & Service Roles\n")
    for svc, meta in SERVICE_DESCRIPTIONS.items():
        info_text.insert(
            tk.END,
            f"{meta.get('emoji', '•')} {meta.get('title', svc)}\n    {meta.get('detail', '')}\n",
        )
    if HOST_SERVICES:
        info_text.insert(tk.END, "\n🖥️ Host Services\n")
        for item in HOST_SERVICES:
            info_text.insert(
                tk.END,
                f"• {item['display']}: {item.get('description', '')} (systemctl {item.get('scope', 'system')})\n",
            )

    info_text.insert(
        tk.END,
        "\n💡 Tips\n"
        "• ปุ่มนี้อ่าน config ล่าสุดโดยไม่แก้ไขไฟล์\n"
        "• คำสั่ง docker compose ทุกปุ่มใช้ไฟล์ dude-stack.yml เช่นเดียวกับเวลารันในเทอร์มินัล\n"
        "• ถ้าต้องการเพิ่มบริการหรือคำอธิบาย ปรับที่ HOST_SERVICES หรือ SERVICE_DESCRIPTIONS ได้เลย\n",
    )
    info_text.configure(state="disabled")

    tk.Button(window, text="ปิด", command=window.destroy).pack(pady=8)


class ServiceMonitorWindow:
    def __init__(self, master: tk.Tk, log_widget: tk.Text) -> None:
        self.master = master
        self.log_widget = log_widget
        self.window = tk.Toplevel(master)
        self.window.title("Service Monitor")
        self.window.geometry("720x560")
        self.window.configure(bg="#ecfeff")

        tk.Label(
            self.window,
            text="สถานะบริการ DuDe Hawaiian",
            font=("Tahoma", 13, "bold"),
            fg="#0f172a",
            bg="#ecfeff",
        ).pack(pady=10)

        self.tree = ttk.Treeview(self.window, columns=("service", "state", "detail", "group"), show="headings")
        self.tree.heading("service", text="บริการ")
        self.tree.heading("state", text="สถานะ")
        self.tree.heading("detail", text="รายละเอียด")
        self.tree.heading("group", text="กลุ่ม")
        self.tree.column("service", width=200, anchor="w")
        self.tree.column("state", width=140, anchor="center")
        self.tree.column("detail", width=300, anchor="w")
        self.tree.column("group", width=80, anchor="center")
        self.tree.pack(fill=tk.BOTH, expand=True, padx=16, pady=8)
        self.records: Dict[str, Dict[str, str]] = {}
        self.tree.bind("<<TreeviewSelect>>", lambda _: self._show_detail())

        self.detail_box = tk.Text(
            self.window,
            height=6,
            bg="#0f172a",
            fg="#e0f2fe",
            wrap="word",
            font=("Tahoma", 10),
        )
        self.detail_box.pack(fill=tk.X, padx=16, pady=(0, 10))
        self.detail_box.configure(state="disabled")

        btn_frame = tk.Frame(self.window, bg="#ecfeff")
        btn_frame.pack(pady=6)

        tk.Button(btn_frame, text="รีเฟรช", width=12, command=self.refresh, bg="#7dd3fc").grid(row=0, column=0, padx=5, pady=4)
        tk.Button(btn_frame, text="เริ่ม", width=12, command=self.start_selected, bg="#bbf7d0").grid(row=0, column=1, padx=5, pady=4)
        tk.Button(btn_frame, text="หยุด", width=12, command=self.stop_selected, bg="#fecaca").grid(row=0, column=2, padx=5, pady=4)
        tk.Button(btn_frame, text="รีสตาร์ท", width=12, command=self.restart_selected, bg="#fef08a").grid(row=0, column=3, padx=5, pady=4)
        tk.Button(btn_frame, text="ดู Log", width=12, command=self.open_logs, bg="#ddd6fe").grid(row=0, column=4, padx=5, pady=4)

        self.status_label = tk.Label(self.window, text="", bg="#ecfeff", fg="#0369a1")
        self.status_label.pack(pady=(0, 8))

        self.refresh()

    def refresh(self) -> None:
        self.status_label.config(text="กำลังรีเฟรชสถานะ...")
        threading.Thread(target=self._refresh_worker, daemon=True).start()

    def _refresh_worker(self) -> None:
        docker = fetch_compose_status()
        host = fetch_host_statuses()
        self.window.after(0, lambda: self._populate(docker, host))

    def _populate(self, docker: List[Dict[str, str]], host: List[Dict[str, str]]) -> None:
        self.tree.delete(*self.tree.get_children())
        self.records.clear()
        for entry in docker:
            svc = entry["service"]
            meta = SERVICE_DESCRIPTIONS.get(svc, {})
            display = f"{meta.get('emoji', '🐳')} {meta.get('title', svc)}"
            item_id = self.tree.insert(
                "",
                tk.END,
                values=(display, entry["state"], entry["detail"], "Docker"),
            )
            self.records[item_id] = {**entry, "display": display}

        for entry in host:
            display = entry.get("display", entry["service"])
            item_id = self.tree.insert(
                "",
                tk.END,
                values=(display, entry["state"], entry["detail"], "Host"),
            )
            self.records[item_id] = {**entry, "display": display}

        if not self.records:
            self.status_label.config(text="ไม่พบข้อมูลบริการ")
        else:
            self.status_label.config(text=f"มีบริการทั้งหมด {len(self.records)} รายการ")
        self._show_detail()

    def _selected_record(self) -> Optional[Dict[str, str]]:
        selection = self.tree.selection()
        if not selection:
            return None
        return self.records.get(selection[0])

    def _show_detail(self) -> None:
        record = self._selected_record()
        self.detail_box.configure(state="normal")
        self.detail_box.delete("1.0", tk.END)
        if record:
            lines = [f"บริการ: {record.get('display', record.get('service'))}"]
            lines.append(f"สถานะ: {record.get('state')} ({record.get('detail')})")
            if record.get("type") == "docker" and record.get("ports"):
                lines.append(f"พอร์ต: {record['ports']}")
            if record.get("type") == "host" and record.get("description"):
                lines.append(f"คำอธิบาย: {record['description']}")
            self.detail_box.insert(tk.END, "\n".join(lines))
        self.detail_box.configure(state="disabled")

    def start_selected(self) -> None:
        record = self._selected_record()
        if not record:
            messagebox.showinfo("แจ้งเตือน", "กรุณาเลือกบริการก่อน")
            return
        if record.get("type") == "docker":
            svc = record["service"]
            append_log(self.log_widget, f"🚀 เริ่ม {svc}")
            run_async(f"start {svc}", "up", "-d", "--build", svc)
        else:
            svc_meta = HOST_SERVICE_BY_NAME.get(record["service"])
            if not svc_meta:
                messagebox.showerror("ผิดพลาด", "ไม่รู้จักบริการโฮสต์นี้")
                return
            append_log(self.log_widget, f"🚀 systemctl start {svc_meta['unit']}")
            run_host_async(f"start {svc_meta['unit']}", systemctl_command("start", svc_meta))
        self.window.after(1500, self.refresh)

    def stop_selected(self) -> None:
        record = self._selected_record()
        if not record:
            messagebox.showinfo("แจ้งเตือน", "กรุณาเลือกบริการก่อน")
            return
        if record.get("type") == "docker":
            svc = record["service"]
            append_log(self.log_widget, f"🛑 หยุด {svc}")
            run_async(f"stop {svc}", "stop", svc)
        else:
            svc_meta = HOST_SERVICE_BY_NAME.get(record["service"])
            if not svc_meta:
                messagebox.showerror("ผิดพลาด", "ไม่รู้จักบริการโฮสต์นี้")
                return
            append_log(self.log_widget, f"🛑 systemctl stop {svc_meta['unit']}")
            run_host_async(f"stop {svc_meta['unit']}", systemctl_command("stop", svc_meta))
        self.window.after(1500, self.refresh)

    def restart_selected(self) -> None:
        record = self._selected_record()
        if not record:
            messagebox.showinfo("แจ้งเตือน", "กรุณาเลือกบริการก่อน")
            return
        if record.get("type") == "docker":
            svc = record["service"]
            append_log(self.log_widget, f"🔄 รีสตาร์ท {svc}")
            run_async(f"restart {svc}", "restart", svc)
        else:
            svc_meta = HOST_SERVICE_BY_NAME.get(record["service"])
            if not svc_meta:
                messagebox.showerror("ผิดพลาด", "ไม่รู้จักบริการโฮสต์นี้")
                return
            append_log(self.log_widget, f"🔄 systemctl restart {svc_meta['unit']}")
            run_host_async(f"restart {svc_meta['unit']}", systemctl_command("restart", svc_meta))
        self.window.after(1500, self.refresh)

    def open_logs(self) -> None:
        record = self._selected_record()
        if not record:
            messagebox.showinfo("แจ้งเตือน", "กรุณาเลือกบริการก่อน")
            return
        if record.get("type") == "docker":
            LogWindow(self.master, record["service"])
        else:
            svc_meta = HOST_SERVICE_BY_NAME.get(record["service"])
            if not svc_meta:
                messagebox.showerror("ผิดพลาด", "ไม่รู้จักบริการโฮสต์นี้")
                return
            if shutil.which("journalctl"):
                command = [
                    "journalctl",
                    "-u",
                    svc_meta["unit"],
                    "-n",
                    "160",
                    "--no-pager",
                ]
                title = f"journalctl {svc_meta['unit']}"
            else:
                command = systemctl_command("status", svc_meta)
                title = f"systemctl status {svc_meta['unit']}"
            CommandOutputWindow(title, command)


# ---------------------------------------------------------------------------
# Main window
# ---------------------------------------------------------------------------


def main() -> None:
    if not COMPOSE_FILE.exists():
        raise SystemExit("ไม่พบไฟล์ dude-stack.yml กรุณาตรวจสอบตำแหน่งสคริปต์")

    root = tk.Tk()
    root.title("DuDe Hawaiian Control Panel")
    root.geometry("680x580")
    root.configure(bg="#fff1f2")

    header_frame = tk.Frame(root, bg="#ffe4e6")
    header_frame.pack(fill=tk.X)

    tk.Label(
        header_frame,
        text="DuDe Hawaiian Control",
        font=("Tahoma", 18, "bold"),
        fg="#be123c",
        bg="#ffe4e6",
    ).pack(pady=(12, 2))
    tk.Label(
        header_frame,
        text="🌴 คุม front/doc/vision/messenger/medic ครบในหน้าจอเดียว",
        font=("Tahoma", 11),
        fg="#9d174d",
        bg="#ffe4e6",
    ).pack(pady=(0, 12))

    button_frame = tk.Frame(root, bg="#fff1f2")
    button_frame.pack(pady=10)

    log_box = tk.Text(root, height=14, width=78, state="disabled", bg="#0f172a", fg="#f8fafc")
    log_box.pack(padx=16, pady=10, fill=tk.BOTH, expand=True)

    def create_main_button(text: str, command, row: int, column: int) -> None:
        tk.Button(
            button_frame,
            text=text,
            width=26,
            command=command,
            bg="#ede9fe",
            fg="#312e81",
            activebackground="#c7d2fe",
            font=("Tahoma", 11, "bold"),
        ).grid(row=row, column=column, padx=8, pady=6)

    create_main_button("1. เปิดบริการ", lambda: open_stack(log_box), 0, 0)
    create_main_button("2. ปิดทุกบริการ", lambda: stop_all(log_box), 1, 0)
    create_main_button("3. รีสตาร์ททั้งหมด", lambda: restart_all(log_box), 2, 0)
    create_main_button("4. ดู Log", lambda: show_logs(root), 0, 1)
    create_main_button("5. ทำความสะอาดไฟล์ขยะ", lambda: clean_junk(log_box), 1, 1)
    create_main_button("6. DuDe Info", open_info_window, 0, 2)
    create_main_button(
        "7. Service Monitor",
        lambda: ServiceMonitorWindow(root, log_box),
        1,
        2,
    )
    create_main_button("ออก", root.destroy, 2, 2)

    def poll_queue() -> None:
        try:
            while True:
                label, code, stdout, stderr = CMD_QUEUE.get_nowait()
                summary = f"✅ {label} สำเร็จ" if code == 0 else f"❌ {label} ล้มเหลว (exit={code})"
                append_log(log_box, summary)
                if stdout.strip():
                    append_log(log_box, stdout.strip())
                if stderr.strip():
                    append_log(log_box, f"stderr: {stderr.strip()}")
        except queue.Empty:
            pass
        root.after(500, poll_queue)

    poll_queue()
    append_log(log_box, "พร้อมใช้งาน กดปุ่มเพื่อจัดการระบบ")
    root.mainloop()


if __name__ == "__main__":
    main()
