import { describe, expect, it } from "vitest";
import type { FileTreeNode } from "@/lib/bmad/types";
import {
  filterFileTree,
  flattenFilePaths,
  highlightRanges,
  parseFilterTerms,
  pathMatchesTerms,
} from "../file-tree-filter";

const f = (path: string): FileTreeNode => ({ name: path.split("/").pop()!, path, type: "file" });
const d = (path: string, children: FileTreeNode[]): FileTreeNode => ({
  name: path.split("/").pop()!,
  path,
  type: "directory",
  children,
});

const tree: FileTreeNode[] = [
  d("init", [
    d("init/epic-budgets", [f("init/epic-budgets/story-1.md"), f("init/epic-budgets/story-2.md")]),
    d("init/reviews", [f("init/reviews/review-a.md")]),
    f("init/.memlog.md"),
  ]),
  d("empty", []),
  f("README.md"),
];

describe("file-tree-filter", () => {
  it("parses terms", () => {
    expect(parseFilterTerms("  Epic   DASH ")).toEqual(["epic", "dash"]);
    expect(parseFilterTerms("   ")).toEqual([]);
  });

  it("flattens files only", () => {
    expect(flattenFilePaths(tree)).toHaveLength(5);
  });

  it("returns the original tree for an empty filter", () => {
    const r = filterFileTree(tree, []);
    expect(r.nodes).toBe(tree);
    expect(r.matched).toBe(5);
    expect(r.total).toBe(5);
  });

  it("matches multiple terms with AND over the full path", () => {
    const r = filterFileTree(tree, parseFilterTerms("story budget"));
    expect(flattenFilePaths(r.nodes)).toEqual([
      "init/epic-budgets/story-1.md",
      "init/epic-budgets/story-2.md",
    ]);
    expect(filterFileTree(tree, parseFilterTerms("story review")).matched).toBe(0);
  });

  it("matches folder names so all descendants show", () => {
    const r = filterFileTree(tree, parseFilterTerms("reviews"));
    expect(flattenFilePaths(r.nodes)).toEqual(["init/reviews/review-a.md"]);
  });

  it("keeps ancestors and drops folders without matches", () => {
    const r = filterFileTree(tree, parseFilterTerms("review-a"));
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].children).toHaveLength(1);
    expect(r.nodes[0].children![0].name).toBe("reviews");
  });

  it("includes dotfiles", () => {
    const r = filterFileTree(tree, parseFilterTerms(".memlog"));
    expect(flattenFilePaths(r.nodes)).toEqual(["init/.memlog.md"]);
  });

  it("returns nothing when no file matches", () => {
    const r = filterFileTree(tree, parseFilterTerms("zzz"));
    expect(r.nodes).toEqual([]);
    expect(r.matched).toBe(0);
    expect(r.total).toBe(5);
  });

  it("is case-insensitive", () => {
    expect(pathMatchesTerms("Docs/ReadMe.MD", parseFilterTerms("README docs"))).toBe(true);
  });

  it("treats regex characters literally", () => {
    for (const q of ["(", "[a-", ".*", "\\", "a+b?", "$^"]) {
      expect(() => filterFileTree(tree, parseFilterTerms(q))).not.toThrow();
      expect(() => highlightRanges("a(b)[c].*", parseFilterTerms(q))).not.toThrow();
    }
    expect(pathMatchesTerms("a/b.md", [".*"])).toBe(false);
    expect(pathMatchesTerms("a/b.*md", [".*"])).toBe(true);
  });

  it("computes merged highlight ranges", () => {
    expect(highlightRanges("Story-Budget.md", ["story", "budget"])).toEqual([
      [0, 5],
      [6, 12],
    ]);
    expect(highlightRanges("abcabc", ["abc", "bca"])).toEqual([[0, 6]]);
    expect(highlightRanges("abc", [])).toEqual([]);
    expect(highlightRanges("abc", ["x"])).toEqual([]);
  });

  it("filters 1000 files in under 20 ms", () => {
    const dirs: FileTreeNode[] = [];
    for (let i = 0; i < 20; i++) {
      const files = Array.from({ length: 50 }, (_, j) => f(`dir-${i}/story-${i}-${j}.md`));
      dirs.push(d(`dir-${i}`, files));
    }
    const terms = parseFilterTerms("story 7");
    const start = performance.now();
    const r = filterFileTree(dirs, terms);
    const elapsed = performance.now() - start;
    expect(r.total).toBe(1000);
    expect(r.matched).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20);
  });
});
