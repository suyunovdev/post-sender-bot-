import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "./config.js";
import type { StateStore } from "./db.js";
import { effective, parsePattern, parseTimes } from "./settings.js";
import { runOnce, prepareTopic, prepareProject, publishPrepared, type PreparedPost } from "./poster.js";
import { editChannelMessage, escapeHtml } from "./telegram.js";

const HELP = `🤖 Admin buyruqlari:

/holat — joriy sozlamalar va keyingi post vaqti
/post — hoziroq bitta post qo'yish
/mavzu <matn> — mavzu bo'yicha post (avval ko'rsatib, tasdiqlatadi)
/tahrir <matn> — oxirgi yuborilgan postni tahrirlash
/pauza — jadvalni to'xtatish
/davom — jadvalni davom ettirish

/imzo <matn> — post imzosi (bo'sh yuborsangiz — imzosiz)
/jadval <10:00 19:00> — post vaqtlari (Toshkent)
/navbat <rss,rss,original,project> — kontent navbati
/soni <n> — bir ishда nechta post

/manbalar — RSS manbalar ro'yxati
/manba_qosh <Nom> <url> — RSS manba qo'shish
/manba_ochir <id> — RSS manba o'chirish

/loyihalar — loyihalar ro'yxati
/loyiha_post <id> — loyiha posti (avval ko'rsatib, tasdiqlatadi)
/loyiha_ochir <id> — loyiha o'chirish
/loyiha_qosh — yangi loyiha (format ko'rsatiladi)`;

function tashkentNow(): { hhmm: string; minutes: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = p.split(":").map((x) => parseInt(x, 10));
  return { hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, minutes: h * 60 + m };
}

function nextFireLabel(times: string[]): string {
  if (times.length === 0) return "—";
  const now = tashkentNow().minutes;
  const mins = times
    .map((t) => {
      const [h, m] = t.split(":").map((x) => parseInt(x, 10));
      return h * 60 + m;
    })
    .sort((a, b) => a - b);
  const upcoming = mins.find((m) => m > now);
  const target = upcoming ?? mins[0];
  const hh = String(Math.floor(target / 60)).padStart(2, "0");
  const mm = String(target % 60).padStart(2, "0");
  return `${hh}:${mm}${upcoming === undefined ? " (ertaga)" : ""} (Toshkent)`;
}

