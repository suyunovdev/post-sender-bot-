# Telegram Tech News Bot

Shaxsiy/tech kanal uchun **aralash** kontent agenti — 3 xil post navbat bilan: RSS yangiliklarини qayta yozadi, mavzu bo'yicha noldan original post yozadi, **va o'z loyihalaringiz haqida** post qiladi. Hammasini **Google Gemini (`gemini-flash-latest`)** bilan, o'zbek tilida, **Telegram kanalingizga** avtomatik joylaydi.

## Oqim (arxitektura)

```
                     ┌── rss ─────▶ rss.ts ──▶ rewrite.ts (yangilikni qayta yozish)
index.ts (rotatsiya) ┤── original ─────────▶ original.ts (mavzu bo'yicha noldan)   ├──▶ telegram.ts ──▶ Telegram
                     └── project ──────────▶ projects.ts (o'z loyihalari haqida)   ┘
                                   │
                              db.ts (dedup + navbat hisoblagichi, SQLite/WAL)
```

- **Aralash rejim (navbat bilan):** `CONTENT_PATTERN` ketma-ketligi bo'ylab har slot `rss` / `original` / `project` bo'ladi. Masalan `rss,rss,original,rss,rss,project` → har 6 postда 4 RSS, 1 original, 1 loyiha. Barcha turlar birga sanaladi, hisoblagich SQLite'da saqlanadi — ishlar orasida navbat buzilmaydi.
- **Loyiha postlari:** `src/projects.ts` dagi `PROJECTS` ro'yxatidan navbat bilan; agent faqat o'sha yerdagi aniq faktlar doirasida, birinchi shaxsda yozadi.
- **Kanal jim qolmaydi:** `rss` navbati kelib yangi yangilik topilmasa (yoki `project` navbatida loyiha yo'q bo'lsa), agent o'sha slotда noldan original yozib qo'yadi.
- **Takrorlanmaslik:** RSS uchun `guid`/`link` kaliti; original uchun yaqindagi sarlavhalar Gemini'ga "takrorlama" deb beriladi.
- **Sifat:** Gemini structured output (`responseSchema` + JSON mode) — natija har doim `{title, body, hashtags}`. Barcha Gemini chaqiruvlari `src/gemini.ts` da markazlashgan.
- **Chidamlilik:** bitta manba yoki bitta post xato bersa, qolganlari to'xtamaydi; xato slotда navbat oshmaydi — keyingi ishда qayta uriniladi.

## 1. Sozlash (lokal)

```bash
cd tg-tech-news-bot
npm install
cp .env.example .env
# .env ni to'ldiring (pastga qarang)
```

`.env` qiymatlari:

