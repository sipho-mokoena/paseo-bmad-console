import { describe, expect, it } from "vitest";
import { visibleTabs } from "./project-tabs";

describe("visibleTabs", () => {
  const labels = (o?: Parameters<typeof visibleTabs>[0]) => visibleTabs(o).map((t) => t.label);
  it("has no Timeline tab", () => {
    expect(labels({ hasSpecs: true, hasDesign: true })).toEqual(["Overview", "Epics", "Specs", "Design", "Library"]);
  });
  it("hides Specs and Design without documents", () => {
    expect(labels()).toEqual(["Overview", "Epics", "Library"]);
  });
});
