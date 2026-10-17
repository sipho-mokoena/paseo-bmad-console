import { describe, expect, it } from "vitest";
import type { ContentProvider } from "@/lib/content-provider";
import type { RepoConfig } from "@/lib/types";
import { getBmadProject } from "../parser";
import { epicAfter } from "../parse-tickets";
import { parseEpicFile } from "../parse-epic-file";
import { parseStory } from "../parse-story";
import { frontmatterEpicDependencies, parseDependencyRefs, storyDeps } from "../deps";

const config = { owner: "local", name: "x", branch: "", displayName: "x", sourceType: "local" } as RepoConfig;
function fake(files: Record<string, string>): ContentProvider {
  return {
    async getTree() {
      return { paths: Object.keys(files), rootDirectories: [...new Set(Object.keys(files).map((p) => p.split("/")[0]))] };
    },
    async getFileContent(p) {
      if (!(p in files)) throw new Error(`Not found: ${p}`);
      return files[p];
    },
    async validateRoot() {},
  };
}

describe("parseDependencyRefs", () => {
  it("accepts arrays, comma strings and numbers", () => {
    expect(parseDependencyRefs(["E1", "E2-S4", "DEFERRED-E10"])).toEqual(["E1", "E2-S4", "DEFERRED-E10"]);
    expect(parseDependencyRefs("E1, E2-S3; DEFERRED-E10-S2")).toEqual(["E1", "E2-S3", "DEFERRED-E10-S2"]);
    expect(parseDependencyRefs([1, 2])).toEqual(["1", "2"]);
    expect(parseDependencyRefs(["1.2", "1-3-slug", "E2-S8a"])).toEqual(["1.2", "1.3", "E2-S8a"]);
  });
  it("tolerates none, null, empty and notes", () => {
    for (const v of ["none", "None", "n/a", null, undefined, [], "", [null], "-"]) expect(parseDependencyRefs(v)).toEqual([]);
    expect(parseDependencyRefs(["E1-S4 (partial)", "E1-S4", "`E3`"])).toEqual(["E1-S4", "E3"]);
  });
  it("drops prose and slugs", () => {
    expect(parseDependencyRefs(["The global-prefix fix landed 2026-09-01", "005-julia-pipeline-wiring", "E1"])).toEqual(["E1"]);
  });
});

describe("storyDeps and epic dependency helpers", () => {
  it("prefers ticket.after, then dependsOn, else empty", () => {
    expect(storyDeps({ ticket: { covers: [], after: ["1.1"] }, dependsOn: ["x"] })).toEqual(["1.1"]);
    expect(storyDeps({ dependsOn: ["E1-S1"] })).toEqual(["E1-S1"]);
    expect(storyDeps({})).toEqual([]);
  });
  it("turns story refs into epic dependencies and drops self refs", () => {
    expect(frontmatterEpicDependencies({ depends_on: ["E1-S1", "E1-S2", "E3", "E7"] }, "E7")).toEqual([
      { id: "E1", needs: "E1-S1, E1-S2" },
      { id: "E3" },
    ]);
  });
  it("epicAfter reads inline tables, ids and merges repeated epics", () => {
    expect(epicAfter([{ epic: 1, needs: "a" }, { epic: 2 }, { epic: 1, needs: "b" }, 3, { epic: 9 }], "9")).toEqual([
      { id: "1", needs: "a; b" },
      { id: "2" },
      { id: "3" },
    ]);
    expect(epicAfter(undefined)).toEqual([]);
  });
});

describe("parsers", () => {
  it("parseEpicFile reads depends_on", () => {
    const epic = parseEpicFile("---\nepic_id: E5\nname: Wallet\ndepends_on:\n  - E1\n  - E3\n---\n# E5\n", "E5-x.md")!;
    expect(epic.after).toEqual([{ id: "E1" }, { id: "E3" }]);
    expect(parseEpicFile("---\nid: 1\ntitle: A\ndepends_on: []\n---\nBody", "epic-1.md")!.after).toBeUndefined();
  });
  it("parseStory reads depends_on and ignores none", () => {
    expect(parseStory("---\nstory_id: E2-S1\nepic_id: E2\ndepends_on: [E1-S4, E1-S5]\n---\n# T\n", "E2-S1-x.md")!.dependsOn).toEqual(["E1-S4", "E1-S5"]);
    expect(parseStory("---\ndepends_on: none\n---\n# T\n", "1-1-x.md")!.dependsOn).toBeUndefined();
  });
});

