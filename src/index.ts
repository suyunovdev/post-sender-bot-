import { config, SOURCES } from "./config.js";
import { StateStore } from "./db.js";
import { PROJECTS } from "./projects.js";
import { runOnce } from "./poster.js";
import { checkAccess } from "./telegram.js";

/**
 * CLI (qo'lda ishlatish uchun). Doimiy xizmat: `node dist/service.js`.
 *   node dist/index.js --healthcheck   → bot+kanal ulanishini tekshirish
 *   node dist/index.js --once          → hoziroq bir ish (post qo'yadi)
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--healthcheck")) {
    await checkAccess();
    console.log("[healthcheck] Bot va kanal ulanishi OK ✅");
    return;
  }

  if (args.includes("--once")) {
    const store = new StateStore(config.dbPath);
    store.seedIfEmpty(SOURCES, PROJECTS);
    try {
      const r = await runOnce(store);
      console.log(r.lines.join("\n"));
      console.log(`[once] Yakun: ${r.sent} ta post.`);
    } finally {
      store.close();
    }
    return;
  }

  console.log(`Foydalanish:
  node dist/service.js               # doimiy xizmat (rejalashtiruvchi + admin-bot)
  node dist/index.js --healthcheck   # bot+kanal ulanishini tekshirish
  node dist/index.js --once          # hoziroq bir marta post qo'yish`);
}

main().catch((err) => {
  console.error("[fatal]", (err as Error).message);
  process.exit(1);
});
