import { compareEpicIds, compareStoryIds } from "@/lib/bmad/ids";

/**
 * Dependency graph and dependency-driven schedule for epics and stories.
 *
 * There are no dates in BMAD data, so the schedule is abstract: items sit on "waves".
 *  - `duration` is 1 wave (or 1/2/3 for low/medium/high risk when sizing by risk),
 *  - `start` = the largest `end` of the item's prerequisites (0 when it has none),
 *  - `end` = `start + duration`; an item occupies the waves `start .. end - 1` (0-based, shown 1-based).
 * `layer` is the hop-based longest-path layer (equal to `start` when every duration is 1); the DAG view uses it.
 *
 * Critical path: the heaviest chain (sum of durations) through UNFINISHED items only. Done items cost
 * nothing and are skipped, since finished work cannot delay anything. Ties go to the earlier item in
 * the stable order. Empty when everything is done.
 *
 * Cycles are reported, then each is broken deterministically by dropping the back edge found by a DFS
 * that visits items in stable order. The dropped edges are listed in `removedEdges`; the layout never loops.
 */

export type NodeKind = "story" | "epic" | "external";

export interface GraphStoryInput {
  id: string;
  title: string;
  status: string;
  epicId: string;
  /** Story ids, or epic ids meaning "every story of that epic". */
  deps: string[];
  risk?: string;
  type?: string;
}

export interface GraphEpicInput {
  id: string;
  title: string;
  status: string;
  after?: { id: string; needs?: string }[];
}

export interface DepNode {
  key: string;
  id: string;
  kind: NodeKind;
  title: string;
  status: string;
  epicId: string;
  risk?: string;
  type?: string;
  /** Position in the stable order (epic order, then id). */
  order: number;
  duration: number;
  layer: number;
  start: number;
  end: number;
  done: boolean;
  /** All prerequisites are done and the item itself is not. */
  ready: boolean;
  /** Unfinished prerequisites (keys). */
  blockedBy: string[];
  /** Direct dependents (keys). */
  blocks: string[];
  /** Direct prerequisites (keys). */
  after: string[];
  critical: boolean;
  /** External nodes: the story ids they stand for. */
  members?: string[];
}

export interface DepEdge {
  from: string;
  to: string;
  /** Epic edges: the author's reason (`needs`). */
  needs?: string;
  /** Story edge that came from an epic-level reference (the whole epic is the prerequisite). */
  viaEpic?: boolean;
  /** Epic edge inferred from a cross-epic story dependency rather than declared. */
  derived?: boolean;
}

export interface UnresolvedRef {
  from: string;
  ref: string;
}

export interface DepGraph {
  kind: "story" | "epic";
  nodes: DepNode[];
  byKey: Map<string, DepNode>;
  /** Edges that are part of the acyclic layout. */
  edges: DepEdge[];
  /** Edges dropped to break cycles. */
  removedEdges: DepEdge[];
  /** Each cycle as the ring of keys, in stable order of discovery. */
  cycles: string[][];
  unresolved: UnresolvedRef[];
  /** Number of waves (`max end`). */
  waves: number;
  /** Highest `layer` + 1. */
  layers: number;
  criticalPath: string[];
  /** True when at least one edge exists. */
  hasEdges: boolean;
}

export interface BuildOptions {
  /** Duration 1/2/3 for low/medium/high risk instead of 1. */
  sizeByRisk?: boolean;
}

export const RISK_WEIGHT: Record<string, number> = { low: 1, medium: 2, high: 3 };

export function riskWeight(risk: string | undefined): number {
  return RISK_WEIGHT[(risk ?? "").toLowerCase()] ?? 1;
}

const isDone = (status: string) => status === "done";

interface RawNode {
  key: string;
  id: string;
  kind: NodeKind;
  title: string;
  status: string;
  epicId: string;
  risk?: string;
  type?: string;
  order: number;
  duration: number;
  members?: string[];
}

