/**
 * A small, safe Markdown subset for assistant answers: headings, paragraphs, lists, fenced code,
 * `code`, **bold**, *italic* and links. The result is a plain AST that React renders as elements,
 * so no HTML string is ever built and nothing is injected. Raw HTML in the text stays text.
 */
export type Inline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "p"; c: Inline[] }
  | { t: "h"; level: 1 | 2 | 3; c: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "code"; lang: string; v: string };

/** Only http, https and mailto links survive. javascript:, data: and relative links are dropped. */
export function safeHref(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Languages the editor can hold. Anything else can be copied but not inserted. */
export function normalizeLang(lang: string): "javascript" | "python" | null {
  const l = lang.trim().toLowerCase();
  if (l === "javascript" || l === "js" || l === "node") return "javascript";
  if (l === "python" || l === "py") return "python";
  return null;
}

export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) {
      out.push({ t: "text", v: buf });
      buf = "";
    }
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 3 && src.startsWith("**", i)) {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: parseInline(src.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }
    if (depth < 3 && ch === "*" && src[i + 1] !== " " && src[i + 1] !== undefined) {
      const end = src.indexOf("*", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "em", c: parseInline(src.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 3 && ch === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(src.slice(i));
      const href = m ? safeHref(m[2]) : null;
      if (m && href) {
        flush();
        out.push({ t: "link", href, c: parseInline(m[1], depth + 1) });
        i += m[0].length;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

const FENCE = /^```\s*([A-Za-z0-9_+-]*)\s*$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const UL = /^\s*[-*]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const startsBlock = (l: string) => FENCE.test(l) || HEADING.test(l) || UL.test(l) || OL.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence; an unterminated fence simply runs to the end
      blocks.push({ t: "code", lang: fence[1], v: body.join("\n") });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, c: parseInline(h[2]) });
      i++;
      continue;
    }
    const kind = UL.test(line) ? "ul" : OL.test(line) ? "ol" : null;
    if (kind) {
      const re = kind === "ul" ? UL : OL;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (!m) break;
        items.push(parseInline(m[1]));
        i++;
      }
      blocks.push({ t: kind, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !(para.length > 0 && startsBlock(lines[i]))) para.push(lines[i++]);
    blocks.push({ t: "p", c: parseInline(para.join(" ")) });
  }
  return blocks;
}
