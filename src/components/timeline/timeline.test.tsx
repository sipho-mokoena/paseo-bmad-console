import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildStoryGraph, type GraphStoryInput } from "@/lib/dependency-graph";
import { HEADER_H, NODE_H, WAVE_LABEL_BASELINE, layoutLayers } from "@/lib/timeline-layout";
import { DetailsPanel, type DetailItem } from "./details-panel";
import { GraphChart, nodeLabel } from "./graph-chart";
import { ScopeSelect } from "./scope-select";
import { TimelineEmpty } from "./timeline-empty";
import { TimelineViewMenu } from "./timeline-view-menu";

const st = (id: string, epicId: string, deps: string[] = [], status = "backlog"): GraphStoryInput => ({ id, title: `Title ${id}`, status, epicId, deps });

describe("TimelineEmpty", () => {
  it("explains missing dependencies and links back", () => {
    const out = renderToStaticMarkup(<TimelineEmpty base="/repo/o/r" hasEpics />);
    expect(out).toContain("No dependencies found");
    expect(out).toContain('href="/repo/o/r/epics"');
  });
  it("explains missing epics", () => {
    expect(renderToStaticMarkup(<TimelineEmpty base="/repo/o/r" hasEpics={false} />)).toContain("No epics found");
  });
});

describe("TimelineViewMenu", () => {
  const base = { state: { critical: true, all: false, risk: true }, view: "gantt" as const, hasRisk: true, canExpand: true, onToggle: () => {}, onExpandAll: () => {} };
  it("renders a View button with a count badge", () => {
    const out = renderToStaticMarkup(<TimelineViewMenu {...base} />);
    expect(out).toContain("View");
    expect(out).toContain('aria-haspopup="menu"');
    expect(out).toContain("View options, 2 on");
  });
  it("has no description line under Size by risk", () => {
    const out = renderToStaticMarkup(<TimelineViewMenu {...base} />);
    expect(out).not.toContain("Bars last");
  });
  it("shows no badge when no toggle is on", () => {
    const out = renderToStaticMarkup(<TimelineViewMenu {...base} state={{ critical: false, all: false, risk: false }} />);
    expect(out).toContain('aria-label="View options"');
  });
});

describe("GraphChart", () => {
  const graph = buildStoryGraph([st("1.1", "1", [], "done"), st("1.2", "1", ["1.1"]), st("1.3", "1"), st("2.1", "2", ["1.2", "1.3"])], [{ id: "1" }, { id: "2" }]);
  const render = () =>
    renderToStaticMarkup(
      <GraphChart graph={graph} prefix="" selected="" hovered="" upstream={new Set()} downstream={new Set()} matches={new Set(graph.nodes.map((n) => n.key))} critical={false} onSelect={() => {}} onHover={() => {}} />,
    );
  it("names every node with id, title, status, wave and what blocks it", () => {
    const out = render();
    expect(out).toContain('aria-label="1.2 Title 1.2, Backlog, wave 2, ready now"');
    expect(out).toContain('aria-label="2.1 Title 2.1, Backlog, wave 3, blocked by 1.2, 1.3"');
    expect(nodeLabel(graph, graph.byKey.get("1.1")!)).toMatch(/^1\.1 Title 1\.1, Done, wave 1/);
  });
  it("has no zoom controls", () => {
    const out = render();
    expect(out).not.toContain('aria-label="Zoom');
    expect(out).not.toContain("Click the chart");
    expect(out).not.toContain("%");
  });
});

describe("ScopeSelect", () => {
  const epics = [{ id: "1", title: "One" }, { id: "3", title: "Join and resolve" }];
  it("is a styled button, not a native select, showing the current value", () => {
    const out = renderToStaticMarkup(<ScopeSelect value="3" epics={epics} onChange={() => {}} />);
    // Radix adds a hidden, aria-hidden select only to mirror the value into forms; there is no visible native control.
    expect(out).not.toMatch(/<select(?![^>]*aria-hidden)/);
    expect(out).toContain("<button");
    expect(out).toContain('role="combobox"');
    expect(out).toContain("Scope");
    expect(out).toContain("Join and resolve");
  });
  it("shows All epics when nothing is scoped", () => {
    expect(renderToStaticMarkup(<ScopeSelect value="" epics={epics} onChange={() => {}} />)).toContain("All epics");
  });
});

describe("DetailsPanel", () => {
  const ref = (label: string, status: string) => ({ key: label, label, title: `Title ${label}`, status });
  const item: DetailItem = {
    key: "3.4", id: "3.4", kind: "story", title: "Join a peer", status: "backlog", epicId: "3", epicTitle: "Mesh", risk: "medium", start: 2, end: 4,
    ready: false, critical: false, blockedBy: [ref("3.2", "in-progress")], after: [ref("3.1", "done"), ref("3.2", "in-progress")], blocks: [ref("3.5", "backlog")],
  };
  const render = (i: DetailItem) => renderToStaticMarkup(<DetailsPanel item={i} base="/repo/o/r" onSelect={() => {}} onClose={() => {}} />);
  it("lists prerequisites with open ones, blocks and links", () => {
    const out = render(item);
    expect(out).toContain('aria-label="Details of 3.4"');
    expect(out).toContain("Prerequisites");
    expect(out).toContain("Blocked by 1 open prerequisite");
    expect(out).toContain("open</span>");
    expect(out).toContain("Blocks");
    expect(out).toContain("Waves 3 to 4");
    expect(out).toContain('href="/repo/o/r/epics/3/3.4"');
    expect(out).toContain('href="/repo/o/r/epics/3"');
    expect(out).not.toContain("Blocked by 0");
    expect(out).not.toContain("Ready now");
    expect(out).not.toContain("Critical path");
  });
  it("shows flags only when true", () => {
    const out = render({ ...item, ready: true, critical: true });
    expect(out).toContain("Ready now");
    expect(out).toContain("Critical path");
  });
  it("says No dependencies once and omits empty sections", () => {
    const out = render({ ...item, blockedBy: [], after: [], blocks: [] });
    expect(out.match(/No dependencies/g)).toHaveLength(1);
    expect(out).not.toContain("Prerequisites");
    expect(out).not.toContain("None");
  });
  it("has no story link for epics", () => {
    const out = render({ ...item, kind: "epic", id: "3" });
    expect(out).not.toContain("Open story");
    expect(out).toContain("Open epic");
  });
});

describe("graph header", () => {
  it("leaves room above the wave labels and before the first row", () => {
    expect(WAVE_LABEL_BASELINE - 12).toBeGreaterThanOrEqual(12);
    expect(HEADER_H - WAVE_LABEL_BASELINE).toBeGreaterThanOrEqual(12);
    const g = buildStoryGraph([st("1.1", "1"), st("1.2", "1", ["1.1"])], [{ id: "1" }]);
    const l = layoutLayers(g);
    expect(l.placed.get("1.1")!.y).toBe(HEADER_H);
    expect(l.height).toBeGreaterThanOrEqual(HEADER_H + NODE_H);
  });
});
