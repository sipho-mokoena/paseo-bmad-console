/**
 * Markdown -> single-line plain text, for compact places (row snippets, search
 * results, tooltips). Pure: no DOM, no markdown parser. Words and emoji are kept;
 * only the syntax goes. Truncation (when asked for) is at a word boundary.
 */

const FENCE = /^\s*(```|~~~)/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function isTableSeparator(line: string): boolean {
  return line.includes("|") && line.includes("-") && TABLE_SEPARATOR.test(line);
}

function looksLikeTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") || (t.endsWith("|") && t.includes("|", 1) && t.length > 1);
}

function stripInline(text: string): string {
  let s = text;
  s = s.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, "$1");
  // HTML comments and tags
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<\/?[A-Za-z][^<>]*>/g, " ");
  // images and links (inline, then reference style), autolinks
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/!?\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  s = s.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, " ");
  // inline code (keep contents)
  s = s.replace(/(`+)([^`]+?)\1/g, "$2");
  // emphasis, strong, strikethrough
  s = s.replace(/(\*\*\*|___)(?=\S)([\s\S]*?\S)\1/g, "$2");
  s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2");
  s = s.replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?!\w)/g, "$1$2");
  s = s.replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, "$1$2");
  s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1");
  // backslash escapes
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, "$1");
  // entities that commonly show up
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return s;
}

/** Truncates at a word boundary, adding an ellipsis. */
export function truncateAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, Math.max(0, maxChars - 1));
  const cut = slice.lastIndexOf(" ");
  const base = cut > maxChars * 0.5 ? slice.slice(0, cut) : slice;
  return `${base.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export function markdownToPlainText(md: string | null | undefined, maxChars?: number): string {
  if (!md) return "";
  const out: string[] = [];
  // Consecutive text lines of one paragraph are joined before inline syntax is
  // stripped, so emphasis that wraps across a line break is still recognised.
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(stripInline(para.join(" ")));
    para = [];
  };
  let inFence = false;
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    if (FENCE.test(raw)) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(raw.trim());
      continue;
    }
    if (!raw.trim()) {
      flush();
      continue;
    }
    if (isTableSeparator(raw)) continue;
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) {
      flush();
      continue; // horizontal rule
    }
    if (looksLikeTableRow(raw)) {
      flush();
      const cells = raw
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/)
        .map((c) => stripInline(c).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      out.push(cells.join(" · "));
      continue;
    }
    const isItem = /^\s*(?:[-*+]|\d+[.)])\s+/.test(raw);
    if (isItem || /^\s{0,3}#{1,6}\s/.test(raw)) flush();
    para.push(
      raw
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/\s+#+\s*$/, "")
        .replace(/^(\s*>\s?)+/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, ""),
    );
  }
  flush();
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  return maxChars && maxChars > 0 ? truncateAtWord(text, maxChars) : text;
}

/** First paragraph (or list/table block) of a markdown body, as plain text. */
export function summarizeMarkdown(md: string | null | undefined, maxChars = 300): string {
  if (!md) return "";
  const blocks = md.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const kept = block.split("\n").filter((l) => !/^\s{0,3}#{1,6}\s/.test(l)).join("\n");
    if (kept.split("\n").every((l) => !l.trim() || looksLikeTableRow(l))) continue;
    const text = markdownToPlainText(kept);
    if (text) return truncateAtWord(text, maxChars);
  }
  return "";
}
