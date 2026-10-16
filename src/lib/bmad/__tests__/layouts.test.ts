import { describe, it, expect } from "vitest";
import type { ContentProvider } from "@/lib/content-provider";
import type { RepoConfig } from "@/lib/types";
import { getBmadProject } from "../parser";
import { detectLayout, detectLayouts } from "../layouts";
import { parseConfigContent, parseTomlConfigContent, getBmadConfig } from "../parse-config";
import {
  compareEpicIds,
  epicLabel,
  parseEpicId,
  parseStoryId,
  frontmatterEpicId,
  frontmatterTitle,
} from "../ids";
import { isExcludedStatus, normalizeStoryStatus } from "../utils";

const config = { owner: "local", name: "x", branch: "", displayName: "x", sourceType: "local" } as RepoConfig;

function fake(files: Record<string, string>, rootDirectories?: string[]): ContentProvider {
  return {
    async getTree() {
      const roots = rootDirectories ?? [...new Set(Object.keys(files).map((p) => p.split("/")[0]))];
      return { paths: Object.keys(files), rootDirectories: roots };
    },
    async getFileContent(p) {
      if (!(p in files)) throw new Error(`Not found: ${p}`);
      return files[p];
    },
    async validateRoot() {},
  };
}

const spec = (id: string, epic: string, status: string | null, extra = "") =>
  `---\nstory_id: ${id}\nepic_id: ${epic}\nname: Title of ${id}\n${status ? `status: ${status}\n` : ""}---\n\n# ${id}: Title of ${id}\n\n## User Story\n\nAs a user I want ${id}.\n\n## Acceptance Criteria\n\n1. first\n2. second\n\n- [x] done task\n- [ ] open task\n${extra}`;

const epicFile = (id: string, name: string) =>
  `---\nepic_id: ${id}\nname: ${name}\nstatus: planned\n---\n\n# ${id}: ${name}\n\n## Goal & Scope\n\nGoal of ${id}.\n`;

const projectFiles = (): Record<string, string> => ({
  "_bmad-output/epics/E1-foundations.md": epicFile("E1", "Foundations"),
  "_bmad-output/epics/E2-money.md": epicFile("E2", "Money"),
  "_bmad-output/epics/E10-late.md": epicFile("E10", "Late"),
  "_bmad-output/epics/DEFERRED-E10-eft.md": epicFile("DEFERRED-E10", "Eft"),
  "_bmad-output/implementation-artifacts/sprint-status.yaml": [
    "development_status:",
    "  E1: in-progress",
    "  E1-S1-first: done",
    "  E1-S2-second: review",
    "  E1-S3-third: backlog",
    "  E1-S4-fourth: done",
    "  E1-retrospective: optional",
    "  E2-S1-money-thing: ready-for-dev",
    "  DEFERRED-E10: backlog",
    "  DEFERRED-E10-S1-eft-one: draft",
    "  E2-S2-sprint-only-retired: retired",
  ].join("\n"),
  ".agentic/epics/E1-foundations/E1-S1-first/spec.md": spec("E1-S1", "E1", "done"),
  ".agentic/epics/E1-foundations/E1-S2-second/spec.md": spec("E1-S2", "E1", "done"), // disagrees with sprint (review)
  ".agentic/epics/E1-foundations/E1-S3-third/spec.md": spec("E1-S3", "E1", null), // falls back to sprint
  ".agentic/epics/E1-foundations/E1-S4-fourth/spec.md": spec("E1-S4", "E1", "retired"),
  ".agentic/epics/E1-foundations/E1-INDEX.md": "# index",
  ".agentic/epics/E2-money/E2-S1-money-thing/spec.md": spec("E2-S1", "E2", "superseded"),
  ".agentic/epics/DEFERRED-E10-eft/DEFERRED-E10-S1-eft-one/spec.md": spec("DEFERRED-E10-S1", "DEFERRED-E10", "partially-implemented"),
  ".agentic/epics/E20-no-flat-file/E20-S1-lonely/spec.md": spec("E20-S1", "E20", "reviewed"),
  "_bmad/core/config.yaml": 'output_folder: "{project-root}/_bmad-output"',
});

