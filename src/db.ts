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
    `);
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
