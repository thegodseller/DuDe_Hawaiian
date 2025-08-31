#!/usr/bin/env bash
# Start Rowboat + (ถ้ามี) n8n
set -Eeuo pipefail

LOG_DIR="$HOME/Data/services/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/ai-stack-start-$(date +%F_%H%M).log"

ROWBOAT_DIR="$HOME/Data/services/rowboat-src"
N8N_DIR="$HOME/Data/services/n8n"

log(){ echo "[$(date +'%T')] $*" | tee -a "$LOG_FILE"; }

need() { command -v "$1" >/dev/null 2>&1 || { echo "ต้องติดตั้ง $1 ก่อน"; exit 1; }; }
need docker

log "เริ่มสตาร์ทสแตก (log: $LOG_FILE)"

# สตาร์ท Ollama ถ้ามี systemd และยังไม่รัน
if command -v systemctl >/dev/null 2>&1; then
  if ! systemctl is-active --quiet ollama; then
    log "สตาร์ท ollama.service"
    sudo systemctl start ollama || true
  fi
fi

start_compose() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  local f=
  for f in docker-compose.yml compose.yml docker-compose.yaml compose.yaml; do
    [ -f "$dir/$f" ] && break
    f=""
  done
  [ -n "$f" ] || return 0

  log "docker compose up -d @ $dir"
  ( cd "$dir" && docker compose up -d ) | tee -a "$LOG_FILE"
  ( cd "$dir" && docker compose ps ) | tee -a "$LOG_FILE"
}

start_compose "$ROWBOAT_DIR"
start_compose "$N8N_DIR"

log "สำเร็จ ✅"
echo "Rowboat UI : http://localhost:3000"
echo "n8n UI     : http://localhost:5678"