describe("v6-project layout", () => {
  it("parses epics, stories, statuses, exclusions and notes", async () => {
    const p = (await getBmadProject(config, fake(projectFiles())))!;
    expect(p.layout).toMatchObject({ id: "v6-project", recognised: true, label: "BMad v6 · project layout" });
    expect(p.epics.map((e) => e.id)).toEqual(["E1", "E2", "E10", "E20", "DEFERRED-E10"]);
    expect(p.epics.find((e) => e.id === "E1")!.title).toBe("Foundations");
    expect(p.epics.find((e) => e.id === "E20")!.title).toBe("No Flat File");
    expect(p.stories.map((s) => s.id)).toEqual(["E1-S1", "E1-S2", "E1-S3", "E20-S1", "DEFERRED-E10-S1"]);
    const st = Object.fromEntries(p.stories.map((s) => [s.id, s.status]));
    expect(st).toEqual({
      "E1-S1": "done",
      "E1-S2": "done", // spec wins over sprint "review"
      "E1-S3": "backlog", // sprint fallback
      "E20-S1": "review",
      "DEFERRED-E10-S1": "in-progress",
    });
    expect(p.totalStories).toBe(5);
    expect(p.completedStories).toBe(2);
    expect(p.inProgressStories).toBe(1);
    const joined = p.layout.notes.join("\n");
    expect(joined).toMatch(/3 retired\/superseded stories are not counted: .*E1-S4 \(retired\).*E2-S1 \(superseded\).*E2-S2 \(retired\)/);
    expect(joined).toMatch(/E1-S2 \(spec done, sprint review\)/);
    const s1 = p.stories.find((s) => s.id === "E1-S1")!;
    expect(s1.title).toBe("Title of E1-S1");
    expect(s1.description).toBe("As a user I want E1-S1.");
    expect(s1.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(s1.totalTasks).toBe(2);
    expect(s1.epicTitle).toBe("Foundations");
    expect(p.epics.find((e) => e.id === "E2")!.totalStories).toBe(0);
    expect(p.extraTrees?.[0].root).toBe(".agentic");
  });

  it("reads story ids from spec folders without a flat epic file and dedupes copies", async () => {
    const files = projectFiles();
    files[".agentic/epics/money-path-remediation-program/E1-S1-first/spec.md"] = spec("E1-S1", "E1", "backlog");
    const p = (await getBmadProject(config, fake(files)))!;
    expect(p.stories.filter((s) => s.id === "E1-S1")).toHaveLength(1);
    expect(p.layout.notes.join("\n")).toMatch(/exist twice.*E1-S1/);
  });

  it("detects from a bare .agentic root directory", () => {
    const ctx = { paths: [], rootDirectories: [".agentic"], outputDir: "_bmad-output", readFile: async () => "" };
    expect(detectLayout(ctx)?.id).toBe("v6-project");
  });
});

describe("v6-default layout (wrapped)", () => {
  it("still parses epics.md + sprint-status + N-N-title stories", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/planning-artifacts/epics.md": "## Epic 1: Setup\n\nStuff\n\n## Epic 2: Next\n",
        "_bmad-output/implementation-artifacts/sprint-status.yaml":
          "development_status:\n  epic-1: in-progress\n  1-1-init: done\n  1-2-more: backlog\n",
        "_bmad-output/implementation-artifacts/1-1-init.md": "# Story 1.1: Init\n\nStatus: done\n",
      }),
    ))!;
    expect(p.layout).toMatchObject({ id: "v6-default", recognised: true, label: "BMad v6 · default" });
    expect(p.epics.map((e) => e.id)).toEqual(["1", "2"]);
    expect(p.stories.map((s) => `${s.id}:${s.status}`)).toEqual(["1.1:done", "1.2:backlog"]);
    expect(p.stories[1].title).toBe("More");
    expect(p.completedStories).toBe(1);
  });
});

describe("ticket-tree layout (wrapped)", () => {
  it("counts epics and stories and keeps ticket metadata", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/initiative-a/tickets.toml": '[[epic]]\nid = 1\nslug = "one"\ntitle = "One"\n[[epic]]\nid = 2\nslug = "two"\ntitle = "Two"\n',
        "_bmad-output/initiative-a/one/tickets.toml": '[[entry]]\nid = 1\ntype = "feature"\ntitle = "A"\n[[entry]]\nid = 2\ntitle = "B"\nafter = [1]\n',
        "_bmad-output/initiative-a/one/feature-a-plan.md": "---\nticket: 1.1\nstatus: done\n---\n",
        "_bmad-output/initiative-a/two/tickets.toml": '[[entry]]\nid = 1\ntitle = "C"\n',
      }),
    ))!;
    expect(p.layout).toMatchObject({ id: "ticket-tree", label: "Ticket tree", recognised: true });
    expect(p.epics).toHaveLength(2);
    expect(p.stories).toHaveLength(3);
    expect(p.completedStories).toBe(1);
    expect(p.stories.find((s) => s.id === "1.2")!.ticket?.after).toEqual(["1.1"]);
  });
});

