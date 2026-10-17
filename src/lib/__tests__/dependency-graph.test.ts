import { describe, expect, it } from "vitest";
import {
  buildEpicGraph,
  buildStoryGraph,
  busiestEpic,
  closure,
  epicSpan,
  hasDependencyData,
  matchesQuery,
  scopeStoryGraph,
  type GraphStoryInput,
} from "../dependency-graph";

const s = (id: string, epicId: string, deps: string[] = [], status = "backlog", extra: Partial<GraphStoryInput> = {}): GraphStoryInput => ({
  id,
  title: `Title ${id}`,
  status,
  epicId,
  deps,
  ...extra,
});
const epics = [
  { id: "1", title: "One" },
  { id: "2", title: "Two" },
  { id: "3", title: "Three" },
];

describe("buildStoryGraph", () => {
  it("lays stories out in waves by longest path", () => {
    const g = buildStoryGraph(
      [s("1.1", "1"), s("1.2", "1", ["1.1"]), s("1.3", "1", ["1.1"]), s("2.1", "2", ["1.2", "1.3"]), s("2.2", "2", ["1.1"])],
      epics,
    );
    const at = (k: string) => g.byKey.get(k)!;
    expect([at("1.1").start, at("1.2").start, at("1.3").start, at("2.1").start, at("2.2").start]).toEqual([0, 1, 1, 2, 1]);
    expect(at("2.1").end).toBe(3);
    expect(g.waves).toBe(3);
    expect(at("2.1").layer).toBe(2);
  });

  it("sizes by risk only when asked", () => {
    const input = [s("1.1", "1", [], "backlog", { risk: "high" }), s("1.2", "1", ["1.1"], "backlog", { risk: "medium" })];
    expect(buildStoryGraph(input, epics).waves).toBe(2);
    const sized = buildStoryGraph(input, epics, { sizeByRisk: true });
    expect(sized.byKey.get("1.1")!.duration).toBe(3);
    expect(sized.byKey.get("1.2")!.start).toBe(3);
    expect(sized.waves).toBe(5);
    // layers stay hop based
    expect(sized.byKey.get("1.2")!.layer).toBe(1);
  });

  it("reports unknown refs instead of dropping them silently", () => {
    const g = buildStoryGraph([s("1.1", "1", ["9.9", "1.1"]), s("1.2", "1", ["1.1"])], epics);
    expect(g.unresolved).toEqual([{ from: "1.1", ref: "9.9" }]);
    expect(g.edges).toHaveLength(1);
  });

  it("expands an epic ref to every story of that epic", () => {
    const g = buildStoryGraph([s("1.1", "1"), s("1.2", "1"), s("2.1", "2", ["1"])], epics);
    expect(g.byKey.get("2.1")!.after).toEqual(["1.1", "1.2"]);
    expect(g.edges.every((e) => e.viaEpic)).toBe(true);
  });

  it("detects and breaks cycles deterministically", () => {
    const input = [s("1.1", "1", ["1.3"]), s("1.2", "1", ["1.1"]), s("1.3", "1", ["1.2"]), s("1.4", "1", ["1.3"])];
    const a = buildStoryGraph(input, epics);
    const b = buildStoryGraph([...input].reverse(), epics);
    expect(a.cycles).toHaveLength(1);
    expect([...a.cycles[0]].sort()).toEqual(["1.1", "1.2", "1.3"]);
    expect(a.removedEdges).toHaveLength(1);
    expect(a.nodes.map((n) => [n.key, n.start])).toEqual(b.nodes.map((n) => [n.key, n.start]));
    expect(a.byKey.get("1.4")!.start).toBeGreaterThan(0);
  });

  it("computes blockedBy, blocks and ready", () => {
    const g = buildStoryGraph(
      [s("1.1", "1", [], "done"), s("1.2", "1", ["1.1"]), s("1.3", "1", ["1.2"]), s("1.4", "1", ["1.1"], "done")],
      epics,
    );
    expect(g.byKey.get("1.2")).toMatchObject({ ready: true, blockedBy: [], blocks: ["1.3"] });
    expect(g.byKey.get("1.3")).toMatchObject({ ready: false, blockedBy: ["1.2"] });
    expect(g.byKey.get("1.1")!.ready).toBe(false); // done itself
    expect(g.byKey.get("1.4")!.ready).toBe(false);
  });

  it("finds the critical path through unfinished work only", () => {
    const g = buildStoryGraph(
      [
        s("1.1", "1", [], "done"),
        s("1.2", "1", ["1.1"], "done"),
        s("1.3", "1", ["1.2"]),
        s("1.4", "1", ["1.3"]),
        s("1.5", "1", ["1.1"]),
      ],
      epics,
    );
    expect(g.criticalPath).toEqual(["1.3", "1.4"]);
    expect(g.byKey.get("1.5")!.critical).toBe(false);
    expect(buildStoryGraph([s("1.1", "1", [], "done")], epics).criticalPath).toEqual([]);
  });

  it("weights the critical path by risk", () => {
    const g = buildStoryGraph(
      [s("1.1", "1", [], "backlog", { risk: "medium" }), s("1.2", "1", [], "backlog"), s("1.3", "1", ["1.2"]), s("1.4", "1", ["1.3"])],
      epics,
      { sizeByRisk: true },
    );
    expect(g.criticalPath).toEqual(["1.2", "1.3", "1.4"]);
  });

  it("orders by epic order then id", () => {
    const g = buildStoryGraph([s("2.1", "2"), s("1.10", "1"), s("1.2", "1")], [{ id: "2" }, { id: "1" }]);
    expect(g.nodes.map((n) => n.id)).toEqual(["2.1", "1.2", "1.10"]);
  });

  it("returns closures", () => {
    const g = buildStoryGraph([s("1.1", "1"), s("1.2", "1", ["1.1"]), s("1.3", "1", ["1.2"]), s("1.4", "1")], epics);
    expect([...closure(g, "1.3", "up")].sort()).toEqual(["1.1", "1.2"]);
    expect([...closure(g, "1.1", "down")].sort()).toEqual(["1.2", "1.3"]);
    expect(closure(g, "1.4", "up").size).toBe(0);
  });

  it("handles an empty project", () => {
    const g = buildStoryGraph([], []);
    expect(g.nodes).toEqual([]);
    expect(g.waves).toBe(0);
    expect(g.hasEdges).toBe(false);
  });
});

