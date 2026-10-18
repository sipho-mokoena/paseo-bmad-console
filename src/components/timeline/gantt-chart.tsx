"use client";

import { COL_W, barBox, connectorPath } from "@/lib/gantt-geometry";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHorizontalWheel } from "@/lib/wheel";
import { epicLabel } from "@/lib/bmad/ids";
import type { DepGraph } from "@/lib/dependency-graph";
import type { GanttModel, GanttRow } from "@/lib/timeline-layout";
import { statusLabel, statusStyle, waveLabel } from "./timeline-style";

const HEADER_H = 36;

interface GanttChartProps {
  model: GanttModel;
  /** Graph the bars were built from (story graph, or the epic graph in epic-only mode). */
  graph: DepGraph;
  epicTitles: Map<string, string>;
  rowH: number;
  /** Selected and hovered row keys (`epic:<id>` for epic rows). */
  selected: string;
  hovered: string;
  upstream: Set<string>;
  downstream: Set<string>;
  critical: boolean;
  showAll: boolean;
  onSelect(key: string): void;
  onHover(key: string): void;
  onToggleEpic(epicId: string): void;
}

const rowKeyOfNode = (graphKind: "story" | "epic", key: string) => (graphKind === "epic" ? `epic:${key}` : key);

function rowDescription(row: GanttRow, titles: Map<string, string>): string {
  const n = row.node;
  if (row.type === "epic" && !n && row.span) {
    return `Epic ${row.epicId} ${titles.get(row.epicId) ?? ""}, ${row.span.done} of ${row.span.total} stories done, ${waveLabel(row.span.start, row.span.end)}`;
  }
  if (!n) return row.key;
  const parts = [`${n.id} ${n.title}`, statusLabel(n.status), waveLabel(n.start, n.end)];
  if (n.ready) parts.push("ready now");
  if (n.critical) parts.push("on the critical path");
  if (n.blockedBy.length) parts.push(`blocked by ${n.blockedBy.join(", ")}`);
  return parts.join(", ");
}

