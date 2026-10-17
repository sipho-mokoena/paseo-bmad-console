import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildStoryGraph, type GraphStoryInput } from "@/lib/dependency-graph";
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