| O'zgaruvchi | Tavsif |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather'dan olingan token |
| `TELEGRAM_CHANNEL_ID` | `@kanal_username` yoki `-100...` ID. **Bot kanalga admin bo'lishi shart** |
| `GEMINI_API_KEY` | Google Gemini API kaliti (Google AI Studio'dan) |
| `GEMINI_MODEL` | Model (standart `gemini-flash-latest`) |
| `MAX_POSTS_PER_RUN` | Bir ishga tushishда nechta post (standart 3) |
| `POST_LANG` | `uz` / `ru` / `en` |
| `SEND_IMAGES` | `1` — rasm bilan, `0` — faqat matn |
| `CHANNEL_TOPIC` | Kanal mavzusi — agent noldan post yozganда shu doirada yozadi |
| `CONTENT_PATTERN` | Kontent navbati: `rss` / `original` / `project` ketma-ketligi (masalan `rss,rss,original,rss,rss,project`) |

Manbalarni tahrirlash: `src/config.ts` ichidagi `SOURCES` ro'yxati.
Original post turlarini (maslahat/tushuntirish/trend/…) tahrirlash: `src/original.ts` ичidagi `POST_TYPES`.
Loyihalarni qo'shish/tahrirlash: `src/projects.ts` ичidagi `PROJECTS` ro'yxati.

## 2. Sinash

```bash
# Bot va kanal ulanishini tekshirish (post yubormaydi)
npm run healthcheck

# Bir marta ishga tushirish (haqiqiy post yuboradi!)
npm run once
```

## 3. Deploy — GitHub CI/CD + systemd (doimiy xizmat, Contabo VPS)

Kod GitHub'ga push qilinganда avtomatik VPS'ga chiqadi (`.github/workflows/deploy.yml`).
VPS'da **doimiy xizmat** (`node dist/service.js`) ishlab turadi: ichida **rejalashtiruvchi**
(belgilangan vaqtда post qo'yadi) va **admin-bot** (chatдан boshqaruv — §4) bor.

### a) GitHub sozlash (bir marta)
1. Repo yarating va push qiling (masalan `suyunovdev/tg-tech-news-bot`).
2. Repo → **Settings → Secrets and variables → Actions** ga 3 ta secret qo'shing:
   - `VPS_HOST` = `84.46.252.77`
   - `VPS_USER` = `deploy`
   - `VPS_SSH_KEY` = deploy uchun **shaxsiy** SSH kalit (Ustoz'dagi bilan bir xil bo'lishi mumkin)
3. `.env` **hech qachon** git'ga tushmaydi (`.gitignore`da) — sirlar faqat VPS'da.

> Repo `suyunovdev`dan boshqa bo'lsa, `.github/workflows/deploy.yml` va `deploy/deploy.sh` ichidagi klon URL'ini to'g'rilang.

### b) VPS'da birinchi marta (bir marta)
```bash
ssh deploy@84.46.252.77
mkdir -p /home/deploy/apps
git clone https://github.com/suyunovdev/tg-tech-news-bot.git /home/deploy/apps/tg-news-bot
cd /home/deploy/apps/tg-news-bot
npm ci && npm run build
cp .env.example .env && nano .env        # tokenlar, kanal, GEMINI_API_KEY, loyihalar

# systemd (doimiy xizmat)
sudo cp deploy/tg-news-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tg-news-bot

# Tekshirish
node dist/index.js --healthcheck      # bot+kanal ulanishi
systemctl status tg-news-bot          # xizmat ishlayaptimi
journalctl -u tg-news-bot -f          # loglar (admin-bot + rejalashtiruvchi)
```

### c) Keyin — har push avtomatik
`git push origin main` → GitHub Action build tekshiradi → VPS'ga SSH orqali `git pull + npm ci + build`.
Kod yangilanadi. (Xizmatni qayta ishga tushirish uchun deploy oxirida `sudo systemctl restart tg-news-bot` qo'shsa bo'ladi.)

## 4. Admin-bot orqali boshqaruv (Telegram)

Botga **shaxsiy chatда** (admin ID `ADMIN_USER_IDS`da) buyruq yozing:

| Buyruq | Vazifa |
|---|---|
| `/holat` | joriy sozlamalar + keyingi post vaqti |
| `/post` | hoziroq bitta post qo'yish |
| `/pauza` · `/davom` | jadvalni to'xtatish / davom ettirish |
| `/imzo <matn>` | post imzosi (bo'sh — imzosiz) |
| `/jadval 10:00 19:00` | post vaqtlari (Toshkent) |
| `/navbat rss,rss,original,project` | kontent navbati |
| `/soni <n>` | bir ishда nechta post |
| `/manbalar` · `/manba_qosh <Nom> <url>` · `/manba_ochir <id>` | RSS manbalar |
| `/loyihalar` · `/loyiha_qosh` · `/loyiha_ochir <id>` | loyihalar |

Sozlamalar SQLite'да saqlanadi — xizmat qayta ishga tushsa ham yo'qolmaydi.

## Eslatmalar

- `better-sqlite3` native modul — VPS'da `build-essential` (yoki `apt install -y python3 make g++`) kerak bo'lishi mumkin.
- Gemini `gemini-flash-latest` bepul tier'da ishlaydi — bu bot uchun (kuniga bir necha marta) limitlar yetarli. Model `GEMINI_MODEL` orqali o'zgartiriladi (masalan `gemini-3.5-flash`).
- Original postда ijodkorlik uchun `temperature: 1.0`, RSS qayta yozishда aniqlik uchun `0.7` — `src/gemini.ts` orqali sozlanadi.