export function startAdminBot(store: StateStore): Bot {
  const bot = new Bot(config.telegramBotToken);
  const isAdmin = (id?: number) => id !== undefined && config.adminUserIds.includes(String(id));

  // Faqat admin — boshqa hammaga (va kanal postlariga) javob bermaydi.
  bot.use(async (ctx, next) => {
    if (ctx.from && isAdmin(ctx.from.id)) return next();
  });

  // Tasdiq kutayotgan tayyor postlar (token -> post). 10 daqiqadan keyin o'chadi.
  const pending = new Map<string, PreparedPost>();
  // Tahrir matnini kutayotgan admin (userId -> token).
  const awaitingEdit = new Map<number, string>();
  let tokenCounter = 0;

  /** Postni ko'rsatib, "✅ Yuborish / ❌ Bekor / ✏️ Tahrir" tugmalari bilan tasdiq so'raydi. */
  const presentPreview = (ctx: Context, p: PreparedPost) => {
    const token = String(++tokenCounter);
    pending.set(token, p);
    setTimeout(() => pending.delete(token), 10 * 60 * 1000);
    const kb = new InlineKeyboard()
      .text("✅ Yuborish", `send:${token}`)
      .text("❌ Bekor", `cancel:${token}`)
      .row()
      .text("✏️ Tahrir", `edit:${token}`);
    return ctx.reply(`👀 <b>Ko'rib chiqing (hali yuborilmadi):</b>\n\n${p.text}`, {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  };

  bot.command(["start", "help"], (ctx) => ctx.reply(HELP));

  bot.command("holat", (ctx) => {
    const s = effective(store);
    const msg = [
      `📊 Holat: ${s.paused ? "⏸ TO'XTATILGAN" : "▶️ faol"}`,
      `Jadval: ${s.scheduleTimes.join(", ")} (Toshkent)`,
      `Keyingi post: ${s.paused ? "—" : nextFireLabel(s.scheduleTimes)}`,
      `Bir ishда: ${s.maxPerRun} post`,
      `Navbat: ${s.pattern.join(", ")}`,
      `Imzo: ${s.signature || "(yo'q)"}`,
      `Manbalar: ${store.listSources().length} ta · Loyihalar: ${store.listProjects().length} ta`,
    ].join("\n");
    return ctx.reply(msg);
  });

  bot.command("post", async (ctx) => {
    await ctx.reply("⏳ Post tayyorlanmoqda...");
    const r = await runOnce(store, { max: 1 });
    return ctx.reply(r.lines.join("\n") || "Hech narsa yuborilmadi.");
  });

  bot.command("mavzu", async (ctx) => {
    const topic = (ctx.match ?? "").trim();
    if (!topic) {
      return ctx.reply("❌ Mavzuni yozing. Masalan:\n/mavzu sun'iy intellekt kelajagi");
    }
    await ctx.reply(`⏳ "${topic}" mavzusida post tayyorlanmoqda...`);
    try {
      const p = await prepareTopic(store, topic);
      return presentPreview(ctx, p);
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });

  // Yuborilgan (oxirgi) postni tahrirlash
  bot.command("tahrir", async (ctx) => {
    const text = (ctx.match ?? "").trim();
    if (!text) return ctx.reply("❌ Yangi matnni yozing:\n/tahrir <to'g'rilangan to'liq matn>");
    const mid = store.getSetting("last_message_id");
    if (!mid) return ctx.reply("❌ Tahrirlash uchun post topilmadi (hali post yo'q).");
    const sig = effective(store).signature;
    const full = escapeHtml(text) + (sig ? `\n\n${escapeHtml(sig)}` : "");
    try {
      await editChannelMessage(parseInt(mid, 10), full);
      return ctx.reply("✅ Oxirgi post tahrirlandi.");
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });

  bot.command("pauza", (ctx) => {
    store.setSetting("paused", "1");
    return ctx.reply("⏸ Jadval to'xtatildi. /davom bilan qayta yoqasiz.");
  });
  bot.command("davom", (ctx) => {
    store.setSetting("paused", "0");
    const s = effective(store);
    return ctx.reply(`▶️ Jadval yoqildi. Keyingi post: ${nextFireLabel(s.scheduleTimes)}`);
  });

  bot.command("imzo", (ctx) => {
    const text = (ctx.match ?? "").trim();
    store.setSetting("signature", text);
    return ctx.reply(text ? `✅ Imzo o'rnatildi:\n${text}` : "✅ Imzo olib tashlandi.");
  });

  bot.command("jadval", (ctx) => {
    const times = parseTimes(ctx.match ?? "");
    if (times.length === 0) {
      return ctx.reply("❌ Vaqt topilmadi. Masalan: /jadval 10:00 19:00");
    }
    store.setSetting("schedule", times.join(","));
    return ctx.reply(`✅ Jadval: ${times.join(", ")} (Toshkent)\nKeyingi post: ${nextFireLabel(times)}`);
  });

  bot.command("navbat", (ctx) => {
    const pattern = parsePattern(ctx.match ?? "");
    if (pattern.length === 0) {
      return ctx.reply("❌ Navbat bo'sh yoki noto'g'ri. Faqat: rss, original, project.\nMasalan: /navbat rss,rss,original,project");
    }
    store.setSetting("pattern", pattern.join(","));
    return ctx.reply(`✅ Navbat: ${pattern.join(", ")}`);
  });

  bot.command("soni", (ctx) => {
    const n = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      return ctx.reply("❌ 1 dan 10 gacha son yuboring. Masalan: /soni 1");
    }
    store.setSetting("max_per_run", String(n));
    return ctx.reply(`✅ Bir ishда ${n} ta post qo'yiladi.`);
  });

  // ---- Manbalar ----
  bot.command("manbalar", (ctx) => {
    const list = store.listSources();
    if (list.length === 0) return ctx.reply("Manba yo'q.");
    return ctx.reply(list.map((s) => `${s.id}. ${s.name} — ${s.url}`).join("\n"));
  });

  bot.command("manba_qosh", (ctx) => {
    const parts = (ctx.match ?? "").trim().split(/\s+/);
    if (parts.length < 2) {
      return ctx.reply("❌ Format: /manba_qosh <Nom> <url>\nMasalan: /manba_qosh TechCrunch https://techcrunch.com/feed/");
    }
    const url = parts[parts.length - 1];
    const name = parts.slice(0, -1).join(" ");
    if (!/^https?:\/\//i.test(url)) return ctx.reply("❌ url http(s):// bilan boshlanishi kerak.");
    store.addSource(name, url);
    return ctx.reply(`✅ Manba qo'shildi: ${name} — ${url}`);
  });

  bot.command("manba_ochir", (ctx) => {
    const id = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(id)) return ctx.reply("❌ id yuboring. Masalan: /manba_ochir 3  (/manbalar dan)");
    return ctx.reply(store.removeSource(id) ? `✅ ${id}-manba o'chirildi.` : `❌ ${id} topilmadi.`);
  });

  // ---- Loyihalar ----
  bot.command("loyihalar", (ctx) => {
    const list = store.listProjects();
    if (list.length === 0) return ctx.reply("Loyiha yo'q.");
    return ctx.reply(list.map((p) => `${p.id}. ${p.name} — ${p.tagline}${p.url ? ` (${p.url})` : ""}`).join("\n"));
  });

  bot.command("loyiha_post", async (ctx) => {
    const arg = (ctx.match ?? "").trim();
    const id = parseInt(arg, 10);
    if (!Number.isFinite(id)) {
      const list = store.listProjects();
      const menu = list.map((p) => `${p.id}. ${p.name}`).join("\n");
      return ctx.reply(
        `Qaysi loyiha? id bilan yuboring, masalan: /loyiha_post ${list[0]?.id ?? 1}\n\n${menu}`
      );
    }
    await ctx.reply("⏳ Loyiha posti tayyorlanmoqda...");
    try {
      const p = await prepareProject(store, id);
      return presentPreview(ctx, p);
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });

  bot.command("loyiha_ochir", (ctx) => {
    const id = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(id)) return ctx.reply("❌ id yuboring. Masalan: /loyiha_ochir 2  (/loyihalar dan)");
    return ctx.reply(store.removeProject(id) ? `✅ ${id}-loyiha o'chirildi.` : `❌ ${id} topilmadi.`);
  });

  const PROJECT_FORMAT = `➕ Yangi loyiha. Quyidagi formatда yuboring (| bilan ajrating):

/loyiha_qosh Nom | qisqa ta'rif | url | to'liq tavsif | imkoniyat1; imkoniyat2; imkoniyat3 | tex1, tex2

• url yo'q bo'lsa "-" qo'ying
• oxirgi (texnologiyalar) qismi ixtiyoriy

Misol:
/loyiha_qosh Falcon CRM | Bizneslar uchun CRM | https://falcon.uz | Sotuvlar va mijozlarni boshqarish tizimi | Lidlar; Hisobotlar; Rollar | Next.js, Prisma`;

  bot.command("loyiha_qosh", (ctx) => {
    const raw = (ctx.match ?? "").trim();
    if (!raw) return ctx.reply(PROJECT_FORMAT);
    const parts = raw.split("|").map((s) => s.trim());
    if (parts.length < 5) return ctx.reply("❌ Kamida 5 qism kerak.\n\n" + PROJECT_FORMAT);
    const [name, tagline, urlRaw, description, highlightsRaw, techRaw] = parts;
    const highlights = highlightsRaw.split(";").map((h) => h.trim()).filter(Boolean);
    if (!name || !tagline || !description || highlights.length === 0) {
      return ctx.reply("❌ Nom, ta'rif, tavsif va kamida 1 imkoniyat bo'lishi shart.");
    }
    store.addProject({
      name,
      tagline,
      url: urlRaw && urlRaw !== "-" ? urlRaw : undefined,
      description,
      highlights,
      tech: techRaw ? techRaw.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    });
    return ctx.reply(`✅ Loyiha qo'shildi: ${name}\nJami: ${store.listProjects().length} ta loyiha.`);
  });

  // "✅ Yuborish" bosilganда — postni kanalga joylaydi.
  bot.callbackQuery(/^send:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    const p = pending.get(token);
    if (!p) {
      await ctx.answerCallbackQuery("Muddati o'tgan");
      return ctx.editMessageText("⌛ Bu taklif eskirgan — qaytadan buyruq bering.");
    }
    pending.delete(token);
    await ctx.answerCallbackQuery("Yuborilmoqda...");
    try {
      await publishPrepared(store, p);
      await ctx.editMessageText(`✅ Kanalga yuborildi:\n${p.title}`);
    } catch (err) {
      await ctx.editMessageText(`❌ Yuborishда xato: ${(err as Error).message}`);
    }
  });

  // "❌ Bekor" bosilganда — bekor qiladi.
  bot.callbackQuery(/^cancel:(.+)$/, async (ctx) => {
    pending.delete(ctx.match[1]);
    await ctx.answerCallbackQuery("Bekor qilindi");
    await ctx.editMessageText("❌ Bekor qilindi — hech narsa yuborilmadi.");
  });

  // "✏️ Tahrir" bosilganда — admin yangi matn yuborishini kutadi.
  bot.callbackQuery(/^edit:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    if (!pending.has(token)) {
      await ctx.answerCallbackQuery("Muddati o'tgan");
      return ctx.editMessageText("⌛ Bu taklif eskirgan — qaytadan buyruq bering.");
    }
    if (ctx.from) {
      awaitingEdit.set(ctx.from.id, token);
      setTimeout(() => awaitingEdit.delete(ctx.from!.id), 10 * 60 * 1000);
    }
    await ctx.answerCallbackQuery();
    return ctx.reply("✏️ To'g'rilangan to'liq matnni yuboring (imzo avtomatik qo'shiladi):");
  });

  // Tahrir rejimidaги admin yuborgan matn — postни yangilab, qayta ko'rsatadi.
  bot.on("message:text", async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const token = awaitingEdit.get(uid);
    if (!token) return; // tahrir kutilmayapti — oddiy matn, e'tiborsiz
    awaitingEdit.delete(uid);
    const p = pending.get(token);
    if (!p) return ctx.reply("⌛ Taklif eskirgan — qaytadan buyruq bering.");
    const sig = effective(store).signature;
    p.text = escapeHtml(ctx.message.text) + (sig ? `\n\n${escapeHtml(sig)}` : "");
    pending.set(token, p);
    await ctx.reply("✅ Matn yangilandi. Qaytadan ko'rib chiqing:");
    return presentPreview(ctx, p);
  });

  bot.catch((err) => console.error("[admin-bot] xato:", err.message));
  bot.start({ onStart: (me) => console.log(`[admin-bot] @${me.username} ishga tushdi`) });
  return bot;
}
