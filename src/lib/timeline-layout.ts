import type { DepGraph, DepNode } from "@/lib/dependency-graph";
import { epicSpan, matchesQuery } from "@/lib/dependency-graph";

/* ---------------------------------------------------------------- filters */

export interface NodeFilter {
  statuses: string[];
  ready: boolean;
  q: string;
}

export const noFilter = (f: NodeFilter) => f.statuses.length === 0 && !f.ready && f.q.trim() === "";

export function nodePasses(node: DepNode, f: NodeFilter): boolean {
  if (f.statuses.length && !f.statuses.includes(node.status)) return false;
  if (f.ready && !node.ready) return false;
  return matchesQuery(node, f.q);
}

/* ------------------------------------------------------------------ gantt */

export interface GanttRow {
  type: "epic" | "story" | "external";
  key: string;
  epicId: string;
  /** Story / external / epic-only node. */
  node: DepNode | null;
  /** Epic rows: min start to max end and progress. */
  span: { start: number; end: number; total: number; done: number } | null;
  /** Epic rows: story rows exist (so the row can expand). */
  expandable: boolean;
  expanded: boolean;
}

export interface GanttModel {
  rows: GanttRow[];
  waves: number;
  /** True when only epics are drawn because story-level dependencies are unknown. */
  epicOnly: boolean;
}

interface GanttInput {
  storyGraph: DepGraph;
  epicGraph: DepGraph;
  /** Epic ids in display order. */
  epicOrder: string[];
  epicTitles: Map<string, string>;
  expanded: Set<string>;
  filter: NodeFilter;
  /** Story-level dependencies exist in this project. */
  storyLevel: boolean;
}

export function buildGanttModel(input: GanttInput): GanttModel {
  const { storyGraph, epicGraph, epicOrder, expanded, filter, storyLevel } = input;
  const rows: GanttRow[] = [];

  if (!storyLevel) {
    for (const id of epicOrder) {
      const node = epicGraph.byKey.get(id);
      if (!node || !nodePasses(node, filter)) continue;
      rows.push({
        type: "epic",
        key: `epic:${id}`,
        epicId: id,
        node,
        span: { start: node.start, end: node.end, total: 1, done: node.done ? 1 : 0 },
        expandable: false,
        expanded: false,
      });
    }
    return { rows, waves: epicGraph.waves, epicOnly: true };
  }

  const byEpic = new Map<string, DepNode[]>();
  for (const n of storyGraph.nodes) {
    const arr = byEpic.get(n.epicId);
    if (arr) arr.push(n);
    else byEpic.set(n.epicId, [n]);
  }
  const ids = [...new Set([...epicOrder, ...byEpic.keys()])].filter((id) => byEpic.has(id));
  const externals = storyGraph.nodes.filter((n) => n.kind === "external");
  const ext = (dir: "ext-in" | "ext-out") =>
    externals.filter((n) => n.key.startsWith(dir)).forEach((n) => {
      if (!nodePasses(n, filter)) return;
      rows.push({ type: "external", key: n.key, epicId: n.epicId, node: n, span: null, expandable: false, expanded: false });
    });
  ext("ext-in");
  for (const id of ids) {
    const stories = (byEpic.get(id) ?? []).filter((n) => n.kind === "story");
    if (stories.length === 0) continue;
    const shown = stories.filter((n) => nodePasses(n, filter));
    if (shown.length === 0) continue;
    const span = epicSpan(storyGraph, id);
    const open = expanded.has(id);
    rows.push({ type: "epic", key: `epic:${id}`, epicId: id, node: null, span, expandable: true, expanded: open });
    if (open) {
      for (const n of shown) rows.push({ type: "story", key: n.key, epicId: id, node: n, span: null, expandable: false, expanded: false });
    }
  }
  ext("ext-out");
  return { rows, waves: storyGraph.waves, epicOnly: false };
}

/* ------------------------------------------------------------ layered DAG */

export const NODE_W = 208;
export const NODE_H = 52;
export const GAP_X = 64;
export const GAP_Y = 12;
export const PAD = 16;

export interface Placed {
  key: string;
  layer: number;
  index: number;
  x: number;
  y: number;
}

export interface LayeredLayout {
  width: number;
  height: number;
  columns: string[][];
  placed: Map<string, Placed>;
  crossings: number;
}