/** The Gantt: epics as collapsible groups, one bar per story placed on dependency waves. */
export function GanttChart({
  model,
  graph,
  epicTitles,
  rowH,
  selected,
  hovered,
  upstream,
  downstream,
  critical,
  showAll,
  onSelect,
  onHover,
  onToggleEpic,
}: GanttChartProps) {
  const { rows, waves } = model;
  const scroller = useRef<HTMLDivElement>(null);
  useHorizontalWheel(scroller);
  // Bring a newly selected item into view (deep links like ?focus=3.4).
  useEffect(() => {
    if (!selected) return;
    const el = scroller.current?.querySelector<HTMLElement>(`[data-bar="${CSS.escape(selected)}"]`);
    el?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [selected]);
  // Stretch the wave columns to fill the pane when there are too few waves to span it.
  const [paneW, setPaneW] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setPaneW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const labelW = paneW >= 768 ? 248 : 152;
  const colW = Math.max(COL_W, Math.floor((paneW - labelW - 2) / Math.max(waves, 1)));
  const trackW = Math.max(waves, 1) * colW;
  const bodyH = rows.length * rowH;
  const kind = graph.kind;
  const rowIndex = new Map(rows.map((r, i) => [r.key, i]));
  const active = hovered || selected;

  // Connectors: the active item's direct edges, the critical chain, or everything.
  const lines: { id: string; d: string; tone: "active" | "critical" | "all" }[] = [];
  const criticalSet = new Set(graph.criticalPath);
  for (const e of graph.edges) {
    const from = rowKeyOfNode(kind, e.from);
    const to = rowKeyOfNode(kind, e.to);
    const direct = active !== "" && (from === active || to === active);
    const onCritical = critical && criticalSet.has(e.from) && criticalSet.has(e.to);
    if (!direct && !onCritical && !showAll) continue;
    const a = rowIndex.get(from);
    const b = rowIndex.get(to);
    const na = graph.byKey.get(e.from);
    const nb = graph.byKey.get(e.to);
    if (a === undefined || b === undefined || !na || !nb) continue;
    const y1 = a * rowH + rowH / 2;
    const y2 = b * rowH + rowH / 2;
    lines.push({
      id: `${e.from}->${e.to}`,
      d: connectorPath(na.end, nb.start, y1, y2, colW),
      tone: direct ? "active" : onCritical ? "critical" : "all",
    });
  }
  lines.sort((p, q) => (p.tone === "active" ? 1 : 0) - (q.tone === "active" ? 1 : 0));

  const gridStyle = {
    backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${colW - 1}px, var(--border) ${colW - 1}px, var(--border) ${colW}px)`,
  };

  return (
    <div
      role="region"
      aria-label={model.epicOnly ? "Gantt chart of epics" : "Gantt chart of stories by epic"}
      tabIndex={0}
      ref={scroller}
      className="max-h-[72vh] min-h-48 overflow-auto rounded-lg border bg-background outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex w-max min-w-full">
        {/* Labels: sticky to the left while the waves scroll. */}
        <div className="sticky left-0 z-20 w-[152px] shrink-0 border-r bg-background md:w-[248px]">
          <div
            className="sticky top-0 z-10 flex items-center border-b bg-background px-2 text-xs text-muted-foreground"
            style={{ height: HEADER_H }}
          >
            {model.epicOnly ? "Epic" : "Epic / story"}
          </div>
          {rows.map((row) => (
            <LabelCell
              key={row.key}
              row={row}
              rowH={rowH}
              selected={selected === row.key}
              onSelect={onSelect}
              onHover={onHover}
              onToggleEpic={onToggleEpic}
              titles={epicTitles}
            />
          ))}
        </div>

        <div className="relative shrink-0" style={{ width: trackW }}>
          <div className="sticky top-0 z-10 flex border-b bg-background" style={{ height: HEADER_H }}>
            {Array.from({ length: Math.max(waves, 1) }, (_, i) => (
              <div
                key={i}
                className="flex shrink-0 items-center justify-center border-r text-xs text-muted-foreground"
                style={{ width: colW }}
              >
                Wave {i + 1}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: bodyH, ...gridStyle }}>
            {rows.map((row, i) => (
              <Bar
                key={row.key}
                row={row}
                top={i * rowH}
                rowH={rowH}
                colW={colW}
                selected={selected === row.key}
                hovered={hovered === row.key}
                inChain={row.node ? upstream.has(row.node.key) || downstream.has(row.node.key) : false}
                titles={epicTitles}
                onSelect={onSelect}
                onHover={onHover}
              />
            ))}
            <svg
              aria-hidden="true"
              focusable="false"
              className="pointer-events-none absolute inset-0 z-10 overflow-visible"
              width={trackW}
              height={bodyH}
            >
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L8 4 L0 8 z" fill="currentColor" />
                </marker>
              </defs>
              {lines.map((l) => (
                <path
                  key={l.id}
                  d={l.d}
                  fill="none"
                  strokeWidth={1}
                  markerEnd="url(#gantt-arrow)"
                  className={cn(
                    l.tone === "active" && "text-foreground",
                    l.tone === "critical" && "text-warning",
                    l.tone === "all" && "text-muted-foreground/50",
                  )}
                  stroke="currentColor"
                />
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelCell({
  row,
  rowH,
  selected,
  titles,
  onSelect,
  onHover,
  onToggleEpic,
}: {
  row: GanttRow;
  rowH: number;
  selected: boolean;
  titles: Map<string, string>;
  onSelect(key: string): void;
  onHover(key: string): void;
  onToggleEpic(epicId: string): void;
}) {
  const isEpic = row.type === "epic";
  const n = row.node;
  return (
    <div
      className={cn("flex items-center gap-1 border-b px-1", selected ? "bg-accent" : "hover:bg-accent/50")}
      style={{ height: rowH }}
      onMouseEnter={() => onHover(row.key)}
      onMouseLeave={() => onHover("")}
    >
      {isEpic && row.expandable ? (
        <button
          type="button"
          aria-expanded={row.expanded}
          aria-label={`${row.expanded ? "Collapse" : "Expand"} epic ${row.epicId}`}
          onClick={() => onToggleEpic(row.epicId)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-7"
        >
          {row.expanded ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
        </button>
      ) : (
        <span className={cn("shrink-0", isEpic ? "w-0" : "w-4 md:w-6")} aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => onSelect(row.key)}
        title={row.type === "story" || row.type === "external" ? `${n?.id} ${n?.title}` : titles.get(row.epicId)}
        aria-label={rowDescription(row, titles)}
        aria-pressed={selected}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-md text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isEpic ? (
          <>
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">{epicLabel(row.epicId)}</span>
            <span className="truncate text-xs font-medium">{titles.get(row.epicId) ?? ""}</span>
            {row.span && row.expandable && (
              <span className="ml-auto shrink-0 pr-1 text-2xs tabular-nums text-muted-foreground">
                {row.span.done}/{row.span.total}
              </span>
            )}
          </>
        ) : (
          <>
            <span className={cn("size-2 shrink-0 rounded-full", statusStyle(n!.status).dot)} aria-hidden="true" />
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">{n!.id}</span>
            <span className="truncate text-xs">{n!.title}</span>
          </>
        )}
      </button>
    </div>
  );
}

function Bar({
  row,
  top,
  rowH,
  colW,
  selected,
  hovered,
  inChain,
  titles,
  onSelect,
  onHover,
}: {
  row: GanttRow;
  top: number;
  rowH: number;
  colW: number;
  selected: boolean;
  hovered: boolean;
  inChain: boolean;
  titles: Map<string, string>;
  onSelect(key: string): void;
  onHover(key: string): void;
}) {
  const n = row.node;
  const isStoryEpic = row.type === "epic" && !n;
  const start = row.span ? row.span.start : n!.start;
  const end = row.span ? row.span.end : n!.end;
  const { left, width } = barBox(start, end, colW);
  const h = isStoryEpic ? 20 : rowH - 12;
  const style = { top: top + (rowH - h) / 2, left, width, height: h };

  const common = {
    type: "button" as const,
    onClick: () => onSelect(row.key),
    onMouseEnter: () => onHover(row.key),
    onMouseLeave: () => onHover(""),
    onFocus: () => onHover(row.key),
    onBlur: () => onHover(""),
    "aria-label": rowDescription(row, titles),
    "aria-pressed": selected,
    "data-bar": row.key,
    style,
  };

  if (isStoryEpic && row.span) {
    const pct = row.span.total ? (row.span.done / row.span.total) * 100 : 0;
    return (
      <button
        {...common}
        title={`${epicLabel(row.epicId)} ${titles.get(row.epicId) ?? ""}: ${row.span.done}/${row.span.total} done`}
        className={cn(
          "absolute overflow-hidden rounded-md border border-foreground/30 bg-muted text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          selected && "ring-2 ring-ring",
          hovered && !selected && "border-foreground/60",
        )}
      >
        <span className="absolute inset-y-0 left-0 bg-success/40" style={{ width: `${pct}%` }} aria-hidden="true" />
        <span className="relative block truncate px-1.5 text-2xs leading-5 text-foreground">
          {epicLabel(row.epicId)} {row.span.done}/{row.span.total}
        </span>
      </button>
    );
  }
  const s = statusStyle(n!.status);
  return (
    <button
      {...common}
      title={`${n!.id} ${n!.title}`}
      className={cn(
        "absolute overflow-hidden rounded-md border text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        s.bar,
        n!.critical && "outline-2 -outline-offset-1 outline-warning outline-solid",
        inChain && "border-foreground/70",
        n!.kind === "external" && "border-dashed",
        selected && "ring-2 ring-ring",
        hovered && !selected && "border-foreground/70",
      )}
    >
      <span className="block truncate px-1.5 text-2xs leading-6 text-foreground">
        <span className="font-mono">{n!.id}</span>
        {n!.kind === "story" && <span className="text-muted-foreground"> {n!.title}</span>}
      </span>
    </button>
  );
}
