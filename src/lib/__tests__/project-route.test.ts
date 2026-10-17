import { describe, expect, it } from "vitest";
import { projectFromPathname } from "@/lib/project-route";

describe("projectFromPathname", () => {
  it("detects project routes at any depth", () => {
    expect(projectFromPathname("/repo/local/sovren")).toEqual({ owner: "local", name: "sovren" });
    expect(projectFromPathname("/repo/local/sovren/epics/4/story")).toEqual({ owner: "local", name: "sovren" });
    expect(projectFromPathname("/repo/a%20b/c/docs")).toEqual({ owner: "a b", name: "c" });
  });
  it("returns null elsewhere", () => {
    expect(projectFromPathname("/")).toBeNull();
    expect(projectFromPathname("/search")).toBeNull();
    expect(projectFromPathname("/repo/local")).toBeNull();
  });
});
