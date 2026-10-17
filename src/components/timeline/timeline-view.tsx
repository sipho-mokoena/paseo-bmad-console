"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GanttChart as GanttIcon, ListTree, Network } from "lucide-react";
import { PillToggle, SearchField, StateMessage } from "@/components/shared/list-kit";
import { cn } from "@/lib/utils";
import { epicLabel } from "@/lib/bmad/ids";
import {
  buildEpicGraph,
  buildStoryGraph,
  busiestEpic,
  closure,
  scopeStoryGraph,
  type DepGraph,
  type DepNode,
} from "@/lib/dependency-graph";
import {
  parseTimelineState,
  serializeTimelineState,
  type TimelineState,
  type TimelineViewId,
} from "@/lib/timeline-params";
import { buildGanttModel, nodePasses, type NodeFilter } from "@/lib/timeline-layout";
import type { TimelineData } from "@/lib/timeline-data";
import { GanttChart } from "./gantt-chart";
import { DependencyList } from "./dependency-list";
import { DetailsPanel, type DetailItem, type DetailRef } from "./details-panel";
import { TimelineEmpty } from "./timeline-empty";
import { CHIP, CHIP_ON, FILTER_STATUS_OPTIONS } from "./timeline-style";

const GraphChart = dynamic(() => import("./graph-chart").then((m) => m.GraphChart), {
  ssr: false,
  loading: () => <StateMessage className="min-h-48">Loading graph</StateMessage>,
});

/** Above this many nodes the all-epics story graph is not drawn. */
export const GRAPH_NODE_CAP = 150;
const EXPAND_ALL_LIMIT = 40;

const subscribeDesktop = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useDesktop = () =>
  useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );

const subscribePhone = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const usePhone = () =>
  useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );

const EPIC = "epic:";
const bare = (key: string) => (key.startsWith(EPIC) ? key.slice(EPIC.length) : key);

interface TimelineViewProps {
  data: TimelineData;
  /** `/repo/<owner>/<repo>` */
  base: string;
}

