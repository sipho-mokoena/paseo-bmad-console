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

/** Link to an epic's stories on the Epics page: `<pathname>?epic=<id>`. */
export function epicHref(pathname: string, epicId: string): string {
  return `${pathname}?epic=${encodeURIComponent(epicId)}`;
}

/** Where the retired `<base>/stories` route sends visitors, keeping `?epic=`. */
export function storiesRedirectTarget(base: string, epic?: string): string {
  return epic ? epicHref(`${base}/epics`, epic) : `${base}/epics`;
}
