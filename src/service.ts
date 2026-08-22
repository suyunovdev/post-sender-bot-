import { config, SOURCES } from "./config.js";
import { StateStore } from "./db.js";
import { PROJECTS } from "./projects.js";
import { effective, challengeState, tashkentToday } from "./settings.js";
import { runOnce, postChallengeAndAdvance } from "./poster.js";
import { startAdminBot } from "./admin.js";
import { notifyAdmins } from "./alerts.js";

/** Hozirgi Toshkent vaqti "HH:MM" shaklida. */
function tashkentHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function main(): Promise<void> {
  // Kutilmagan xatolar — adminga ogohlantirish
  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    void notifyAdmins(`🔴 tg-news-bot kutilmagan xato (unhandledRejection):\n${String(reason)}`);
  });
  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    void notifyAdmins(`🔴 tg-news-bot kutilmagan xato (uncaughtException):\n${err.message}`).finally(
      () => process.exit(1)
    );
  });

  const store = new StateStore(config.dbPath);
  // Manbalar/loyihalarni koddan bazaga bir marta ko'chirish (keyin chatdan tahrirlanadi).
  store.seedIfEmpty(SOURCES, PROJECTS);

  // Admin-bot (buyruqlar tinglaydi)
  startAdminBot(store);

  // Rejalashtiruvchi — har 30s tekshiradi, mos daqiqada bir marta post qo'yadi.
  let lastFired = "";
  let lastChallenge = "";
  setInterval(() => {
    void (async () => {
      const hhmm = tashkentHHMM();
      const stamp = `${new Date().toISOString().slice(0, 10)} ${hhmm}`;

      // 1) Challenge (30 kunlik) — mustaqil, /pauza ta'sir qilmaydi
      const cs = challengeState(store);
      if (cs.on && hhmm === cs.time && lastChallenge !== stamp && cs.postedDate !== tashkentToday()) {
        lastChallenge = stamp;
        console.log(`[challenge] ${hhmm} — kun ${cs.day} (${cs.level}) yuborilmoqda`);
        try {
          const r = await postChallengeAndAdvance(store);
          console.log(`[challenge] ✅ ${r.label}`);
          if (r.finished) await notifyAdmins("🎉 30 kunlik JS challenge tugadi! Tabriklaymiz.");
        } catch (err) {
          console.error("[challenge] xato:", (err as Error).message);
          await notifyAdmins(`🔴 Challenge post xatosi: ${(err as Error).message}`);
        }
      }

      // 2) Oddiy jadval
      const s = effective(store);
      if (s.paused) return;
      if (!s.scheduleTimes.includes(hhmm) || lastFired === stamp) return;
      lastFired = stamp;
      console.log(`[scheduler] ${hhmm} (Toshkent) — post boshlandi`);
      try {
        const r = await runOnce(store);
        console.log(r.lines.join("\n"));
        const failed = r.lines.filter((l) => l.startsWith("❌"));
        if (failed.length > 0) {
          await notifyAdmins(`⚠️ Post muammosi (${hhmm} Toshkent):\n${failed.join("\n")}`);
        } else if (r.sent === 0) {
          await notifyAdmins(`⚠️ ${hhmm} (Toshkent) da hech qanday post yuborilmadi.`);
        }
      } catch (err) {
        console.error("[scheduler] xato:", (err as Error).message);
        await notifyAdmins(`🔴 Rejalashtirilgan post ISHLAMADI (${hhmm} Toshkent):\n${(err as Error).message}`);
      }
    })();
  }, 30_000);

  const s = effective(store);
  console.log(
    `[service] ishga tushdi. Jadval: ${s.scheduleTimes.join(", ")} (Toshkent), ` +
      `bir ishda ${s.maxPerRun} post. Admin: ${config.adminUserIds.join(", ")}`
  );
}

main().catch((err) => {
  console.error("[fatal]", (err as Error).message);
  process.exit(1);
});
