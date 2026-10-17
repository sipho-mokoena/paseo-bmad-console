import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";
import { TimelineView } from "@/components/timeline/timeline-view";
import type { TimelineData } from "@/lib/timeline-data";

let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => "/repo/o/r",
  useSearchParams: () => new URLSearchParams(search),
}));

describe("Resizable", () => {
  it("renders a labelled separator between two panels", () => {
    const html = renderToStaticMarkup(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="a">A</ResizablePanel>
        <ResizableHandle aria-label="Resize chart and details panels" />
        <ResizablePanel id="b">B</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-label="Resize chart and details panels"');
    expect(html).toContain("cursor-col-resize");
  });

  it("gives the handle a default label", () => {
    const html = renderToStaticMarkup(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel id="a">A</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="b">B</ResizablePanel>
      </ResizablePanelGroup>,
    );
    expect(html).toContain('aria-label="Resize panels"');
  });
});

describe("TimelineView layout on the server", () => {
  const data: TimelineData = {
    hasRisk: false,
    epics: [
      { id: "1", title: "One", status: "done" },
      { id: "2", title: "Two", status: "backlog", after: [{ id: "1" }] },
    ],
    stories: [],
  } as unknown as TimelineData;
  it("is stacked (no separator) with or without a selection; the group needs a wide screen", () => {
    for (const q of ["", "?focus=epic%3A2"]) {
      search = q;
      const html = renderToStaticMarkup(<TimelineView data={data} base="/repo/o/r" />);
      expect(html).toContain("Timeline controls");
      expect(html).not.toContain('role="separator"');
    }
  });
});