describe("buildEpicGraph", () => {
  it("uses declared after edges with needs, plus derived ones", () => {
    const g = buildEpicGraph(
      [
        { id: "1", title: "One", status: "not-started" },
        { id: "2", title: "Two", status: "not-started", after: [{ id: "1", needs: "the lab" }, { id: "7" }] },
        { id: "3", title: "Three", status: "not-started" },
      ],
      [s("1.1", "1"), s("2.1", "2", ["1.1"]), s("3.1", "3", ["2.1"])],
    );
    expect(g.edges.find((e) => e.to === "2")).toMatchObject({ from: "1", needs: "the lab" });
    expect(g.edges.find((e) => e.to === "2")!.derived).toBeUndefined();
    expect(g.edges.find((e) => e.to === "3")).toMatchObject({ from: "2", derived: true });
    expect(g.unresolved).toEqual([{ from: "2", ref: "7" }]);
    expect(g.byKey.get("3")!.start).toBe(2);
  });

  it("marks an epic done when all its stories are done", () => {
    const g = buildEpicGraph([{ id: "1", title: "One", status: "not-started" }], [s("1.1", "1", [], "done")]);
    expect(g.byKey.get("1")!.done).toBe(true);
  });
});

describe("scopeStoryGraph", () => {
  const input = [
    s("1.1", "1", [], "done"),
    s("1.2", "1", [], "backlog"),
    s("2.1", "2", ["1.1", "1.2"]),
    s("2.2", "2", ["2.1"]),
    s("3.1", "3", ["2.2"]),
  ];
  it("collapses outside prerequisites and dependents into external nodes", () => {
    const g = scopeStoryGraph(input, epics, "2");
    const keys = g.nodes.map((n) => n.key);
    expect(keys).toEqual(["ext-in:1", "2.1", "2.2", "ext-out:3"]);
    expect(g.byKey.get("ext-in:1")).toMatchObject({ kind: "external", members: ["1.1", "1.2"], status: "backlog" });
    expect(g.byKey.get("ext-in:1")!.title).toContain("2 prerequisites");
    expect(g.byKey.get("2.1")!.after).toEqual(["ext-in:1"]);
    expect(g.byKey.get("2.1")!.start).toBe(1);
    expect(g.byKey.get("ext-out:3")!.after).toEqual(["2.2"]);
  });
  it("an external node is done only when every member is", () => {
    const g = scopeStoryGraph([s("1.1", "1", [], "done"), s("2.1", "2", ["1.1"])], epics, "2");
    expect(g.byKey.get("ext-in:1")!.done).toBe(true);
    expect(g.byKey.get("2.1")!.ready).toBe(true);
  });
  it("epicSpan covers an epic's stories only", () => {
    const g = buildStoryGraph(input, epics);
    expect(epicSpan(g, "2")).toEqual({ start: 1, end: 3, total: 2, done: 0 });
    expect(epicSpan(g, "9")).toBeNull();
  });
});

