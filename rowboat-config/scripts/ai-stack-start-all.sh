#!/usr/bin/env bash
set -Eeuo pipefail

# ============ tHe DuDe Banner ============ #
read -r -d '' DUDE <<'EOF'
   ____  _          ____        _       
  |  _ \| |__   ___|  _ \  ___ | |_ ___ 
  | | | | '_ \ / _ \ | | |/ _ \| __/ _ \
  | |_| | | | |  __/ |_| | (_) | ||  __/
  |____/|_| |_|\___|____/ \___/ \__\___|
        Hybrid Local AI Stack Controller
EOF

# ============ Config ============ #
ROWBOAT_DIR="${ROWBOAT_DIR:-$HOME/Data/services/rowboat-src}"
N8N_DIR="${N8N_DIR:-$HOME/Data/services/n8n}"
LOG_DIR="${LOG_DIR:-$HOME/Data/services/logs}"
mkdir -p "$LOG_DIR"
STAMP="$(date +'%Y%m%d-%H%M%S')"
LOG_FILE="$LOG_DIR/ai-stack-start-$STAMP.log"

# Options: --rebuild --no-rowboat --no-n8n
REBUILD=0; DO_ROWBOAT=1; DO_N8N=1
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --no-rowboat) DO_ROWBOAT=0 ;;
    --no-n8n) DO_N8N=0 ;;
    *) echo "Unknown option: $arg" >&2 ; exit 2 ;;
  case_esac_done
done

# ============ Colors ============ #
is_tty() { [[ -t 1 ]]; }
if is_tty; then
  C0='\033[0m'; C1='\033[38;5;45m'; C2='\033[38;5;82m'; C3='\033[38;5;214m'; CERR='\033[38;5;203m'
else
  C0=''; C1=''; C2=''; C3=''; CERR=''
fi

banner() { echo -e "${C1}$DUDE${C0}"; }
msg()    { echo -e "${C3}▶${C0} $*"; }
ok()     { echo -e "${C2}✔${C0} $*"; }
err()    { echo -e "${CERR}✘${C0} $*"; }

spinner() {
  local pid=$1 txt=$2; local frames=('⠋' '⠙' '⠸' '⠼' '⠴' '⠦' '⠇' '⠏')
  while kill -0 "$pid" 2>/dev/null; do
    for f in "${frames[@]}"; do
      printf "\r${C1}%s${C0} %s" "$f" "$txt"
      sleep 0.08
    done
  done
  printf "\r"
}

wait_on_url() {
  local url="$1" name="$2" timeout="${3:-60}"
  local t=0
  while ! curl -fsS "$url" >/dev/null 2>&1; do
    (( t++ ))
    if (( t >= timeout )); then
      err "$name ยังไม่พร้อมใน $timeout วินาที (URL: $url)"
      return 1
    fi
    printf "\r${C1}…${C0} รอ $name ($t s)"
    sleep 1
  done
  printf "\r"
  ok "$name พร้อมแล้ว ➜ $url"
}

compose_up() {
  local dir="$1" name="$2"
  [[ -f "$dir/docker-compose.yml" || -f "$dir/docker-compose.yaml" ]] || { msg "ข้าม $name (ไม่พบ compose ใน $dir)"; return 0; }
  msg "สตาร์ต $name จาก $dir"
  {
    cd "$dir"
    if (( REBUILD )); then
      docker compose pull --ignore-pull-failures || true
      docker compose up -d --build
    else
      docker compose up -d
    fi
    docker compose ps
  } >>"$LOG_FILE" 2>&1 &
  spinner $! "กำลังสตาร์ต $name…" ; echo
  ok "$name สั่งรันแล้ว"
}

summary_rowboat() {
  echo -e "\n${C3}Rowboat endpoints:${C0}"
  echo "  UI          : http://localhost:3000/"
  echo "  API (jobs)  : ใช้ผ่าน Rowboat เอง"
}
summary_n8n() {
  echo -e "\n${C3}n8n endpoints:${C0}"
  echo "  Studio UI   : http://localhost:5678/"
  echo "  Webhook prod: http://localhost:5678/webhook/{path}"
}

trap 'err "เกิดข้อผิดพลาด! ดูล๊อก: $LOG_FILE"' ERR

banner
msg "ล๊อกไฟล์: $LOG_FILE"

if (( DO_ROWBOAT )); then
  compose_up "$ROWBOAT_DIR" "Rowboat"
  # รอ UI 3000 ถ้าเปิดไว้
  wait_on_url "http://localhost:3000/" "Rowboat UI" 90 || true
  summary_rowboat
fi

if (( DO_N8N )); then
  compose_up "$N8N_DIR" "n8n"
  wait_on_url "http://localhost:5678/" "n8n UI" 60 || true
  summary_n8n
fi

echo
ok "สตาร์ตครบแล้ว ✅"
echo -e "${C3}วิธีหยุด:${C0} ./ai-stack-stop-all.sh"

