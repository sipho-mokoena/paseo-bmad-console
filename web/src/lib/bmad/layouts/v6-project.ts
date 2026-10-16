import matter from "gray-matter";
import type { Epic, EpicStatus, StoryDetail, SprintStoryEntry } from "../types";
import { parseSprintStatus, sprintRawStatuses } from "../parse-sprint-status";
import { parseStory } from "../parse-story";
import { markdownToPlainText } from "@/lib/markdown-text";
import { capBody, plainSummary, stripLeadingTitle } from "../body";
import { isExcludedStatus, normalizeStoryStatus } from "../utils";
import {
  compareEpicIds,
  compareStoryIds,
  frontmatterEpicId,
  frontmatterTitle,
  humanizeSlug,
  parseEpicId,
  parseStoryId,
  stripIdPrefix,
} from "../ids";
import { mapLimit, READ_CONCURRENCY } from "../concurrency";
import { emptyResult, hasRoot, inOutput, type LayoutAdapter, type LayoutContext, type LayoutResult } from "./types";

/**
 * BMad v6 install with a project-specific epic/story layout (seen in the wild):
 *   <out>/epics/E1-foundations.md                       one file per epic, frontmatter epic_id/name
 *   <out>/implementation-artifacts/sprint-status.yaml   development_status: E1, E1-S1-slug, ...
 *   .agentic/epics/<epic folder>/<E1-S1-slug>/spec.md   one spec per story, frontmatter status
 *   .agentic/specs/<E1-S1-slug>/spec.md                 same, flat variant
 * Statuses: a spec's explicit status wins, sprint-status.yaml is the fallback (as in v6 default).
 * retired / superseded / dropped / deferred stories are left out of every count and listed in notes.
 */

const AGENTIC = ".agentic";
const EPIC_FILE = /^((?:[A-Za-z]+-)*[Ee]\d+)(?:[-_.]|$)/;
/** Notes list at most this many ids before "+N more". */
const NOTE_IDS = 6;

function listIds(ids: string[]): string {
  const shown = ids.slice(0, NOTE_IDS).join(", ");
  return ids.length > NOTE_IDS ? `${shown} +${ids.length - NOTE_IDS} more` : shown;
}

function flatEpicFiles(ctx: LayoutContext): string[] {
  const prefix = `${ctx.outputDir}/epics/`;
  return ctx.paths.filter((p) => {
    if (!p.startsWith(prefix) || !p.endsWith(".md")) return false;
    const name = p.slice(prefix.length);
    return !name.includes("/") && EPIC_FILE.test(name);
  });
}

interface SpecRef {
  path: string;
  storyId: string;
  epicId: string;
  slug: string;
  /** Name of the epic folder it lives in (".agentic/epics/<folder>/..."), or "". */
  folder: string;
}

/** `.agentic/(epics|specs)/[<folder>/]<story dir>/spec.md` where the story dir is an E<n>-S<k> id. */
function specRefs(ctx: LayoutContext): SpecRef[] {
  const out: SpecRef[] = [];
  for (const p of ctx.paths) {
    if (!p.startsWith(AGENTIC + "/") || !p.endsWith("/spec.md")) continue;
    const parts = p.split("/");
    // .agentic / epics / <folder> / <story dir> / spec.md   (5)
    // .agentic / specs / <story dir> / spec.md              (4)
    if (parts.length !== 5 && parts.length !== 4) continue;
    if (parts[1] !== "epics" && parts[1] !== "specs") continue;
    const dir = parts[parts.length - 2];
    const id = parseStoryId(dir);
    if (!id || !id.id.includes("-S")) continue;
    out.push({
      path: p,
      storyId: id.id,
      epicId: id.epicId,
      slug: id.slug,
      folder: parts.length === 5 ? parts[2] : "",
    });
  }
  return out;
}

/** `<out>/implementation-artifacts/E<n>-S<k>-slug.md` story files that are not pointers to another file. */
function implementationStoryFiles(ctx: LayoutContext): { path: string; id: string }[] {
  const prefix = `${ctx.outputDir}/implementation-artifacts/`;
  const out: { path: string; id: string }[] = [];
  for (const p of ctx.paths) {
    if (!p.startsWith(prefix) || !p.endsWith(".md")) continue;
    const name = p.slice(prefix.length);
    if (name.includes("/")) continue;
    const id = parseStoryId(name);
    if (id && id.id.includes("-S")) out.push({ path: p, id: id.id });
  }
  return out;
}

