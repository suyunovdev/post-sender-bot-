import { config } from "./config.js";
import type { RewrittenPost } from "./rewrite.js";

const API = `https://api.telegram.org/bot${config.telegramBotToken}`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Kanalga yuboriladigan HTML matnni tayyorlaydi.
 * `link` berilsa (RSS manbasi yoki loyiha havolasi) — oxirida havola qo'shiladi.
 * Berilmasa (noldan original post) — havolasiz.
 */
export function formatMessage(
  post: RewrittenPost,
  link?: { url: string; label: string }
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
  if (config.postSignature) {
    parts.push("", escapeHtml(config.postSignature));
  }
  return parts.join("\n");
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
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
export async function publish(text: string, imageUrl?: string): Promise<void> {
  const canUsePhoto = config.sendImages && imageUrl && text.length <= 1024;

  if (canUsePhoto) {
    const r = await call("sendPhoto", {
      chat_id: config.telegramChannelId,
      photo: imageUrl,
      caption: text,
      parse_mode: "HTML",
    });
    if (r.ok) return;
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
