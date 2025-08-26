#!/usr/bin/env bash
# tHe DuDe — sync_to_gitgub.sh
# ซิงค์ไฟล์คอนฟิกจากเครื่อง Local -> GitHub repo Dude-by-Rowboat อย่างปลอดภัย
# ใช้ rsync + git (มี dry-run, custom commit message, optional tag)

set -euo pipefail

### ====== CONFIG (แก้ได้ตามเครื่องคุณ) =======================================
REPO_DIR="${REPO_DIR:-$HOME/Data/services/rowboat-src}"        # โฟลเดอร์รีโป (โคลนไว้)
SRC_ROWBOAT_CFG="${SRC_ROWBOAT_CFG:-$HOME/Data/rowboat-config}"
SRC_ROWBOAT_SRC="${SRC_ROWBOAT_SRC:-$HOME/Data/services/rowboat-src}"
SRC_N8N="${SRC_N8N:-$HOME/Data/services/n8n}"

# ปลายทางในรีโป
DST_CFG="rowboat-config"
DST_ROWBOAT_SRC="services/rowboat-src"
DST_N8N="services/n8n"

# ไฟล์ที่อนุญาตจาก rowboat-src (กันเผลออัพไฟล์หนัก/ลับ)
ALLOW_ROWBOAT_SRC=( "docker-compose*.yml" ".env.example" "README-setup.md" )

# ค่าเริ่มต้นของตัวเลือก
COMMIT_MSG="chore(sync): repo configs ($(date +%F))"
DO_PUSH=1
DRY_RUN=0
TAG_NAME=""

### ====== UI (สี/แบนเนอร์) ====================================================
C_RESET=$'\e[0m'; C_B=$'\e[1m'; C_G=$'\e[32m'; C_Y=$'\e[33m'; C_R=$'\e[31m'; C_C=$'\e[36m'
banner() {
  echo -e "${C_C}
   ____       _        ____         _        
  |  _ \ _ __(_)_   __/ ___|  _   _| |_ ___  
  | | | | '__| \ \ / /\___ \ | | | | __/ _ \ 
  | |_| | |  | |\ V /  ___) || |_| | || (_) |
  |____/|_|  |_| \_/  |____/  \__,_|\__\___/   sync_to_gitgub
${C_RESET}"
}
log()   { echo -e " ${C_B}▶${C_RESET} $*"; }
ok()    { echo -e " ${C_G}✔${C_RESET} $*"; }
warn()  { echo -e " ${C_Y}!${C_RESET} $*"; }
die()   { echo -e " ${C_R}✖${C_RESET} $*" >&2; exit 1; }

### ====== HELP ================================================================
usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  -m, --message  "TEXT"   ข้อความ commit (ดีฟอลต์: "${COMMIT_MSG}")
  -n, --dry-run           โหมดซ้อม (rsync --dry-run และไม่ push)
  --no-push               ไม่ push (แต่ commit)
  -t, --tag "vX.Y.Z"      สร้าง git tag หลัง commit
  -h, --help              แสดงวิธีใช้

ENV override:
  REPO_DIR, SRC_ROWBOAT_CFG, SRC_ROWBOAT_SRC, SRC_N8N
EOF
}

### ====== PARSE ARGS ==========================================================
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) COMMIT_MSG="$2"; shift 2 ;;
    -n|--dry-run) DRY_RUN=1; DO_PUSH=0; shift ;;
    --no-push)    DO_PUSH=0; shift ;;
    -t|--tag)     TAG_NAME="$2"; shift 2 ;;
    -h|--help)    usage; exit 0 ;;
    *) die "Unknown option: $1";;
  esac
done

### ====== CHECKS ==============================================================
banner
[[ -d "$REPO_DIR/.git" ]] || die "ไม่พบรีโป Git ที่ $REPO_DIR (ต้อง git clone มาก่อน)"
[[ -d "$SRC_ROWBOAT_CFG" ]] || warn "ไม่มี $SRC_ROWBOAT_CFG — จะข้ามเซ็ตนี้"
[[ -d "$SRC_ROWBOAT_SRC" ]] || warn "ไม่มี $SRC_ROWBOAT_SRC — จะข้ามเซ็ตนี้"
[[ -d "$SRC_N8N"        ]] || warn "ไม่มี $SRC_N8N — จะข้ามเซ็ตนี้"

RSYNC_FLAGS=(-a --delete --prune-empty-dirs --human-readable)
[[ $DRY_RUN -eq 1 ]] && RSYNC_FLAGS+=(--dry-run)

### ====== SYNC FUNCTIONS ======================================================
sync_dir_all() {
  local src="$1" dst="$2"
  [[ -d "$src" ]] || return 0
  mkdir -p "$REPO_DIR/$dst"
  log "rsync ${src}/ -> ${REPO_DIR}/${dst}/"
  rsync "${RSYNC_FLAGS[@]}" "$src"/ "$REPO_DIR/$dst"/
}

sync_pick_files() {
  local src="$1" dst="$2"; shift 2
  [[ -d "$src" ]] || return 0
  mkdir -p "$REPO_DIR/$dst"
  for pat in "$@"; do
    local found=()
    readarray -t found < <(compgen -G "$src/$pat" || true)
    if [[ ${#found[@]} -gt 0 ]]; then
      log "rsync pick [$pat] from ${src} -> ${REPO_DIR}/${dst}/"
      rsync "${RSYNC_FLAGS[@]}" "${found[@]}" "$REPO_DIR/$dst"/
    else
      warn "ไม่พบไฟล์ตรงกับแพทเทิร์น: $pat (ใน $src)"
    fi
  done
}

### ====== DO SYNC =============================================================
log "Repo: $REPO_DIR"
[[ $DRY_RUN -eq 1 ]] && warn "โหมด DRY-RUN: จะไม่ push"

# 1) rowboat-config/**
sync_dir_all "$SRC_ROWBOAT_CFG" "$DST_CFG"

# 2) services/rowboat-src: pick เฉพาะไฟล์ที่อนุญาต
sync_pick_files "$SRC_ROWBOAT_SRC" "$DST_ROWBOAT_SRC" "${ALLOW_ROWBOAT_SRC[@]}"

# 3) services/n8n/docker-compose.yml (ถ้ามี)
if [[ -f "$SRC_N8N/docker-compose.yml" ]]; then
  sync_pick_files "$SRC_N8N" "$DST_N8N" "docker-compose.yml"
fi

### ====== GIT COMMIT & PUSH ===================================================
cd "$REPO_DIR"
git add -A

if git diff --cached --quiet; then
  ok "ไม่มีการเปลี่ยนแปลงให้ commit"
else
  log "Commit: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG" || true
  ok "commit เสร็จ"
fi

if [[ -n "$TAG_NAME" ]]; then
  log "สร้าง tag: $TAG_NAME"
  git tag -f "$TAG_NAME" || true
fi

if [[ $DO_PUSH -eq 1 ]]; then
  log "Push branch…"
  git push || warn "push ไม่สำเร็จ"
  if [[ -n "$TAG_NAME" ]]; then
    log "Push tag…"
    git push -f origin "$TAG_NAME" || warn "push tag ไม่สำเร็จ"
  fi
  ok "เสร็จสิ้น"
else
  warn "ข้ามการ push (ใช้ --no-push หรือ --dry-run)"
fi