describe("v4 layout (fixture only)", () => {
  const files = {
    ".bmad-core/core-config.yaml": "x: 1",
    "docs/prd.md": "# PRD",
    "docs/architecture.md": "# Arch",
    "docs/epics/epic-1-setup.md": "---\nid: 1\ntitle: Setup\n---\nBody",
    "docs/epic-2-next.md": "## Epic 2: Next\n\nBody",
    "docs/stories/1.1.first.md": "# Story 1.1: First\n\n## Status\n\nDone\n\n## Acceptance Criteria\n\n1. ok\n",
    "docs/stories/1.2.second.md": "# Story 1.2: Second\n\nStatus: Approved\n",
    "docs/stories/2.1.third.md": "# Story 2.1: Third\n\n## Status\n\nInProgress\n",
  };
  it("parses epics and stories with v4 status words", async () => {
    const p = (await getBmadProject(config, fake(files)))!;
    expect(p.layout).toMatchObject({ id: "v4", recognised: true, label: "BMAD v4" });
    expect(p.epics.map((e) => e.id)).toEqual(["1", "2"]);
    expect(p.stories.map((s) => `${s.id}:${s.status}`)).toEqual(["1.1:done", "1.2:ready-for-dev", "2.1:in-progress"]);
    expect(p.stories[0].title).toBe("First");
  });
});

describe("detection and unrecognised layouts", () => {
  const ctx = (paths: string[], roots: string[] = []) => ({ paths, rootDirectories: roots, outputDir: "_bmad-output", readFile: async () => "" });

  it("orders by score: project > default > ticket tree > v4, stable on ties", () => {
    const all = ctx([
      "_bmad-output/epics/E1-a.md",
      "_bmad-output/planning-artifacts/epics.md",
      "_bmad-output/initiative-x/tickets.toml",
    ], [".bmad-core", "docs"]);
    expect(detectLayouts(all).map((c) => c.adapter.id)).toEqual(["v6-project", "v6-default", "ticket-tree", "v4"]);
    expect(detectLayout(ctx(["_bmad-output/initiative-x/tickets.toml"]))?.id).toBe("ticket-tree");
    const a = { id: "v4", label: "a", extraRoots: [], lookedFor: () => [], detect: () => 5, load: async () => { throw new Error(); } } as never;
    const b = { ...(a as object), id: "v6-default" } as never;
    expect(detectLayouts(ctx([]), [a, b]).map((c) => c.adapter.id)).toEqual(["v4", "v6-default"]);
  });

  it("falls through to the next adapter when the best finds nothing", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        ".agentic/README.md": "x",
        "_bmad-output/planning-artifacts/epics.md": "## Epic 1: Only\n",
      }, [".agentic", "_bmad-output"]),
    ))!;
    expect(p.layout.id).toBe("v6-default");
    expect(p.layout.recognised).toBe(true);
  });

  it("marks a project with only _bmad and a README as not recognised", async () => {
    const p = (await getBmadProject(config, fake({ "_bmad/core/config.yaml": "x: 1", "README.md": "hi" })))!;
    expect(p.layout.recognised).toBe(false);
    expect(p.layout.id).toBe("unknown");
    expect(p.layout.lookedFor.length).toBeGreaterThan(3);
    expect(p.layout.lookedFor.join(" ")).toContain("_bmad-output/planning-artifacts/epics.md");
    expect(p.epics).toEqual([]);
  });

  it("marks a matched layout with zero epics as not recognised", async () => {
    const p = (await getBmadProject(config, fake({ "_bmad-output/implementation-artifacts/sprint-status.yaml": "development_status: {}\n" })))!;
    expect(p.layout.recognised).toBe(false);
    expect(p.layout.notes[0]).toMatch(/no epics were found/);
  });
});

