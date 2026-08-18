#!/usr/bin/env bash
# VPS'da botni yangilaydi: klon (birinchi marta) -> pull -> npm ci -> build.
# .env va data/ (SQLite) gitignore'da — pull/reset ularga TEGMAYDI.
# Ishlatish: bash deploy/deploy.sh [branch]   (yoki CI avtomatik chaqiradi)
set -euo pipefail

APP_DIR="${APP_DIR:-/home/deploy/apps/tg-news-bot}"
REPO_URL="${REPO_URL:-https://github.com/suyunovdev/tg-tech-news-bot.git}"
BRANCH="${1:-main}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "[deploy] Birinchi marta: $REPO_URL klonlanmoqda..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

npm ci
npm run build

if [ ! -f "$APP_DIR/.env" ]; then
  echo "[deploy] ⚠️  .env topilmadi. .env.example dan nusxa olib to'ldiring:"
  echo "         cp $APP_DIR/.env.example $APP_DIR/.env && nano $APP_DIR/.env"
fi

echo "[deploy] ✅ Kod yangilandi. Timer bo'yicha o'zi ishga tushadi."
echo "[deploy]    Darrov sinash: sudo systemctl start tg-news-bot"
