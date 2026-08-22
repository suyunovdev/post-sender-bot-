import { Bot, InlineKeyboard, type Context } from "grammy";
import { config } from "./config.js";
import type { StateStore } from "./db.js";
import { effective, parsePattern, parseTimes, challengeState, tashkentToday } from "./settings.js";
import {
  runOnce,
  prepareTopic,
  prepareProject,
  publishPrepared,
  postChallengeAndAdvance,
  challengePreviewText,
  type PreparedPost,
} from "./poster.js";
import { editChannelMessage, escapeHtml } from "./telegram.js";
import { parseLevel, LEVEL_META, type Level } from "./challenge.js";

const PROJECT_INPUT_HELP = `➕ Yangi loyiha — quyidagi formatda yuboring (| bilan ajrating):

Nom | qisqa ta'rif | url | to'liq tavsif | imkoniyat1; imkoniyat2 | tex1, tex2

• url yo'q bo'lsa "-" qo'ying
• texnologiyalar (oxirgi) ixtiyoriy

Misol:
Falcon CRM | Bizneslar uchun CRM | https://falcon.uz | Sotuvlar va mijozlarni boshqarish | Lidlar; Hisobotlar | Next.js, Prisma`;

const PROMPTS: Record<string, string> = {
  mavzu: "📝 Mavzuni yozing (masalan: sun'iy intellekt kelajagi):",
  tahrir: "✏️ Oxirgi post uchun to'g'rilangan to'liq matnni yuboring (imzo o'zi qo'shiladi):",
  imzo: "✍️ Yangi imzoni yuboring (imzosiz bo'lishi uchun bitta \"-\" yuboring):",
  jadval: "🕐 Post vaqtlarini yuboring (masalan: 10:00 19:00):",
  navbat: "🔀 Navbatni yuboring (turlar: rss, original, project — masalan: rss,rss,original,project):",
  soni: "🔢 Bir ishda nechta post? (1-10):",
  manba_qosh: "📡 Manba: Nom va url (masalan: TechCrunch https://techcrunch.com/feed/):",
  loyiha_qosh: PROJECT_INPUT_HELP,
  ch_kun: "📆 Qaysi kun? (1-30):",
  ch_vaqt: "🕐 Challenge vaqti (masalan: 09:00):",
};

