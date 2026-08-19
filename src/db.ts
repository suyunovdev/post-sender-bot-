import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Yuborilgan postlarni kuzatuvchi kichik SQLite baza (WAL rejimida).
 * Maqsad: bir yangilikni ikki marta yubormaslik (dedup).
 */
export class StateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS posted (
        id          TEXT PRIMARY KEY,      -- yangilikning barqaror kaliti (guid/link)
        source      TEXT NOT NULL,
        title       TEXT,
        posted_at   INTEGER NOT NULL       -- unix millisekund
      );
      CREATE TABLE IF NOT EXISTS meta (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sources (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        url         TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS projects (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        tagline     TEXT NOT NULL,
        url         TEXT,
        description TEXT NOT NULL,
        highlights  TEXT NOT NULL,     -- JSON massiv
        tech        TEXT               -- JSON massiv (ixtiyoriy)
      );
    `);
  }

  // ---- Sozlamalar (key/value) — chatдан o'zgartiriladi ----
  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run(key, value);
  }

  // ---- RSS manbalar ----
  listSources(): Array<{ id: number; name: string; url: string }> {
    return this.db
      .prepare("SELECT id, name, url FROM sources ORDER BY id")
      .all() as Array<{ id: number; name: string; url: string }>;
  }

  addSource(name: string, url: string): void {
    this.db.prepare("INSERT OR IGNORE INTO sources (name, url) VALUES (?, ?)").run(name, url);
  }

  removeSource(id: number): boolean {
    return this.db.prepare("DELETE FROM sources WHERE id = ?").run(id).changes > 0;
  }

  // ---- Loyihalar ----
  listProjects(): Array<{
    id: number;
    name: string;
    tagline: string;
    url?: string;
    description: string;
    highlights: string[];
    tech?: string[];
  }> {
    const rows = this.db
      .prepare("SELECT id, name, tagline, url, description, highlights, tech FROM projects ORDER BY id")
      .all() as Array<{
      id: number;
      name: string;
      tagline: string;
      url: string | null;
      description: string;
      highlights: string;
      tech: string | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tagline: r.tagline,
      url: r.url ?? undefined,
      description: r.description,
      highlights: JSON.parse(r.highlights) as string[],
      tech: r.tech ? (JSON.parse(r.tech) as string[]) : undefined,
    }));
  }

  addProject(p: {
    name: string;
    tagline: string;
    url?: string;
    description: string;
    highlights: string[];
    tech?: string[];
  }): void {
    this.db
      .prepare(
        "INSERT INTO projects (name, tagline, url, description, highlights, tech) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        p.name,
        p.tagline,
        p.url ?? null,
        p.description,
        JSON.stringify(p.highlights),
        p.tech ? JSON.stringify(p.tech) : null
      );
  }

  removeProject(id: number): boolean {
    return this.db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  }

  /** Manbalar/loyihalar bo'sh bo'lsa — koddagi standartlardan bir marta to'ldirish. */
  seedIfEmpty(
    defaultSources: Array<{ name: string; url: string }>,
    defaultProjects: Array<{
      name: string;
      tagline: string;
      url?: string;
      description: string;
      highlights: string[];
      tech?: string[];
    }>
  ): void {
    const nSources = (this.db.prepare("SELECT COUNT(*) AS n FROM sources").get() as { n: number }).n;
    if (nSources === 0) {
      const insert = this.db.prepare("INSERT OR IGNORE INTO sources (name, url) VALUES (?, ?)");
      for (const s of defaultSources) insert.run(s.name, s.url);
    }
    const nProjects = (this.db.prepare("SELECT COUNT(*) AS n FROM projects").get() as { n: number })
      .n;
    if (nProjects === 0) {
      for (const p of defaultProjects) this.addProject(p);
    }
  }

  /**
   * Global post navbat raqami (RSS + original — hammasi birga sanaladi).
   * Aralash rejimda "har N-post original" qarorini shu raqam belgilaydi.
   * Faqat muvaffaqiyatli yuborilgan postda oshiriladi, shuning uchun
   * xatolik bo'lsa navbat buzilmaydi.
   */
  getSeq(): number {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'post_seq'").get() as
      | { value: string }
      | undefined;
    return row ? parseInt(row.value, 10) : 0;
  }

  setSeq(n: number): void {
    this.db
      .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('post_seq', ?)")
      .run(String(n));
  }

  /**
   * Berilgan manba (masalan 'Original' yoki 'Project') bo'yicha yaqindagi
   * sarlavhalar — AI'ga "bularni takrorlama" deb beriladi (xilma-xillik).
   */
  recentTitles(source: string, limit = 15): string[] {
    const rows = this.db
      .prepare("SELECT title FROM posted WHERE source = ? ORDER BY posted_at DESC LIMIT ?")
      .all(source, limit) as Array<{ title: string | null }>;
    return rows.map((r) => r.title ?? "").filter(Boolean);
  }

  /** Berilgan manba bo'yicha nechta post chiqqan (loyihalarni navbatlash uchun). */
  countBySource(source: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM posted WHERE source = ?")
      .get(source) as { n: number };
    return row.n;
  }

  /** Bu yangilik allaqachon yuborilganmi? */
  isPosted(id: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM posted WHERE id = ?").get(id);
    return row !== undefined;
  }

  /** Yuborilgan deb belgilash. */
  markPosted(id: string, source: string, title: string): void {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO posted (id, source, title, posted_at) VALUES (?, ?, ?, ?)"
      )
      .run(id, source, title, Date.now());
  }

  /**
   * Eski yozuvlarni tozalab turish (baza cheksiz o'smasligi uchun).
   * Standart: 90 kundan eski yozuvlar o'chiriladi.
   */
  prune(olderThanDays = 90): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    this.db.prepare("DELETE FROM posted WHERE posted_at < ?").run(cutoff);
  }

  close(): void {
    this.db.close();
  }
}