describe("output dir resolution", () => {
  const prov = (files: Record<string, string>) => fake(files);
  it("reads yaml, toml and the default", async () => {
    expect(parseConfigContent('output_folder: "{project-root}/out-y"')).toEqual({ outputDir: "out-y" });
    expect(parseTomlConfigContent('[core]\nproject_name = "p"\noutput_folder = "{project-root}/out-t"\n')).toEqual({ outputDir: "out-t" });
    expect(parseTomlConfigContent('[other.sub]\noutput_folder = "deep"\n')).toEqual({ outputDir: "deep" });
    expect(parseTomlConfigContent("[core]\nx = 1\n")).toBeNull();
    const y = prov({ "_bmad/core/config.yaml": "output_folder: yy" });
    expect((await getBmadConfig(y, ["_bmad/core/config.yaml"])).outputDir).toBe("yy");
    const t = prov({ "_bmad/config.toml": '[core]\noutput_folder = "tt"' });
    expect((await getBmadConfig(t, ["_bmad/config.toml"])).outputDir).toBe("tt");
    expect((await getBmadConfig(prov({}), [])).outputDir).toBe("_bmad-output");
  });
});

describe("ids", () => {
  it("parses epic ids", () => {
    expect(["E1", "DEFERRED-E10", "1", "epic-1", "Epic 3", "e7", "foo"].map(parseEpicId)).toEqual(["E1", "DEFERRED-E10", "1", "1", "3", "E7", null]);
  });
  it("parses story ids", () => {
    expect(parseStoryId("E1-S1")).toMatchObject({ id: "E1-S1", epicId: "E1" });
    expect(parseStoryId("E1-S1-slug-words.md")).toMatchObject({ id: "E1-S1", slug: "slug-words" });
    expect(parseStoryId("DEFERRED-E10-S3-x")).toMatchObject({ id: "DEFERRED-E10-S3", epicId: "DEFERRED-E10" });
    expect(parseStoryId("E2-S8b")).toMatchObject({ id: "E2-S8b" });
    expect(parseStoryId("1-1-slug")).toMatchObject({ id: "1.1", epicId: "1", slug: "slug" });
    expect(parseStoryId("1.2")).toMatchObject({ id: "1.2" });
    expect(parseStoryId("readme")).toBeNull();
  });
  it("reads frontmatter keys", () => {
    expect(frontmatterEpicId({ epicId: "E4" })).toBe("E4");
    expect(frontmatterEpicId({ epic: 2 })).toBe("2");
    expect(frontmatterEpicId({ id: "E9", epic_id: "E1" })).toBe("E1");
    expect(frontmatterTitle({ name: "N" })).toBe("N");
    expect(frontmatterTitle({ title: "T", name: "N" })).toBe("T");
  });
  it("sorts epics naturally with DEFERRED last", () => {
    const ids = ["DEFERRED-E10", "E10", "E2", "E1", "MPR-E1", "DEFERRED-E2", "E3"];
    expect([...ids].sort(compareEpicIds)).toEqual(["E1", "E2", "E3", "E10", "MPR-E1", "DEFERRED-E2", "DEFERRED-E10"]);
    expect(["10", "9", "1"].sort(compareEpicIds)).toEqual(["1", "9", "10"]);
    expect(epicLabel("1")).toBe("E1");
    expect(epicLabel("E1")).toBe("E1");
  });
});

describe("normalizeStoryStatus words", () => {
  const cases: [string, string][] = [
    ["done", "done"], ["complete", "done"], ["completed", "done"],
    ["in-progress", "in-progress"], ["started", "in-progress"], ["partially-implemented", "in-progress"],
    ["review", "review"], ["in-review", "review"], ["reviewed", "review"], ["built", "review"],
    ["blocked", "blocked"], ["ready", "ready-for-dev"], ["ready-for-dev", "ready-for-dev"],
    ["backlog", "backlog"], ["planned", "backlog"], ["draft", "backlog"], ["todo", "backlog"],
    ["pending", "backlog"], ["optional", "backlog"], ["whatever", "backlog"],
  ];
  it.each(cases)("%s -> %s", (raw, want) => expect(normalizeStoryStatus(raw)).toBe(want));
  it("flags excluded words", () => {
    for (const w of ["retired", "Superseded", "dropped", "deferred"]) expect(isExcludedStatus(w)).toBe(true);
    expect(isExcludedStatus("done")).toBe(false);
  });
});
