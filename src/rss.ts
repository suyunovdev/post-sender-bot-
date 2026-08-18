import Parser from "rss-parser";
import type { Source } from "./config.js";

export interface NewsItem {
  /** Barqaror kalit: guid bo'lsa guid, bo'lmasa link */
  id: string;
  source: string;
  title: string;
  link: string;
  summary: string;
  imageUrl?: string;
  isoDate?: string;
}

type CustomItem = {
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  enclosure?: { url?: string; type?: string };
};

const parser: Parser<unknown, CustomItem> = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "tg-tech-news-bot/1.0 (+https://t.me)" },
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
    ],
  },
});

function extractImage(item: CustomItem & Parser.Item): string | undefined {
  const media = item["media:content"]?.$?.url;
  if (media) return media;
  const thumb = item["media:thumbnail"]?.$?.url;
  if (thumb) return thumb;
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image/")) {
    return item.enclosure.url;
  }
  // content:encoded ichidan birinchi <img src="...">
  const html = (item as { "content:encoded"?: string })["content:encoded"] ?? item.content ?? "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1];
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Bitta manbadan yangiliklarni o'qish. Xatolik bo'lsa bo'sh ro'yxat qaytaradi. */
async function fetchOne(source: Source): Promise<NewsItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items ?? [])
      .map((item): NewsItem | null => {
        const link = item.link?.trim();
        const title = item.title?.trim();
        if (!link || !title) return null;
        const id = (item.guid ?? link).trim();
        const rawSummary = item.contentSnippet ?? item.content ?? "";
        return {
          id,
          source: source.name,
          title,
          link,
          summary: stripHtml(rawSummary).slice(0, 1200),
          imageUrl: extractImage(item),
          isoDate: item.isoDate,
        };
      })
      .filter((x): x is NewsItem => x !== null);
  } catch (err) {
    console.error(`[rss] ${source.name} o'qib bo'lmadi:`, (err as Error).message);
    return [];
  }
}

/**
 * Barcha manbalardan yangiliklarni parallel o'qib, eng yangisidan eskisiga
 * saralab qaytaradi.
 */
export async function fetchAll(sources: Source[]): Promise<NewsItem[]> {
  const batches = await Promise.all(sources.map(fetchOne));
  const all = batches.flat();
  all.sort((a, b) => {
    const ta = a.isoDate ? Date.parse(a.isoDate) : 0;
    const tb = b.isoDate ? Date.parse(b.isoDate) : 0;
    return tb - ta;
  });
  return all;
}