function tashkentNow(): { minutes: number } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  const [h, m] = p.split(":").map((x) => parseInt(x, 10));
  return { minutes: h * 60 + m };
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

  const pending = new Map<string, PreparedPost>();
  const awaitingInput = new Map<number, { kind: string; token?: string }>();
  let tokenCounter = 0;

  const arm = (uid: number, kind: string, token?: string) => {
    awaitingInput.set(uid, { kind, token });
    setTimeout(() => {
      const cur = awaitingInput.get(uid);
      if (cur && cur.kind === kind) awaitingInput.delete(uid);
    }, 10 * 60 * 1000);
  };

  // ---- Amal-yordamchilari (slash va tugmalar — ikkalasi ham shularni chaqiradi) ----
  const applyImzo = (text: string): string => {
    const v = text === "-" ? "" : text;
    store.setSetting("signature", v);
    return v ? `✅ Imzo o'rnatildi:\n${v}` : "✅ Imzo olib tashlandi.";
  };
  const applyJadval = (text: string): string => {
    const times = parseTimes(text);
    if (times.length === 0) return "❌ Vaqt topilmadi. Masalan: 10:00 19:00";
    store.setSetting("schedule", times.join(","));
    return `✅ Jadval: ${times.join(", ")} (Toshkent)\nKeyingi post: ${nextFireLabel(times)}`;
  };
  const applyNavbat = (text: string): string => {
    const pattern = parsePattern(text);
    if (pattern.length === 0) return "❌ Faqat: rss, original, project. Masalan: rss,rss,original,project";
    store.setSetting("pattern", pattern.join(","));
    return `✅ Navbat: ${pattern.join(", ")}`;
  };
  const applySoni = (text: string): string => {
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10) return "❌ 1 dan 10 gacha son yuboring.";
    store.setSetting("max_per_run", String(n));
    return `✅ Bir ishda ${n} ta post qo'yiladi.`;
  };
  const applyManbaQosh = (text: string): string => {
    const parts = text.split(/\s+/);
    if (parts.length < 2) return "❌ Format: Nom url\nMasalan: TechCrunch https://techcrunch.com/feed/";
    const url = parts[parts.length - 1];
    const name = parts.slice(0, -1).join(" ");
    if (!/^https?:\/\//i.test(url)) return "❌ url http(s):// bilan boshlanishi kerak.";
    store.addSource(name, url);
    return `✅ Manba qo'shildi: ${name}`;
  };
  const applyLoyihaQosh = (raw: string): string => {
    const parts = raw.split("|").map((s) => s.trim());
    if (parts.length < 5) return "❌ Kamida 5 qism kerak.\n\n" + PROJECT_INPUT_HELP;
    const [name, tagline, urlRaw, description, highlightsRaw, techRaw] = parts;
    const highlights = highlightsRaw.split(";").map((h) => h.trim()).filter(Boolean);
    if (!name || !tagline || !description || highlights.length === 0) {
      return "❌ Nom, ta'rif, tavsif va kamida 1 imkoniyat shart.";
    }
    store.addProject({
      name,
      tagline,
      url: urlRaw && urlRaw !== "-" ? urlRaw : undefined,
      description,
      highlights,
      tech: techRaw ? techRaw.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
    });
    return `✅ Loyiha qo'shildi: ${name}\nJami: ${store.listProjects().length} ta.`;
  };
  const applyChKun = (text: string): string => {
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < 1 || n > 30) return "❌ 1-30 orasida kun yuboring.";
    store.setSetting("challenge_day", String(n));
    return `✅ Joriy kun: ${n}/30`;
  };
  const applyChVaqt = (text: string): string => {
    const t = parseTimes(text)[0];
    if (!t) return "❌ Vaqt: masalan 09:00";
    store.setSetting("challenge_time", t);
    return `✅ Challenge vaqti: ${t} (Toshkent)`;
  };
  const applyTahrir = async (text: string): Promise<string> => {
    const mid = store.getSetting("last_message_id");
    if (!mid) return "❌ Tahrirlash uchun post topilmadi.";
    const sig = effective(store).signature;
    const full = escapeHtml(text) + (sig ? `\n\n${escapeHtml(sig)}` : "");
    await editChannelMessage(parseInt(mid, 10), full);
    return "✅ Oxirgi post tahrirlandi.";
  };

  // ---- Matnli holatlar (statuslar) ----
  const statusText = (): string => {
    const s = effective(store);
    return [
      `📊 <b>Holat:</b> ${s.paused ? "⏸ to'xtatilgan" : "▶️ faol"}`,
      `🕐 Jadval: ${s.scheduleTimes.join(", ")} (Toshkent)`,
      `⏭ Keyingi: ${s.paused ? "—" : nextFireLabel(s.scheduleTimes)}`,
      `🔢 Bir ishda: ${s.maxPerRun} post`,
      `🔀 Navbat: ${s.pattern.join(", ")}`,
      `✍️ Imzo: ${escapeHtml(s.signature || "(yo'q)")}`,
      `🖼 Rasm: ${s.images ? "yoqilgan" : "o'chirilgan"}`,
      `📡 ${store.listSources().length} manba · 🚀 ${store.listProjects().length} loyiha`,
    ].join("\n");
  };
  const challengeStatusText = (): string => {
    const cs = challengeState(store);
    return [
      `📅 <b>Challenge:</b> ${cs.on ? "▶️ faol" : "⏸ o'chirilgan"}`,
      `Kun: ${cs.day}/30`,
      `Daraja: ${LEVEL_META[cs.level].emoji} ${LEVEL_META[cs.level].name}`,
      `Vaqt: ${cs.time} (Toshkent)`,
      `Bugun joylandi: ${cs.postedDate === tashkentToday() ? "ha ✅" : "yo'q"}`,
    ].join("\n");
  };
  const projectListText = (): string => {
    const list = store.listProjects();
    if (!list.length) return "Loyiha yo'q.";
    return "🚀 <b>Loyihalar:</b>\n" + list.map((p) => `${p.id}. ${escapeHtml(p.name)} — ${escapeHtml(p.tagline)}`).join("\n");
  };
  const sourceListText = (): string => {
    const list = store.listSources();
    if (!list.length) return "Manba yo'q.";
    return "📡 <b>Manbalar:</b>\n" + list.map((s) => `${s.id}. ${escapeHtml(s.name)}`).join("\n");
  };

  // ---- Klaviaturalar ----
  const backKb = (target: string) => new InlineKeyboard().text("⬅️ Orqaga", `nav:${target}`);
  const listKb = (items: Array<{ id: number; name: string }>, prefix: string, back: string) => {
    const kb = new InlineKeyboard();
    for (const it of items) kb.text(`${it.id}. ${it.name}`, `${prefix}:${it.id}`).row();
    kb.text("⬅️ Orqaga", `nav:${back}`);
    return kb;
  };
  const mainKb = () =>
    new InlineKeyboard()
      .text("📊 Holat", "nav:holat").text("⚡ Hoziroq post", "act:post").row()
      .text("📝 Mavzu post", "in:mavzu").text("✏️ Tahrir", "in:tahrir").row()
      .text("⚙️ Sozlamalar", "nav:set").text("🚀 Loyihalar", "nav:proj").row()
      .text("📡 Manbalar", "nav:src").text("📅 Challenge", "nav:ch");
  const setKb = () => {
    const s = effective(store);
    return new InlineKeyboard()
      .text(s.paused ? "▶️ Jadvalni yoqish" : "⏸ Jadvalni to'xtatish", "act:pause_toggle").row()
      .text(s.images ? "🖼 Rasmni o'chirish" : "🖼 Rasmni yoqish", "act:img_toggle").row()
      .text("🕐 Jadval", "in:jadval").text("🔀 Navbat", "in:navbat").row()
      .text("🔢 Post soni", "in:soni").text("✍️ Imzo", "in:imzo").row()
      .text("⬅️ Orqaga", "nav:main");
  };
  const projKb = () =>
    new InlineKeyboard()
      .text("📋 Ro'yxat", "nav:proj_list").row()
      .text("📤 Loyiha posti", "nav:proj_post").row()
      .text("➕ Qo'shish", "in:loyiha_qosh").text("🗑 O'chirish", "nav:proj_del").row()
      .text("⬅️ Orqaga", "nav:main");
  const srcKb = () =>
    new InlineKeyboard()
      .text("📋 Ro'yxat", "nav:src_list").row()
      .text("➕ Qo'shish", "in:manba_qosh").text("🗑 O'chirish", "nav:src_del").row()
      .text("⬅️ Orqaga", "nav:main");
  const chKb = () => {
    const cs = challengeState(store);
    return new InlineKeyboard()
      .text(cs.on ? "⏸ Challenge o'chirish" : "▶️ Challenge yoqish", "act:ch_toggle").row()
      .text(`🎚 Daraja: ${LEVEL_META[cs.level].emoji} ${LEVEL_META[cs.level].name}`, "nav:ch_level").row()
      .text("👁 Ko'rish", "act:ch_korish").text("📤 Joylash", "act:ch_post").row()
      .text("📊 Holat", "nav:ch_holat").row()
      .text("📆 Kun", "in:ch_kun").text("🕐 Vaqt", "in:ch_vaqt").row()
      .text("⬅️ Orqaga", "nav:main");
  };
  const levelKb = () =>
    new InlineKeyboard()
      .text("🟢 Boshlang'ich", "lvl:green").row()
      .text("🟡 O'rta", "lvl:yellow").row()
      .text("🔴 Qiyin", "lvl:red").row()
      .text("⬅️ Orqaga", "nav:ch");

  const screen = (name: string): { text: string; kb: InlineKeyboard } => {
    switch (name) {
      case "set": return { text: "⚙️ <b>Sozlamalar</b>", kb: setKb() };
      case "proj": return { text: "🚀 <b>Loyihalar</b>", kb: projKb() };
      case "src": return { text: "📡 <b>Manbalar</b>", kb: srcKb() };
      case "ch": return { text: "📅 <b>30 kunlik JS Challenge</b>", kb: chKb() };
      case "ch_level": return { text: "🎚 <b>Darajani tanlang</b>\n(o'quvchilarga shu darajada ketadi)", kb: levelKb() };
      case "holat": return { text: statusText(), kb: backKb("main") };
      case "ch_holat": return { text: challengeStatusText(), kb: backKb("ch") };
      case "proj_list": return { text: projectListText(), kb: backKb("proj") };
      case "src_list": return { text: sourceListText(), kb: backKb("src") };
      case "proj_post": return { text: "📤 <b>Qaysi loyiha posti?</b>", kb: listKb(store.listProjects(), "pp", "proj") };
      case "proj_del": return { text: "🗑 <b>Qaysi loyihani o'chirish?</b>", kb: listKb(store.listProjects(), "pd", "proj") };
      case "src_del": return { text: "🗑 <b>Qaysi manbani o'chirish?</b>", kb: listKb(store.listSources(), "sd", "src") };
      default: return { text: "🤖 <b>Boshqaruv paneli</b>\nKerakli bo'limni tanlang:", kb: mainKb() };
    }
  };
  const sendScreen = (ctx: Context, name: string) => {
    const sc = screen(name);
    return ctx.reply(sc.text, { parse_mode: "HTML", reply_markup: sc.kb, link_preview_options: { is_disabled: true } });
  };
  const editScreen = async (ctx: Context, name: string) => {
    const sc = screen(name);
    try {
      await ctx.editMessageText(sc.text, { parse_mode: "HTML", reply_markup: sc.kb, link_preview_options: { is_disabled: true } });
    } catch {
      // "message is not modified" va shu kabi — e'tiborsiz
    }
  };

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
    const imgNote = effective(store).images ? "\n\n🖼 <i>Yuborilganda mos rasm ham qo'shiladi.</i>" : "";
    return ctx.reply(`👀 <b>Ko'rib chiqing (hali yuborilmadi):</b>\n\n${p.text}${imgNote}`, {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  };

  // ==== Buyruqlar (tugmalar bilan bir xil ishlaydi) ====
  bot.command(["start", "menu"], (ctx) => sendScreen(ctx, "main"));
  bot.command("holat", (ctx) => sendScreen(ctx, "holat"));
  bot.command("post", async (ctx) => {
    await ctx.reply("⏳ Post tayyorlanmoqda...");
    const r = await runOnce(store, { max: 1 });
    return ctx.reply(r.lines.join("\n") || "Hech narsa yuborilmadi.");
  });
  bot.command("mavzu", async (ctx) => {
    const topic = (ctx.match ?? "").trim();
    if (!topic) return ctx.reply(PROMPTS.mavzu);
    await ctx.reply(`⏳ "${topic}" tayyorlanmoqda...`);
    try {
      return presentPreview(ctx, await prepareTopic(store, topic));
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });
  bot.command("tahrir", async (ctx) => {
    const text = (ctx.match ?? "").trim();
    if (!text) return ctx.reply(PROMPTS.tahrir);
    try {
      return ctx.reply(await applyTahrir(text));
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });
  bot.command("pauza", (ctx) => {
    store.setSetting("paused", "1");
    return ctx.reply("⏸ Jadval to'xtatildi.");
  });
  bot.command("davom", (ctx) => {
    store.setSetting("paused", "0");
    return ctx.reply(`▶️ Jadval yoqildi. Keyingi post: ${nextFireLabel(effective(store).scheduleTimes)}`);
  });
  bot.command("imzo", (ctx) => ctx.reply(applyImzo((ctx.match ?? "").trim())));
  bot.command("jadval", (ctx) => ctx.reply(applyJadval(ctx.match ?? "")));
  bot.command("navbat", (ctx) => ctx.reply(applyNavbat(ctx.match ?? "")));
  bot.command("soni", (ctx) => ctx.reply(applySoni((ctx.match ?? "").trim())));
  bot.command("rasm", (ctx) => {
    const v = (ctx.match ?? "").trim().toLowerCase();
    if (v !== "on" && v !== "off") return ctx.reply("❌ /rasm on  yoki  /rasm off");
    store.setSetting("images", v === "on" ? "1" : "0");
    return ctx.reply(v === "on" ? "✅ Rasm YOQILDI." : "✅ Rasm O'CHIRILDI.");
  });
  bot.command("manbalar", (ctx) => ctx.reply(sourceListText(), { parse_mode: "HTML" }));
  bot.command("manba_qosh", (ctx) => ctx.reply(applyManbaQosh((ctx.match ?? "").trim())));
  bot.command("manba_ochir", (ctx) => {
    const id = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(id)) return ctx.reply("❌ id yuboring.");
    return ctx.reply(store.removeSource(id) ? `✅ ${id} o'chirildi.` : `❌ ${id} topilmadi.`);
  });
  bot.command("loyihalar", (ctx) => ctx.reply(projectListText(), { parse_mode: "HTML" }));
  bot.command("loyiha_qosh", (ctx) => {
    const raw = (ctx.match ?? "").trim();
    if (!raw) return ctx.reply(PROJECT_INPUT_HELP);
    return ctx.reply(applyLoyihaQosh(raw));
  });
  bot.command("loyiha_post", async (ctx) => {
    const id = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(id)) return sendScreen(ctx, "proj_post");
    await ctx.reply("⏳ Tayyorlanmoqda...");
    try {
      return presentPreview(ctx, await prepareProject(store, id));
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });
  bot.command("loyiha_ochir", (ctx) => {
    const id = parseInt((ctx.match ?? "").trim(), 10);
    if (!Number.isFinite(id)) return ctx.reply("❌ id yuboring.");
    return ctx.reply(store.removeProject(id) ? `✅ ${id} o'chirildi.` : `❌ ${id} topilmadi.`);
  });
  bot.command("challenge", (ctx) => {
    const v = (ctx.match ?? "").trim().toLowerCase();
    if (v === "on") store.setSetting("challenge_on", "1");
    else if (v === "off") store.setSetting("challenge_on", "0");
    else return ctx.reply("❌ /challenge on  yoki  /challenge off");
    return sendScreen(ctx, "ch");
  });
  bot.command("daraja", (ctx) => {
    const lvl = parseLevel(ctx.match ?? "");
    if (!lvl) return ctx.reply("❌ Daraja: yashil | sariq | qizil");
    store.setSetting("challenge_level", lvl);
    return ctx.reply(`✅ Daraja: ${LEVEL_META[lvl].emoji} ${LEVEL_META[lvl].name}`);
  });
  bot.command("challenge_kun", (ctx) => ctx.reply(applyChKun((ctx.match ?? "").trim())));
  bot.command("challenge_vaqt", (ctx) => ctx.reply(applyChVaqt(ctx.match ?? "")));
  bot.command("challenge_holat", (ctx) => sendScreen(ctx, "ch_holat"));
  bot.command("challenge_korish", (ctx) =>
    ctx.reply(challengePreviewText(store), { parse_mode: "HTML", link_preview_options: { is_disabled: true } })
  );
  bot.command("challenge_post", async (ctx) => {
    if (challengeState(store).postedDate === tashkentToday()) return ctx.reply("⚠️ Bugun allaqachon joylangan.");
    await ctx.reply("⏳ Tayyorlanmoqda...");
    try {
      const r = await postChallengeAndAdvance(store);
      return ctx.reply(`✅ ${r.label}${r.finished ? "\n🎉 Tugadi!" : ""}`);
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`);
    }
  });

  // ==== Tasdiq tugmalari (preview) ====
  bot.callbackQuery(/^send:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    const p = pending.get(token);
    if (!p) {
      await ctx.answerCallbackQuery("Muddati o'tgan");
      return ctx.editMessageText("⌛ Bu taklif eskirgan.");
    }
    pending.delete(token);
    await ctx.answerCallbackQuery("Yuborilmoqda...");
    try {
      await publishPrepared(store, p);
      await ctx.editMessageText(`✅ Kanalga yuborildi:\n${p.title}`);
    } catch (err) {
      await ctx.editMessageText(`❌ Xato: ${(err as Error).message}`);
    }
  });
  bot.callbackQuery(/^cancel:(.+)$/, async (ctx) => {
    pending.delete(ctx.match[1]);
    await ctx.answerCallbackQuery("Bekor qilindi");
    await ctx.editMessageText("❌ Bekor qilindi.");
  });
  bot.callbackQuery(/^edit:(.+)$/, async (ctx) => {
    const token = ctx.match[1];
    if (!pending.has(token)) {
      await ctx.answerCallbackQuery("Muddati o'tgan");
      return ctx.editMessageText("⌛ Bu taklif eskirgan.");
    }
    if (ctx.from) arm(ctx.from.id, "edit_preview", token);
    await ctx.answerCallbackQuery();
    return ctx.reply("✏️ To'g'rilangan to'liq matnni yuboring:");
  });

  // ==== Menyu tugmalari (nav / act / in / lvl / pp / pd / sd) ====
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const idx = data.indexOf(":");
    const prefix = idx === -1 ? data : data.slice(0, idx);
    const arg = idx === -1 ? "" : data.slice(idx + 1);
    const uid = ctx.from?.id;

    if (prefix === "nav") {
      await ctx.answerCallbackQuery();
      return editScreen(ctx, arg);
    }
    if (prefix === "in") {
      if (uid !== undefined) arm(uid, arg);
      await ctx.answerCallbackQuery();
      return ctx.reply(PROMPTS[arg] ?? "Qiymatni yuboring:");
    }
    if (prefix === "lvl") {
      const lvl = arg as Level;
      store.setSetting("challenge_level", lvl);
      await ctx.answerCallbackQuery(`Daraja: ${LEVEL_META[lvl].name}`);
      return editScreen(ctx, "ch");
    }
    if (prefix === "pp") {
      await ctx.answerCallbackQuery("Tayyorlanmoqda...");
      try {
        return presentPreview(ctx, await prepareProject(store, parseInt(arg, 10)));
      } catch (err) {
        return ctx.reply(`❌ ${(err as Error).message}`);
      }
    }
    if (prefix === "pd") {
      const ok = store.removeProject(parseInt(arg, 10));
      await ctx.answerCallbackQuery(ok ? "O'chirildi" : "Topilmadi");
      return editScreen(ctx, "proj_del");
    }
    if (prefix === "sd") {
      const ok = store.removeSource(parseInt(arg, 10));
      await ctx.answerCallbackQuery(ok ? "O'chirildi" : "Topilmadi");
      return editScreen(ctx, "src_del");
    }
    if (prefix === "act") {
      if (arg === "post") {
        await ctx.answerCallbackQuery("Tayyorlanmoqda...");
        const r = await runOnce(store, { max: 1 });
        return ctx.reply(r.lines.join("\n") || "Hech narsa yuborilmadi.", { reply_markup: backKb("main") });
      }
      if (arg === "pause_toggle") {
        const s = effective(store);
        store.setSetting("paused", s.paused ? "0" : "1");
        await ctx.answerCallbackQuery(s.paused ? "Yoqildi" : "To'xtatildi");
        return editScreen(ctx, "set");
      }
      if (arg === "img_toggle") {
        const s = effective(store);
        store.setSetting("images", s.images ? "0" : "1");
        await ctx.answerCallbackQuery(s.images ? "O'chirildi" : "Yoqildi");
        return editScreen(ctx, "set");
      }
      if (arg === "ch_toggle") {
        const cs = challengeState(store);
        store.setSetting("challenge_on", cs.on ? "0" : "1");
        await ctx.answerCallbackQuery(cs.on ? "O'chirildi" : "Yoqildi");
        return editScreen(ctx, "ch");
      }
      if (arg === "ch_korish") {
        await ctx.answerCallbackQuery();
        return ctx.reply(challengePreviewText(store), {
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: backKb("ch"),
        });
      }
      if (arg === "ch_post") {
        if (challengeState(store).postedDate === tashkentToday()) {
          await ctx.answerCallbackQuery("Bugun joylangan");
          return;
        }
        await ctx.answerCallbackQuery("Joylanmoqda...");
        try {
          const r = await postChallengeAndAdvance(store);
          return ctx.reply(`✅ ${r.label}${r.finished ? "\n🎉 Tugadi!" : ""}`, { reply_markup: backKb("ch") });
        } catch (err) {
          return ctx.reply(`❌ ${(err as Error).message}`);
        }
      }
    }
    await ctx.answerCallbackQuery();
  });

  // ==== Matn kutilganda (tugmalar so'ragan qiymat) ====
  bot.on("message:text", async (ctx) => {
    const uid = ctx.from?.id;
    if (uid === undefined) return;
    const st = awaitingInput.get(uid);
    if (!st) return; // hech narsa kutilmayapti
    awaitingInput.delete(uid);
    const text = ctx.message.text.trim();
    const menuBtn = backKb("main");
    try {
      switch (st.kind) {
        case "edit_preview": {
          const p = st.token ? pending.get(st.token) : undefined;
          if (!p) return void ctx.reply("⌛ Taklif eskirgan.");
          const sig = effective(store).signature;
          p.text = escapeHtml(text) + (sig ? `\n\n${escapeHtml(sig)}` : "");
          pending.set(st.token!, p);
          await ctx.reply("✅ Matn yangilandi. Qaytadan ko'rib chiqing:");
          return void presentPreview(ctx, p);
        }
        case "mavzu": {
          if (!text) return void ctx.reply("❌ Mavzu bo'sh.", { reply_markup: menuBtn });
          await ctx.reply(`⏳ "${text}" tayyorlanmoqda...`);
          return void presentPreview(ctx, await prepareTopic(store, text));
        }
        case "tahrir":
          return void ctx.reply(await applyTahrir(text), { reply_markup: menuBtn });
        case "imzo":
          return void ctx.reply(applyImzo(text), { reply_markup: menuBtn });
        case "jadval":
          return void ctx.reply(applyJadval(text), { reply_markup: menuBtn });
        case "navbat":
          return void ctx.reply(applyNavbat(text), { reply_markup: menuBtn });
        case "soni":
          return void ctx.reply(applySoni(text), { reply_markup: menuBtn });
        case "manba_qosh":
          return void ctx.reply(applyManbaQosh(text), { reply_markup: menuBtn });
        case "loyiha_qosh":
          return void ctx.reply(applyLoyihaQosh(text), { reply_markup: menuBtn });
        case "ch_kun":
          return void ctx.reply(applyChKun(text), { reply_markup: menuBtn });
        case "ch_vaqt":
          return void ctx.reply(applyChVaqt(text), { reply_markup: menuBtn });
        default:
          return;
      }
    } catch (err) {
      return void ctx.reply(`❌ ${(err as Error).message}`, { reply_markup: menuBtn });
    }
  });

  bot.catch((err) => console.error("[admin-bot] xato:", err.message));
  bot.start({ onStart: (me) => console.log(`[admin-bot] @${me.username} ishga tushdi`) });
  return bot;
}
