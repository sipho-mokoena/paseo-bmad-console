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
