import { config } from "./config.js";

/**
 * Admin(lar)ga Telegram orqali ogohlantirish yuboradi (best-effort).
 * ⚠️ Bot faqat o'ziga /start yozgan foydalanuvchiga xabar yubora oladi —
 * shuning uchun admin kamida bir marta @bot ga yozgan bo'lishi kerak.
 */
export async function notifyAdmins(text: string): Promise<void> {
  const api = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  for (const id of config.adminUserIds) {
    try {
      await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text, disable_web_page_preview: true }),
      });
    } catch {
      // Ogohlantirishning o'zi yuborilmasa — jim (asosiy ishga xalaqit bermasin)
    }
  }
}
