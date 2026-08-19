import type { StateStore } from "./db.js";
import { fetchAll } from "./rss.js";
import { rewrite } from "./rewrite.js";
import { generateOriginal, generateOnTopic } from "./original.js";
import { generateProjectPost } from "./projects.js";
import { formatMessage, publish } from "./telegram.js";
import { effective, type SlotType } from "./settings.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunResult {
  sent: number;
  lines: string[];
}

/** Tayyorlangan, lekin hali yuborilmagan post (preview/tasdiq uchun). */
export interface PreparedPost {
  text: string;
  imageUrl?: string;
  markId: string;
  source: string;
  title: string;
}

// Bir vaqtda faqat bitta post-sikli ishlashi uchun oddiy qulf
// (rejalashtiruvchi va /post buyrug'i to'qnashmasin).
let running = false;

/** Tayyorlangan postni kanalga yuboradi va bazaga belgilaydi. */
export async function publishPrepared(store: StateStore, p: PreparedPost): Promise<void> {
  await publish(p.text, p.imageUrl);
  store.markPosted(p.markId, p.source, p.title);
}

/**
 * Admin bergan MAVZU bo'yicha post TAYYORLAYDI (yubormaydi — preview uchun).
 */
export async function prepareTopic(store: StateStore, topic: string): Promise<PreparedPost> {
  if (running) throw new Error("Hozir band — biroz kuting.");
  running = true;
  try {
    const s = effective(store);
    const post = await generateOnTopic(topic);
    return {
      text: formatMessage(post, undefined, s.signature),
      markId: `topic:${Date.now()}`,
      source: "Original",
      title: post.title,
    };
  } finally {
    running = false;
  }
}

/**
 * Aniq loyiha haqida post TAYYORLAYDI (yubormaydi — preview uchun).
 */
export async function prepareProject(store: StateStore, id: number): Promise<PreparedPost> {
  if (running) throw new Error("Hozir band — biroz kuting.");
  running = true;
  try {
    const s = effective(store);
    const project = store.listProjects().find((p) => p.id === id);
    if (!project) throw new Error(`Loyiha #${id} topilmadi (/loyihalar bilan tekshiring).`);
    const angleSeq = store.countBySource("Project"); // burchak xilma-xilligi uchun
    const post = await generateProjectPost(project, store.recentTitles("Project", 15), angleSeq);
    const link = project.url ? { url: project.url, label: `🌐 ${project.name}` } : undefined;
    return {
      text: formatMessage(post, link, s.signature),
      markId: `project:${Date.now()}`,
      source: "Project",
      title: `${post.title} (${project.name})`,
    };
  } finally {
    running = false;
  }
}

/**
 * Bir "ish" — pattern navbatiga qarab `max` (yoki sozlamadagi) tagacha post qo'yadi.
 * Manbalar, loyihalar, imzo va navbat — hammasi BAZADAN o'qiladi (chatдан tahrirlangan).
 */
export async function runOnce(store: StateStore, opts: { max?: number } = {}): Promise<RunResult> {
  if (running) return { sent: 0, lines: ["⏳ Avvalgi post hali tugamadi — o'tkazib yuborildi."] };
  running = true;
  try {
    const s = effective(store);
    const max = opts.max ?? s.maxPerRun;
    const sig = s.signature;
    const pattern = s.pattern;
    const sources = store.listSources();
    const projects = store.listProjects();

    store.prune();
    const items = await fetchAll(sources);
    const freshQueue = items.filter((it) => !store.isPosted(it.id));

    let seq = store.getSeq();
    const lines: string[] = [];
    let sent = 0;

    const postOriginal = async (n: number): Promise<string> => {
      const post = await generateOriginal(store.recentTitles("Original", 15), n);
      await publish(formatMessage(post, undefined, sig));
      store.markPosted(`original:${Date.now()}`, "Original", post.title);
      return post.title;
    };

    const postProject = async (n: number): Promise<string | null> => {
      if (projects.length === 0) return null;
      const project = projects[store.countBySource("Project") % projects.length];
      const post = await generateProjectPost(project, store.recentTitles("Project", 15), n);
      const link = project.url ? { url: project.url, label: `🌐 ${project.name}` } : undefined;
      await publish(formatMessage(post, link, sig));
      store.markPosted(`project:${Date.now()}`, "Project", post.title);
      return `${post.title} (${project.name})`;
    };

    for (let slot = 0; slot < max; slot++) {
      const nextSeq = seq + 1;
      const type: SlotType = pattern[(nextSeq - 1) % pattern.length];
      try {
        if (type === "original") {
          lines.push(`✅ Original #${nextSeq}: ${await postOriginal(nextSeq)}`);
        } else if (type === "project") {
          const t = await postProject(nextSeq);
          lines.push(
            t
              ? `✅ Loyiha #${nextSeq}: ${t}`
              : `✅ Original #${nextSeq} (loyiha yo'q): ${await postOriginal(nextSeq)}`
          );
        } else {
          const item = freshQueue.shift();
          if (item) {
            const post = await rewrite(item);
            const link = { url: item.link, label: `🔗 Manba: ${item.source}` };
            await publish(formatMessage(post, link, sig), item.imageUrl);
            store.markPosted(item.id, item.source, item.title);
            lines.push(`✅ RSS #${nextSeq}: ${post.title} (${item.source})`);
          } else {
            lines.push(`✅ Original #${nextSeq} (RSS bo'sh): ${await postOriginal(nextSeq)}`);
          }
        }
        seq = nextSeq;
        store.setSeq(seq);
        sent++;
        if (slot < max - 1) await sleep(3000);
      } catch (err) {
        lines.push(`❌ Slot #${nextSeq} (${type}): ${(err as Error).message}`);
      }
    }
    return { sent, lines };
  } finally {
    running = false;
  }
}
