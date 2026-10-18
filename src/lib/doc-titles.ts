import matter from "gray-matter";

const clean = (s: unknown): string => (typeof s === "string" ? s.replace(/[`*]/g, "").replace(/\s+/g, " ").trim() : "");

/** Display title of a Markdown document: frontmatter `title` or `name`, else the first H1, else null. */
export function extractDocTitle(text: string): string | null {
  let body = text;
  try {
    const parsed = matter(text);
    body = parsed.content;
    const fromMeta = clean(parsed.data.title) || clean(parsed.data.name);
    if (fromMeta) return fromMeta;
  } catch {
    // Malformed frontmatter: fall through to the heading.
  }
  let fenced = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) return clean(m[1]) || null;
  }
  return null;
}
