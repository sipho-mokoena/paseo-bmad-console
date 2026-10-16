import { describe, it, expect } from "vitest";
import { groupEpicsByStatus, searchStories, filterStoriesByStatus, epicHref, storiesRedirectTarget } from "../stories-browse";
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

describe("epicHref", () => {
  it("builds the ?epic= link and encodes the id", () => {
    expect(epicHref("/repo/a/b/epics", "3")).toBe("/repo/a/b/epics?epic=3");
    expect(epicHref("/x", "a b")).toBe("/x?epic=a%20b");
  });
});

describe("storiesRedirectTarget", () => {
  it("points at epics and keeps ?epic=", () => {
    expect(storiesRedirectTarget("/repo/o/r")).toBe("/repo/o/r/epics");
    expect(storiesRedirectTarget("/repo/o/r", "3")).toBe("/repo/o/r/epics?epic=3");
  });
});
