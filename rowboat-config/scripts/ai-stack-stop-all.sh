#!/usr/bin/env bash
set -Eeuo pipefail

# Options: --volumes --prune --no-rowboat --no-n8n
REMOVE_VOLUMES=0; PRUNE=0; DO_ROWBOAT=1; DO_N8N=1
for arg in "$@"; do
  case "$arg" in
    --volumes) REMOVE_VOLUMES=1 ;;
    --prune)   PRUNE=1 ;;
    --no-rowboat) DO_ROWBOAT=0 ;;
    --no-n8n)  DO_N8N=0 ;;
    *) echo "Unknown option: $arg" >&2 ; exit 2 ;;
  esac
done

ROWBOAT_DIR="${ROWBOAT_DIR:-$HOME/Data/services/rowboat-src}"
N8N_DIR="${N8N_DIR:-$HOME/Data/services/n8n}"
LOG_DIR="${LOG_DIR:-$HOME/Data/services/logs}"
mkdir -p "$LOG_DIR"
STAMP="$(date +'%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/ai-stack-stop-$STAMP.log"

is_tty() { [[ -t 1 ]]; }
if is_tty; then C2='\033[38;5;82m'; C3='\033[38;5;214m'; CERR='\033[38;5;203m'; C0='\033[0m'; else C2=''; C3=''; CERR=''; C0=''; fi
ok(){ echo -e "${C2}✔${C0} $*"; }
msg(){ echo -e "${C3}▶${C0} $*"; }
err(){ echo -e "${CERR}✘${C0} $*"; }

down() {
  local dir="$1" name="$2"
  [[ -f "$dir/docker-compose.yml" || -f "$dir/docker-compose.yaml" ]] || { msg "ข้าม $name (ไม่พบ compose ใน $dir)"; return 0; }
  msg "หยุด $name"
  {
    cd "$dir"
    if (( REMOVE_VOLUMES )); then
      docker compose down -v
    else
      docker compose down
    fi
  } >>"$LOG_FILE" 2>&1 || true
  ok "$name หยุดแล้ว"
}

msg "ล๊อกไฟล์: $LOG_FILE"

(( DO_ROWBOAT )) && down "$ROWBOAT_DIR" "Rowboat"
(( DO_N8N ))     && down "$N8N_DIR" "n8n"

if (( PRUNE )); then
  msg "Prune resources (dangling)"
  docker system prune -f >>"$LOG_FILE" 2>&1 || true
  ok "Prune เสร็จ"
fi

ok "หยุดสแตกเรียบร้อย ✅"

