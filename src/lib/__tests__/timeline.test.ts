import { describe, expect, it } from "vitest";
import { buildEpicGraph, buildStoryGraph, type GraphStoryInput } from "../dependency-graph";
import {
  DEFAULT_TIMELINE_STATE,
  parseTimelineState,
  serializeTimelineState,
  timelineHref,
  timelineRedirectTarget,
  shouldShowTimelineOnOverview,
} from "../timeline-params";
import { toTimelineData } from "../timeline-data";
import { buildGanttModel, countCrossings, edgePath, layoutLayers, neighbourKey, NODE_H, NODE_W } from "../timeline-layout";

const q = (s: string) => new URLSearchParams(s);
const st = (id: string, epicId: string, deps: string[] = [], status = "backlog"): GraphStoryInput => ({ id, title: `T ${id}`, status, epicId, deps });

describe("timeline params", () => {
  it("defaults on empty and bad values", () => {
    expect(parseTimelineState(q(""))).toEqual(DEFAULT_TIMELINE_STATE);
    expect(parseTimelineState(q("view=nope&level=x&status=bogus,done,done&critical=0"))).toMatchObject({
      view: "gantt",
      level: "stories",
      status: ["done"],
      critical: false,
    });
  });
  it("reads every param", () => {
    expect(parseTimelineState(q("view=graph&scope=E2&status=blocked,review&q=wal&critical=1&all=true&focus=E2-S1&ready=1&risk=1&level=epics"))).toEqual({
      view: "graph",
      scope: "E2",
      status: ["blocked", "review"],
      q: "wal",
      critical: true,
      all: true,
      focus: "E2-S1",
      ready: true,
      risk: true,
      level: "epics",
    });
  });
  it("round-trips, omits defaults and keeps unrelated params", () => {
    expect(serializeTimelineState("", DEFAULT_TIMELINE_STATE).toString()).toBe("");
    const state = { ...DEFAULT_TIMELINE_STATE, view: "list" as const, scope: "1", status: ["done"], q: "a b", focus: "1.2", ready: true };
    const out = serializeTimelineState("foo=1&view=graph", state);
    expect(out.get("foo")).toBe("1");
    expect(parseTimelineState(out)).toEqual(state);
  });
  it("builds entry point links", () => {
    expect(timelineHref("/repo/o/r")).toBe("/repo/o/r#timeline");
    expect(timelineHref("/repo/o/r", { focus: "E1-S1" })).toBe("/repo/o/r?focus=E1-S1#timeline");
    expect(timelineHref("/repo/o/r", { scope: "2" })).toBe("/repo/o/r?scope=2#timeline");
  });
});

describe("old /timeline route redirect", () => {
  it("goes to the Overview and keeps every query param", () => {
    expect(timelineRedirectTarget("/repo/o/r")).toBe("/repo/o/r");
    expect(timelineRedirectTarget("/repo/o/r", { q: "wal", status: "done,review" })).toBe("/repo/o/r?q=wal&status=done%2Creview");
    expect(timelineRedirectTarget("/repo/o/r", { view: "graph", scope: "3", focus: "3.6", critical: "1", level: "epics" })).toBe(
      "/repo/o/r?view=graph&scope=3&focus=3.6&critical=1&level=epics#timeline",
    );
  });
  it("keeps repeated params and skips undefined ones", () => {
    expect(timelineRedirectTarget("/repo/o/r", { focus: ["1.1", "1.2"], all: undefined })).toBe("/repo/o/r?focus=1.1&focus=1.2#timeline");
  });
});

describe("shouldShowTimelineOnOverview", () => {
  const story = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra }) as never;
  it("is true with epic or story dependencies", () => {
    expect(shouldShowTimelineOnOverview({ epics: [{ after: ["1"] }] as never, stories: [] })).toBe(true);
    expect(shouldShowTimelineOnOverview({ epics: [{}] as never, stories: [story("1.2", { dependsOn: ["1.1"] })] })).toBe(true);
    expect(shouldShowTimelineOnOverview({ epics: [{}] as never, stories: [story("1.2", { ticket: { after: ["1.1"] } })] })).toBe(true);
  });
  it("is false without dependency data, so the epics list stays", () => {
    expect(shouldShowTimelineOnOverview({ epics: [{}, { after: [] }] as never, stories: [story("1.1"), story("1.2", { dependsOn: [] })] })).toBe(false);
    expect(shouldShowTimelineOnOverview({ epics: [], stories: [] })).toBe(false);
  });
});

describe("toTimelineData", () => {
  it("keeps only what the charts need and unifies deps", () => {
    const data = toTimelineData({
      epics: [{ id: "1", title: "One", description: "d", body: "big", status: "not-started", stories: [], totalStories: 0, completedStories: 0, progressPercent: 0, after: [{ id: "2", needs: "x" }] }],
      stories: [
        { id: "1.1", title: "A", status: "done", epicId: "1", description: "", body: "huge", acceptanceCriteria: [], tasks: [], completedTasks: 0, totalTasks: 0, ticket: { covers: [], after: ["1.0"], risk: "high", type: "feature" } },
        { id: "1.2", title: "B", status: "backlog", epicId: "1", description: "", acceptanceCriteria: [], tasks: [], completedTasks: 0, totalTasks: 0, dependsOn: ["1.1"] },
      ],
    });
    expect(data.stories[0]).toEqual({ id: "1.1", title: "A", status: "done", epicId: "1", deps: ["1.0"], risk: "high", type: "feature" });
    expect(data.stories[1].deps).toEqual(["1.1"]);
    expect(data.epics[0]).toEqual({ id: "1", title: "One", status: "not-started", after: [{ id: "2", needs: "x" }] });
    expect(data.hasRisk).toBe(true);
    expect(JSON.stringify(data)).not.toContain("huge");
  });
});

