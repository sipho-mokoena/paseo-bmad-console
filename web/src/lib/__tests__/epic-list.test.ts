import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATE,
  clampPage,
  computeEpicList,
  filterEpicsByStatus,
  isFiltered,
  pageItems,
  paginate,
  parseListState,
  searchEpics,
  serializeListState,
  showToolbar,
  sortEpics,
  statusCounts,
  type EpicListState,
} from "../epic-list";
import type { Epic } from "@/lib/bmad/types";

const mk = (
  id: string,
  title: string,
  status: Epic["status"] = "not-started",
  total = 0,
  done = 0,
  description = "",
): Epic => ({
  id,
  title,
  description,
  status,
  stories: [],
  totalStories: total,
  completedStories: done,
  progressPercent: total ? Math.round((done / total) * 100) : 0,
});

const epics = [
  mk("E10", "Billing", "in-progress", 10, 5, "Invoices and payments"),
  mk("DEFERRED-E10", "Later work", "not-started", 2, 0),
  mk("E2", "Auth", "done", 4, 4, "Login flow"),
  mk("E1", "Zebra setup", "done", 8, 8),
  mk("E3", "alpha", "in-progress", 6, 1),
];
const ids = (l: Epic[]) => l.map((e) => e.id);

describe("searchEpics", () => {
  it("matches id, label, title and description case-insensitively", () => {
    expect(ids(searchEpics(epics, "deferred"))).toEqual(["DEFERRED-E10"]);
    expect(ids(searchEpics(epics, "e2"))).toEqual(["E2"]);
    expect(ids(searchEpics(epics, "INVOICES"))).toEqual(["E10"]);
  });
  it("ANDs multiple terms", () => {
    expect(ids(searchEpics(epics, "login auth"))).toEqual(["E2"]);
    expect(searchEpics(epics, "login billing")).toEqual([]);
  });
  it("matches the E label of bare numeric ids", () => {
    const list = [mk("1", "One"), mk("2", "Two")];
    expect(ids(searchEpics(list, "E2"))).toEqual(["2"]);
  });
  it("returns everything for a blank query", () => {
    expect(searchEpics(epics, "   ")).toBe(epics);
  });
});

describe("sortEpics", () => {
  it("default/id: natural order, DEFERRED last", () => {
    expect(ids(sortEpics(epics, "default", "asc"))).toEqual(["E1", "E2", "E3", "E10", "DEFERRED-E10"]);
    expect(ids(sortEpics(epics, "id", "desc"))).toEqual(["DEFERRED-E10", "E10", "E3", "E2", "E1"]);
  });
  it("title A-Z and Z-A, case-insensitive", () => {
    expect(ids(sortEpics(epics, "title", "asc"))).toEqual(["E3", "E2", "E10", "DEFERRED-E10", "E1"]);
    expect(sortEpics(epics, "title", "desc")[0].id).toBe("E1");
  });
  it("progress both ways, ties by id", () => {
    expect(ids(sortEpics(epics, "progress", "desc"))).toEqual(["E1", "E2", "E10", "E3", "DEFERRED-E10"]);
    expect(ids(sortEpics(epics, "progress", "asc"))).toEqual(["DEFERRED-E10", "E3", "E10", "E1", "E2"]);
  });
  it("stories most/least", () => {
    expect(ids(sortEpics(epics, "stories", "desc"))).toEqual(["E10", "E1", "E3", "E2", "DEFERRED-E10"]);
    expect(ids(sortEpics(epics, "stories", "asc"))).toEqual(["DEFERRED-E10", "E2", "E3", "E1", "E10"]);
  });
  it("status: in progress, not started, done", () => {
    expect(ids(sortEpics(epics, "status", "asc"))).toEqual(["E3", "E10", "DEFERRED-E10", "E1", "E2"]);
    expect(ids(sortEpics(epics, "status", "desc"))).toEqual(["E1", "E2", "DEFERRED-E10", "E3", "E10"]);
  });
  it("does not mutate", () => {
    const copy = [...epics];
    sortEpics(epics, "title", "desc");
    expect(epics).toEqual(copy);
  });
});

