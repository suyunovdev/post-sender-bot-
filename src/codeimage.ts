import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";

const FONT = "JetBrains Mono";
const FONT_BOLD = "JetBrains Mono Bold";

function fontPath(file: string): string {
  const p = join(process.cwd(), "assets", "fonts", file);
  if (existsSync(p)) return p;
  return fileURLToPath(new URL(`../assets/fonts/${file}`, import.meta.url)); // dist/ -> ../assets
}

try {
  GlobalFonts.registerFromPath(fontPath("JetBrainsMono-Regular.ttf"), FONT);
  GlobalFonts.registerFromPath(fontPath("JetBrainsMono-Bold.ttf"), FONT_BOLD);
} catch (err) {
  console.error("[codeimage] font ro'yxatдан o'tmadi:", (err as Error).message);
}

// One Dark uslubidagi ranglar
const C = {
  outer: "#0d1117",
  card: "#282c34",
  header: "#21252b",
  title: "#9da5b4",
  lineNo: "#4b5263",
  def: "#abb2bf",
  keyword: "#c678dd",
  string: "#98c379",
  comment: "#7f848e",
  number: "#d19a66",
  func: "#61afef",
  punct: "#7a818e",
};

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "new", "typeof", "instanceof", "of", "in",
  "await", "async", "try", "catch", "finally", "throw", "class", "extends", "super",
  "this", "import", "export", "from", "default", "null", "undefined", "true", "false",
]);

interface Tok {
  t: string;
  c: string;
}

/** Bitta qatorni ranglangan bo'laklarга ajratadi (oddiy JS tokenizer). */
function tokenize(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\/\/.*$/.exec(rest))) {
      out.push({ t: m[0], c: C.comment });
    } else if ((m = /^(['"`])(?:\\.|(?!\1)[^\\])*\1?/.exec(rest))) {
      out.push({ t: m[0], c: C.string });
    } else if ((m = /^\d+(?:\.\d+)?/.exec(rest))) {
      out.push({ t: m[0], c: C.number });
    } else if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) {
      const w = m[0];
      const after = line.slice(i + w.length);
      const c = KEYWORDS.has(w) ? C.keyword : /^\s*\(/.test(after) ? C.func : C.def;
      out.push({ t: w, c });
    } else if ((m = /^\s+/.exec(rest))) {
      out.push({ t: m[0], c: C.def });
    } else {
      out.push({ t: line[i], c: C.punct });
      i += 1;
      continue;
    }
    i += m[0].length;
  }
  return out;
}

function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/**
 * Kod bo'lagini syntax-rangли "kod oynasi" (Carbon uslubida) PNG rasm qilib chizadi.
 * Xato bo'lsa null qaytaradi (chaqiruvchi matn-only postга tushadi).
 */
export function renderCodeImage(code: string, opts: { title?: string } = {}): Buffer | null {
  try {
    const FS = 30;
    const LH = 42;
    const MARGIN = 26;
    const HEADER = 60;
    const PADX = 28;
    const TOP = 18;
    const BOT = 20;

    const src = code.replace(/\t/g, "  ").replace(/\r/g, "");
    const lines = src.split("\n");
    while (lines.length > 1 && lines[lines.length - 1].trim() === "") lines.pop();

    // O'lchash (monospace — barcha belgilar bir xil kenglик)
    const mctx = createCanvas(10, 10).getContext("2d");
    mctx.font = `${FS}px "${FONT}"`;
    const cw = mctx.measureText("M").width || FS * 0.6;

    const maxLen = Math.max(1, ...lines.map((l) => l.length));
    const digits = String(lines.length).length;
    const gutterW = digits * cw + 22;
    const codeW = maxLen * cw;
    const cardW = Math.max(520, PADX + gutterW + codeW + PADX);
    const cardH = HEADER + TOP + lines.length * LH + BOT;
    const W = Math.round(cardW + MARGIN * 2);
    const H = Math.round(cardH + MARGIN * 2);

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = C.outer;
    ctx.fillRect(0, 0, W, H);

    roundRectPath(ctx, MARGIN, MARGIN, cardW, cardH, 14);
    ctx.fillStyle = C.card;
    ctx.fill();

    // header (yuqori qism yumaloq)
    ctx.save();
    roundRectPath(ctx, MARGIN, MARGIN, cardW, HEADER + 14, 14);
    ctx.clip();
    ctx.fillStyle = C.header;
    ctx.fillRect(MARGIN, MARGIN, cardW, HEADER);
    ctx.restore();

    const dotY = MARGIN + HEADER / 2;
    ["#ff5f56", "#ffbd2e", "#27c93f"].forEach((col, i) => {
      ctx.beginPath();
      ctx.fillStyle = col;
      ctx.arc(MARGIN + 26 + i * 22, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    if (opts.title) {
      ctx.fillStyle = C.title;
      ctx.font = `26px "${FONT_BOLD}"`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const tx = MARGIN + 26 + 3 * 22 + 16;
      const maxChars = Math.floor((cardW - (tx - MARGIN) - 20) / (cw * 0.86));
      ctx.fillText(truncate(opts.title, Math.max(8, maxChars)), tx, dotY + 1);
    }

    // kod
    ctx.textBaseline = "top";
    const contentTop = MARGIN + HEADER + TOP;
    const numRight = MARGIN + PADX + digits * cw;
    const codeX = MARGIN + PADX + gutterW;
    lines.forEach((line, idx) => {
      const y = contentTop + idx * LH;
      ctx.font = `${FS}px "${FONT}"`;
      ctx.fillStyle = C.lineNo;
      ctx.textAlign = "right";
      ctx.fillText(String(idx + 1), numRight, y);
      ctx.textAlign = "left";
      let x = codeX;
      for (const tk of tokenize(line)) {
        ctx.fillStyle = tk.c;
        ctx.fillText(tk.t, x, y);
        x += tk.t.length * cw;
      }
    });

    return canvas.toBuffer("image/png");
  } catch (err) {
    console.error("[codeimage] render xato:", (err as Error).message);
    return null;
  }
}