/** Core: lays out an arbitrary node/edge set (edges may form cycles, duplicates are merged). */
function layout(
  kind: "story" | "epic",
  raw: RawNode[],
  rawEdges: DepEdge[],
  unresolved: UnresolvedRef[],
): DepGraph {
  const sorted = [...raw].sort((a, b) => a.order - b.order);
  const index = new Map(sorted.map((n, i) => [n.key, i]));

  // Merge duplicate edges, drop self loops and edges to unknown nodes.
  const merged = new Map<string, DepEdge>();
  for (const e of rawEdges) {
    if (e.from === e.to || !index.has(e.from) || !index.has(e.to)) continue;
    const id = `${e.from}\u0000${e.to}`;
    const have = merged.get(id);
    if (!have) merged.set(id, { ...e });
    else {
      if (e.needs && !have.needs?.includes(e.needs)) have.needs = have.needs ? `${have.needs}; ${e.needs}` : e.needs;
      if (!e.viaEpic) have.viaEpic = undefined;
      if (!e.derived) have.derived = undefined;
    }
  }
  const all = [...merged.values()].sort(
    (a, b) => index.get(a.to)! - index.get(b.to)! || index.get(a.from)! - index.get(b.from)!,
  );

  // Cycle detection: iterative DFS in stable order over dependent -> prerequisite is irrelevant;
  // we walk prerequisite -> dependent so a cycle's ring is reported in flow order.
  const out: DepEdge[][] = sorted.map(() => []);
  for (const e of all) out[index.get(e.from)!].push(e);
  const colour = new Uint8Array(sorted.length); // 0 new, 1 on stack, 2 done
  const removed = new Set<DepEdge>();
  const cycles: string[][] = [];
  for (let root = 0; root < sorted.length; root++) {
    if (colour[root] !== 0) continue;
    const stack: { n: number; i: number }[] = [{ n: root, i: 0 }];
    colour[root] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const edges = out[top.n];
      if (top.i >= edges.length) {
        colour[top.n] = 2;
        stack.pop();
        continue;
      }
      const e = edges[top.i++];
      const to = index.get(e.to)!;
      if (colour[to] === 1) {
        const at = stack.findIndex((s) => s.n === to);
        cycles.push(stack.slice(at).map((s) => sorted[s.n].key));
        removed.add(e);
      } else if (colour[to] === 0) {
        colour[to] = 1;
        stack.push({ n: to, i: 0 });
      }
    }
  }
  const edges = all.filter((e) => !removed.has(e));
  const removedEdges = all.filter((e) => removed.has(e));

  // Kahn topological order, smallest stable index first, so results are deterministic.
  const preds: number[][] = sorted.map(() => []);
  const succs: number[][] = sorted.map(() => []);
  for (const e of edges) {
    preds[index.get(e.to)!].push(index.get(e.from)!);
    succs[index.get(e.from)!].push(index.get(e.to)!);
  }
  const indeg = preds.map((p) => p.length);
  const topo: number[] = [];
  const ready: number[] = [];
  indeg.forEach((d, i) => d === 0 && ready.push(i));
  // `ready` stays sorted ascending: insertion by binary search keeps it cheap.
  const insert = (i: number) => {
    let lo = 0;
    let hi = ready.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ready[mid] < i) lo = mid + 1;
      else hi = mid;
    }
    ready.splice(lo, 0, i);
  };
  while (ready.length) {
    const n = ready.shift()!;
    topo.push(n);
    for (const s of succs[n]) if (--indeg[s] === 0) insert(s);
  }

  const start = new Array<number>(sorted.length).fill(0);
  const end = new Array<number>(sorted.length).fill(0);
  const layer = new Array<number>(sorted.length).fill(0);
  for (const n of topo) {
    let s = 0;
    let l = 0;
    for (const p of preds[n]) {
      s = Math.max(s, end[p]);
      l = Math.max(l, layer[p] + 1);
    }
    start[n] = s;
    layer[n] = l;
    end[n] = s + sorted[n].duration;
  }

  // Critical path through unfinished nodes: heaviest chain, ties to the earlier node.
  const done = sorted.map((n) => isDone(n.status));
  const best = new Array<number>(sorted.length).fill(0);
  const prev = new Array<number>(sorted.length).fill(-1);
  for (const n of topo) {
    if (done[n]) continue;
    let b = 0;
    let from = -1;
    for (const p of preds[n]) {
      if (done[p]) continue;
      if (best[p] > b || (best[p] === b && from >= 0 && p < from)) {
        b = best[p];
        from = p;
      }
    }
    best[n] = b + sorted[n].duration;
    prev[n] = from;
  }
  let tail = -1;
  for (const n of topo) if (!done[n] && (tail < 0 || best[n] > best[tail] || (best[n] === best[tail] && n < tail))) tail = n;
  const criticalPath: number[] = [];
  for (let n = tail; n >= 0; n = prev[n]) criticalPath.unshift(n);
  const critical = new Set(criticalPath);

  const nodes: DepNode[] = sorted.map((r, i) => {
    const after = preds[i].map((p) => sorted[p].key).sort((a, b) => index.get(a)! - index.get(b)!);
    const blocks = succs[i].map((s) => sorted[s].key).sort((a, b) => index.get(a)! - index.get(b)!);
    const blockedBy = preds[i].filter((p) => !done[p]).map((p) => sorted[p].key).sort((a, b) => index.get(a)! - index.get(b)!);
    return {
      ...r,
      layer: layer[i],
      start: start[i],
      end: end[i],
      done: done[i],
      ready: !done[i] && blockedBy.length === 0,
      blockedBy,
      blocks,
      after,
      critical: critical.has(i),
    };
  });

  return {
    kind,
    nodes,
    byKey: new Map(nodes.map((n) => [n.key, n])),
    edges,
    removedEdges,
    cycles,
    unresolved,
    waves: nodes.reduce((m, n) => Math.max(m, n.end), 0),
    layers: nodes.reduce((m, n) => Math.max(m, n.layer + 1), 0),
    criticalPath: criticalPath.map((i) => sorted[i].key),
    hasEdges: edges.length + removedEdges.length > 0,
  };
}