/** Epic folders under `.agentic/epics/`: folder name -> epic id (only names like "E1-foundations"). */
function epicFolders(ctx: LayoutContext): Map<string, string> {
  const folders = new Map<string, string>();
  for (const p of ctx.paths) {
    if (!p.startsWith(AGENTIC + "/epics/")) continue;
    const parts = p.split("/");
    if (parts.length < 4) continue;
    const folder = parts[2];
    if (folders.has(folder)) continue;
    const m = folder.match(EPIC_FILE);
    const id = m ? parseEpicId(m[1]) : null;
    if (id) folders.set(folder, id);
  }
  return folders;
}

/** First paragraph of the first "summary-like" section, else of the text after the H1. Capped. */
export function summarizeSpec(body: string, max = 1000): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const isHeading = (l: string) => /^#{1,6}\s/.test(l);
  const take = (from: number): string => {
    const out: string[] = [];
    let started = false;
    for (let i = from; i < lines.length; i++) {
      const l = lines[i];
      if (isHeading(l)) {
        if (started || out.length) break;
        continue;
      }
      if (!l.trim()) {
        if (started && out.length > 0 && !/^\s*[-*\d]/.test(out[out.length - 1])) break;
        if (started) out.push("");
        continue;
      }
      started = true;
      out.push(l);
    }
    return out.join("\n").trim();
  };
  const wanted = /^#{2,3}\s+(?:user story|story|summary|goal(?: & scope)?|problem|overview|context|description)\b/i;
  const at = lines.findIndex((l) => wanted.test(l));
  if (at >= 0) {
    const text = take(at + 1);
    if (text) return text.slice(0, max);
  }
  const h1 = lines.findIndex((l) => /^#\s/.test(l));
  return take(h1 >= 0 ? h1 + 1 : 0).slice(0, max);
}

