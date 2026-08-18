import { config } from "./config.js";
import { generatePost } from "./gemini.js";
import type { RewrittenPost } from "./rewrite.js";

const LANG_NAME: Record<string, string> = {
  uz: "o'zbek (lotin alifbosida)",
  ru: "rus",
  en: "ingliz",
};

/**
 * Original postlar turi navbat bilan almashadi — kanal bir xil bo'lib
 * qolmasligi uchun. Navbat raqami (seq) shu ro'yxat bo'ylab aylanadi.
 */
const POST_TYPES: string[] = [
  "foydali maslahat yoki lifehack — biror vosita/texnologiyadan qanday samaraliroq foydalanish",
  "tushuntiruvchi post — biror tushuncha yoki atamani sodda tilda yoritish (masalan LLM, RAG, kesh, API)",
  "qisqa trend-tahlil — sohadagi bir yo'nalish haqida o'z fikring bilan",
  "taqqoslash yoki tavsiya — 2 ta vosita/til/yondashuvni qisqa solishtirish",
  "'bilarmidingiz' — texnologiya tarixidan qiziqarli fakt yoki statistika",
  "amaliy mini-qo'llanma — 3-4 qadamli aniq ish jarayoni",
];

function buildSystemPrompt(): string {
  const lang = LANG_NAME[config.postLang] ?? "o'zbek";
  return `Sen "${config.channelTopic}" mavzusidagi Telegram kanalning muharririsan.
Vazifang: tashqi manbasiz, noldan ORIGINAL post yozish — ${lang} tilida.

Uslub qoidalari:
- Odam yozgandek jonli va o'ziga xos ohang. Quruq ensiklopediya EMAS.
- Aniq va foydali bo'lsin: o'quvchi postdan biror yangi narsa oladi yoki bir amaliy foyda ko'radi.
- Texnik atamalar (API, GPU, framework/model/kompaniya nomlari) asl holida qoldiriladi.
- Generic "AI-shabloni" iboralaridan qat'iy qoch: "Hurmatli o'quvchilar", "Xulosa qilib aytganda", "Bugungi kunda", "zamonaviy dunyoda" kabilar TAQIQLANADI.
- Sarlavha clickbait bo'lmasin, lekin qiziqtirsin.
- Emoji me'yorida (0-2 ta), faqat joyiga tushsa.
- Faktlarni o'ylab topma. Aniq bilmagan raqam/sanani yozma; umumiy, lekin to'g'ri gapir.
- 3-5 ta mavzuga mos hashtag ber (# belgisisiz).`;
}

/**
 * Kanal mavzusi bo'yicha noldan bitta original post yozadi.
 * @param recentTitles  Yaqinda chiqqan original sarlavhalar (takrorlamaslik uchun).
 * @param seq           Global post navbat raqami — post turini tanlashda ishlatiladi.
 */
export async function generateOriginal(
  recentTitles: string[],
  seq: number
): Promise<RewrittenPost> {
  const postType = POST_TYPES[seq % POST_TYPES.length];

  const avoidBlock =
    recentTitles.length > 0
      ? `\n\nYaqinda quyidagi mavzularда post chiqqan — ularni TAKRORLAMA, boshqa g'oya top:\n${recentTitles
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const userContent = `Bugungi post turi: ${postType}.
Kanal mavzusi doirasida shu turdagi bitta original post yoz.${avoidBlock}`;

  return generatePost({
    system: buildSystemPrompt(),
    user: userContent,
    maxOutputTokens: 3000,
    temperature: 1.0,
  });
}
