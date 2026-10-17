import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsBrowser } from "./docs-browser";
import { HighlightedName } from "./file-tree";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("Library file filter", () => {
  it("renders the filter field above the tree and no count while empty", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <DocsBrowser
          fileTree={[{ name: "a.md", path: "a.md", type: "file" }]}
          docsTree={[]}
          bmadCoreTree={[]}
          owner="o"
          repo="r"
        />
      </TooltipProvider>,
    );
    expect(html).toContain('aria-label="Filter files"');
    expect(html).toContain('placeholder="Filter files"');
    expect(html).not.toContain("files</p>");
    expect(html).not.toContain("Clear filter");
  });

  it("highlights matches in a name", () => {
    const html = renderToStaticMarkup(<HighlightedName name="Story-Budget.md" terms={["budget"]} />);
    expect(html).toContain("<mark");
    expect(html).toContain(">Budget</mark>");
  });
});