describe("gantt model", () => {
  const stories = [st("1.1", "1", [], "done"), st("1.2", "1", ["1.1"]), st("2.1", "2", ["1.2"]), st("2.2", "2", ["2.1"])];
  const epics = [
    { id: "1", title: "One", status: "not-started" },
    { id: "2", title: "Two", status: "not-started", after: [{ id: "1" }] },
  ];
  const base = () => ({
    storyGraph: buildStoryGraph(stories, epics),
    epicGraph: buildEpicGraph(epics, stories),
    epicOrder: ["1", "2"],
    epicTitles: new Map(epics.map((e) => [e.id, e.title])),
    filter: { statuses: [], ready: false, q: "" },
    storyLevel: true,
  });
  it("has one summary row per epic and story rows only when expanded", () => {
    const m = buildGanttModel({ ...base(), expanded: new Set(["2"]) });
    expect(m.rows.map((r) => `${r.type}:${r.key}`)).toEqual(["epic:epic:1", "epic:epic:2", "story:2.1", "story:2.2"]);
    expect(m.rows[0].span).toEqual({ start: 0, end: 2, total: 2, done: 1 });
    expect(m.rows[1].span).toEqual({ start: 2, end: 4, total: 2, done: 0 });
    expect(m.waves).toBe(4);
  });
  it("filters story rows and drops epics without a match", () => {
    const m = buildGanttModel({ ...base(), expanded: new Set(["1", "2"]), filter: { statuses: [], ready: true, q: "" } });
    expect(m.rows.map((r) => r.key)).toEqual(["epic:1", "1.2"]);
  });
  it("falls back to epic bars without story-level dependencies", () => {
    const m = buildGanttModel({ ...base(), storyLevel: false, expanded: new Set() });
    expect(m.epicOnly).toBe(true);
    expect(m.rows.map((r) => [r.key, r.span!.start, r.expandable])).toEqual([["epic:1", 0, false], ["epic:2", 1, false]]);
  });
});

describe("layered layout", () => {
  it("places layers left to right and is deterministic", () => {
    const input = [st("1.1", "1"), st("1.2", "1", ["1.1"]), st("1.3", "1", ["1.2"])];
    const g = buildStoryGraph(input, [{ id: "1" }]);
    const a = layoutLayers(g);
    const b = layoutLayers(g);
    expect([...a.placed.values()]).toEqual([...b.placed.values()]);
    expect(a.placed.get("1.2")!.x).toBeGreaterThan(a.placed.get("1.1")!.x);
    expect(a.width).toBeGreaterThan(3 * NODE_W);
  });
  it("reduces crossings with the barycenter sweep", () => {
    // a-d, b-c cross in the naive order a,b / c,d (stable order is by id).
    const input = [st("1.1", "1"), st("1.2", "1"), st("1.3", "1", ["1.2"]), st("1.4", "1", ["1.1"])];
    const g = buildStoryGraph(input, [{ id: "1" }]);
    const naive = new Map(g.nodes.map((n) => [n.key, { layer: n.layer, index: g.nodes.filter((m) => m.layer === n.layer && m.order < n.order).length }]));
    expect(countCrossings(g.edges, naive)).toBe(1);
    expect(layoutLayers(g).crossings).toBe(0);
  });
  it("lays out 300 nodes quickly", () => {
    const input: GraphStoryInput[] = [];
    for (let i = 0; i < 300; i++) input.push(st(`${Math.floor(i / 10) + 1}.${(i % 10) + 1}`, String(Math.floor(i / 10) + 1), i > 8 ? [`${Math.floor((i - 9) / 10) + 1}.${((i - 9) % 10) + 1}`] : []));
    const g = buildStoryGraph(input, []);
    const t0 = performance.now();
    layoutLayers(g);
    expect(performance.now() - t0).toBeLessThan(500);
  });
  it("moves between neighbours", () => {
    const g = buildStoryGraph([st("1.1", "1"), st("1.2", "1", ["1.1"]), st("1.3", "1", ["1.1"])], [{ id: "1" }]);
    const l = layoutLayers(g);
    expect(neighbourKey(g, l, "1.1", "right")).toBe("1.2");
    expect(neighbourKey(g, l, "1.2", "left")).toBe("1.1");
    expect(neighbourKey(g, l, "1.2", "down")).toBe("1.3");
    expect(neighbourKey(g, l, "1.2", "up")).toBeNull();
    expect(neighbourKey(g, l, "1.1", "left")).toBeNull();
  });
  it("draws a path between the card edges", () => {
    const p = edgePath({ key: "a", layer: 0, index: 0, x: 0, y: 0 }, { key: "b", layer: 1, index: 0, x: 300, y: 100 });
    expect(p.startsWith(`M${NODE_W} ${NODE_H / 2} C`)).toBe(true);
    expect(p.endsWith("299 126")).toBe(true);
  });
});
