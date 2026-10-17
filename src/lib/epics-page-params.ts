import {
  DEFAULT_DIR,
  EPIC_STATUSES,
  SORT_KEYS,
  SORT_LABELS,
  filterEpicsByStatus,
  sortEpics,
  statusCounts,
  type EpicSortKey,
  type SortDir,
} from "@/lib/epic-list";
import { compareStoryIds } from "@/lib/bmad/ids";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

/**
 * State of the Epics page toolbar. Two modes share one set of controls:
 *  - "epics" (empty search): Filter/Sort act on epics;
 *  - "stories" (non-empty search): they act on the story results.
 * Filter selection across modes: one list (`statuses`), cut down to the values the
 * current mode offers. Values valid in both ("done", "in-progress") survive a switch,
 * the others are dropped. The same goes for the sort key (progress/stories are epic only).
 */
export type EpicsPageMode = "epics" | "stories";

export interface EpicsPageState {
  query: string;
  statuses: string[];
  sort: string;
  dir: SortDir;
}

export const DEFAULT_PAGE_STATE: EpicsPageState = { query: "", statuses: [], sort: "default", dir: "asc" };

/** URL params; none collide with the legacy `?epic=` / `?story=` redirects. */
export const PAGE_PARAM = { query: "q", statuses: "st", sort: "sort", dir: "dir" } as const;

export const STORY_STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "review", label: "In review" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "ready-for-dev", label: "Ready for dev" },
  { value: "backlog", label: "Backlog" },
] as const;

export const STORY_SORT_KEYS = ["default", "id", "title", "status"] as const;
export type StorySortKey = (typeof STORY_SORT_KEYS)[number];

export const STORY_SORT_LABELS: Record<StorySortKey, string> = {
  default: "Default order",
  id: SORT_LABELS.id,
  title: SORT_LABELS.title,
  status: SORT_LABELS.status,
};

export function modeOf(query: string): EpicsPageMode {
  return query.trim() === "" ? "epics" : "stories";
}

export function statusOptions(mode: EpicsPageMode): { value: string; label: string }[] {
  return mode === "epics" ? [...EPIC_STATUSES] : [...STORY_STATUS_OPTIONS];
}

export function sortKeys(mode: EpicsPageMode): readonly string[] {
  return mode === "epics" ? SORT_KEYS : STORY_SORT_KEYS;
}

export function sortLabels(mode: EpicsPageMode): Record<string, string> {
  return mode === "epics" ? SORT_LABELS : STORY_SORT_LABELS;
}

/** Keeps only what the mode offers: status values, and a known sort key (else default). */
export function sanitizeForMode(state: EpicsPageState, mode: EpicsPageMode): EpicsPageState {
  const valid = new Set(statusOptions(mode).map((o) => o.value));
  const sort = sortKeys(mode).includes(state.sort) ? state.sort : "default";
  return {
    ...state,
    statuses: [...new Set(state.statuses.filter((s) => valid.has(s)))],
    sort,
    dir: sort === "default" && state.sort !== "default" ? "asc" : state.dir,
  };
}

/** Reads the state from URL params; unknown or bad values fall back to defaults. */
export function parseEpicsPageState(params: { get(name: string): string | null }): EpicsPageState {
  const query = params.get(PAGE_PARAM.query) ?? "";
  const raw: EpicsPageState = {
    query,
    statuses: (params.get(PAGE_PARAM.statuses) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    sort: (params.get(PAGE_PARAM.sort) ?? "").trim() || "default",
    dir: params.get(PAGE_PARAM.dir) === "desc" ? "desc" : "asc",
  };
  return sanitizeForMode(raw, modeOf(query));
}

/** Writes the state onto a copy of `base` params; defaults are omitted, other params kept. */
export function serializeEpicsPageState(
  base: URLSearchParams | string,
  state: EpicsPageState,
): URLSearchParams {
  const out = new URLSearchParams(typeof base === "string" ? base : base.toString());
  Object.values(PAGE_PARAM).forEach((k) => out.delete(k));
  const s = sanitizeForMode(state, modeOf(state.query));
  if (s.query.trim() !== "") out.set(PAGE_PARAM.query, s.query);
  if (s.statuses.length > 0) out.set(PAGE_PARAM.statuses, s.statuses.join(","));
  if (s.sort !== "default") out.set(PAGE_PARAM.sort, s.sort);
  if (s.dir !== "asc") out.set(PAGE_PARAM.dir, s.dir);
  return out;
}

/** Direction a key starts in when picked. */
export function defaultDirFor(mode: EpicsPageMode, sort: string): SortDir {
  return mode === "epics" ? (DEFAULT_DIR[sort as EpicSortKey] ?? "asc") : "asc";
}

/** True when search, filter or a non-default sort is active. */
export function isPageFiltered(s: EpicsPageState): boolean {
  return s.query.trim() !== "" || s.statuses.length > 0;
}

/**
 * Browsing keeps the status-grouped layout (In progress / Not started / Done) only while
 * no sort override is active; any picked key, or a flipped direction, gives a flat list.
 */
export function isGroupedLayout(state: EpicsPageState): boolean {
  return state.sort === "default" && state.dir === "asc";
}

const STORY_STATUS_RANK: Record<string, number> = {
  "in-progress": 0,
  review: 1,
  blocked: 2,
  "ready-for-dev": 3,
  backlog: 4,
  done: 5,
};

/** Story results sorted by ID (natural), Title or Status; "default" keeps the input order. Sorts a copy. */
export function sortStoryResults<T extends Pick<StoryDetail, "id" | "title" | "status">>(
  stories: T[],
  sort: string,
  dir: SortDir,
): T[] {
  const sign = dir === "desc" ? -1 : 1;
  if (sort === "default") return dir === "desc" ? [...stories].reverse() : [...stories];
  const cmp = (a: T, b: T) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" });
      case "status":
        return (STORY_STATUS_RANK[a.status] ?? 9) - (STORY_STATUS_RANK[b.status] ?? 9);
      default:
        return compareStoryIds(a.id, b.id);
    }
  };
  return [...stories].sort((a, b) => sign * cmp(a, b) || compareStoryIds(a.id, b.id));
}

export function storyStatusCounts(stories: Pick<StoryDetail, "status">[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of stories) counts[s.status] = (counts[s.status] ?? 0) + 1;
  return counts;
}

export function filterStoriesByStatuses<T extends Pick<StoryDetail, "status">>(
  stories: T[],
  statuses: string[],
): T[] {
  return statuses.length === 0 ? stories : stories.filter((s) => statuses.includes(s.status));
}

/** Epics after the status filter and sort of the page state (browsing mode). */
export function browseEpics(epics: Epic[], state: EpicsPageState): Epic[] {
  const s = sanitizeForMode(state, "epics");
  return sortEpics(
    filterEpicsByStatus(epics, s.statuses as Parameters<typeof filterEpicsByStatus>[1]),
    s.sort as EpicSortKey,
    s.dir,
  );
}

export function browseCounts(epics: Epic[]): Record<string, number> {
  return statusCounts(epics);
}