describe("helpers", () => {
  it("busiestEpic picks the biggest, ties by natural order", () => {
    expect(busiestEpic([{ epicId: "2" }, { epicId: "1" }, { epicId: "1" }, { epicId: "2" }])).toBe("1");
    expect(busiestEpic([])).toBeNull();
  });
  it("hasDependencyData", () => {
    expect(hasDependencyData([], [])).toBe(false);
    expect(hasDependencyData([{ after: [{}] }], [])).toBe(true);
    expect(hasDependencyData([], [{ ticket: { after: ["1.1"] } }])).toBe(true);
    expect(hasDependencyData([], [{ dependsOn: ["E1"] }])).toBe(true);
    expect(hasDependencyData([], [{ ticket: { after: [] } }, { dependsOn: [] }])).toBe(false);
  });
  it("matchesQuery", () => {
    expect(matchesQuery({ id: "1.2", title: "Budget ledger" }, "budg 1.2")).toBe(true);
    expect(matchesQuery({ id: "1.2", title: "Budget ledger" }, "nope")).toBe(false);
    expect(matchesQuery({ id: "1.2", title: "x" }, "  ")).toBe(true);
  });
});

describe("performance", () => {
  function synthetic(n: number, fan = 3): GraphStoryInput[] {
    const out: GraphStoryInput[] = [];
    for (let i = 0; i < n; i++) {
      const deps: string[] = [];
      for (let k = 1; k <= fan && i - k * 7 >= 0; k++) deps.push(`${Math.floor((i - k * 7) / 10) + 1}.${((i - k * 7) % 10) + 1}`);
      out.push(s(`${Math.floor(i / 10) + 1}.${(i % 10) + 1}`, String(Math.floor(i / 10) + 1), deps, i % 5 === 0 ? "done" : "backlog"));
    }
    return out;
  }
  it("builds 300 nodes well under 100 ms", () => {
    const input = synthetic(300);
    const epicList = Array.from({ length: 30 }, (_, i) => ({ id: String(i + 1) }));
    buildStoryGraph(input, epicList); // warm up
    const t0 = performance.now();
    const g = buildStoryGraph(input, epicList);
    const ms = performance.now() - t0;
    expect(g.nodes).toHaveLength(300);
    expect(g.cycles).toHaveLength(0);
    expect(g.waves).toBeGreaterThan(5);
    expect(ms).toBeLessThan(100);
  });
  it("survives a 300 node ring without looping", () => {
    const ring = Array.from({ length: 300 }, (_, i) => s(`1.${i + 1}`, "1", [`1.${((i + 299) % 300) + 1}`]));
    const g = buildStoryGraph(ring, [{ id: "1" }]);
    expect(g.cycles).toHaveLength(1);
    expect(g.cycles[0]).toHaveLength(300);
    expect(g.waves).toBe(300);
  });
});