/** Stable order: epic order as given (unknown epics last, by natural id), then natural story id. */
function orderer(epics: Pick<GraphEpicInput, "id">[]) {
  const rank = new Map(epics.map((e, i) => [e.id, i]));
  return (a: { epicId: string; id: string }, b: { epicId: string; id: string }) => {
    const ra = rank.get(a.epicId) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.epicId) ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || (ra === rb && ra === Number.MAX_SAFE_INTEGER ? compareEpicIds(a.epicId, b.epicId) : 0) || compareStoryIds(a.id, b.id);
  };
}

/**
 * Story graph. A dep that names a story becomes an edge; one that names an epic becomes edges
 * from every story of that epic; anything else is listed in `unresolved`.
 */
export function buildStoryGraph(
  stories: GraphStoryInput[],
  epics: Pick<GraphEpicInput, "id">[] = [],
  options: BuildOptions = {},
): DepGraph {
  const cmp = orderer(epics);
  const unique = new Map<string, GraphStoryInput>();
  for (const s of stories) if (!unique.has(s.id)) unique.set(s.id, s);
  const list = [...unique.values()].sort(cmp);
  const byEpic = new Map<string, string[]>();
  for (const s of list) {
    const arr = byEpic.get(s.epicId);
    if (arr) arr.push(s.id);
    else byEpic.set(s.epicId, [s.id]);
  }

  const raw: RawNode[] = list.map((s, order) => ({
    key: s.id,
    id: s.id,
    kind: "story",
    title: s.title,
    status: s.status,
    epicId: s.epicId,
    risk: s.risk,
    type: s.type,
    order,
    duration: options.sizeByRisk ? riskWeight(s.risk) : 1,
  }));
  const edges: DepEdge[] = [];
  const unresolved: UnresolvedRef[] = [];
  for (const s of list) {
    for (const ref of s.deps) {
      if (ref === s.id) continue;
      if (unique.has(ref)) edges.push({ from: ref, to: s.id });
      else if (byEpic.has(ref) && ref !== s.epicId) {
        for (const from of byEpic.get(ref)!) edges.push({ from, to: s.id, viaEpic: true });
      } else if (!(byEpic.has(ref) && ref === s.epicId)) unresolved.push({ from: s.id, ref });
    }
  }
  return layout("story", raw, edges, unresolved);
}

