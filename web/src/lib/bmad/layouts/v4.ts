import matter from "gray-matter";
import type { Epic, StoryDetail } from "../types";
import { humanizeSlug } from "../ids";
import { isExcludedStatus, normalizeStoryStatus } from "../utils";
import { mapLimit, READ_CONCURRENCY } from "../concurrency";
import { parseStory } from "../parse-story";
import { plainSummary } from "../body";
import { parseEpics } from "../parse-epics";
import { parseEpicFile } from "../parse-epic-file";
import { emptyResult, hasRoot, type LayoutAdapter, type LayoutContext, type LayoutResult } from "./types";

/**
 * BMAD v4 (`.bmad-core/`), minimal and fixture-tested only (no real v4 project to test on):
 *   docs/prd.md, docs/architecture.md
 *   docs/epics/epic-N*.md, docs/epic-N*.md      one file per epic ("## Epic N: Title" or frontmatter)
 *   docs/prd.md / docs/epics.md                 sharded or single "## Epic N: Title" headings
 *   docs/stories/N.M.<slug>.md                  story files with a "Status:" line (or "## Status" section)
 */

const DOCS = "docs";

const EPIC_FILE = /^docs\/(?:epics\/)?epic[-_ ]?\d+[^/]*\.md$/i;
const STORY_FILE = /^docs\/stories\/(\d+)\.(\d+)(?:[.\-_ ](.*))?\.md$/i;

function epicFiles(ctx: LayoutContext): string[] {
  return ctx.paths.filter((p) => EPIC_FILE.test(p));
}

function storyFiles(ctx: LayoutContext): string[] {
  return ctx.paths.filter((p) => STORY_FILE.test(p));
}

/** "## Status\n\nApproved" or "Status: Done" -> the status word. */
function v4Status(body: string): string | undefined {
  const section = body.match(/^##\s+Status\s*\n+\s*([^\n]+)/im);
  if (section) return section[1].replace(/[*_`]/g, "").trim();
  return body.match(/^\**Status:?\**:?\s*(.+)/im)?.[1]?.replace(/[*_`]/g, "").trim();
}

/** v4 story statuses: Draft, Approved, InProgress, Review, Done. */
function normalizeV4(raw: string | undefined) {
  const s = (raw ?? "").toLowerCase().replace(/[\s_]+/g, "-");
  if (s === "approved") return "ready-for-dev" as const;
  if (s === "inprogress") return "in-progress" as const;
  return normalizeStoryStatus(s);
}

export const v4Adapter: LayoutAdapter = {
  id: "v4",
  label: "BMAD v4",
  extraRoots: [DOCS],

  lookedFor() {
    return ["docs/epics/epic-<n>*.md", "docs/epic-<n>*.md", "docs/prd.md (## Epic <n>)", "docs/stories/<n>.<n>.*.md"];
  },

  detect(ctx) {
    const hasCore = ctx.rootDirectories.includes(".bmad-core") || hasRoot(ctx, ".bmad-core");
    const hasDocs = ctx.rootDirectories.includes(DOCS) || ctx.paths.some((p) => p.startsWith("docs/"));
    const hasFiles = epicFiles(ctx).length > 0 || storyFiles(ctx).length > 0 || ctx.paths.includes("docs/prd.md");
    if (hasCore && hasDocs) return 40;
    return hasCore ? 30 : hasFiles && ctx.paths.includes("docs/prd.md") ? 20 : 0;
  },

  async load(ctx): Promise<LayoutResult> {
    const result = emptyResult();
    const epicPaths = epicFiles(ctx);
    const storyPaths = storyFiles(ctx);
    const headingSource = ["docs/epics.md", "docs/prd.md"].find((p) => ctx.paths.includes(p));

    const jobs = [
      ...epicPaths.map((path) => ({ kind: "epic" as const, path })),
      ...(epicPaths.length === 0 && headingSource ? [{ kind: "headings" as const, path: headingSource }] : []),
      ...storyPaths.map((path) => ({ kind: "story" as const, path })),
    ];
    const read = await mapLimit(jobs, READ_CONCURRENCY, async (job) => {
      try {
        return { ...job, content: await ctx.readFile(job.path), error: null as string | null };
      } catch (e) {
        return { ...job, content: "", error: e instanceof Error ? e.message : "Read failed" };
      }
    });

    const epics: Epic[] = [];
    const stories: StoryDetail[] = [];
    const excluded: string[] = [];
    for (const r of read) {
      result.totalFiles++;
      if (r.error !== null) {
        result.parseErrors.push({ file: r.path, error: `Could not read the file: ${r.error}`, contentType: r.kind === "story" ? "story" : "epic" });
        continue;
      }
      if (r.kind === "epic") {
        const epic = parseEpicFile(r.content, r.path.split("/").pop() ?? "");
        if (epic) epics.push({ ...epic, sourcePath: r.path });
        else result.parseErrors.push({ file: r.path, error: "Failed to parse individual epic file. Check format (frontmatter or heading).", contentType: "epic" });
      } else if (r.kind === "headings") {
        const parsed = parseEpics(r.content);
        epics.push(...parsed.epics);
      } else {
        const m = r.path.match(STORY_FILE)!;
        const { data: fm, content: body } = matter(r.content);
        const base = parseStory(r.content, r.path.split("/").pop() ?? "");
        const id = `${m[1]}.${m[2]}`;
        const raw = (typeof fm.status === "string" ? fm.status : undefined) ?? v4Status(body);
        if (isExcludedStatus(raw)) {
          excluded.push(id);
          continue;
        }
        const h1 = body.match(/^#\s+(?:Story\s+[\d.]+[:\s-]+)?(.+)/m)?.[1]?.trim();
        stories.push({
          ...(base ?? { acceptanceCriteria: [], tasks: [], completedTasks: 0, totalTasks: 0 }),
          id,
          epicId: m[1],
          title: (typeof fm.title === "string" && fm.title) || h1 || humanizeSlug(m[3] ?? "") || `Story ${id}`,
          status: normalizeV4(raw),
          statusExplicit: Boolean(raw),
          description: base?.description ?? plainSummary(body),
          ...(base?.body ? { body: base.body } : {}),
        });
        result.storyPaths.push(r.path);
      }
    }
    if (excluded.length) result.notes.push(`${excluded.length} dropped/retired stories are not counted: ${excluded.join(", ")}`);
    result.notes.push("BMAD v4 support is minimal");
    return { ...result, epics, stories };
  },
};
