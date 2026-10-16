import { describe, it, expect } from "vitest";
import {
  groupEpicsByStatus,
  searchStories,
  filterStoriesByStatus,
  epicsHref,
  epicHref,
  storyHref,
  legacyEpicsTarget,
  storiesRedirectTarget,
  storiesBlockedBy,
  resolveAfter,
  neighbours,
} from "../stories-browse";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

const epic = (id: string, status: Epic["status"]): Epic => ({
  id,
  title: `Epic ${id}`,
  description: "",
  status,
  stories: [],
  totalStories: 0,
  completedStories: 0,
  progressPercent: 0,
});

const story = (id: string, title: string, description = ""): StoryDetail => ({
  id,
  title,
  status: "backlog",
  epicId: id.split(".")[0],
  description,
  acceptanceCriteria: [],
  tasks: [],
  completedTasks: 0,
  totalTasks: 0,
});

describe("groupEpicsByStatus", () => {
  it("orders groups and drops empty ones", () => {
    const groups = groupEpicsByStatus([
      epic("1", "done"),
      epic("2", "in-progress"),
      epic("3", "not-started"),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["In progress", "Not started", "Done"]);
    expect(groupEpicsByStatus([epic("1", "done")]).map((g) => g.status)).toEqual(["done"]);
  });
});

describe("searchStories", () => {
  const all = [
    story("1.1", "Plugin Registry"),
    story("2.3", "Login", "uses the REGISTRY lookup"),
    story("3.2", "Other"),
  ];
  it("matches title, description and id, case-insensitively", () => {
    expect(searchStories(all, "registry").map((s) => s.id)).toEqual(["1.1", "2.3"]);
    expect(searchStories(all, "3.2").map((s) => s.id)).toEqual(["3.2"]);
  });
  it("returns everything for an empty query", () => {
    expect(searchStories(all, "  ")).toHaveLength(3);
  });
});

describe("filterStoriesByStatus", () => {
  const stories = [
    { id: "1.1", status: "done" },
    { id: "1.2", status: "backlog" },
    { id: "1.3", status: "review" },
  ];
  const f = (operator: string, values: string[], field = "status") => ({ field, operator, values });

  it("keeps everything with no usable filter", () => {
    expect(filterStoriesByStatus(stories, [])).toHaveLength(3);
    expect(filterStoriesByStatus(stories, [f("is_any_of", [])])).toHaveLength(3);
    expect(filterStoriesByStatus(stories, [f("is", ["done"], "epicId")])).toHaveLength(3);
  });

  it("includes and excludes by status", () => {
    expect(filterStoriesByStatus(stories, [f("is_any_of", ["done", "review"])]).map((s) => s.id)).toEqual(["1.1", "1.3"]);
    expect(filterStoriesByStatus(stories, [f("is_not", ["done"])]).map((s) => s.id)).toEqual(["1.2", "1.3"]);
  });
});

const B = "/repo/o/r";

describe("path helpers", () => {
  it("builds epics, epic and story paths and encodes ids", () => {
    expect(epicsHref(B)).toBe("/repo/o/r/epics");
    expect(epicHref(B, "3")).toBe("/repo/o/r/epics/3");
    expect(epicHref(B, "a b")).toBe("/repo/o/r/epics/a%20b");
    expect(storyHref(B, "3", "3.6")).toBe("/repo/o/r/epics/3/3.6");
  });
});

describe("legacyEpicsTarget", () => {
  const epics = [{ id: "3" }, { id: "4" }];
  const stories = [
    { id: "3.6", epicId: "3" },
    { id: "4.1", epicId: "4" },
  ];
  it("sends ?epic= to the epic page", () => {
    expect(legacyEpicsTarget(B, { epic: "3" }, epics, stories)).toBe("/repo/o/r/epics/3");
  });
  it("sends ?story= (with or without ?epic=) to the story page, using the story's epic", () => {
    expect(legacyEpicsTarget(B, { epic: "3", story: "3.6" }, epics, stories)).toBe("/repo/o/r/epics/3/3.6");
    expect(legacyEpicsTarget(B, { story: "4.1" }, epics, stories)).toBe("/repo/o/r/epics/4/4.1");
    expect(legacyEpicsTarget(B, { epic: "3", story: "4.1" }, epics, stories)).toBe("/repo/o/r/epics/4/4.1");
  });
  it("falls back to the epic, then to nothing, for unknown refs", () => {
    expect(legacyEpicsTarget(B, { epic: "3", story: "9.9" }, epics, stories)).toBe("/repo/o/r/epics/3");
    expect(legacyEpicsTarget(B, { epic: "9", story: "9.9" }, epics, stories)).toBeNull();
    expect(legacyEpicsTarget(B, {}, epics, stories)).toBeNull();
  });
});

describe("storiesRedirectTarget", () => {
  it("points at the new routes", () => {
    expect(storiesRedirectTarget(B)).toBe("/repo/o/r/epics");
    expect(storiesRedirectTarget(B, "3")).toBe("/repo/o/r/epics/3");
    expect(storiesRedirectTarget(B, "3", "3.6")).toBe("/repo/o/r/epics/3/3.6");
    expect(storiesRedirectTarget(B, undefined, "3.6")).toBe("/repo/o/r/epics?story=3.6");
  });
});

describe("story links", () => {
  const t = (id: string, after: string[] = []) => ({
    id,
    ticket: { covers: [], after },
  });
  const all = [t("1.1"), t("1.2", ["1.1"]), t("2.1", ["1.1", "1.2"]), { id: "2.2" }];

  it("computes the stories a story blocks", () => {
    expect(storiesBlockedBy(all, "1.1").map((s) => s.id)).toEqual(["1.2", "2.1"]);
    expect(storiesBlockedBy(all, "2.1")).toEqual([]);
  });
  it("resolves after refs, leaving unknown ones unlinked", () => {
    const r = resolveAfter(all, ["1.1", "9.9"]);
    expect(r[0].story?.id).toBe("1.1");
    expect(r[1]).toEqual({ ref: "9.9", story: null });
  });
  it("finds previous and next neighbours", () => {
    expect(neighbours(all, "1.2")).toMatchObject({ prev: { id: "1.1" }, next: { id: "2.1" } });
    expect(neighbours(all, "1.1").prev).toBeNull();
    expect(neighbours(all, "2.2").next).toBeNull();
    expect(neighbours(all, "x")).toEqual({ prev: null, next: null });
  });
});
