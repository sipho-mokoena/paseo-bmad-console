import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE_STATE,
  browseEpics,
  filterStoriesByStatuses,
  isGroupedLayout,
  modeOf,
  parseEpicsPageState,
  sanitizeForMode,
  serializeEpicsPageState,
  sortKeys,
  sortStoryResults,
  statusOptions,
  storyStatusCounts,
} from "../epics-page-params";
import type { Epic } from "@/lib/bmad/types";

const mk = (id: string, title: string, status: Epic["status"], total = 0, done = 0): Epic => ({
  id,
  title,
  description: "",
  status,
  stories: [],
  totalStories: total,
  completedStories: done,
  progressPercent: total ? Math.round((done / total) * 100) : 0,
});
const epics = [
  mk("E10", "Billing", "in-progress", 10, 5),
  mk("DEFERRED-E1", "Later", "not-started", 2, 0),
  mk("E2", "Auth", "done", 4, 4),
  mk("E1", "Core", "not-started", 6, 0),
];
const p = (qs: string) => parseEpicsPageState(new URLSearchParams(qs));

describe("params", () => {
  it("round trips and keeps unrelated params", () => {
    const state = { query: "login", statuses: ["done", "blocked"], sort: "title", dir: "desc" as const };
    const qs = serializeEpicsPageState("x=1", state);
    expect(qs.get("x")).toBe("1");
    expect(p(qs.toString())).toEqual(state);
    const epicState = { query: "", statuses: ["done"], sort: "progress", dir: "desc" as const };
    expect(p(serializeEpicsPageState("", epicState).toString())).toEqual(epicState);
  });
  it("omits defaults", () => {
    expect(serializeEpicsPageState("", DEFAULT_PAGE_STATE).toString()).toBe("");
  });
  it("tolerates junk", () => {
    expect(p("st=,,nope&sort=zzz&dir=sideways")).toEqual(DEFAULT_PAGE_STATE);
  });
  it("does not use the legacy epic/story params", () => {
    const qs = serializeEpicsPageState("epic=E1&story=E1-S1", DEFAULT_PAGE_STATE);
    expect(qs.get("epic")).toBe("E1");
    expect(qs.get("q")).toBeNull();
  });
});

describe("mode-specific options", () => {
  it("offers epic statuses when browsing and story statuses when searching", () => {
    expect(modeOf("  ")).toBe("epics");
    expect(modeOf("a")).toBe("stories");
    expect(statusOptions("epics").map((o) => o.value)).toEqual(["in-progress", "not-started", "done"]);
    expect(statusOptions("stories").map((o) => o.label)).toEqual([
      "Done", "In review", "In progress", "Blocked", "Ready for dev", "Backlog",
    ]);
    expect(sortKeys("epics")).toContain("progress");
    expect(sortKeys("stories")).toEqual(["default", "id", "title", "status"]);
  });
  it("drops values the mode does not offer, keeps the shared ones", () => {
    const s = { query: "", statuses: ["done", "blocked", "not-started"], sort: "progress", dir: "desc" as const };
    expect(sanitizeForMode(s, "epics").statuses).toEqual(["done", "not-started"]);
    const toStories = sanitizeForMode(s, "stories");
    expect(toStories.statuses).toEqual(["done", "blocked"]);
    expect(toStories.sort).toBe("default");
    expect(toStories.dir).toBe("asc");
  });
  it("parses by the mode of q", () => {
    expect(p("st=blocked,done").statuses).toEqual(["done"]);
    expect(p("q=x&st=blocked,done").statuses).toEqual(["blocked", "done"]);
    expect(p("q=x&sort=progress").sort).toBe("default");
  });
});

describe("layout decision", () => {
  it("groups only with the default order", () => {
    expect(isGroupedLayout(DEFAULT_PAGE_STATE)).toBe(true);
    expect(isGroupedLayout({ ...DEFAULT_PAGE_STATE, sort: "title" })).toBe(false);
    expect(isGroupedLayout({ ...DEFAULT_PAGE_STATE, dir: "desc" })).toBe(false);
  });
});

describe("browseEpics", () => {
  it("sorts by natural id, DEFERRED last", () => {
    expect(browseEpics(epics, DEFAULT_PAGE_STATE).map((e) => e.id)).toEqual(["E1", "E2", "E10", "DEFERRED-E1"]);
  });
  it("filters by status and sorts", () => {
    const s = { ...DEFAULT_PAGE_STATE, statuses: ["not-started", "done"], sort: "stories", dir: "desc" as const };
    expect(browseEpics(epics, s).map((e) => e.id)).toEqual(["E1", "E2", "DEFERRED-E1"]);
  });
});

describe("story results", () => {
  const st = (id: string, title: string, status: string) => ({ id, title, status: status as never });
  const list = [st("E1-S10", "b story", "done"), st("E1-S2", "A story", "blocked"), st("E1-S1", "c", "in-progress")];
  it("sorts by natural id both ways", () => {
    expect(sortStoryResults(list, "id", "asc").map((s) => s.id)).toEqual(["E1-S1", "E1-S2", "E1-S10"]);
    expect(sortStoryResults(list, "id", "desc").map((s) => s.id)).toEqual(["E1-S10", "E1-S2", "E1-S1"]);
  });
  it("sorts by title and status", () => {
    expect(sortStoryResults(list, "title", "asc").map((s) => s.title)).toEqual(["A story", "b story", "c"]);
    expect(sortStoryResults(list, "status", "asc").map((s) => s.status)).toEqual(["in-progress", "blocked", "done"]);
  });
  it("default keeps order and does not mutate", () => {
    const copy = [...list];
    expect(sortStoryResults(list, "default", "asc")).toEqual(list);
    expect(sortStoryResults(list, "default", "desc").map((s) => s.id)).toEqual(["E1-S1", "E1-S2", "E1-S10"]);
    expect(list).toEqual(copy);
  });
  it("filters and counts by status", () => {
    expect(filterStoriesByStatuses(list, ["done", "blocked"])).toHaveLength(2);
    expect(filterStoriesByStatuses(list, [])).toHaveLength(3);
    expect(storyStatusCounts(list)).toEqual({ done: 1, blocked: 1, "in-progress": 1 });
  });
});
