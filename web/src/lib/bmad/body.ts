import { summarizeMarkdown } from "@/lib/markdown-text";

/** Longest markdown body kept on an epic or story (detail pages only). */
export const MAX_BODY_CHARS = 20000;
/** Longest plain-text `description` summary kept on list payloads. */
export const SUMMARY_CHARS = 300;

/** Short plain-text summary (first block, markdown syntax stripped). */
export function plainSummary(md: string | null | undefined): string {
  return summarizeMarkdown(md, SUMMARY_CHARS);
}

/** Removes the first heading line when it is the first non-blank line (the title). */
export function stripLeadingTitle(md: string, levels = "1,2"): string {
  const re = new RegExp(`^\\s*#{${levels}}\\s+[^\\n]*(?:\\n|$)`);
  return md.replace(re, "");
}

/** Longest markdown body kept on a story (they carry specs and are routinely long). */
export const MAX_STORY_BODY_CHARS = 60000;

/** Trims and caps a markdown body at a paragraph boundary; undefined when nothing is left. */
export function capBody(md: string | null | undefined, max = MAX_BODY_CHARS): string | undefined {
  const t = (md ?? "").replace(/\r\n?/g, "\n").trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const cut = head.lastIndexOf("\n\n");
  return `${(cut > max * 0.5 ? head.slice(0, cut) : head).trimEnd()}\n\n…`;
}

/** Removes a `##` section (heading line through the next heading of the same or higher level). */
export function removeSection(md: string, heading: RegExp): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let skipLevel = 0;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (skipLevel) {
      if (h && h[1].length <= skipLevel) skipLevel = 0;
      else continue;
    }
    if (h && heading.test(h[2])) {
      skipLevel = h[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
