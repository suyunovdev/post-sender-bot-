import { config } from "./config.js";
import type { RewrittenPost } from "./rewrite.js";

const API = `https://api.telegram.org/bot${config.telegramBotToken}`;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Kanalga yuboriladigan HTML matnni tayyorlaydi.
 * `link` berilsa (RSS manbasi yoki loyiha havolasi) — oxirida havola qo'shiladi.
 * Berilmasa (noldan original post) — havolasiz.
 */
export function formatMessage(
  post: RewrittenPost,
  link?: { url: string; label: string },
  signature?: string
): string {
  const tags = post.hashtags.map((h) => `#${h.replace(/[^\p{L}\p{N}_]/gu, "")}`).join(" ");
  const parts = [
    `<b>${escapeHtml(post.title)}</b>`,
    "",
    escapeHtml(post.body),
  ];
  if (tags) {
    parts.push("", tags);
  }
  if (link) {
    parts.push("", `<a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`);
  }
  const sig = signature ?? config.postSignature;
  if (sig) {
    parts.push("", escapeHtml(sig));
  }
  return parts.join("\n");
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: { message_id?: number };
}

async function call(method: string, body: Record<string, unknown>): Promise<TelegramResponse> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as TelegramResponse;
}

/**
 * Postni kanalga yuboradi. Rasm bo'lsa va sig'sa — rasm bilan (caption),
 * aks holda oddiy matn sifatida. Rasm yuborish muvaffaqiyatsiz bo'lsa,
 * matnga qaytadi.
 */
export async function publish(text: string, imageUrl?: string): Promise<number | undefined> {
  const canUsePhoto = config.sendImages && imageUrl && text.length <= 1024;

  if (canUsePhoto) {
    const r = await call("sendPhoto", {
      chat_id: config.telegramChannelId,
      photo: imageUrl,
      caption: text,
      parse_mode: "HTML",
    });
    if (r.ok) return r.result?.message_id;
    console.warn(`[telegram] sendPhoto muvaffaqiyatsiz (${r.description}); matnga o'tilyapti`);
  }

  const r = await call("sendMessage", {
    chat_id: config.telegramChannelId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  if (!r.ok) {
    throw new Error(`Telegram sendMessage xatosi: ${r.description}`);
  }
  return r.result?.message_id;
}

/**
 * Generatsiya qilingan rasmni (baytlar) post bilan yuboradi.
 * Matn ≤1024 bo'lsa — rasm + caption (bitta xabar).
 * Uzun bo'lsa — avval rasm, keyin matn (alohida xabar; message_id — matnники).
 */
export async function publishPhotoBytes(text: string, image: Buffer): Promise<number | undefined> {
  const form = new FormData();
  form.append("chat_id", config.telegramChannelId);
  form.append("photo", new Blob([new Uint8Array(image)], { type: "image/png" }), "post.png");

  const short = text.length <= 1024;
  if (short) {
    form.append("caption", text);
    form.append("parse_mode", "HTML");
  }
  const res = await fetch(`${API}/sendPhoto`, { method: "POST", body: form });
  const r = (await res.json()) as TelegramResponse;
  if (!r.ok) throw new Error(`Telegram sendPhoto xatosi: ${r.description}`);
  if (short) return r.result?.message_id;

  // Uzun post — matnни alohida yuboramiz (tahrirlash uchun shu message_id qaytadi)
  const r2 = await call("sendMessage", {
    chat_id: config.telegramChannelId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  if (!r2.ok) throw new Error(`Telegram sendMessage xatosi: ${r2.description}`);
  return r2.result?.message_id;
}

/**
 * Kanaldagi mavjud postni tahrirlaydi (message_id bo'yicha).
 * Rasm posti bo'lsa — caption'ni tahrirlaydi.
 */
export async function editChannelMessage(messageId: number, text: string): Promise<void> {
  const r = await call("editMessageText", {
    chat_id: config.telegramChannelId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  });
  if (r.ok) return;
  // Rasm/caption posti bo'lsa — editMessageCaption bilan qayta urinish
  if (r.description && /no text in the message|caption/i.test(r.description)) {
    const r2 = await call("editMessageCaption", {
      chat_id: config.telegramChannelId,
      message_id: messageId,
      caption: text,
      parse_mode: "HTML",
    });
    if (r2.ok) return;
    throw new Error(`Tahrirlab bo'lmadi: ${r2.description}`);
  }
  throw new Error(`Tahrirlab bo'lmadi: ${r.description}`);
}

/** Bot va kanal sozlamalari to'g'riligini tekshirish (healthcheck). */
export async function checkAccess(): Promise<void> {
  const me = await call("getMe", {});
  if (!me.ok) throw new Error(`Bot tokeni noto'g'ri: ${me.description}`);
  const chat = await call("getChat", { chat_id: config.telegramChannelId });
  if (!chat.ok) {
    throw new Error(
      `Kanalga ulanib bo'lmadi (${chat.description}). Bot kanalga admin qilib qo'shilganini tekshiring.`
    );
  }
}
