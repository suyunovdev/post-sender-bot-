import type { StateStore } from "./db.js";
import { fetchAll } from "./rss.js";
import { rewrite } from "./rewrite.js";
import { generateOriginal, generateOnTopic } from "./original.js";
import { generateProjectPost } from "./projects.js";
import { formatMessage, publish, publishPhotoBytes } from "./telegram.js";
import { generateImage } from "./image.js";
import { effective, type SlotType } from "./settings.js";

/** "(Loyiha nomi)" qo'shimchasini olib tashlaydi — rasm mavzusi uchun. */
function imageSubject(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

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

/** Tayyorlangan postni kanalga yuboradi, message_id ni saqlaydi va belgilaydi. */
export async function publishPrepared(store: StateStore, p: PreparedPost): Promise<void> {
  let id: number | undefined;
  if (effective(store).images && !p.imageUrl) {
    const img = await generateImage(imageSubject(p.title));
    if (img) id = await publishPhotoBytes(p.text, img);
  }
  if (id === undefined) id = await publish(p.text, p.imageUrl);
  if (id) store.setSetting("last_message_id", String(id));
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

    // Yuboradi + oxirgi message_id ni saqlaydi (chatда /tahrir uchun).
    const setLast = (id?: number) => {
      if (id) store.setSetting("last_message_id", String(id));
    };

    /**
     * Rasm bilan yuboradi: real manba rasmи bo'lsa — o'sha; bo'lmasa va rasm
     * yoqilgan bo'lsa — AI rasm; aks holda matn.
     */
    const pubMaybeImage = async (text: string, subject: string, realImg?: string): Promise<void> => {
      if (realImg) {
        setLast(await publish(text, realImg));
        return;
      }
      if (s.images) {
        const img = await generateImage(subject);
        if (img) {
          setLast(await publishPhotoBytes(text, img));
          return;
        }
      }
      setLast(await publish(text));
    };

    const postOriginal = async (n: number): Promise<string> => {
      const post = await generateOriginal(store.recentTitles("Original", 15), n);
      await pubMaybeImage(formatMessage(post, undefined, sig), post.title);
      store.markPosted(`original:${Date.now()}`, "Original", post.title);
      return post.title;
    };

    const postProject = async (n: number): Promise<string | null> => {
      if (projects.length === 0) return null;
      const project = projects[store.countBySource("Project") % projects.length];
      const post = await generateProjectPost(project, store.recentTitles("Project", 15), n);
      const link = project.url ? { url: project.url, label: `🌐 ${project.name}` } : undefined;
      await pubMaybeImage(formatMessage(post, link, sig), post.title);
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
            await pubMaybeImage(formatMessage(post, link, sig), post.title, item.imageUrl);
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
