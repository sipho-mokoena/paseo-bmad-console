import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildStoryGraph, type GraphStoryInput } from "@/lib/dependency-graph";
import { DependencyList } from "./dependency-list";
import { TimelineEmpty } from "./timeline-empty";
import { TimelineViewMenu } from "./timeline-view-menu";

const st = (id: string, epicId: string, deps: string[] = [], status = "backlog"): GraphStoryInput => ({ id, title: `Title ${id}`, status, epicId, deps });

describe("DependencyList", () => {
  const graph = buildStoryGraph([st("1.1", "1", [], "done"), st("1.2", "1", ["1.1"]), st("2.1", "2", ["1.2"])], [{ id: "1" }, { id: "2" }]);
  const html = (nodes = graph.nodes) =>
    renderToStaticMarkup(<DependencyList graph={graph} epicTitles={new Map([["1", "One"], ["2", "Two"]])} nodes={nodes} selected="1.2" onSelect={() => {}} />);

  it("lists every item with its wave, prerequisites and dependents", () => {
    const out = html();
    expect(out).toContain('aria-label="Dependencies as a list"');
    expect(out).toContain("Title 1.2");
    expect(out).toContain("Wave 2");
    expect(out).toContain("Ready now");
    expect(out).toContain("After");
    expect(out).toContain("Blocks");
    expect(out).toContain("not from dates");
  });
  it("groups by epic and marks the selection", () => {
    const out = html();
    expect(out).toContain('aria-label="Epic 1"');
    expect(out).toContain('aria-label="Epic 2"');
    expect(out).toContain('aria-pressed="true"');
  });
  it("says so when nothing matches", () => {
    expect(html([])).toContain("No item matches the filters");
  });
});

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
