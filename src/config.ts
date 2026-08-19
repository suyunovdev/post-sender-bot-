import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name} (.env faylini tekshiring)`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

/**
 * RSS manbalari. Har biriga `name` — postda manba nomi sifatida ko'rsatiladi.
 * VPS'da faqat shu ro'yxatni tahrirlab, kanalingiz mavzusiga moslashtiring.
 */
export interface Source {
  name: string;
  url: string;
}

export const SOURCES: Source[] = [
  { name: "Habr", url: "https://habr.com/ru/rss/best/daily/?fl=ru" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { name: "Hacker News", url: "https://hnrss.org/frontpage" },
];

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChannelId: required("TELEGRAM_CHANNEL_ID"),
  geminiApiKey: required("GEMINI_API_KEY"),
  /** Gemini modeli. `gemini-flash-latest` — har doim eng so'nggi barqaror flash. */
  geminiModel: optional("GEMINI_MODEL", "gemini-flash-latest"),
  maxPostsPerRun: parseInt(optional("MAX_POSTS_PER_RUN", "3"), 10),
  dbPath: optional("DB_PATH", "./data/state.sqlite"),
  postLang: optional("POST_LANG", "uz"),
  sendImages: optional("SEND_IMAGES", "1") === "1",
  /** Har post oxiriga qo'shiladigan imzo (masalan "✍️ @Suyunov_dev1"). Bo'sh = imzosiz. */
  postSignature: optional("POST_SIGNATURE", ""),
  /** Kanal mavzusi — noldan original post yozishда agentga beriladi. */
  channelTopic: optional("CHANNEL_TOPIC", "IT, sun'iy intellekt, dasturlash va texnologiya"),
  /**
   * Kontent navbati (aralash rejim). Har bir slot 3 turdan biri:
   *   rss      — RSS manbadan yangilikni qayta yozish
   *   original — mavzu bo'yicha noldan original post
   *   project  — o'z loyihalaring haqida post (src/projects.ts)
   * Navbat post ketma-ketligi bo'ylab aylanadi.
   * Masalan "rss,rss,original,rss,rss,project" => har 6 postда 4 RSS, 1 original, 1 loyiha.
   */
  contentPattern: optional("CONTENT_PATTERN", "rss,rss,original,rss,rss,project")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is "rss" | "original" | "project" =>
      s === "rss" || s === "original" || s === "project"
    ),
  /** Standart post jadvali (Toshkent vaqti, HH:MM). Chatдан o'zgartiriladi. */
  scheduleDefault: optional("SCHEDULE", "10:00,19:00"),
  /** Admin-botга buyruq bera oladigan Telegram ID'lar. */
  adminUserIds: optional("ADMIN_USER_IDS", "6307446924")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
} as const;

export type AppConfig = typeof config;
