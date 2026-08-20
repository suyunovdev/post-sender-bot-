import { GoogleGenAI, Modality } from "@google/genai";
import { config } from "./config.js";

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Post mavzusiga mos rasm generatsiya qiladi (Gemini image modeli).
 * Matnsiz, toza illyustratsiya. Xato bo'lsa null (post matnsiz ketaveradi).
 */
export async function generateImage(subject: string): Promise<Buffer | null> {
  try {
    const res = await ai.models.generateContent({
      model: config.geminiImageModel,
      contents: `Minimalist modern flat vector illustration representing the theme: "${subject}". Clean editorial tech style, cohesive limited color palette, soft geometric shapes, subtle depth. Absolutely NO text, no words, no letters, no numbers, no logos.`,
      config: { responseModalities: [Modality.IMAGE] },
    });
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      const data = p.inlineData?.data;
      if (data) return Buffer.from(data, "base64");
    }
    return null;
  } catch (err) {
    console.error("[image] generatsiya xatosi:", (err as Error).message);
    return null;
  }
}
