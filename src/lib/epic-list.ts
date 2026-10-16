import { compareEpicIds, epicLabel } from "@/lib/bmad/ids";
import type { Epic, EpicStatus } from "@/lib/bmad/types";

/** Below this many epics the toolbar is hidden. */
export const TOOLBAR_MIN_EPICS = 6;
export const PAGE_SIZE = 15;

export const SORT_KEYS = ["default", "id", "title", "progress", "stories", "status"] as const;
export type EpicSortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<EpicSortKey, string> = {
  default: "Default order",
  id: "ID",
  title: "Title",
  progress: "Progress",
  stories: "Stories",
  status: "Status",
};

export const EPIC_STATUSES: { value: EpicStatus; label: string }[] = [
  { value: "in-progress", label: "In progress" },
  { value: "not-started", label: "Not started" },
  { value: "done", label: "Done" },
];

/** Direction a key starts in when picked: biggest first for the numeric keys. */
export const DEFAULT_DIR: Record<EpicSortKey, SortDir> = {
  default: "asc",
  id: "asc",
  title: "asc",
  progress: "desc",
  stories: "desc",
  status: "asc",
};

const STATUS_RANK: Record<string, number> = { "in-progress": 0, "not-started": 1, done: 2 };

/** Statuses other than in-progress/done count as not started (as groupEpicsByStatus does). */
export function normalizedStatus(status: string): EpicStatus {
  return status === "in-progress" || status === "done" ? status : "not-started";
}

export interface EpicListState {
  query: string;
  statuses: EpicStatus[];
  sort: EpicSortKey;
  dir: SortDir;
  page: number;
}

export const DEFAULT_STATE: EpicListState = {
  query: "",
  statuses: [],
  sort: "default",
  dir: "asc",
  page: 1,
};

export function showToolbar(total: number): boolean {
  return total >= TOOLBAR_MIN_EPICS;
}

/** Case-insensitive search over id, label, title and description; every term must match. */
export function searchEpics(epics: Epic[], query: string): Epic[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return epics;
  return epics.filter((e) => {
    const hay = `${e.id} ${epicLabel(e.id)} ${e.title} ${e.description ?? ""}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function filterEpicsByStatus(epics: Epic[], statuses: EpicStatus[]): Epic[] {
  if (statuses.length === 0) return epics;
  return epics.filter((e) => statuses.includes(normalizedStatus(e.status)));
}

export function statusCounts(epics: Epic[]): Record<EpicStatus, number> {
  const counts: Record<EpicStatus, number> = { "in-progress": 0, "not-started": 0, done: 0 };
  for (const e of epics) counts[normalizedStatus(e.status)]++;
  return counts;
}

/** The natural direction of each key: what "asc" means for the user. */
function compare(key: EpicSortKey, a: Epic, b: Epic): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" });
    case "progress":
      return a.progressPercent - b.progressPercent;
    case "stories":
      return a.totalStories - b.totalStories;
    case "status":
      return STATUS_RANK[normalizedStatus(a.status)] - STATUS_RANK[normalizedStatus(b.status)];
    default:
      return compareEpicIds(a.id, b.id);
  }
}

/**
 * Sorts a copy. Ties fall back to natural id order, whatever the direction, so
 * results are stable. "default" is natural id order (desc reverses it, DEFERRED first).
 */
export function sortEpics(epics: Epic[], key: EpicSortKey, dir: SortDir): Epic[] {
  const sign = dir === "desc" ? -1 : 1;
  return [...epics].sort(
    (a, b) => sign * compare(key, a, b) || compareEpicIds(a.id, b.id),
  );
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, total: number, pageSize = PAGE_SIZE): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), pageCount(total, pageSize));
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  pages: number;
  /** 1-based inclusive range shown; 0/0 when empty. */
  from: number;
  to: number;
  total: number;
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): PageSlice<T> {
  const total = items.length;
  const p = clampPage(page, total, pageSize);
  const start = (p - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page: p,
    pages: pageCount(total, pageSize),
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}

/** Compact page list with ellipses: [1, "…", 4, 5, 6, "…", 12]. */
export function pageItems(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

/** True when any search/filter/sort is active (page is not a filter). */
export function isFiltered(s: EpicListState): boolean {
  return s.query.trim() !== "" || s.statuses.length > 0;
}

export const PARAM = { query: "eq", statuses: "es", sort: "esort", dir: "edir", page: "epage" } as const;

/** Reads the list state from URL params; unknown or bad values fall back to defaults. */
export function parseListState(params: { get(name: string): string | null }): EpicListState {
  const sortRaw = params.get(PARAM.sort);
  const sort = (SORT_KEYS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as EpicSortKey)
    : "default";
  const dirRaw = params.get(PARAM.dir);
  const statuses = (params.get(PARAM.statuses) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is EpicStatus => s in STATUS_RANK);
  const pageNum = Number.parseInt(params.get(PARAM.page) ?? "", 10);
  return {
    query: params.get(PARAM.query) ?? "",
    statuses: [...new Set(statuses)],
    sort,
    dir: dirRaw === "desc" ? "desc" : "asc",
    page: Number.isFinite(pageNum) && pageNum > 1 ? pageNum : 1,
  };
}

/** Writes the state onto a copy of `base` params; defaults are omitted, other params kept. */
export function serializeListState(base: URLSearchParams | string, s: EpicListState): URLSearchParams {
  const out = new URLSearchParams(typeof base === "string" ? base : base.toString());
  Object.values(PARAM).forEach((k) => out.delete(k));
  if (s.query.trim() !== "") out.set(PARAM.query, s.query);
  if (s.statuses.length > 0) out.set(PARAM.statuses, s.statuses.join(","));
  if (s.sort !== "default") out.set(PARAM.sort, s.sort);
  if (s.dir !== "asc") out.set(PARAM.dir, s.dir);
  if (s.page > 1) out.set(PARAM.page, String(s.page));
  return out;
}

/** Everything the list renders, derived in one pass. */
export function computeEpicList(epics: Epic[], state: EpicListState) {
  const searched = searchEpics(epics, state.query);
  // Counts reflect the search, so the status menu shows what picking each would give.
  const counts = statusCounts(searched);
  const filtered = filterEpicsByStatus(searched, state.statuses);
  const sorted = sortEpics(filtered, state.sort, state.dir);
  return { counts, filtered, page: paginate(sorted, state.page) };
}
