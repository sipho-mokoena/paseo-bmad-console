import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyPathButton } from "./document-pane";

describe("CopyPathButton", () => {
  it("renders the labelled button with the full system path as title", () => {
    const html = renderToStaticMarkup(
      <CopyPathButton path="_bmad-output/a/b.md" owner="local" repo="x" localRoot="/home/u/proj" />,
    );
    expect(html).toContain('aria-label="Copy file path"');
    expect(html).toContain('title="/home/u/proj/_bmad-output/a/b.md"');
    expect(html).toContain("Copy path");
    expect(html).toContain('aria-live="polite"');
  });

  it("GitHub project: title says the path is in the repository", () => {
    const html = renderToStaticMarkup(<CopyPathButton path="docs/a.md" owner="acme" repo="app" />);
    expect(html).toContain("Path in the repository: acme/app/docs/a.md");
  });
});