describe("adapters", () => {
  it("ticket-tree keeps epic after with needs and story after as ids", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/initiative-a/tickets.toml":
          '[[epic]]\nid = 1\nslug = "one"\ntitle = "One"\n[[epic]]\nid = 2\nslug = "two"\ntitle = "Two"\nafter = [{ epic = 1, needs = "the lab" }]\n',
        "_bmad-output/initiative-a/one/tickets.toml": '[[entry]]\nid = 1\ntitle = "A"\n',
        "_bmad-output/initiative-a/two/tickets.toml": '[[entry]]\nid = 1\ntitle = "C"\nafter = ["1.1"]\n',
      }),
    ))!;
    expect(p.epics.find((e) => e.id === "2")!.after).toEqual([{ id: "1", needs: "the lab" }]);
    expect(p.epics.find((e) => e.id === "1")!.after).toBeUndefined();
    expect(storyDeps(p.stories.find((s) => s.id === "2.1")!)).toEqual(["1.1"]);
  });

  it("v6-project reads depends_on on epics (array, comma string, none, story refs) and on story specs", async () => {
    const epic = (id: string, dep: string) => `---\nepic_id: ${id}\nname: N ${id}\ndepends_on: ${dep}\n---\n\n# ${id}\n\nGoal.\n`;
    const spec = (id: string, epicId: string, dep: string) =>
      `---\nstory_id: ${id}\nepic_id: ${epicId}\nname: S ${id}\nstatus: backlog\ndepends_on: ${dep}\n---\n\n# ${id}\n\n## User Story\n\nx\n`;
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/epics/E1-a.md": epic("E1", "[]"),
        "_bmad-output/epics/E2-b.md": epic("E2", "\n  - E1"),
        "_bmad-output/epics/E3-c.md": epic("E3", "E1, E2"),
        "_bmad-output/epics/DEFERRED-E10-d.md": epic("DEFERRED-E10", "[E2-S1]"),
        "_bmad-output/epics/E4-e.md": epic("E4", "none"),
        ".agentic/epics/E1-a/E1-S1-x/spec.md": spec("E1-S1", "E1", "[]"),
        ".agentic/epics/E2-b/E2-S1-x/spec.md": spec("E2-S1", "E2", "\n  - E1-S1\n  - E1"),
        ".agentic/epics/E2-b/E2-S2-x/spec.md": spec("E2-S2", "E2", "[E2-S1]"),
      }),
    ))!;
    const after = (id: string) => p.epics.find((e) => e.id === id)!.after;
    expect(after("E1")).toBeUndefined();
    expect(after("E2")).toEqual([{ id: "E1" }]);
    expect(after("E3")).toEqual([{ id: "E1" }, { id: "E2" }]);
    expect(after("DEFERRED-E10")).toEqual([{ id: "E2", needs: "E2-S1" }]);
    expect(after("E4")).toBeUndefined();
    const deps = (id: string) => storyDeps(p.stories.find((s) => s.id === id)!);
    expect(deps("E1-S1")).toEqual([]);
    expect(deps("E2-S1")).toEqual(["E1-S1", "E1"]);
    expect(deps("E2-S2")).toEqual(["E2-S1"]);
  });

  it("v6-default epic files and story files carry depends_on", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/planning-artifacts/epics/epic-1.md": "---\nid: 1\ntitle: One\n---\nBody",
        "_bmad-output/planning-artifacts/epics/epic-2.md": "---\nid: 2\ntitle: Two\ndepends_on: [1]\n---\nBody",
        "_bmad-output/implementation-artifacts/sprint-status.yaml": "development_status:\n  1-1-a: backlog\n  2-1-b: backlog\n",
        "_bmad-output/implementation-artifacts/1-1-a.md": "# Story 1.1: A\n\nStatus: backlog\n",
        "_bmad-output/implementation-artifacts/2-1-b.md": "---\ndepends_on: 1-1\n---\n# Story 2.1: B\n\nStatus: backlog\n",
      }),
    ))!;
    expect(p.layout.id).toBe("v6-default");
    expect(p.epics.find((e) => e.id === "2")!.after).toEqual([{ id: "1" }]);
    expect(storyDeps(p.stories.find((s) => s.id === "2.1")!)).toEqual(["1.1"]);
  });

  it("v4 story and epic frontmatter carry dependencies", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        ".bmad-core/core-config.yaml": "x: 1",
        "docs/prd.md": "# PRD",
        "docs/epics/epic-1-setup.md": "---\nid: 1\ntitle: Setup\n---\nBody",
        "docs/epics/epic-2-next.md": "---\nid: 2\ntitle: Next\nafter: 1\n---\nBody",
        "docs/stories/1.1.first.md": "# Story 1.1: First\n\nStatus: Approved\n",
        "docs/stories/2.1.second.md": "---\ndependsOn: [1.1]\n---\n# Story 2.1: Second\n\nStatus: Approved\n",
      }),
    ))!;
    expect(p.layout.id).toBe("v4");
    expect(p.epics.find((e) => e.id === "2")!.after).toEqual([{ id: "1" }]);
    expect(storyDeps(p.stories.find((s) => s.id === "2.1")!)).toEqual(["1.1"]);
  });
});
