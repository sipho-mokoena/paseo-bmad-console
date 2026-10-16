/**
 * Tolerant, pure helpers for the id schemes BMAD projects use:
 *   epics    "1", "epic-1", "Epic 1", "E1", "DEFERRED-E10"
 *   stories  "1.1", "1-1-slug", "E1-S1", "E1-S1-slug", "DEFERRED-E10-S3-slug", "E2-S8b"
 * Numeric ids stay bare digits ("1", "1.1") so the BMad v6 default layout is unchanged;
 * project-style ids keep their letters ("E1", "E1-S1").
 */

/** Canonical epic id from a raw id/label/key, or null when it is not an epic id. */
export function parseEpicId(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const numeric = s.match(/^(?:epic[\s_-]*)?(\d+)$/i);
  if (numeric) return numeric[1];
  const project = s.match(/^((?:[A-Za-z]+-)*)[Ee](\d+)$/);
  if (project) return `${project[1]}E${project[2]}`;
  return null;
}

export interface ParsedStoryId {
  /** Canonical id: "1.2" or "E1-S2". */
  id: string;
  /** Canonical epic id: "1" or "E1". */
  epicId: string;
  /** Trailing slug (without separators), or "". */
  slug: string;
}

/**
 * Story id from an id, key or file/folder name (extension tolerated).
 * Returns null when nothing in the string looks like a story id.
 */
export function parseStoryId(raw: unknown): ParsedStoryId | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim().replace(/\.md$/i, "");
  // Project style: [PREFIX-]E<n>-S<k>[letter][-slug]
  const project = s.match(/^((?:[A-Za-z]+-)*)[Ee](\d+)-[Ss](\d+[A-Za-z]?)(?:[-_.](.+))?$/);
  if (project) {
    const epicId = `${project[1]}E${project[2]}`;
    return { id: `${epicId}-S${project[3]}`, epicId, slug: project[4] ?? "" };
  }
  // Numeric: 1-2-slug, 1.2, 1.2.slug, 1_2_slug
  const numeric = s.match(/^(\d+)[-._](\d+)(?:[-_.](.+))?$/);
  if (numeric) {
    const epicId = numeric[1];
    return { id: `${epicId}.${numeric[2]}`, epicId, slug: numeric[3] ?? "" };
  }
  return null;
}

/** Title-cased words of a slug: "send-money-fail" -> "Send Money Fail". */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const DEFERRED = /^deferred-/i;

function epicNumber(id: string): number {
  const m = id.match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** Natural epic order: E2 before E10; plain/E ids first, other prefixes next, DEFERRED-* last. */
export function compareEpicIds(a: string, b: string): number {
  const rank = (id: string) => (DEFERRED.test(id) ? 2 : /^(?:epic[-_ ]?)?e?\d+$/i.test(id) ? 0 : 1);
  return (
    rank(a) - rank(b) ||
    epicNumber(a) - epicNumber(b) ||
    a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })
  );
}

/** Natural story order: by epic (see compareEpicIds), then "E1-S2" before "E1-S10" and "1.2" before "1.10". */
export function compareStoryIds(a: string, b: string): number {
  const pa = parseStoryId(a);
  const pb = parseStoryId(b);
  const byEpic = pa && pb ? compareEpicIds(pa.epicId, pb.epicId) : 0;
  return byEpic || a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/** Long label: "Epic 1" for numeric ids, the id itself ("E1", "DEFERRED-E10") otherwise. */
export function epicName(id: string): string {
  return /^\d+$/.test(id) ? `Epic ${id}` : id;
}

/** Short label for an epic id: "1" -> "E1"; "E1" and "DEFERRED-E10" stay as they are. */
export function epicLabel(id: string): string {
  return /^\d+$/.test(id) ? `E${id}` : id;
}

type Fm = Record<string, unknown> | null | undefined;

function firstString(fm: Fm, keys: string[]): string | undefined {
  if (!fm) return undefined;
  for (const k of keys) {
    const v = fm[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** Raw epic id from frontmatter: epic_id, epicId, epic, then id. */
export function frontmatterEpicId(fm: Fm): string | null {
  return parseEpicId(firstString(fm, ["epic_id", "epicId", "epic", "id"]));
}

/** Raw story id from frontmatter: story_id, storyId, then id. */
export function frontmatterStoryId(fm: Fm): ParsedStoryId | null {
  return parseStoryId(firstString(fm, ["story_id", "storyId", "id"]));
}

/** Display title from frontmatter: title, name, story_title, epic_title. */
export function frontmatterTitle(fm: Fm): string | undefined {
  return firstString(fm, ["title", "name", "story_title", "epic_title"]);
}

/** Heading text without a leading "Epic 1:" / "E1:" / "E1-S1 -" style prefix. */
export function stripIdPrefix(heading: string): string {
  const stripped = heading
    .replace(/^(?:story|epic)\s+/i, "")
    .replace(/^(?:(?:[A-Za-z]+-)*[Ee]\d+(?:-[Ss]\d+[A-Za-z]?)?|\d+(?:\.\d+)?)\s*[:.—–-]\s+/, "")
    .trim();
  return stripped || heading.trim();
}
