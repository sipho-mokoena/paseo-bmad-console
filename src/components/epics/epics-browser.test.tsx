import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

let qs = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/repo/o/r/epics",
  useSearchParams: () => new URLSearchParams(qs),
}));

import { EpicsBrowser } from "./epics-browser";
import type { Epic } from "@/lib/bmad/types";

const epic = (id: string, status: Epic["status"]): Epic => ({
  id,
  title: `Epic ${id}`,
  description: "",
  status,
  stories: [],
  totalStories: 2,
  completedStories: 1,
  progressPercent: 50,
});
const epics = [epic("1", "in-progress"), epic("2", "done"), epic("3", "not-started")];
const render = (query = "") => {
  qs = query;
  return renderToStaticMarkup(<EpicsBrowser epics={epics} stories={[]} base="/repo/o/r" />);
};

describe("EpicsBrowser toolbar", () => {
  it("has search, Filter and Sort, and no native select", () => {
    const html = render();
    expect(html).toContain('aria-label="Search all stories"');
    expect(html).toContain("Filter");
    expect(html).toContain('aria-label="Sort: Default order"');
    expect(html).toContain("Sort direction: ascending");
    expect(html).toContain('aria-label="Epics display mode"');
    expect(html).not.toContain("<select");
    expect(html).toContain("3 epics");
  });
  it("shows grouped sections by default and the count while filtered", () => {
    const html = render("sort=title");
    expect(html).toContain('aria-label="Sort: Title"');
    expect(render("st=done")).toContain("1 of 3 epics");
  });
  it("shows the empty state with Clear filters", () => {
    qs = "st=done&sort=id";
    const none = renderToStaticMarkup(
      <EpicsBrowser epics={[epic("1", "in-progress")]} stories={[]} base="/repo/o/r" />,
    );
    expect(none).toContain("No epics match");
    expect(none).toContain("Clear filters");
  });
  it("search mode keeps the controls and drops the layout toggle", () => {
    const html = render("q=zzz");
    expect(html).toContain("Filter");
    expect(html).toContain("Sort");
    expect(html).toContain("No story matches the search");
    expect(html).not.toContain('aria-label="Epics display mode"');
  });
});
