import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  queryTerms,
  scoreEpic,
  scoreStory,
  scoreDoc,
  rankAndCap,
  makeSnippet,
  highlightSegments,
  MAX_QUERY_LENGTH,
} from "../search";
import type { Epic, StoryDetail } from "../bmad/types";

const epic = (o: Partial<Epic> = {}): Epic => ({
  id: "7",
  title: "Registry",
  description: "Image registry on the control VM",
  status: "in-progress",
  stories: [],
  totalStories: 0,
  completedStories: 0,
  progressPercent: 0,
  ...o,
});
const story = (o: Partial<StoryDetail> = {}): StoryDetail => ({
  id: "3.6",
  title: "Wire the thing",
  status: "backlog",
  epicId: "3",
  description: "Some description",
  acceptanceCriteria: [],
  tasks: [],
  completedTasks: 0,
  totalTasks: 0,
  ...o,
});
const run = (q: string) => {
  const n = normalizeQuery(q)!;
  return { n, t: queryTerms(n) };
};

describe("normalizeQuery", () => {
  it("trims, collapses and caps", () => {
    expect(normalizeQuery("  a   b  ")).toBe("a b");
    expect(normalizeQuery("x".repeat(500))).toHaveLength(MAX_QUERY_LENGTH);
  });
  it("ignores short or empty queries", () => {
    expect(normalizeQuery("a")).toBeNull();
    expect(normalizeQuery("  a ")).toBeNull();
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery("ab")).toBe("ab");
  });
});

describe("scoring", () => {
  it("requires all terms (AND), case-insensitive", () => {
    const { n, t } = run("REGISTRY vm");
    expect(scoreEpic(epic(), n, t)).toBeGreaterThan(0);
    const r = run("registry zzz");
    expect(scoreEpic(epic(), r.n, r.t)).toBe(0);
  });
  it("ranks exact id > title contains > description", () => {
    const exact = run("3.6");
    const a = scoreStory(story({ id: "3.6" }), exact.n, exact.t);
    const b = scoreStory(story({ id: "13.6", title: "x 3.6" }), exact.n, exact.t);
    const c = scoreStory(story({ id: "9.1", description: "see 3.6" }), exact.n, exact.t);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
    expect(c).toBeGreaterThan(0);
  });
  it("matches covers like CAP-10 and exact cover beats body", () => {
    const { n, t } = run("CAP-10");
    const withCover = story({
      id: "1.1",
      ticket: { covers: ["CAP-10"], after: [] },
    });
    const inBody = story({ id: "1.2", description: "mentions CAP-10 once" });
    expect(scoreStory(withCover, n, t)).toBeGreaterThan(scoreStory(inBody, n, t));
    expect(scoreStory(story({ id: "1.3" }), n, t)).toBe(0);
  });
  it("matches verify text and type/risk", () => {
    const s = story({
      acceptanceCriteria: ["boots in under 30s"],
      ticket: { type: "afk", risk: "high", covers: [], after: [] },
    });
    const v = run("under 30s");
    expect(scoreStory(s, v.n, v.t)).toBeGreaterThan(0);
    const r = run("high afk");
    expect(scoreStory(s, r.n, r.t)).toBeGreaterThan(0);
  });
  it("exact epic id", () => {
    const { n, t } = run("E7");
    expect(scoreEpic(epic(), n, t)).toBe(100);
  });
  it("docs: name beats path beats content", () => {
    const { n, t } = run("registry");
    const name = scoreDoc({ path: "a/registry.md", text: "" }, n, t).score;
    const path = scoreDoc({ path: "registry/x.md", text: "" }, n, t).score;
    const body = scoreDoc({ path: "a/x.md", text: "the registry is" }, n, t).score;
    expect(name).toBeGreaterThan(path);
    expect(path).toBeGreaterThan(body);
    expect(body).toBeGreaterThan(0);
    expect(scoreDoc({ path: "a/x.md", text: "nothing" }, n, t).score).toBe(0);
  });
});

describe("rankAndCap", () => {
  it("is stable for ties, caps, and reports the total", () => {
    const scored = ["a", "b", "c", "d"].map((item, i) => ({ item, score: i === 3 ? 9 : 1 }));
    const r = rankAndCap(scored, 3);
    expect(r.items).toEqual(["d", "a", "b"]);
    expect(r.total).toBe(4);
  });
});

describe("makeSnippet", () => {
  it("cuts around the first match with ellipses", () => {
    const text = `${"lorem ipsum ".repeat(30)}Control VM boots ${"dolor sit ".repeat(30)}`;
    const s = makeSnippet(text, ["control vm"])!;
    expect(s.startsWith("… ")).toBe(true);
    expect(s.endsWith(" …")).toBe(true);
    expect(s.toLowerCase()).toContain("control vm");
    expect(s.length).toBeLessThan(260);
  });
  it("has no ellipsis for short text and null without a match", () => {
    expect(makeSnippet("hello world", ["world"])).toBe("hello world");
    expect(makeSnippet("hello", ["zzz"])).toBeNull();
  });
  it("picks the earliest of several terms", () => {
    const s = makeSnippet("alpha beta gamma", ["gamma", "alpha"])!;
    expect(s).toBe("alpha beta gamma");
  });
});

describe("highlightSegments", () => {
  it("splits into matched and plain segments", () => {
    expect(highlightSegments("The Registry registry", ["registry"])).toEqual([
      { text: "The ", match: false },
      { text: "Registry", match: true },
      { text: " ", match: false },
      { text: "registry", match: true },
    ]);
  });
  it("merges overlapping terms and handles no match", () => {
    expect(highlightSegments("abcd", ["ab", "bc"])).toEqual([
      { text: "abc", match: true },
      { text: "d", match: false },
    ]);
    expect(highlightSegments("abc", ["x"])).toEqual([{ text: "abc", match: false }]);
    expect(highlightSegments("", ["x"])).toEqual([]);
  });
});
