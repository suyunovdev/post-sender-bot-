import { GoogleGenAI, Type } from "@google/genai";
import { config } from "./config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/** Kanal posti — RSS qayta yozish va noldan original uchun umumiy shakl. */
export interface GeneratedPost {
  title: string;
  body: string;
  hashtags: string[];
}

/** Gemini structured output sxemasi — natija har doim shu shaklda bo'ladi. */
const POST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Qiziqarli, aniq sarlavha" },
    body: { type: Type.STRING, description: "Asosiy matn" },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 ta hashtag, # belgisisiz",
    },
  },
  required: ["title", "body", "hashtags"],
  propertyOrdering: ["title", "body", "hashtags"],
};

/**
 * Berilgan system + user prompt bo'yicha Gemini'dan {title, body, hashtags}
 * shaklidagi postni oladi. Structured output ishlatilgani uchun natija
 * har doim to'g'ri JSON.
 */
export async function generatePost(opts: {
  system: string;
  user: string;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<GeneratedPost> {
  const res = await ai.models.generateContent({
    model: config.geminiModel,
    contents: opts.user,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseSchema: POST_SCHEMA,
      maxOutputTokens: opts.maxOutputTokens ?? 2000,
      temperature: opts.temperature,
    },
  });

  const text = res.text;
  if (!text) {
    throw new Error("Gemini javobi bo'sh (ehtimol maxOutputTokens yetmadi yoki bloklandi)");
  }

  const parsed = JSON.parse(text) as Partial<GeneratedPost>;
  if (!parsed.title || !parsed.body) {
    throw new Error("Post to'liq emas (title/body yo'q)");
  }
  return {
    title: parsed.title.trim(),
    body: parsed.body.trim(),
    hashtags: (parsed.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
  };
}