/**
 * Epic graph: declared `after` edges plus edges derived from cross-epic story dependencies
 * (marked `derived`). Epic status is "done" when all its stories are done.
 */
export function buildEpicGraph(
  epics: GraphEpicInput[],
  stories: GraphStoryInput[] = [],
): DepGraph {
  const order = new Map(epics.map((e, i) => [e.id, i]));
  const total = new Map<string, number>();
  const finished = new Map<string, number>();
  for (const s of stories) {
    total.set(s.epicId, (total.get(s.epicId) ?? 0) + 1);
    if (isDone(s.status)) finished.set(s.epicId, (finished.get(s.epicId) ?? 0) + 1);
  }
  const raw: RawNode[] = epics.map((e) => {
    const t = total.get(e.id) ?? 0;
    const status = t > 0 ? (finished.get(e.id) === t ? "done" : (finished.get(e.id) ?? 0) > 0 && e.status === "not-started" ? "in-progress" : e.status) : e.status;
    return { key: e.id, id: e.id, kind: "epic", title: e.title, status, epicId: e.id, order: order.get(e.id)!, duration: 1 };
  });
  const known = new Set(epics.map((e) => e.id));
  const edges: DepEdge[] = [];
  const unresolved: UnresolvedRef[] = [];
  for (const e of epics) {
    for (const a of e.after ?? []) {
      if (a.id === e.id) continue;
      if (known.has(a.id)) edges.push({ from: a.id, to: e.id, ...(a.needs ? { needs: a.needs } : {}) });
      else unresolved.push({ from: e.id, ref: a.id });
    }
  }
  const storyEpic = new Map(stories.map((s) => [s.id, s.epicId]));
  for (const s of stories) {
    for (const ref of s.deps) {
      const fromEpic = storyEpic.get(ref) ?? (known.has(ref) ? ref : undefined);
      if (fromEpic && fromEpic !== s.epicId && known.has(fromEpic) && known.has(s.epicId)) {
        edges.push({ from: fromEpic, to: s.epicId, derived: true, ...(storyEpic.has(ref) ? { needs: ref } : {}) });
      }
    }
  }
  // A declared edge wins over a derived one for the same pair.
  const declared = new Set(edges.filter((e) => !e.derived).map((e) => `${e.from}\u0000${e.to}`));
  const keep = edges.filter((e) => !e.derived || !declared.has(`${e.from}\u0000${e.to}`));
  // Merge derived `needs` (story ids) so one derived edge lists its stories.
  return layout("epic", raw, keep, unresolved);
}

