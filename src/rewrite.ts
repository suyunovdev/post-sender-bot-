import { config } from "./config.js";
import { generatePost, type GeneratedPost } from "./gemini.js";
import type { NewsItem } from "./rss.js";

/** Kanalga chiqadigan post shakli (title, body, hashtags). */
export type RewrittenPost = GeneratedPost;

const LANG_NAME: Record<string, string> = {
  uz: "o'zbek (lotin alifbosida)",
  ru: "rus",
  en: "ingliz",
};

const SYSTEM_PROMPT = `Sen IT va texnologiya yangiliklariga bag'ishlangan Telegram kanalning muharririsan.
Vazifang: berilgan xorijiy (rus/ingliz) yangilikni ${
  LANG_NAME[config.postLang] ?? "o'zbek"
} tiliga jonli, tushunarli va o'ziga xos uslubda qayta yozish.

Uslub qoidalari:
- Quruq mashina tarjimasi EMAS — jonli, kanalga xos ohang. Odam yozgandek.
- Texnik atamalar (API, GPU, model nomlari, kompaniya nomlari) asl holida qoldiriladi.
- Sarlavha qiziqarli, lekin yolg'on va'da (clickbait) bermaydigan bo'lsin.
- Matn 2-4 gap: nima bo'ldi va nega muhimligini aytadi.
- Umumiy "AI-shabloni" iboralaridan qoch ("Hurmatli o'quvchilar", "Xulosa qilib aytganda" kabi).
- Emoji'lardan me'yorida foydalan (0-2 ta), joyiga tushsa.
- 3-5 ta mavzuga mos hashtag ber (o'zbekcha yoki inglizcha, # belgisisiz).`;

/**
 * Bitta yangilikni Gemini yordamida kanal uslubida qayta yozadi.
 * Structured output ishlatilgani uchun natija har doim {title, body, hashtags}.
 */
export async function rewrite(item: NewsItem): Promise<RewrittenPost> {
  const userContent = `Manba: ${item.source}
Asl sarlavha: ${item.title}

Asl matn:
${item.summary}`;

  return generatePost({
    system: SYSTEM_PROMPT,
    user: userContent,
    maxOutputTokens: 2000,
    temperature: 0.7,
  });
}