function firstH1(body: string): string | undefined {
  return body.match(/^#\s+(.+)/m)?.[1]?.trim();
}

function rawStatusOf(fm: Record<string, unknown>, body: string): string | undefined {
  const v = fm.status ?? fm.state;
  if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  return body.match(/^Status:\s*(.+)/im)?.[1]?.trim();
}

interface EpicSeed {
  id: string;
  title?: string;
  description?: string;
  body?: string;
  sourcePath?: string;
  folder?: string;
}

export const v6ProjectAdapter: LayoutAdapter = {
  id: "v6-project",
  label: "BMad v6 · project layout",
  extraRoots: [AGENTIC, "docs"],

  lookedFor(outputDir) {
    return [
      `${outputDir}/epics/E<n>-<slug>.md`,
      `${AGENTIC}/epics/<epic>/<E<n>-S<k>-slug>/spec.md`,
      `${outputDir}/implementation-artifacts/sprint-status.yaml (development_status: E<n>, E<n>-S<k>-slug)`,
    ];
  },

  detect(ctx) {
    if (flatEpicFiles(ctx).length > 0) return 90;
    // The local provider only lists .agentic after this adapter is chosen; the folder name is enough.
    if (hasRoot(ctx, AGENTIC) && (ctx.rootDirectories.includes(AGENTIC) || specRefs(ctx).length > 0)) return 75;
    return 0;
  },

  async load(ctx): Promise<LayoutResult> {
    const result = emptyResult();
    const notes: string[] = [];

    const flat = flatEpicFiles(ctx);
    const folders = epicFolders(ctx);
    const refs = specRefs(ctx);
    const implFiles = implementationStoryFiles(ctx);
    const sprintPath = ctx.paths.find(
      (p) => inOutput(ctx, p) && p.endsWith("/implementation-artifacts/sprint-status.yaml"),
    );

    // Dedupe specs by story id: prefer the one inside its own epic folder, then the first by path.
    const bestRef = new Map<string, SpecRef>();
    const duplicates: string[] = [];
    const rank = (r: SpecRef) => (r.folder.startsWith(r.epicId + "-") ? 0 : r.folder === "" ? 1 : 2);
    for (const r of [...refs].sort((a, b) => a.path.localeCompare(b.path))) {
      const have = bestRef.get(r.storyId);
      if (!have) bestRef.set(r.storyId, r);
      else {
        duplicates.push(r.storyId);
        if (rank(r) < rank(have)) bestRef.set(r.storyId, r);
      }
    }
    if (duplicates.length) {
      notes.push(`${duplicates.length} story spec(s) exist twice, the one inside the epic's own folder is used: ${listIds([...new Set(duplicates)])}`);
    }

    // Epic-level metadata for epics without a flat file: <folder>/spec.md, else <folder>/<ID>-INDEX.md
    const epicMeta = new Map<string, string>(); // epic id -> path to read
    const flatIds = new Set(flat.map((p) => parseEpicId((p.split("/").pop() ?? "").match(EPIC_FILE)?.[1] ?? "")));
    for (const [folder, id] of folders) {
      if (flatIds.has(id)) continue;
      const spec = `${AGENTIC}/epics/${folder}/spec.md`;
      const index = `${AGENTIC}/epics/${folder}/${id}-INDEX.md`;
      const hit = ctx.paths.includes(spec) ? spec : ctx.paths.includes(index) ? index : null;
      if (hit) epicMeta.set(id, hit);
    }

    const storyRefs = [...bestRef.values()];
    const implOnly = implFiles.filter((f) => !bestRef.has(f.id));

    const jobs: { key: string; path: string }[] = [];
    if (sprintPath) jobs.push({ key: "sprint", path: sprintPath });
    for (const p of flat) jobs.push({ key: `epic:${p}`, path: p });
    for (const [id, p] of epicMeta) jobs.push({ key: `meta:${id}`, path: p });
    for (const r of storyRefs) jobs.push({ key: `spec:${r.storyId}`, path: r.path });
    for (const f of implOnly) jobs.push({ key: `impl:${f.id}`, path: f.path });

    const read = await mapLimit(jobs, READ_CONCURRENCY, async (job) => {
      try {
        return { ...job, content: await ctx.readFile(job.path), error: null as string | null };
      } catch (e) {
        return { ...job, content: "", error: e instanceof Error ? e.message : "Read failed" };
      }
    });

    let sprintEntries: SprintStoryEntry[] = [];
    let sprintEpicStatuses: { id: string; status: EpicStatus }[] = [];
    let sprintMeta: ReturnType<typeof parseSprintStatus> = null;
    let sprintRaw = new Map<string, string>();
    const seeds = new Map<string, EpicSeed>();
    const seed = (id: string): EpicSeed => {
      let s = seeds.get(id);
      if (!s) seeds.set(id, (s = { id }));
      return s;
    };
    const specStories = new Map<string, { story: StoryDetail; raw?: string; path: string }>();

    for (const r of read) {
      result.totalFiles++;
      const contentType = r.key === "sprint" ? "sprint-status" : r.key.startsWith("epic:") || r.key.startsWith("meta:") ? "epic" : "story";
      if (r.error !== null) {
        result.parseErrors.push({ file: r.path, error: `Could not read the file: ${r.error}`, contentType });
        continue;
      }
      try {
        if (r.key === "sprint") {
          sprintMeta = parseSprintStatus(r.content);
          if (!sprintMeta) {
            result.parseErrors.push({ file: r.path, error: "Failed to parse sprint status YAML. Check the file syntax.", contentType });
          } else {
            sprintEntries = sprintMeta.sprintStatus.stories;
            sprintRaw = sprintRawStatuses(r.content);
            sprintEpicStatuses = sprintMeta.epicStatuses;
          }
        } else if (r.key.startsWith("epic:") || r.key.startsWith("meta:")) {
          const { data: fm, content: body } = matter(r.content);
          const name = r.path.split("/").pop() ?? "";
          const id =
            frontmatterEpicId(fm) ??
            parseEpicId(name.match(EPIC_FILE)?.[1] ?? "") ??
            (r.key.startsWith("meta:") ? r.key.slice(5) : null);
          if (!id) {
            result.parseErrors.push({ file: r.path, error: "Epic file has no epic id (frontmatter epic_id or an E<n> file name).", contentType });
            continue;
          }
          const s = seed(id);
          const rawTitle = frontmatterTitle(fm) ?? (firstH1(body) ? stripIdPrefix(firstH1(body)!) : undefined);
          const title = rawTitle ? markdownToPlainText(rawTitle) : undefined;
          // A flat epic file is the primary source; epic-level specs only fill gaps.
          if (r.key.startsWith("epic:") || !s.title) s.title = title ?? s.title;
          if (r.key.startsWith("epic:") || !s.description) s.description = plainSummary(summarizeSpec(body, 2000)) || s.description;
          if (r.key.startsWith("epic:") || !s.sourcePath) s.sourcePath = r.path;
          if (r.key.startsWith("epic:") || !s.body) s.body = capBody(stripLeadingTitle(body)) ?? s.body;
        } else {
          const filename = r.path.split("/").pop() ?? "";
          const id = r.key.slice(r.key.indexOf(":") + 1);
          const parsed = parseStory(r.content, filename);
          if (!parsed) {
            result.parseErrors.push({ file: r.path, error: "Failed to parse story. Check the markdown format and section structure.", contentType });
            continue;
          }
          const { data: fm, content: body } = matter(r.content);
          const sid = parseStoryId(id)!;
          const rawStatus = rawStatusOf(fm, body);
          const h1 = firstH1(body);
          const story: StoryDetail = {
            ...parsed,
            id: sid.id,
            epicId: sid.epicId,
            title: markdownToPlainText(frontmatterTitle(fm) ?? (h1 ? stripIdPrefix(h1) : "")) || humanizeSlug(sid.slug) || sid.id,
            status: normalizeStoryStatus(rawStatus),
            statusExplicit: Boolean(rawStatus),
            description: plainSummary(summarizeSpec(body, 2000)) || parsed.description,
          };
          specStories.set(sid.id, { story, raw: rawStatus, path: r.path });
          result.storyPaths.push(r.path);
        }
      } catch (e) {
        result.parseErrors.push({
          file: r.path,
          error: e instanceof Error ? e.message : "Failed to parse file.",
          contentType,
        });
      }
    }

    // Folder-derived epic seeds (titles from the folder slug) for epics that have no flat file.
    for (const [folder, id] of folders) {
      const s = seed(id);
      s.folder = folder;
      if (!s.title) s.title = humanizeSlug(folder.replace(EPIC_FILE, "").replace(/^[-_.]+/, "")) || undefined;
    }
    for (const e of sprintEpicStatuses) seed(e.id);

    // Merge statuses: explicit spec status wins, sprint-status.yaml is the fallback.
    const sprintById = new Map(sprintEntries.map((e) => [e.id, e]));
    const stories: StoryDetail[] = [];
    const entries: SprintStoryEntry[] = [];
    const excluded: string[] = [];
    const disagree: string[] = [];
    const ids = new Set([...specStories.keys(), ...sprintById.keys()]);
    let sprintOnly = 0;

    for (const id of [...ids].sort(compareStoryIds)) {
      const spec = specStories.get(id);
      const sprint = sprintById.get(id);
      const sid = parseStoryId(id)!;
      const sprintWord = sprintRaw.get(id);
      const rawFinal = spec?.raw ?? sprintWord;
      if (isExcludedStatus(rawFinal)) {
        excluded.push(`${id} (${rawFinal!.toLowerCase()})`);
        continue;
      }
      const status = normalizeStoryStatus(rawFinal);
      if (spec?.raw && sprint && normalizeStoryStatus(spec.raw) !== normalizeStoryStatus(sprintWord)) {
        disagree.push(`${id} (spec ${spec.raw}, sprint ${sprintWord})`);
      }
      let story: StoryDetail;
      if (spec) {
        story = { ...spec.story, status };
      } else {
        sprintOnly++;
        story = {
          id,
          title: humanizeSlug(sid.slug) || id,
          status,
          statusExplicit: false,
          epicId: sid.epicId,
          description: "",
          acceptanceCriteria: [],
          tasks: [],
          completedTasks: 0,
          totalTasks: 0,
        };
      }
      stories.push(story);
      entries.push({ id, title: sprint?.title ?? id, status, epicId: sid.epicId });
      seed(sid.epicId);
    }

    const epicStatusById = new Map(sprintEpicStatuses.map((e) => [e.id, e.status]));
    const epics: Epic[] = [...seeds.values()]
      .sort((a, b) => compareEpicIds(a.id, b.id))
      .map((s) => ({
        id: s.id,
        title: s.title ?? s.id,
        description: s.description ?? "",
        ...(s.body ? { body: s.body } : {}),
        ...(s.sourcePath ? { sourcePath: s.sourcePath } : {}),
        status: epicStatusById.get(s.id) ?? "not-started",
        stories: stories.filter((st) => st.epicId === s.id).map((st) => st.id),
        totalStories: 0,
        completedStories: 0,
        progressPercent: 0,
      }));

    if (excluded.length) {
      notes.push(`${excluded.length} retired/superseded stories are not counted: ${listIds(excluded)}`);
    }
    if (disagree.length) {
      notes.push(`${disagree.length} stories where the spec status differs from sprint-status.yaml (spec wins): ${listIds(disagree)}`);
    }
    if (sprintOnly > 0) notes.push(`${sprintOnly} sprint-status entries have no story spec`);
    if (stories.length > 0 && specStories.size === 0 && refs.length === 0) {
      notes.push("No story specs found; story data comes from sprint-status.yaml only");
    }

    return {
      ...result,
      epics,
      stories,
      sprintStatus: sprintMeta
        ? { ...(sprintMeta as NonNullable<typeof sprintMeta>).sprintStatus, stories: entries }
        : entries.length
          ? { stories: entries }
          : null,
      epicStatuses: sprintEpicStatuses,
      notes,
    };
  },
};