/** Edge crossings between adjacent... and long edges, counted pairwise on final positions. */
export function countCrossings(edges: { from: string; to: string }[], placed: Map<string, { layer: number; index: number }>): number {
  let n = 0;
  const list = edges.filter((e) => placed.has(e.from) && placed.has(e.to));
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    const af = placed.get(a.from)!;
    const at = placed.get(a.to)!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const bf = placed.get(b.from)!;
      const bt = placed.get(b.to)!;
      if (af.layer !== bf.layer || at.layer !== bt.layer) continue;
      if ((af.index - bf.index) * (at.index - bt.index) < 0) n++;
    }
  }
  return n;
}

/**
 * Left-to-right layered layout by `layer` (hop-based waves). Order inside a layer starts from the
 * stable node order and is improved by a few deterministic barycenter sweeps (down, then up).
 */
export function layoutLayers(graph: DepGraph, include?: (node: DepNode) => boolean): LayeredLayout {
  const nodes = include ? graph.nodes.filter(include) : graph.nodes;
  const keys = new Set(nodes.map((n) => n.key));
  const edges = graph.edges.filter((e) => keys.has(e.from) && keys.has(e.to));
  const columns: string[][] = [];
  for (const n of nodes) (columns[n.layer] ??= []).push(n.key);
  for (let l = 0; l < columns.length; l++) columns[l] ??= [];
  const order = new Map(nodes.map((n) => [n.key, n.order]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const e of edges) {
    (preds.get(e.to) ?? preds.set(e.to, []).get(e.to)!).push(e.from);
    (succs.get(e.from) ?? succs.set(e.from, []).get(e.from)!).push(e.to);
  }
  const pos = new Map<string, number>();
  const reindex = (col: string[]) => col.forEach((k, i) => pos.set(k, i));
  columns.forEach((c) => {
    c.sort((a, b) => order.get(a)! - order.get(b)!);
    reindex(c);
  });
  const sweep = (col: string[], neighbours: Map<string, string[]>) => {
    const bary = new Map<string, number>();
    for (const k of col) {
      const ns = neighbours.get(k);
      bary.set(k, ns && ns.length ? ns.reduce((s, x) => s + (pos.get(x) ?? 0), 0) / ns.length : pos.get(k)!);
    }
    col.sort((a, b) => bary.get(a)! - bary.get(b)! || order.get(a)! - order.get(b)!);
    reindex(col);
  };
  const measure = () => {
    const p = new Map<string, { layer: number; index: number }>();
    columns.forEach((c, l) => c.forEach((k, i) => p.set(k, { layer: l, index: i })));
    return countCrossings(edges, p);
  };
  let best = columns.map((c) => [...c]);
  let bestScore = measure();
  for (let pass = 0; pass < 4; pass++) {
    for (let l = 1; l < columns.length; l++) sweep(columns[l], preds);
    for (let l = columns.length - 2; l >= 0; l--) sweep(columns[l], succs);
    const score = measure();
    if (score < bestScore) {
      bestScore = score;
      best = columns.map((c) => [...c]);
    }
  }
  best.forEach((c, l) => (columns[l] = c));

  const placed = new Map<string, Placed>();
  let tallest = 0;
  columns.forEach((c, layer) => {
    tallest = Math.max(tallest, c.length);
    c.forEach((key, index) => {
      placed.set(key, { key, layer, index, x: PAD + layer * (NODE_W + GAP_X), y: PAD + index * (NODE_H + GAP_Y) });
    });
  });
  return {
    width: PAD * 2 + Math.max(columns.length, 1) * NODE_W + Math.max(columns.length - 1, 0) * GAP_X,
    height: PAD * 2 + Math.max(tallest, 1) * NODE_H + Math.max(tallest - 1, 0) * GAP_Y,
    columns,
    placed,
    crossings: bestScore,
  };
}

/** Cubic curve from the right edge of `a` to the left edge of `b`. */
export function edgePath(a: Placed, b: Placed): string {
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const dx = Math.max(24, Math.min(120, (x2 - x1) / 2));
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2 - 1} ${y2}`;
}

/** Arrow-key neighbour in the layered layout: left = a prerequisite, right = a dependent, up/down = same column. */
export function neighbourKey(
  graph: DepGraph,
  layout: LayeredLayout,
  key: string,
  dir: "left" | "right" | "up" | "down",
): string | null {
  const node = graph.byKey.get(key);
  const here = layout.placed.get(key);
  if (!node || !here) return null;
  if (dir === "up" || dir === "down") {
    return layout.columns[here.layer][here.index + (dir === "up" ? -1 : 1)] ?? null;
  }
  const list = (dir === "left" ? node.after : node.blocks).filter((k) => layout.placed.has(k));
  if (list.length === 0) return null;
  // closest vertically
  return [...list].sort((a, b) => Math.abs(layout.placed.get(a)!.index - here.index) - Math.abs(layout.placed.get(b)!.index - here.index))[0];
}
