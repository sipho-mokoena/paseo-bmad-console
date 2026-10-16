import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineMarkdown } from "./inline-markdown";
import { MarkdownRenderer } from "./markdown-renderer";

describe("InlineMarkdown", () => {
  it("renders bold, code, links, strikethrough and nested lists inline", () => {
    const html = renderToStaticMarkup(
      <InlineMarkdown>{"**The daily limit is 3000** and `cap` [x](https://a.dev) ~~old~~\n- sub **one**"}</InlineMarkdown>,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain('href="https://a.dev"');
    expect(html).toContain("<del>");
    expect(html).toContain("<ul");
    expect(html).not.toContain("**");
    expect(html).not.toContain("`");
    expect(html).not.toContain("<p>");
  });

  it("does not render raw HTML", () => {
    expect(renderToStaticMarkup(<InlineMarkdown>{"<script>alert(1)</script>ok"}</InlineMarkdown>)).not.toContain("<script");
  });
});

describe("MarkdownRenderer compact", () => {
  it("renders a GFM table as a table", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer content={"| a | b |\n|---|---|\n| **1** | 2 |"} variant="compact" />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("md-compact");
    expect(html).not.toContain("|---|");
  });
});
