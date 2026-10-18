import { describe, expect, it } from "vitest";
import { extractDocTitle } from "../doc-titles";

describe("extractDocTitle", () => {
  it("prefers frontmatter title, then name", () => {
    expect(extractDocTitle("---\ntitle: 'Platform user blocking'\nname: x\n---\n# Heading\n")).toBe("Platform user blocking");
    expect(extractDocTitle("---\nname: blocking-spine\n---\n# Heading\n")).toBe("blocking-spine");
  });
  it("falls back to the first H1 and skips fenced code", () => {
    expect(extractDocTitle("intro\n```\n# not a title\n```\n# Real *title*\n")).toBe("Real title");
  });
  it("returns null with neither", () => {
    expect(extractDocTitle("just text\n## sub\n")).toBeNull();
    expect(extractDocTitle("---\n: bad: [\n---\n")).toBeNull();
  });
});
