import { config, SOURCES } from "./config.js";
import { StateStore } from "./db.js";
import { fetchAll, type NewsItem } from "./rss.js";
import { rewrite } from "./rewrite.js";
import { generateOriginal } from "./original.js";
import { PROJECTS, generateProjectPost } from "./projects.js";
import { formatMessage, publish, checkAccess } from "./telegram.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SlotType = "rss" | "original" | "project";

async function healthcheck(): Promise<void> {
  await checkAccess();
  console.log("[healthcheck] Bot va kanal ulanishi OK ✅");
}

/** Global navbat raqamiga qarab bu slot qaysi tur post bo'lishi kerak. */
function slotType(seq: number): SlotType {
  const pattern = config.contentPattern;
  if (pattern.length === 0) return "rss";
  return pattern[(seq - 1) % pattern.length];
}

/** Noldan original post yozib, kanalga yuboradi va bazaga belgilaydi. */
async function postOriginal(store: StateStore, seq: number): Promise<string> {
  const post = await generateOriginal(store.recentTitles("Original", 15), seq);
  await publish(formatMessage(post)); // manbasiz, matn-only
  store.markPosted(`original:${Date.now()}`, "Original", post.title);
  return post.title;
}

/** O'z loyiha haqida post yozib yuboradi. Loyiha bo'lmasa null qaytaradi. */
async function postProject(store: StateStore, seq: number): Promise<string | null> {
  if (PROJECTS.length === 0) return null;
  // Loyihalar bo'ylab navbat bilan: nechta loyiha posti chiqqan bo'lsa, shu indeks.
  const project = PROJECTS[store.countBySource("Project") % PROJECTS.length];
  const post = await generateProjectPost(project, store.recentTitles("Project", 15), seq);
  const link = project.url ? { url: project.url, label: `🌐 ${project.name}` } : undefined;
  await publish(formatMessage(post, link));
  store.markPosted(`project:${Date.now()}`, "Project", post.title);
  return `${post.title}  (${project.name})`;
}

/** Bitta RSS yangilikni qayta yozib yuboradi. */
async function postRss(store: StateStore, item: NewsItem, seq: number): Promise<string> {
  const post = await rewrite(item);
  const link = { url: item.link, label: `🔗 Manba: ${item.source}` };
  await publish(formatMessage(post, link), item.imageUrl);
  store.markPosted(item.id, item.source, item.title);
  return `${post.title}  (${item.source})`;
}

async function run(): Promise<void> {
  const store = new StateStore(config.dbPath);
  store.prune();

  try {
    console.log(`[run] ${SOURCES.length} ta manbadan yangiliklar o'qilyapti...`);
    const items = await fetchAll(SOURCES);
    const freshQueue = items.filter((it) => !store.isPosted(it.id));
    console.log(`[run] Jami ${items.length}, yangi ${freshQueue.length} ta RSS topildi.`);

    let seq = store.getSeq();
    let sent = 0;

    for (let slot = 0; slot < config.maxPostsPerRun; slot++) {
      const nextSeq = seq + 1;
      const type = slotType(nextSeq);
      try {
        if (type === "original") {
          console.log(`[run] ✅ Original (#${nextSeq}): ${await postOriginal(store, nextSeq)}`);
        } else if (type === "project") {
          const title = await postProject(store, nextSeq);
          if (title) {
            console.log(`[run] ✅ Loyiha (#${nextSeq}): ${title}`);
          } else {
            // Loyiha yo'q — kanal jim qolmasin, original yozamiz.
            console.log(`[run] ✅ Original (#${nextSeq}, loyiha yo'q): ${await postOriginal(store, nextSeq)}`);
          }
        } else {
          const item = freshQueue.shift();
          if (item) {
            console.log(`[run] ✅ RSS (#${nextSeq}): ${await postRss(store, item, nextSeq)}`);
          } else {
            // RSS navbati, lekin yangi yangilik yo'q — original bilan to'ldiramiz.
            console.log(`[run] ✅ Original (#${nextSeq}, RSS bo'sh edi): ${await postOriginal(store, nextSeq)}`);
          }
        }
        // Faqat muvaffaqiyatda navbat oshadi — xatolikda navbat buzilmaydi.
        seq = nextSeq;
        store.setSeq(seq);
        sent++;
        if (slot < config.maxPostsPerRun - 1) await sleep(3000); // flood limitidan saqlanish
      } catch (err) {
        console.error(`[run] ❌ Slot xatosi (#${nextSeq}, ${type}):`, (err as Error).message);
        // Navbatni oshirmaymiz — keyingi ishga tushishда shu slot qayta uriniladi.
      }
    }

    console.log(`[run] Yakun: ${sent} ta post yuborildi.`);
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--healthcheck")) {
    await healthcheck();
    return;
  }
  await run();
}

main().catch((err) => {
  console.error("[fatal]", (err as Error).message);
  process.exit(1);
});
