"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useHorizontalWheel } from "@/lib/wheel";
import { epicLabel } from "@/lib/bmad/ids";
import type { DepGraph, DepNode } from "@/lib/dependency-graph";
import { NODE_H, NODE_W, WAVE_LABEL_BASELINE, edgePath, layoutLayers, neighbourKey } from "@/lib/timeline-layout";
import { statusLabel, statusStyle } from "./timeline-style";

interface GraphChartProps {
  graph: DepGraph;
  /** Selection / hover keys as used by the page (`epic:<id>` at epic level). */
  prefix: "" | "epic:";
  selected: string;
  hovered: string;
  upstream: Set<string>;
  downstream: Set<string>;
  /** Nodes that pass the filters; the rest are dimmed. */
  matches: Set<string>;
  /** Draw only these nodes (epic level scoped to one epic). */
  only?: Set<string>;
  critical: boolean;
  onSelect(key: string): void;
  onHover(key: string): void;
}

/** Accessible name of a node: id, title, status, wave and the items still blocking it. */
export function nodeLabel(graph: DepGraph, n: DepNode): string {
  const name = (k: string) => {
    const b = graph.byKey.get(k);
    return b ? (b.kind === "epic" ? epicLabel(b.id) : b.id) : k;
  };
  return `${n.kind === "epic" ? "Epic " : ""}${n.id} ${n.title}, ${statusLabel(n.status)}, wave ${n.layer + 1}${n.ready ? ", ready now" : ""}${n.blockedBy.length ? `, blocked by ${n.blockedBy.map(name).join(", ")}` : ""}`;
}

const MAX_TITLE = 24;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Layered left-to-right DAG; one column per wave. */
export function GraphChart({ graph, prefix, selected, hovered, upstream, downstream, matches, only, critical, onSelect, onHover }: GraphChartProps) {
  const layout = useMemo(() => layoutLayers(graph, only ? (n) => only.has(n.key) : undefined), [graph, only]);
  const scroller = useRef<HTMLDivElement>(null);
  useHorizontalWheel(scroller);
  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const active = (hovered || selected).startsWith(prefix) ? (hovered || selected).slice(prefix.length) : "";
  const selectedKey = selected.startsWith(prefix) ? selected.slice(prefix.length) : "";
  const focusKey = graph.byKey.has(selectedKey) ? selectedKey : (layout.columns[0]?.[0] ?? "");
  const criticalSet = useMemo(() => new Set(graph.criticalPath), [graph]);
  const chain = useMemo(() => {
    if (!active) return null;
    return new Set([active, ...upstream, ...downstream]);
  }, [active, upstream, downstream]);

  // Keep a keyboard-selected node in view.
  useEffect(() => {
    if (selectedKey) nodeRefs.current.get(selectedKey)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [selectedKey]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" }[e.key] as "left" | "right" | "up" | "down" | undefined;
    if (!dir) return;
    const from = (e.target as Element).closest("[data-node]")?.getAttribute("data-node") ?? focusKey;
    const next = from ? neighbourKey(graph, layout, from, dir) : null;
    if (!next) return;
    e.preventDefault();
    nodeRefs.current.get(next)?.focus();
    onSelect(prefix + next);
  };

  const dimmed = (key: string) => (chain ? !chain.has(key) : false) || !matches.has(key);

  return (
    <div>
      <div
        ref={scroller}
        role="group"
        aria-label={`Dependency graph, ${graph.nodes.length} items in ${layout.columns.length} waves`}
        onKeyDown={onKeyDown}
        className="max-h-[72vh] min-h-48 overflow-auto rounded-lg border bg-background"
      >
        <svg width={layout.width} height={layout.height} className="block" role="group" aria-label="Dependency graph canvas">
          <defs>
            <marker id="graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
            </marker>
          </defs>
          <g>
            {layout.columns.map((col, l) => (
              <text key={l} x={16 + l * (NODE_W + 64)} y={WAVE_LABEL_BASELINE} className="fill-muted-foreground" fontSize={12} aria-hidden="true">
                Wave {l + 1}
              </text>
            ))}
            <g aria-hidden="true">
              {graph.edges.map((e) => {
                const a = layout.placed.get(e.from);
                const b = layout.placed.get(e.to);
                if (!a || !b) return null;
                const touches = chain ? chain.has(e.from) && chain.has(e.to) : false;
                const onCritical = critical && criticalSet.has(e.from) && criticalSet.has(e.to);
                return (
                  <path
                    key={`${e.from}->${e.to}`}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={touches || onCritical ? 1.5 : 1}
                    markerEnd="url(#graph-arrow)"
                    className={cn(
                      touches ? "text-foreground" : onCritical ? "text-warning" : "text-muted-foreground/50",
                      chain && !touches && "opacity-25",
                      e.derived && "[stroke-dasharray:4_3]",
                    )}
                  />
                );
              })}
            </g>
            {graph.nodes.map((n) => {
              const p = layout.placed.get(n.key);
              if (!p) return null;
              const s = statusStyle(n.status);
              const isSel = selectedKey === n.key;
              const label = nodeLabel(graph, n);
              return (
                <g
                  key={n.key}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(n.key, el);
                    else nodeRefs.current.delete(n.key);
                  }}
                  data-node={n.key}
                  role="button"
                  tabIndex={n.key === focusKey ? 0 : -1}
                  aria-label={label}
                  aria-pressed={isSel}
                  transform={`translate(${p.x} ${p.y})`}
                  className={cn("cursor-pointer outline-hidden [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-2", dimmed(n.key) && "opacity-30")}
                  onClick={() => onSelect(prefix + n.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(prefix + n.key);
                    }
                  }}
                  onMouseEnter={() => onHover(prefix + n.key)}
                  onMouseLeave={() => onHover("")}
                  onFocus={() => onHover(prefix + n.key)}
                  onBlur={() => onHover("")}
                >
                  <title>{`${n.id} ${n.title}`}</title>
                  {/* Solid base: the status tint below is translucent, and edges must not show through the card. */}
                  <rect width={NODE_W} height={NODE_H} rx={8} className="fill-background" data-node-base="" />
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    className={cn(s.fill, s.stroke, "stroke-1", isSel && "stroke-foreground stroke-2", n.critical && critical && "stroke-warning stroke-2", n.kind === "external" && "[stroke-dasharray:4_3]")}
                  />
                  <circle cx={14} cy={17} r={4} className={s.dotFill} />
                  <text x={26} y={21} fontSize={12} className="fill-muted-foreground font-mono">
                    {n.kind === "epic" ? epicLabel(n.id) : n.kind === "external" ? epicLabel(n.id) : n.id}
                  </text>
                  <text x={NODE_W - 10} y={21} fontSize={12} textAnchor="end" className="fill-muted-foreground">
                    {n.ready ? "ready" : n.blockedBy.length ? `blocked ${n.blockedBy.length}` : ""}
                  </text>
                  <text x={12} y={40} fontSize={13.5} className="fill-foreground">
                    {cut(n.title, MAX_TITLE)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
