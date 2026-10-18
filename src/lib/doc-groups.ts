/**
 * Pure classification of a project's BMAD files into the "Specs" and "Design"
 * tabs. Input is the repo-relative path list (`project.bmadFiles`); the Library
 * keeps showing everything, so a file can appear in both places.
 */

export interface DocEntry {
  /** Repo-relative path. */
  path: string;
  /** Display name: the document's title when known, else the file name without `.md`. */
  name: string;
}

export interface DocGroup {
  id: string;
  label: string;
  docs: DocEntry[];
}

export interface ClassifiedDocs {
  specs: DocGroup[];
  design: DocGroup[];
}

type SpecGroupId = "brief" | "prd" | "spec" | "architecture";
type DesignGroupId = "design" | "wireframes" | "reviews";

const SPEC_GROUPS: { id: SpecGroupId; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "prd", label: "PRD" },
  { id: "spec", label: "Spec" },
  { id: "architecture", label: "Architecture" },
];

const DESIGN_GROUPS: { id: DesignGroupId; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "wireframes", label: "Wireframes" },
  { id: "reviews", label: "Reviews" },
];

const PLANNING_DIR = "planning-artifacts";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function stripExt(name: string): string {
  return name.replace(/\.md$/i, "");
}

/** Group of a BMAD output folder, from its name prefix. */
function folderKind(name: string): { tab: "specs"; group: SpecGroupId } | { tab: "design" } | null {
  const n = name.toLowerCase();
  if (n.startsWith("brief-")) return { tab: "specs", group: "brief" };
  if (n.startsWith("prd-")) return { tab: "specs", group: "prd" };
  if (n.startsWith("spec-")) return { tab: "specs", group: "spec" };
  if (n.startsWith("architecture-")) return { tab: "specs", group: "architecture" };
  if (n.startsWith("ux-") || n.startsWith("design-")) return { tab: "design" };
  return null;
}

/** Group of a v6 `planning-artifacts` entry (file stem or sharded folder name). */
function planningKind(stem: string): { tab: "specs"; group: SpecGroupId } | { tab: "design" } | null {
  const n = stem.toLowerCase();
  if (n.startsWith("ux-design") || /ux.*spec/.test(n)) return { tab: "design" };
  if (n.startsWith("product-brief")) return { tab: "specs", group: "brief" };
  if (n.startsWith("prd")) return { tab: "specs", group: "prd" };
  if (n.startsWith("architecture")) return { tab: "specs", group: "architecture" };
  if (/^(project-context|research|spec)/.test(n)) return { tab: "specs", group: "spec" };
  return null;
}

interface Classified {
  tab: "specs" | "design";
  group: string;
  /** Sort key: [owner folder, tier, sub-rank, path]. */
  folder: string;
  tier: number;
  rank: number;
}

function isReview(base: string, inner: string[]): boolean {
  return /^review/i.test(base) || inner.some((s) => s.toLowerCase() === "reviews");
}

function classify(path: string): Classified | null {
  if (!/\.md$/i.test(path)) return null;
  const segments = path.split("/");
  if (segments.some((s) => s.startsWith("."))) return null;
  const base = segments[segments.length - 1];

  // v6 layout: <output>/planning-artifacts/<file or sharded folder>
  const planning = segments.indexOf(PLANNING_DIR);
  if (planning >= 0 && planning < segments.length - 1) {
    const entry = segments[planning + 1];
    const isFolder = planning + 1 < segments.length - 1;
    const kind = planningKind(isFolder ? entry : stripExt(entry));
    if (!kind) return null;
    const folder = segments.slice(0, isFolder ? planning + 2 : planning + 1).join("/");
    const inner = segments.slice(planning + 2, -1);
    const review = isReview(base, inner);
    if (kind.tab === "specs") {
      return { tab: "specs", group: kind.group, folder, tier: review ? 2 : 0, rank: 0 };
    }
    return designRank(base, inner, folder, isFolder ? entry : stripExt(entry));
  }

  // Folder layout: <output>/.../<brief|prd|spec|architecture|ux|design>-*/...
  for (let i = 1; i < segments.length - 1; i++) {
    const kind = folderKind(segments[i]);
    if (!kind) continue;
    const folder = segments.slice(0, i + 1).join("/");
    const inner = segments.slice(i + 1, -1);
    if (kind.tab === "specs") {
      const main = inner.length === 0 && stripExt(base).toLowerCase() === segments[i].toLowerCase();
      const tier = isReview(base, inner) || /^addendum/i.test(base) ? 2 : main ? 0 : 1;
      return { tab: "specs", group: kind.group, folder, tier, rank: 0 };
    }
    return designRank(base, inner, folder, segments[i]);
  }
  return null;
}

function designRank(base: string, inner: string[], folder: string, folderName: string): Classified {
  if (isReview(base, inner)) return { tab: "design", group: "reviews", folder, tier: 0, rank: 0 };
  if (inner.some((s) => s.toLowerCase() === "wireframes")) {
    return { tab: "design", group: "wireframes", folder, tier: 0, rank: 0 };
  }
  const stem = stripExt(base).toLowerCase();
  let rank = 3;
  if (inner.length === 0) {
    if (stem === "design") rank = 0;
    else if (stem === "experience") rank = 1;
    else if (stem === folderName.toLowerCase()) rank = 2;
  }
  return { tab: "design", group: "design", folder, tier: 0, rank };
}

function build<T extends string>(
  defs: { id: T; label: string }[],
  items: { entry: DocEntry; c: Classified }[],
): DocGroup[] {
  const groups: DocGroup[] = [];
  for (const def of defs) {
    const docs = items
      .filter((i) => i.c.group === def.id)
      .sort(
        (a, b) =>
          collator.compare(a.c.folder, b.c.folder) ||
          a.c.tier - b.c.tier ||
          a.c.rank - b.c.rank ||
          collator.compare(stripExt(a.entry.path), stripExt(b.entry.path)),
      )
      .map((i) => i.entry);
    if (docs.length > 0) groups.push({ id: def.id, label: def.label, docs });
  }
  return groups;
}

/** Classify repo-relative paths into the Specs and Design tab groups (empty groups are omitted). */
export function classifyDocs(paths: readonly string[]): ClassifiedDocs {
  const specs: { entry: DocEntry; c: Classified }[] = [];
  const design: { entry: DocEntry; c: Classified }[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    const c = classify(path);
    if (!c) continue;
    const base = path.split("/").pop() ?? path;
    const item = { entry: { path, name: stripExt(base) }, c };
    (c.tab === "specs" ? specs : design).push(item);
  }
  return { specs: build(SPEC_GROUPS, specs), design: build(DESIGN_GROUPS, design) };
}

export function flattenDocs(groups: readonly DocGroup[]): DocEntry[] {
  return groups.flatMap((g) => g.docs);
}

/** The requested document, or the first one when absent or not part of the tab. */
export function pickDoc(groups: readonly DocGroup[], file: string | undefined): DocEntry | null {
  const all = flattenDocs(groups);
  return all.find((d) => d.path === file) ?? all[0] ?? null;
}

/** The groups with each document named by its title where one is known (order is unchanged). */
export function withTitles(groups: readonly DocGroup[], titles: Readonly<Record<string, string>>): DocGroup[] {
  return groups.map((g) => ({ ...g, docs: g.docs.map((d) => ({ ...d, name: titles[d.path] ?? d.name })) }));
}
