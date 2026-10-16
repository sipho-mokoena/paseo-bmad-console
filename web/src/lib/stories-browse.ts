import type { Epic, StoryDetail } from "@/lib/bmad/types";

export const EPIC_GROUPS: { status: Epic["status"]; label: string }[] = [
  { status: "in-progress", label: "In progress" },
  { status: "not-started", label: "Not started" },
  { status: "done", label: "Done" },
];

/** Groups epics by status; any status other than in-progress/done counts as not started. */
export function groupEpicsByStatus(epics: Epic[]) {
  return EPIC_GROUPS.map((g) => ({
    ...g,
    epics: epics.filter((e) =>
      g.status === "not-started"
        ? e.status !== "in-progress" && e.status !== "done"
        : e.status === g.status,
    ),
  })).filter((g) => g.epics.length > 0);
}

/** Case-insensitive search over story title, id and description. Empty query matches all. */
export function searchStories(stories: StoryDetail[], query: string): StoryDetail[] {
  const q = query.trim().toLowerCase();
  if (!q) return stories;
  return stories.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.description ?? "").toLowerCase().includes(q),
  );
}

/** Minimal shape of a status filter chip (matches the Filters component). */
export interface StatusFilterLike {
  field: string;
  operator: string;
  values: string[];
}

/** Applies the "status" filters; other fields and empty value lists are ignored. */
export function filterStoriesByStatus<T extends { status: string }>(
  stories: T[],
  filters: StatusFilterLike[],
): T[] {
  return stories.filter((story) =>
    filters.every((f) => {
      if (f.field !== "status" || f.values.length === 0) return true;
      const negated = f.operator === "is_not" || f.operator === "is_not_any_of";
      return f.values.includes(story.status) !== negated;
    }),
  );
}

/** The epics list of a project: `<base>/epics` (base is `/repo/<owner>/<repo>`). */
export function epicsHref(base: string): string {
  return `${base}/epics`;
}

/** Link to an epic page: `<base>/epics/<epicId>`. */
export function epicHref(base: string, epicId: string): string {
  return `${epicsHref(base)}/${encodeURIComponent(epicId)}`;
}

/** Link to a story page: `<base>/epics/<epicId>/<storyId>`. */
export function storyHref(base: string, epicId: string, storyId: string): string {
  return `${epicHref(base, epicId)}/${encodeURIComponent(storyId)}`;
}

/**
 * Where the old query-string URLs go: `/epics?epic=` and `/epics?story=` (also the
 * retired `/stories`). A story wins over an epic and brings its own epic along; refs
 * that match nothing return null (the caller then shows the list).
 */
export function legacyEpicsTarget(
  base: string,
  query: { epic?: string; story?: string },
  epics: Pick<Epic, "id">[],
  stories: Pick<StoryDetail, "id" | "epicId">[],
): string | null {
  if (query.story) {
    const hit = stories.find(
      (s) => s.id === query.story && (!query.epic || s.epicId === query.epic),
    ) ?? stories.find((s) => s.id === query.story);
    if (hit) return storyHref(base, hit.epicId, hit.id);
  }
  if (query.epic && epics.some((e) => e.id === query.epic)) {
    return epicHref(base, query.epic);
  }
  return null;
}

/**
 * Where the retired `<base>/stories` route sends visitors. It cannot see the project,
 * so a lone `?story=` goes to the epics page, which resolves it.
 */
export function storiesRedirectTarget(base: string, epic?: string, story?: string): string {
  if (epic && story) return storyHref(base, epic, story);
  if (epic) return epicHref(base, epic);
  if (story) return `${epicsHref(base)}?story=${encodeURIComponent(story)}`;
  return epicsHref(base);
}

type Linked = Pick<StoryDetail, "id" | "ticket">;

/** Stories that list `storyId` in their `after` (the ones it blocks), in input order. */
export function storiesBlockedBy<T extends Linked>(stories: T[], storyId: string): T[] {
  return stories.filter((s) => s.id !== storyId && s.ticket?.after.includes(storyId));
}

/** Splits `after` refs into known stories (linkable) and unknown refs (plain chips). */
export function resolveAfter<T extends Pick<StoryDetail, "id">>(
  stories: T[],
  refs: string[],
): { ref: string; story: T | null }[] {
  return refs.map((ref) => ({ ref, story: stories.find((s) => s.id === ref) ?? null }));
}

/** Previous and next item around `id` in the given order (null at the ends or when absent). */
export function neighbours<T extends { id: string }>(
  items: T[],
  id: string,
): { prev: T | null; next: T | null } {
  const i = items.findIndex((s) => s.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: items[i - 1] ?? null, next: items[i + 1] ?? null };
}
