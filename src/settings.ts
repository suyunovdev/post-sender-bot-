import { config } from "./config.js";
import type { StateStore } from "./db.js";

export type SlotType = "rss" | "original" | "project";

export interface EffectiveSettings {
  signature: string;
  pattern: SlotType[];
  scheduleTimes: string[]; // "HH:MM"
  maxPerRun: number;
  paused: boolean;
  images: boolean;
}

export function parsePattern(input: string): SlotType[] {
  return input
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SlotType => s === "rss" || s === "original" || s === "project");
}

export function parseTimes(input: string): string[] {
  const out: string[] = [];
  for (const tok of input.split(/[,\s]+/)) {
    const m = tok.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) continue; // noto'g'ri vaqt (masalan 25:99) — o'tkazma
    out.push(`${String(h).padStart(2, "0")}:${m[2]}`);
  }
  return out;
}

/** Bazadagi sozlama, bo'lmasa .env standarti. */
export function effective(store: StateStore): EffectiveSettings {
  const pattern = parsePattern(store.getSetting("pattern") ?? config.contentPattern.join(","));
  const times = parseTimes(store.getSetting("schedule") ?? config.scheduleDefault);
  const max = parseInt(store.getSetting("max_per_run") ?? String(config.maxPostsPerRun), 10);
  return {
    signature: store.getSetting("signature") ?? config.postSignature,
    pattern: pattern.length ? pattern : ["rss"],
    scheduleTimes: times.length ? times : ["10:00", "19:00"],
    maxPerRun: Number.isFinite(max) && max > 0 ? max : 1,
    paused: store.getSetting("paused") === "1",
    images: (store.getSetting("images") ?? (config.generateImages ? "1" : "0")) === "1",
  };
}
