import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyPathButton } from "./document-pane";

describe("CopyPathButton", () => {
  it("renders the labelled button with the full path as title", () => {
    const html = renderToStaticMarkup(<CopyPathButton path="_bmad-output/a/b.md" />);
    expect(html).toContain('aria-label="Copy file path"');
    expect(html).toContain('title="_bmad-output/a/b.md"');
    expect(html).toContain("Copy path");
    expect(html).toContain('aria-live="polite"');
  });
});
