import { config } from "./config.js";
import { generatePost, type GeneratedPost } from "./gemini.js";

/**
 * Loyihangiz haqidagi ma'lumot. Agent shu ma'lumot asosida turli burchakdan
 * (tanishtiruv, feature, use-case, texnik) post yozadi — faktlarni o'zi
 * to'qib chiqarmaydi, faqat shu yerdagilardan foydalanadi.
 */
export interface Project {
  /** Loyiha nomi */
  name: string;
  /** Bir qatorli ta'rif */
  tagline: string;
  /** Havola (bo'lsa postga qo'shiladi) */
  url?: string;
  /** To'liqroq tavsif — nima qiladi, kimga */
  description: string;
  /** Asosiy imkoniyatlar / xususiyatlar (agent ulardan birini tanlab yoritishi mumkin) */
  highlights: string[];
  /** Texnologiyalar (texnik burchakli post uchun; ixtiyoriy) */
  tech?: string[];
}

/**
 * Loyihalaringiz ro'yxati. Yangi loyiha qo'shish uchun shu massivga element
 * qo'shing. Agent ro'yxat bo'ylab navbat bilan aylanadi.
 *
 * ⚠️ Faqat ochiq (public) e'lon qilsa bo'ladigan, aniq ma'lumotlarni yozing —
 * agent shu yozilganlar doirasida gapiradi.
 */
export const PROJECTS: Project[] = [
  {
    name: "DeklarantAI",
    tagline: "Bojxona TIF TN kodlarini AI bilan aniqlaydigan platforma",
    url: "https://declarantai.com",
    description:
      "O'zbekiston bojxona sohasiga mo'ljallangan AI platforma. Tovar tavsifini yozsangiz yoki rasmini yuklasangiz, tizim TIF TN kodini avtomatik aniqlaydi. Deklarantlar, logistlar va import-eksport bilan shug'ullanadigan tadbirkorlar uchun.",
    highlights: [
      "Matn kiritasiz → millisekundlarda mos kodlar chiqadi (vector search)",
      "AI ishonchi past bo'lsa → Gemini avtomatik qayta tekshiradi",
      "Rasm yuklasangiz → Vision AI tovarni tanib, kod beradi",
      "Boj stavkasi, kalkulyator, tarix — hammasi bitta joyda",
    ],
    tech: ["vector search", "Gemini", "Vision AI"],
  },

  {
    name: "Ustoz",
    tagline: "O'zbek tilidagi onlayn ta'lim platformasi",
    url: "https://ustozedu.uz",
    description:
      "O'qituvchilar kurs yaratadigan, o'quvchilar video darslar, testlar va topshiriqlar orqali o'rganadigan onlayn ta'lim platformasi. 3 tilda (o'zbek/rus/ingliz), sertifikat va obuna tizimi bilan.",
    highlights: [
      "O'qituvchilar kurs yaratadi, admin moderatsiyadan o'tkazadi — sifat nazorati",
      "Video darslar, testlar/quizlar, topshiriqlar va o'rganish jarayonini kuzatish",
      "Kursni tugatganda sertifikat",
      "Obuna (oylik/yillik) — barcha kurslarga kirish, yoki alohida kurs sotib olish",
      "3 til: o'zbek, rus, ingliz",
    ],
    tech: ["Next.js", "TypeScript", "Prisma", "PostgreSQL"],
  },

  {
    name: "Zyron CRM",
    tagline: "O'quv markazlari uchun CRM tizimi",
    url: "https://zyron-crm.zyron.uz",
    description:
      "O'quv va ta'lim markazlarini boshqarish uchun CRM. Filiallar, guruhlar, o'quvchilar, ota-onalar, davomat, to'lovlar va potentsial mijozlar (lidlar) — hammasi bitta joyda. Har bir markaz o'z brendi bilan ishlatishi mumkin (white-label). Bir bosishda sinab ko'riladigan demo mavjud.",
    highlights: [
      "Bir necha filialni boshqarish — har filial ma'lumoti alohida izolyatsiya qilingan",
      "Guruhlar, dars jadvali va davomat kuzatuvi",
      "O'quvchilar va ota-onalar bilan ishlash, to'lovlar hisobi",
      "Lidlar (potentsial mijozlar) — CRM voronkasi",
      "Rollar: administrator, o'qituvchi, ota-ona, o'quvchi",
    ],
    tech: ["Next.js", "TypeScript", "Prisma"],
  },

  {
    name: "Maktab platformasi",
    tagline: "Maktablar uchun onlayn ta'lim va boshqaruv platformasi",
    // url: hali ommaviy chiqmagan — prod'ga chiqqach qo'shiladi
    description:
      "Maktablar uchun to'liq onlayn platforma: o'quvchi, o'qituvchi, ota-ona, direktor va administrator uchun alohida panellar. Darslar, vazifalar, davomat, baholar, testlar va dars jadvalidan tashqari, o'quvchini rag'batlantiruvchi o'yin elementlari (XP, daraja, reyting) bilan.",
    highlights: [
      "5 rol: o'quvchi, o'qituvchi, ota-ona, direktor, administrator",
      "Darslar, vazifalar, davomat, baholar, testlar/quizlar va dars jadvali",
      "Ota-onalar farzandining bahosi va davomatini kuzatadi",
      "Direktor uchun maktab-darajali tahlil: xavf ostidagi o'quvchilar, statistika, hisobotlar",
      "Gamifikatsiya: XP, daraja, davomat ketma-ketligi (streak), sinf reytingi",
      "E'lonlar, savol-javob va push bildirishnomalar",
    ],
    tech: ["Next.js 16", "TypeScript", "Prisma", "PostgreSQL"],
  },

  // --- Boshqa loyihalaringizni shu shaklda qo'shing ---
  // {
  //   name: "...",
  //   tagline: "...",
  //   url: "https://...",
  //   description: "...",
  //   highlights: ["...", "..."],
  //   tech: ["..."],
  // },
];

