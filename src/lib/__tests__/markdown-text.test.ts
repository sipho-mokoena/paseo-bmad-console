import { describe, it, expect } from "vitest";
import { markdownToPlainText, summarizeMarkdown, truncateAtWord } from "../markdown-text";

describe("markdownToPlainText", () => {
  it("returns empty for empty input", () => {
    expect(markdownToPlainText("")).toBe("");
    expect(markdownToPlainText(null)).toBe("");
    expect(markdownToPlainText(undefined)).toBe("");
    expect(markdownToPlainText("  \n \n")).toBe("");
  });

  it("strips bold, italics, strikethrough and code", () => {
    expect(markdownToPlainText("**bold** and *it* and _it2_ and __b2__ and ~~gone~~ and `x = 1`")).toBe(
      "bold and it and it2 and b2 and gone and x = 1",
    );
  });

  it("strips emphasis that wraps across a line break", () => {
    expect(markdownToPlainText("choose. **It must\nnot** fall back")).toBe("choose. It must not fall back");
  });

  it("keeps snake_case and arithmetic asterisks", () => {
    expect(markdownToPlainText("use snake_case_name and 2 * 3 * 4")).toBe("use snake_case_name and 2 * 3 * 4");
  });

  it("turns links and images into their text", () => {
    expect(markdownToPlainText("see [the docs](https://x.dev/a) and ![diagram](a.png) or <https://y.dev>")).toBe(
      "see the docs and diagram or https://y.dev",
    );
    expect(markdownToPlainText("[ref text][1]\n\n[1]: https://z.dev")).toBe("ref text");
  });

  it("removes headings, blockquote, list and task markers and rules", () => {
    const md = "# Title\n\n> quoted\n\n- one\n* two\n1. three\n- [x] done\n- [ ] open\n\n---\nend";
    expect(markdownToPlainText(md)).toBe("Title quoted one two three done open end");
  });

  it("removes HTML tags and comments", () => {
    expect(markdownToPlainText("a <b>bold</b><br/> b <!-- hidden --> c")).toBe("a bold b c");
  });

  it("keeps the words of code fences without the fences", () => {
    expect(markdownToPlainText("before\n```ts\nconst a = 1;\n```\nafter")).toBe("before const a = 1; after");
  });

  it("flattens tables: no pipes, no separator row, text and emoji kept", () => {
    const md = [
      "| Story | Title | Priority | Depends on | Enables |",
      "|---|---|---|---|---|",
      "| **E14-S1** | KYC stub removal and tier-independent 3000 daily cap | 🟡 High (was 🔴 Blocker) | Spec Kit `005` | E14-S4 |",
    ].join("\n");
    const out = markdownToPlainText(md);
    expect(out).not.toMatch(/[|*`]|---/);
    expect(out).toContain("Story · Title · Priority");
    expect(out).toContain("E14-S1 · KYC stub removal and tier-independent 3000 daily cap · 🟡 High (was 🔴 Blocker)");
    expect(out).toContain("Spec Kit 005");
  });

  it("handles aligned separator rows", () => {
    expect(markdownToPlainText("a | b\n:--- | ---:\n1 | 2")).not.toContain("---");
    expect(markdownToPlainText("| a | b |\n| :-- | --: |\n| 1 | 2 |")).toBe("a · b 1 · 2");
  });

  it("unescapes backslash escapes and collapses whitespace", () => {
    expect(markdownToPlainText("1\\*2\n\n\n   x   y")).toBe("1*2 x y");
  });

  it("truncates at a word boundary with an ellipsis only when asked", () => {
    const text = "alpha beta gamma delta epsilon";
    expect(markdownToPlainText(text)).toBe(text);
    const cut = markdownToPlainText(text, 14);
    expect(cut).toBe("alpha beta…");
    expect(cut.length).toBeLessThanOrEqual(14);
    expect(truncateAtWord("short", 50)).toBe("short");
  });
});

describe("summarizeMarkdown", () => {
  it("takes the first prose block, skipping headings and pure tables", () => {
    const md = "# T\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nFirst **para** here.\n\nSecond.";
    expect(summarizeMarkdown(md)).toBe("First para here.");
  });

  it("caps at the limit", () => {
    expect(summarizeMarkdown("word ".repeat(200), 50).length).toBeLessThanOrEqual(50);
  });
});