/** Transitive prerequisites (`up`) or dependents (`down`) of a node, excluding the node itself. */
export function closure(graph: DepGraph, key: string, direction: "up" | "down"): Set<string> {
  const seen = new Set<string>();
  const stack = [key];
  while (stack.length) {
    const node = graph.byKey.get(stack.pop()!);
    if (!node) continue;
    for (const next of direction === "up" ? node.after : node.blocks) {
      if (next !== key && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/**
 * Scopes the story graph to one epic. Prerequisites and dependents that live in other epics
 * collapse into one "external" node per epic and direction (`ext-in:<epic>` / `ext-out:<epic>`),
 * which stands for the stories listed in `members`. The result is laid out again.
 */
export function scopeStoryGraph(
  stories: GraphStoryInput[],
  epics: Pick<GraphEpicInput, "id" | "title">[],
  epicId: string,
  options: BuildOptions = {},
): DepGraph {
  const full = buildStoryGraph(stories, epics, options);
  const inside = full.nodes.filter((n) => n.epicId === epicId);
  const insideKeys = new Set(inside.map((n) => n.key));
  const titleOf = new Map(epics.map((e) => [e.id, e.title]));
  const ext = new Map<string, { dir: "in" | "out"; epic: string; members: Set<string>; done: boolean[] }>();
  const addExt = (dir: "in" | "out", other: DepNode) => {
    const key = `ext-${dir}:${other.epicId}`;
    let e = ext.get(key);
    if (!e) ext.set(key, (e = { dir, epic: other.epicId, members: new Set(), done: [] }));
    if (!e.members.has(other.key)) {
      e.members.add(other.key);
      e.done.push(other.done);
    }
    return key;
  };
  const edges: DepEdge[] = [];
  for (const e of full.edges.concat(full.removedEdges)) {
    const fromIn = insideKeys.has(e.from);
    const toIn = insideKeys.has(e.to);
    if (fromIn && toIn) edges.push(e);
    else if (toIn) edges.push({ ...e, from: addExt("in", full.byKey.get(e.from)!) });
    else if (fromIn) edges.push({ ...e, to: addExt("out", full.byKey.get(e.to)!) });
  }
  const raw: RawNode[] = inside.map((n) => ({
    key: n.key, id: n.id, kind: n.kind, title: n.title, status: n.status, epicId: n.epicId,
    risk: n.risk, type: n.type, order: n.order, duration: n.duration,
  }));
  const extKeys = [...ext.keys()].sort((a, b) => {
    const A = ext.get(a)!;
    const B = ext.get(b)!;
    return (A.dir === B.dir ? 0 : A.dir === "in" ? -1 : 1) || compareEpicIds(A.epic, B.epic);
  });
  extKeys.forEach((key, i) => {
    const e = ext.get(key)!;
    const allDone = e.done.every(Boolean);
    const n = e.members.size;
    raw.push({
      key,
      id: e.epic,
      kind: "external",
      title: `${titleOf.get(e.epic) ?? e.epic} (${n} ${e.dir === "in" ? (n === 1 ? "prerequisite" : "prerequisites") : n === 1 ? "dependent" : "dependents"})`,
      status: allDone ? "done" : "backlog",
      epicId: e.epic,
      // Prerequisites sort before the epic's own stories, dependents after; re-ranked below.
      order: e.dir === "in" ? -1e6 + i : 1e6 + i,
      duration: 1,
      members: [...e.members],
    });
  });
  // Re-rank to integers so `order` stays a clean index.
  raw.sort((a, b) => a.order - b.order).forEach((n, i) => (n.order = i));
  return layout("story", raw, edges, full.unresolved.filter((u) => insideKeys.has(u.from)));
}

/** Counts per epic, busiest first (for the "too many nodes" guard). */
export function busiestEpic(stories: Pick<GraphStoryInput, "epicId">[]): string | null {
  const counts = new Map<string, number>();
  for (const s of stories) counts.set(s.epicId, (counts.get(s.epicId) ?? 0) + 1);
  let best: string | null = null;
  for (const [id, n] of counts) {
    if (best === null || n > counts.get(best)! || (n === counts.get(best)! && compareEpicIds(id, best) < 0)) best = id;
  }
  return best;
}

/** True when there is anything to draw: a story with prerequisites or an epic with `after`. */
export function hasDependencyData(
  epics: { after?: unknown[] }[],
  stories: { deps?: unknown[]; ticket?: { after: unknown[] }; dependsOn?: unknown[] }[],
): boolean {
  return (
    epics.some((e) => (e.after?.length ?? 0) > 0) ||
    stories.some((s) => (s.ticket?.after ?? s.dependsOn ?? s.deps ?? []).length > 0)
  );
}

/** Time span of an epic in a story graph: min start to max end of its stories, with done/total. */
export function epicSpan(graph: DepGraph, epicId: string) {
  let start = Infinity;
  let end = 0;
  let total = 0;
  let done = 0;
  for (const n of graph.nodes) {
    if (n.epicId !== epicId || n.kind !== "story") continue;
    start = Math.min(start, n.start);
    end = Math.max(end, n.end);
    total++;
    if (n.done) done++;
  }
  return total === 0 ? null : { start, end, total, done };
}

export type Filterable = Pick<DepNode, "id" | "title" | "status" | "ready" | "kind" | "key">;

/** Case-insensitive search over id and title; every term must match. */
export function matchesQuery(node: Pick<DepNode, "id" | "title">, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = `${node.id} ${node.title}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}