/**
 * Loyiha posti burchagi (angle) — bir loyiha haqida turlicha yozish uchun.
 * Navbat raqami (seq) shu ro'yxat bo'ylab aylanadi.
 */
const ANGLES: string[] = [
  "tanishtiruv — loyiha nima qilishi va kimga foydali ekani (umumiy, lekin quruq emas)",
  "bitta muhim imkoniyatni chuqurroq yoritish — u qanday ishlashi va nima uchun foydali",
  "muammo va yechim — bu loyihani nega yaratganing, qaysi og'riqni hal qilishi",
  "amaliy foydalanish holati (use-case) — real bir misolda qanday yordam berishi",
  "texnik nigoh — qanday texnologiyalar bilan qurilgani va nega shunday tanlanganini qisqa",
];

function buildSystemPrompt(): string {
  return `Sen quyidagi loyihaning MUALLIFISAN — o'z shaxsiy Telegram kanalingda, birinchi shaxsda (men) o'z loyihang haqida yozyapsan.

Uslub qoidalari:
- Birinchi shaxsda, tabiiy va samimiy: "men yaratdim", "ustida ishlayapman", "qo'shdim".
- Maqtanchoqlik va reklama-shabloni EMAS. Real, foydali, ishonchli ohang.
- Faqat berilgan ma'lumotdagi faktlardan foydalan. Raqam, statistika yoki imkoniyatni O'YLAB TOPMA.
- "Bugungi kunda", "zamonaviy dunyoda", "Hurmatli obunachilar" kabi generic iboralar TAQIQLANADI.
- Oxirida yumshoq chaqiruv (sinab ko'ring / fikr bildiring), lekin bosim o'tkazma.
- Emoji me'yorida (0-2 ta).
- Havolani matn ichida takrorlama — u alohida qo'shiladi.
- 3-5 ta mavzuga mos hashtag ber (# belgisisiz), loyiha nomini ham qo'shsang bo'ladi.
- MUHIM: faqat o'zbek LOTIN yozuvi. Kirill harflarini MUTLAQO ishlatma. Masalan "da","ga","ning","ichida" deb yoz — hech qachon "да","га","нинг" emas.`;
}

/**
 * Bitta loyiha haqida post yozadi.
 * @param project       Loyiha ma'lumoti.
 * @param recentTitles  Yaqindagi loyiha postlari sarlavhalari (takrorlamaslik).
 * @param seq           Global navbat raqami — post burchagini tanlashda ishlatiladi.
 */
export async function generateProjectPost(
  project: Project,
  recentTitles: string[],
  seq: number
): Promise<GeneratedPost> {
  const angle = ANGLES[seq % ANGLES.length];

  const avoidBlock =
    recentTitles.length > 0
      ? `\n\nYaqinda loyihalar haqida shu sarlavhalar bilan post chiqqan — bularni TAKRORLAMA, boshqa burchak/g'oya top:\n${recentTitles
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";

  const linkNote = project.url
    ? `Havola: ${project.url}`
    : "Bu loyihaning hali ommaviy havolasi YO'Q — 'saytga kiring' yoki 'sinab ko'ring' DEMA, havola haqida gapirma. 'Ustida ishlayapman' ohangida yoz, oxirida faqat fikr/taklif so'ra.";

  const userContent = `Loyiha: ${project.name}
Ta'rif: ${project.tagline}
Batafsil: ${project.description}
Asosiy imkoniyatlar:
${project.highlights.map((h) => `- ${h}`).join("\n")}${
    project.tech ? `\nTexnologiyalar: ${project.tech.join(", ")}` : ""
  }
${linkNote}

Bugungi post burchagi: ${angle}.
Shu burchakdan bu loyiha haqida bitta post yoz (til: ${config.postLang}).${avoidBlock}`;

  return generatePost({
    system: buildSystemPrompt(),
    user: userContent,
    maxOutputTokens: 3000,
    temperature: 0.9,
  });
}