/** The Timeline section of the Overview page: Gantt, dependency graph and list over one dependency-driven schedule. */
export function TimelineView({ data, base }: TimelineViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseTimelineState(searchParams), [searchParams]);
  const desktop = useDesktop();

  const [query, setQuery] = useState(urlState.q);
  const writtenQ = useRef(urlState.q);
  // Back / forward changes the URL's q: adopt it unless it is our own write.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting an external (history) change of the URL
    if (urlState.q !== writtenQ.current) setQuery(urlState.q);
    writtenQ.current = urlState.q;
  }, [urlState.q]);

  // Arriving with #timeline (links from story and epic pages, the old /timeline URL): bring the section into view once
  // the chart is in the page, since the browser's own hash scroll can run before it has its height.
  useEffect(() => {
    if (window.location.hash !== "#timeline") return;
    document.getElementById("timeline")?.scrollIntoView({ block: "start" });
  }, []);

  const [hovered, setHovered] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pickedView, setPickedView] = useState(false);
  const phone = usePhone();
  const view: TimelineViewId = pickedView || searchParams.has("view") || !phone ? urlState.view : "list";

  const commit = useCallback(
    (patch: Partial<TimelineState>, mode: "replace" | "push" = "replace") => {
      const next = { ...urlState, ...patch };
      const qs = serializeTimelineState(window.location.search, next).toString();
      const url = `${pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [urlState, pathname],
  );

  const { epics, stories } = data;
  const epicTitles = useMemo(() => new Map(epics.map((e) => [e.id, e.title])), [epics]);
  const epicOrder = useMemo(() => epics.map((e) => e.id), [epics]);
  const scope = epics.some((e) => e.id === urlState.scope) ? urlState.scope : "";
  const sizeByRisk = data.hasRisk && urlState.risk;
  const storyLevel = useMemo(() => stories.some((s) => s.deps.length > 0), [stories]);

  const fullGraph = useMemo(() => buildStoryGraph(stories, epics, { sizeByRisk }), [stories, epics, sizeByRisk]);
  const epicGraph = useMemo(() => buildEpicGraph(epics, stories), [epics, stories]);
  const storyGraph = useMemo(
    () => (scope && storyLevel ? scopeStoryGraph(stories, epics, scope, { sizeByRisk }) : fullGraph),
    [scope, storyLevel, stories, epics, sizeByRisk, fullGraph],
  );

  const filter: NodeFilter = useMemo(
    () => ({ statuses: urlState.status, ready: urlState.ready, q: query }),
    [urlState.status, urlState.ready, query],
  );

  // Epic-only scoping keeps the epic and its direct neighbours.
  const epicScopeSet = useMemo(() => {
    if (!scope) return null;
    const n = epicGraph.byKey.get(scope);
    return new Set(n ? [scope, ...n.after, ...n.blocks] : [scope]);
  }, [scope, epicGraph]);

  // Which graph feeds the active view.
  const graphLevel: "story" | "epic" =
    view === "graph" ? (urlState.level === "epics" || !storyLevel ? "epic" : "story") : storyLevel ? "story" : "epic";
  const viewGraph: DepGraph = graphLevel === "epic" ? epicGraph : storyGraph;
  const prefix = graphLevel === "epic" ? EPIC : "";

  // Gantt group state: explicit user choices win; otherwise the scoped / focused epic is open,
  // and every epic is open when the project is small.
  const [override, setOverride] = useState<Map<string, boolean>>(() => new Map());
  const focusEpic = useMemo(() => stories.find((s) => s.id === urlState.focus)?.epicId, [stories, urlState.focus]);
  const expanded = useMemo(() => {
    const open = new Set<string>();
    for (const id of epicOrder) {
      const auto = id === scope || id === focusEpic || stories.length <= EXPAND_ALL_LIMIT;
      if (override.get(id) ?? auto) open.add(id);
    }
    return open;
  }, [override, epicOrder, scope, focusEpic, stories.length]);
  const setAllExpanded = (open: boolean) => setOverride(new Map(epicOrder.map((id) => [id, open])));

  const gantt = useMemo(() => {
    const model = buildGanttModel({ storyGraph, epicGraph, epicOrder, epicTitles, expanded, filter, storyLevel });
    if (model.epicOnly && epicScopeSet) model.rows = model.rows.filter((r) => epicScopeSet.has(r.epicId));
    return model;
  }, [storyGraph, epicGraph, epicOrder, epicTitles, expanded, filter, storyLevel, epicScopeSet]);

  const listNodes = useMemo(() => {
    const nodes = viewGraph.nodes.filter((n) => nodePasses(n, filter) && (graphLevel !== "epic" || !epicScopeSet || epicScopeSet.has(n.key)));
    return nodes;
  }, [viewGraph, filter, graphLevel, epicScopeSet]);

  const matches = useMemo(() => new Set(listNodes.map((n) => n.key)), [listNodes]);

  const selected = useMemo(() => {
    const f = urlState.focus;
    if (!f) return "";
    if (!f.startsWith(EPIC) && (storyGraph.byKey.has(f) || fullGraph.byKey.has(f))) return f;
    return epicGraph.byKey.has(bare(f)) ? EPIC + bare(f) : "";
  }, [urlState.focus, storyGraph, fullGraph, epicGraph]);
  const activeKey = hovered || selected;
  const chainGraph = view === "gantt" ? (gantt.epicOnly ? epicGraph : storyGraph) : viewGraph;
  const activeBare = chainGraph.kind === "epic" ? (activeKey.startsWith(EPIC) ? bare(activeKey) : "") : activeKey.startsWith(EPIC) ? "" : activeKey;
  const upstream = useMemo(() => (activeBare ? closure(chainGraph, activeBare, "up") : new Set<string>()), [chainGraph, activeBare]);
  const downstream = useMemo(() => (activeBare ? closure(chainGraph, activeBare, "down") : new Set<string>()), [chainGraph, activeBare]);

  const select = useCallback(
    (key: string) => commit({ focus: key.startsWith(EPIC) && !epicGraph.byKey.has(bare(key)) ? "" : key }),
    [commit, epicGraph],
  );

  const detail = useMemo(
    () => resolveDetail(selected, storyGraph, fullGraph, epicGraph, stories, epicTitles),
    [selected, storyGraph, fullGraph, epicGraph, stories, epicTitles],
  );

  const hasRisk = data.hasRisk;
  const toggle = (patch: Partial<TimelineState>) => commit(patch);
  const onQuery = (value: string) => {
    writtenQ.current = value;
    setQuery(value);
    commit({ q: value });
  };
  const statusOn = (s: string) => urlState.status.includes(s);
  const filtered = urlState.status.length > 0 || urlState.ready || query.trim() !== "";
  const resetFilters = () => {
    writtenQ.current = "";
    setQuery("");
    commit({ status: [], ready: false, q: "" });
  };

  if (epics.length === 0 || (!storyLevel && !epics.some((e) => (e.after?.length ?? 0) > 0))) {
    return <TimelineEmpty base={base} hasEpics={epics.length > 0} />;
  }

  const rowH = desktop ? 36 : 40;
  const tooMany = view === "graph" && graphLevel === "story" && !scope && storyGraph.nodes.length > GRAPH_NODE_CAP;
  const busiest = busiestEpic(stories);
  const waves = view === "gantt" ? gantt.waves : viewGraph.waves;
  const unresolved = viewGraph.unresolved;
  const cycles = viewGraph.cycles;
  const showPanel = detail !== null;

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label="Timeline">
      <div className="flex flex-wrap items-center gap-2">
        <PillToggle<TimelineViewId>
          label="Timeline view"
          value={view}
          onChange={(v) => {
            setPickedView(true);
            commit({ view: v }, "push");
          }}
          options={[
            { value: "gantt", label: "Gantt", icon: GanttIcon, ariaLabel: "Gantt view" },
            { value: "graph", label: "Graph", icon: Network, ariaLabel: "Dependency graph view" },
            { value: "list", label: "List", icon: ListTree, ariaLabel: "Dependencies as a list" },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only md:not-sr-only">Scope</span>
          <select
            aria-label="Scope"
            value={scope}
            onChange={(e) => commit({ scope: e.target.value, focus: "" }, "push")}
            className="h-10 max-w-[12rem] rounded-lg border border-input bg-card px-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:max-w-[18rem]"
          >
            <option value="">All epics</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                {epicLabel(e.id)} {e.title}
              </option>
            ))}
          </select>
        </label>
        <SearchField value={query} onChange={onQuery} placeholder="Search id or title" ariaLabel="Search id or title" clearable className="min-w-40 flex-1 sm:max-w-72" />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters and options">
        <button type="button" aria-pressed={urlState.ready} onClick={() => toggle({ ready: !urlState.ready })} className={cn(CHIP, urlState.ready && CHIP_ON)}>
          Ready now
        </button>
        {FILTER_STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={statusOn(o.value)}
            onClick={() => toggle({ status: statusOn(o.value) ? urlState.status.filter((s) => s !== o.value) : [...urlState.status, o.value] })}
            className={cn(CHIP, statusOn(o.value) && CHIP_ON)}
          >
            {o.label}
          </button>
        ))}
        {filtered && (
          <button type="button" onClick={resetFilters} className={cn(CHIP, "border-transparent bg-transparent underline underline-offset-2")}>
            Clear filters
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Chart options">
        <button type="button" aria-pressed={urlState.critical} onClick={() => toggle({ critical: !urlState.critical })} className={cn(CHIP, urlState.critical && CHIP_ON)}>
          Highlight critical path
        </button>
        {view === "gantt" && (
          <button type="button" aria-pressed={urlState.all} onClick={() => toggle({ all: !urlState.all })} className={cn(CHIP, urlState.all && CHIP_ON)}>
            Show all dependencies
          </button>
        )}
        {hasRisk && (
          <button type="button" aria-pressed={urlState.risk} onClick={() => toggle({ risk: !urlState.risk })} className={cn(CHIP, urlState.risk && CHIP_ON)} title="Bars last 1, 2 or 3 waves for low, medium and high risk">
            Size by risk
          </button>
        )}
        {view === "graph" && storyLevel && !scope && (
          <PillToggle
            label="Graph level"
            value={urlState.level}
            onChange={(level) => commit({ level }, "push")}
            options={[
              { value: "stories", label: "Stories" },
              { value: "epics", label: "Epics" },
            ]}
          />
        )}
        {view === "gantt" && gantt.rows.some((r) => r.expandable) && (
          <>
            <button type="button" className={CHIP} onClick={() => setAllExpanded(true)}>
              Expand all
            </button>
            <button type="button" className={CHIP} onClick={() => setAllExpanded(false)}>
              Collapse all
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Schedule derived from dependencies, not dates: bars sit on Wave 1, Wave 2, and so on, each starting when its prerequisites end
        {sizeByRisk ? " (sized by risk: low 1 wave, medium 2, high 3)" : ""}. {waves} {waves === 1 ? "wave" : "waves"}
        {view === "list" || graphLevel === "story" ? `, ${viewGraph.nodes.filter((n) => n.kind !== "external").length} items` : ""}.
        {gantt.epicOnly && view !== "graph" ? " Story-level dependencies are not available for this project, so only epics are drawn." : ""}
      </p>
      {(cycles.length > 0 || unresolved.length > 0) && (
        <p role="status" className="text-xs text-warning-foreground">
          {cycles.length > 0 && `${cycles.length} dependency ${cycles.length === 1 ? "cycle was" : "cycles were"} found (${cycles.map((c) => c.join(" > ")).slice(0, 2).join("; ")}${cycles.length > 2 ? "; ..." : ""}); one link per cycle is ignored in the layout. `}
          {unresolved.length > 0 && `${unresolved.length} dependency ${unresolved.length === 1 ? "reference points" : "references point"} to unknown items (${unresolved.map((u) => `${u.from} needs ${u.ref}`).slice(0, 3).join(", ")}${unresolved.length > 3 ? ", ..." : ""}).`}
        </p>
      )}

      <div className={cn("grid min-w-0 gap-3", showPanel && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="min-w-0">
          {view === "list" ? (
            <DependencyList graph={viewGraph} epicTitles={epicTitles} nodes={listNodes} selected={selected} onSelect={select} prefix={prefix} />
          ) : view === "gantt" ? (
            gantt.rows.length === 0 ? (
              <StateMessage>No item matches the filters</StateMessage>
            ) : (
              <GanttChart
                model={gantt}
                graph={gantt.epicOnly ? epicGraph : storyGraph}
                epicTitles={epicTitles}
                rowH={rowH}
                selected={selected}
                hovered={hovered}
                upstream={upstream}
                downstream={downstream}
                critical={urlState.critical}
                showAll={urlState.all}
                onSelect={select}
                onHover={setHovered}
                onToggleEpic={(id) => setOverride((prev) => new Map(prev).set(id, !expanded.has(id)))}
              />
            )
          ) : tooMany ? (
            <StateMessage className="flex-col gap-3">
              <p className="text-foreground">Too many nodes: pick an epic</p>
              <p className="max-w-prose">
                All epics together have {storyGraph.nodes.length} stories, more than the {GRAPH_NODE_CAP} the graph draws legibly. Choose one epic in Scope, or switch to the epic level.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {busiest && (
                  <button type="button" className={cn(CHIP, CHIP_ON)} onClick={() => commit({ scope: busiest, focus: "" }, "push")}>
                    Scope to the busiest epic ({epicLabel(busiest)}, {stories.filter((s) => s.epicId === busiest).length} stories)
                  </button>
                )}
                <button type="button" className={CHIP} onClick={() => commit({ level: "epics" }, "push")}>
                  Show epics only
                </button>
              </div>
            </StateMessage>
          ) : (
            <GraphChart
              graph={viewGraph}
              prefix={prefix}
              selected={selected}
              hovered={hovered}
              upstream={upstream}
              downstream={downstream}
              matches={matches}
              only={graphLevel === "epic" && epicScopeSet ? epicScopeSet : undefined}
              critical={urlState.critical}
              zoom={zoom}
              onZoom={setZoom}
              onSelect={select}
              onHover={setHovered}
            />
          )}
        </div>
        {detail && <DetailsPanel item={detail} base={base} onSelect={select} onClose={() => commit({ focus: "" })} />}
      </div>
    </div>
  );
}

const refOf = (g: DepGraph, key: string, prefix: string, titles?: Map<string, string>): DetailRef => {
  const n = g.byKey.get(key);
  return {
    key: prefix + key,
    label: n ? (n.kind === "story" ? n.id : epicLabel(n.id)) : key,
    title: n?.title ?? titles?.get(key) ?? key,
  };
};

function resolveDetail(
  selected: string,
  storyGraph: DepGraph,
  fullGraph: DepGraph,
  epicGraph: DepGraph,
  stories: TimelineData["stories"],
  epicTitles: Map<string, string>,
): DetailItem | null {
  if (!selected) return null;
  if (selected.startsWith(EPIC)) {
    const n = epicGraph.byKey.get(bare(selected));
    if (!n) return null;
    const needs = new Map(epicGraph.edges.filter((e) => e.to === n.key).map((e) => [e.from, e.needs]));
    const mine = stories.filter((s) => s.epicId === n.key);
    return {
      key: selected,
      id: n.id,
      kind: "epic",
      title: n.title,
      status: n.status,
      epicId: n.id,
      epicTitle: n.title,
      start: n.start,
      end: n.end,
      ready: n.ready,
      critical: n.critical,
      blockedBy: n.blockedBy.map((k) => refOf(epicGraph, k, EPIC)),
      after: n.after.map((k) => ({ ...refOf(epicGraph, k, EPIC), needs: needs.get(k) })),
      blocks: n.blocks.map((k) => refOf(epicGraph, k, EPIC)),
      progress: { done: mine.filter((s) => s.status === "done").length, total: mine.length },
    };
  }
  const g = storyGraph.byKey.has(selected) ? storyGraph : fullGraph;
  const n: DepNode | undefined = g.byKey.get(selected);
  if (!n) return null;
  return {
    key: selected,
    id: n.id,
    kind: n.kind === "external" ? "external" : "story",
    title: n.title,
    status: n.status,
    epicId: n.epicId,
    epicTitle: epicTitles.get(n.epicId) ?? n.epicId,
    risk: n.risk,
    type: n.type,
    start: n.start,
    end: n.end,
    ready: n.ready,
    critical: n.critical,
    blockedBy: n.blockedBy.map((k) => refOf(g, k, "")),
    after: n.after.map((k) => refOf(g, k, "")),
    blocks: n.blocks.map((k) => refOf(g, k, "")),
    members: n.members,
  };
}

