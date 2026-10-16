import { describe, it, expect } from "vitest";
import type { ContentProvider } from "@/lib/content-provider";
import type { RepoConfig } from "@/lib/types";
import { getBmadProject } from "../parser";
import { parseStory, extractCriteria } from "../parse-story";
import { parseEpicFile } from "../parse-epic-file";
import { parseEpics } from "../parse-epics";
import { SUMMARY_CHARS } from "../body";
import { epicsForList, storiesForList } from "../list-view";

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

const TABLE = [
  "| Story | Title | Priority |",
  "|---|---|---|",
  "| **E14-S1** | KYC stub removal | 🟡 High |",
].join("\n");

describe("description (plain summary) vs body (full markdown)", () => {
  it("v6-project: whatsapp-like epic file", async () => {
    const long = "Filler sentence with `code`. ".repeat(40);
    const epic = `---\nepic_id: E14\nname: Alpha\n---\n\n# E14: Alpha\n\n**Epic:** E14 goal with [a link](x.md).\n\n${long}\n\n## Stories\n\n${TABLE}\n`;
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/epics/E14-alpha.md": epic,
        ".agentic/epics/E14-alpha/E14-S1-kyc/spec.md":
          "---\nstory_id: E14-S1\nepic_id: E14\nname: KYC\n---\n\n# E14-S1: KYC\n\n## User Story\n\nAs a **user** I want `kyc` gone.\n\n## Acceptance Criteria\n\n- **The daily limit is 3000**\n  - nested `a`\n- second\n",
        "_bmad/core/config.yaml": 'output_folder: "{project-root}/_bmad-output"',
      }),
    ))!;
    const e = p.epics.find((x) => x.id === "E14")!;
    expect(e.description.length).toBeLessThanOrEqual(SUMMARY_CHARS);
    expect(e.description).not.toMatch(/[*`|]|\]\(/);
    expect(e.description).toContain("E14 goal with a link");
    expect(e.body).toContain(TABLE);
    expect(e.body).not.toMatch(/^# E14/m);
    expect(e.body).not.toContain("epic_id:");
    expect(e.sourcePath).toBe("_bmad-output/epics/E14-alpha.md");

    const s = p.stories.find((x) => x.id === "E14-S1")!;
    expect(s.description).toBe("As a user I want kyc gone.");
    expect(s.body).toContain("As a **user** I want `kyc` gone.");
    expect(s.body).not.toContain("Acceptance Criteria");
    expect(s.acceptanceCriteria).toEqual(["**The daily limit is 3000**\n  - nested `a`", "second"]);

    const listE = epicsForList(p.epics);
    const listS = storiesForList(p.stories);
    expect(listE.every((x) => x.body === undefined)).toBe(true);
    expect(listS.every((x) => x.body === undefined)).toBe(true);
    expect(p.epics.find((x) => x.id === "E14")!.body).toBeDefined();
  });

  it("ticket-tree: epic description section and plain ticket descriptions", async () => {
    const p = (await getBmadProject(
      config,
      fake({
        "_bmad-output/initiative-a/tickets.toml": '[[epic]]\nid = 1\nslug = "one"\ntitle = "One"\n',
        "_bmad-output/initiative-a/one/one.md": `# One\n\n## Description\n\nThe **epic** goal.\n\n${TABLE}\n\n## Other\n\nx\n`,
        "_bmad-output/initiative-a/one/tickets.toml":
          '[[entry]]\nid = 1\ntitle = "A"\ndescription = "Do the `thing`."\nverify = "Run **tests**"\n',
      }),
    ))!;
    const e = p.epics[0];
    expect(e.description).toBe("The epic goal.");
    expect(e.body).toContain(TABLE);
    expect(e.body).not.toContain("## Other");
    expect(e.sourcePath).toBe("_bmad-output/initiative-a/one/one.md");
    const s = p.stories[0];
    expect(s.description).toBe("Do the thing.");
    expect(s.body).toBe("Do the `thing`.");
    expect(s.acceptanceCriteria).toEqual(["Run **tests**"]);
  });

  it("parseEpicFile / parseEpics keep the full markdown in body", () => {
    const md = `---\nid: 1\ntitle: T\n---\n# T\n\nIntro.\n\n${TABLE}\n\n${"x ".repeat(600)}`;
    const e = parseEpicFile(md, "epic-1.md")!;
    expect(e.description).toBe("Intro.");
    expect(e.body).toContain(TABLE);
    expect(e.body!.length).toBeGreaterThan(1000);

    const multi = parseEpics(`## Epic 1: A\n\nFirst **a**.\n\n${TABLE}\n\n## Epic 2: B\n\nSecond.\n`).epics;
    expect(multi[0].description).toBe("First a.");
    expect(multi[0].body).toContain(TABLE);
    expect(multi[1].body).toBe("Second.");
  });

  it("parseStory keeps a long body whole and a short plain description", () => {
    const md = `# Story 1.1: T\n\nStatus: done\n\n${"Para **bold** text. ".repeat(200)}\n\n## Acceptance Criteria\n\n1. one\n`;
    const s = parseStory(md, "1-1-t.md")!;
    expect(s.description.length).toBeLessThanOrEqual(SUMMARY_CHARS);
    expect(s.description).not.toContain("*");
    expect(s.body!.length).toBeGreaterThan(3000);
    expect(s.body).not.toMatch(/^Status:/m);
  });

  it("extractCriteria keeps nested bullets and Given/And/Then lines", () => {
    expect(extractCriteria("1. a\n   - sub\n2. b\n**Given** x\n**Then** y")).toEqual([
      "a\n   - sub",
      "b",
      "**Given** x",
      "**Then** y",
    ]);
  });
});
