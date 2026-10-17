import { epicLabel } from "@/lib/bmad/ids";
import type { DepGraph, DepNode } from "@/lib/dependency-graph";
import { Pill } from "@/components/shared/pill";
import { cn } from "@/lib/utils";
import { statusLabel, statusStyle, waveLabel } from "./timeline-style";

interface DependencyListProps {
  graph: DepGraph;
  epicTitles: Map<string, string>;
  /** Items to list (already filtered), in display order. */
  nodes: DepNode[];
  selected: string;
  onSelect(key: string): void;
  /** `epic:` at epic level. */
  prefix?: "" | "epic:";
}

const REF =
  "inline-flex min-h-10 items-center rounded-md px-1 font-mono text-xs underline decoration-dotted underline-offset-2 outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-6";

function Refs({ label, keys, graph, onSelect, prefix }: { label: string; keys: string[]; graph: DepGraph; onSelect(key: string): void; prefix: string }) {
  if (keys.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-0.5">
      <span>{label}</span>
      {keys.map((k) => (
        <button key={k} type="button" className={REF} onClick={() => onSelect(prefix + k)} aria-label={`${label} ${graph.byKey.get(k)?.title ?? k}`}>
          {graph.byKey.get(k)?.kind === "external" ? `${epicLabel(graph.byKey.get(k)!.id)}*` : (graph.byKey.get(k)?.id ?? k)}
        </button>
      ))}
    </span>
  );
}

/**
 * "Dependencies as a list": every item with its wave, prerequisites and dependents as text.
 * Meant for screen readers and phones; reads top to bottom, grouped by epic.
 */
export function DependencyList({ graph, epicTitles, nodes, selected, onSelect, prefix = "" }: DependencyListProps) {
  const groups: { epicId: string; items: DepNode[] }[] = [];
  for (const n of nodes) {
    const last = groups[groups.length - 1];
    if (last && last.epicId === n.epicId) last.items.push(n);
    else groups.push({ epicId: n.epicId, items: [n] });
  }
  if (nodes.length === 0) {
    return <p className="px-2 py-8 text-center text-sm text-muted-foreground">No item matches the filters.</p>;
  }
  return (
    <section aria-label="Dependencies as a list" className="min-w-0 space-y-4">
      <p className="px-2 text-xs text-muted-foreground">
        {nodes.length} {nodes.length === 1 ? "item" : "items"}. Wave numbers come from the dependencies, not from dates.
        {graph.byKey && [...graph.byKey.values()].some((n) => n.kind === "external") ? " An asterisk marks items outside the chosen epic." : ""}
      </p>
      {groups.map((g) => (
        <section key={`${g.epicId}-${g.items[0].key}`} aria-label={`Epic ${g.epicId}`}>
          {graph.kind === "story" && (
            <h3 className="px-2 pb-1 text-xs font-normal text-muted-foreground">
              <span className="font-mono">{epicLabel(g.epicId)}</span> {epicTitles.get(g.epicId) ?? ""}
            </h3>
          )}
          <ul className="divide-y rounded-lg border">
            {g.items.map((n) => (
              <li key={n.key} className={cn("space-y-1 px-3 py-2", selected === prefix + n.key && "bg-accent")}>
                <div className="flex min-w-0 items-start gap-2">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", statusStyle(n.status).dot)} aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => onSelect(prefix + n.key)}
                    aria-pressed={selected === prefix + n.key}
                    className="min-w-0 flex-1 rounded-md text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{n.kind === "external" ? epicLabel(n.id) : n.id}</span>
                    {n.title}
                  </button>
                  <Pill className="shrink-0">{statusLabel(n.status)}</Pill>
                </div>
                <p className="flex flex-wrap items-center gap-x-3 pl-4 text-xs text-muted-foreground">
                  <span>{waveLabel(n.start, n.end)}</span>
                  {n.ready && <span className="text-success-foreground">Ready now</span>}
                  {n.critical && <span className="text-warning-foreground">Critical path</span>}
                  <Refs label="After" keys={n.after} graph={graph} onSelect={onSelect} prefix={prefix} />
                  <Refs label="Blocks" keys={n.blocks} graph={graph} onSelect={onSelect} prefix={prefix} />
                  {n.after.length === 0 && n.blocks.length === 0 && <span>No dependencies</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