describe("status filter", () => {
  it("filters and counts, unknown statuses count as not started", () => {
    expect(ids(filterEpicsByStatus(epics, ["done"]))).toEqual(["E2", "E1"]);
    expect(filterEpicsByStatus(epics, [])).toBe(epics);
    expect(ids(filterEpicsByStatus(epics, ["done", "in-progress"]))).toHaveLength(4);
    const odd = [...epics, mk("E9", "x", "review" as Epic["status"])];
    expect(statusCounts(odd)).toEqual({ "in-progress": 2, "not-started": 2, done: 2 });
  });
});

describe("pagination", () => {
  const many = Array.from({ length: 38 }, (_, i) => i);
  it("slices pages and reports the range", () => {
    const p = paginate(many, 1);
    expect(p.items).toHaveLength(15);
    expect([p.from, p.to, p.total, p.pages]).toEqual([1, 15, 38, 3]);
    const last = paginate(many, 3);
    expect([last.from, last.to, last.items.length]).toEqual([31, 38, 8]);
  });
  it("clamps out of range pages", () => {
    expect(paginate(many, 99).page).toBe(3);
    expect(paginate(many, 0).page).toBe(1);
    expect(clampPage(NaN, 38)).toBe(1);
    expect(clampPage(5, 0)).toBe(1);
  });
  it("handles empty", () => {
    const p = paginate([], 1);
    expect([p.from, p.to, p.pages]).toEqual([0, 0, 1]);
  });
  it("builds compact page lists", () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(pageItems(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(pageItems(12, 12)).toEqual([1, "…", 9, 10, 11, 12]);
  });
});

describe("URL state", () => {
  it("round-trips", () => {
    const s: EpicListState = {
      query: "dead line",
      statuses: ["done", "in-progress"],
      sort: "progress",
      dir: "desc",
      page: 3,
    };
    const params = serializeListState("file=a.md", s);
    expect(params.get("file")).toBe("a.md");
    expect(params.get("eq")).toBe("dead line");
    expect(params.get("es")).toBe("done,in-progress");
    expect(params.get("esort")).toBe("progress");
    expect(params.get("edir")).toBe("desc");
    expect(params.get("epage")).toBe("3");
    expect(parseListState(new URLSearchParams(params.toString()))).toEqual(s);
  });
  it("omits defaults and drops stale params", () => {
    const params = serializeListState("eq=x&epage=2&q=keep", DEFAULT_STATE);
    expect(params.toString()).toBe("q=keep");
  });
  it("tolerates garbage", () => {
    const s = parseListState(new URLSearchParams("esort=nope&edir=up&es=bogus,done,done&epage=-4"));
    expect(s).toEqual({ ...DEFAULT_STATE, statuses: ["done"] });
    expect(parseListState(new URLSearchParams("epage=abc")).page).toBe(1);
  });
});

describe("toolbar and composition", () => {
  it("hides the toolbar under 6 epics", () => {
    expect(showToolbar(5)).toBe(false);
    expect(showToolbar(6)).toBe(true);
    expect(showToolbar(38)).toBe(true);
  });
  it("isFiltered ignores sort and page", () => {
    expect(isFiltered({ ...DEFAULT_STATE, sort: "title", page: 2 })).toBe(false);
    expect(isFiltered({ ...DEFAULT_STATE, query: " a " })).toBe(true);
    expect(isFiltered({ ...DEFAULT_STATE, statuses: ["done"] })).toBe(true);
  });
  it("computes search then filter then sort then page", () => {
    const r = computeEpicList(epics, {
      ...DEFAULT_STATE,
      statuses: ["done"],
      sort: "title",
      dir: "desc",
    });
    expect(ids(r.filtered)).toEqual(["E2", "E1"]);
    expect(ids(r.page.items)).toEqual(["E1", "E2"]);
    expect(r.counts["in-progress"]).toBe(2);
  });
});
