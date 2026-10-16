import type { Epic, EpicStatus, ParseErrorEntry, SprintStatus } from "../types";
import { parseSprintStatus } from "../parse-sprint-status";
import { parseEpics } from "../parse-epics";
import { parseEpicFile } from "../parse-epic-file";
import { parseStory } from "../parse-story";
import { parseEpicFolderName } from "../parse-epic-folder";
import { mapLimit, READ_CONCURRENCY } from "../concurrency";
import { emptyResult, inOutput, type LayoutAdapter, type LayoutContext, type LayoutResult } from "./types";

const PLANNING = "planning-artifacts";
const IMPLEMENTATION = "implementation-artifacts";

type ParsedStory = NonNullable<ReturnType<typeof parseStory>>;

/** The BMad v6 default sources inside the output folder (also used by detect). */
function sources(ctx: LayoutContext) {
  const bmadPaths = ctx.paths.filter((p) => inOutput(ctx, p));

  const sprintStatusPath = bmadPaths.find(
    (p) => p.includes(IMPLEMENTATION) && p.endsWith("sprint-status.yaml"),
  );

  // Single file first, then directory. The single file lives directly under
  // planning-artifacts/ — NOT inside a subfolder (otherwise an epic-folder's
  // epic.md would be captured here).
  const epicsPath = bmadPaths.find(
    (p) => p.endsWith("/" + PLANNING + "/epics.md") || p.endsWith("/" + PLANNING + "/epic.md"),
  );

  const epicsDir = "/" + PLANNING + "/epics/";
  const allEpicsDirPaths = bmadPaths.filter((p) => p.includes(epicsDir) && p.endsWith(".md"));

  // Split by depth: flat (epic-1.md) vs nested (epic-1/<file>.md)
  const flatEpicPaths: string[] = [];
  const folderEpicMap = new Map<string, string[]>();
  for (const p of allEpicsDirPaths) {
    const rel = p.slice(p.indexOf(epicsDir) + epicsDir.length);
    const parts = rel.split("/");
    if (parts.length === 1) {
      if (/^(?:epic[_-]?)?\d+/i.test(parts[0])) flatEpicPaths.push(p);
    } else {
      const folder = parts[0];
      if (!folderEpicMap.has(folder)) folderEpicMap.set(folder, []);
      folderEpicMap.get(folder)!.push(p);
    }
  }

  const implStoryPaths = bmadPaths.filter((p) => {
    if (!p.includes(IMPLEMENTATION) || !p.endsWith(".md")) return false;
    const filename = p.split("/").pop() || "";
    if (/^\d+-\d+-.+\.md$/.test(filename)) return true;
    if (/^story[_-]?\d/i.test(filename)) return true;
    return false;
  });

  return { bmadPaths, sprintStatusPath, epicsPath, flatEpicPaths, folderEpicMap, implStoryPaths };
}

interface EpicFolderEntry {
  folder: string;
  id: string;
  title: string;
  metaPath: string | null;
  storyPaths: string[];
}

export const v6DefaultAdapter: LayoutAdapter = {
  id: "v6-default",
  label: "BMad v6 · default",
  extraRoots: [],

  lookedFor(outputDir) {
    return [
      `${outputDir}/planning-artifacts/epics.md`,
      `${outputDir}/planning-artifacts/epics/`,
      `${outputDir}/implementation-artifacts/sprint-status.yaml`,
      `${outputDir}/implementation-artifacts/<n>-<n>-<title>.md`,
    ];
  },

  detect(ctx) {
    const s = sources(ctx);
    const hasEpicSource =
      Boolean(s.epicsPath) ||
      s.flatEpicPaths.length > 0 ||
      [...s.folderEpicMap.keys()].some((f) => parseEpicFolderName(f));
    if (hasEpicSource || s.implStoryPaths.length > 0) return 70;
    // A bare sprint-status.yaml still yields stories, but ranks below a ticket tree.
    return s.sprintStatusPath ? 50 : 0;
  },

  async load(ctx): Promise<LayoutResult> {
    const result = emptyResult();
    const s = sources(ctx);

    const epicFolders: EpicFolderEntry[] = [];
    const epicIdByStoryPath = new Map<string, string>();
    for (const [folder, paths] of s.folderEpicMap) {
      const derived = parseEpicFolderName(folder);
      if (!derived) continue;
      const metaPath = paths.find((p) => p.endsWith("/epic.md")) ?? null;
      const innerStories = paths.filter((p) => !p.endsWith("/epic.md"));
      epicFolders.push({ folder, id: derived.id, title: derived.title, metaPath, storyPaths: innerStories });
      for (const sp of innerStories) epicIdByStoryPath.set(sp, derived.id);
    }

    // Epic file paths = flat files + folder meta files (if no single epics.md)
    const epicFilePaths = s.epicsPath
      ? []
      : [...s.flatEpicPaths, ...epicFolders.filter((e) => e.metaPath).map((e) => e.metaPath as string)];
    const derivedFolderEpics = s.epicsPath ? [] : epicFolders.filter((e) => !e.metaPath);

    // Stories: implementation-artifacts (legacy) ∪ epic-folder-inner stories
    const folderStoryPaths = s.epicsPath ? [] : epicFolders.flatMap((e) => e.storyPaths);
    const storyPaths = Array.from(new Set([...s.implStoryPaths, ...folderStoryPaths]));
    result.storyPaths = storyPaths;

    const jobs: { key: string; path: string }[] = [];
    if (s.sprintStatusPath) jobs.push({ key: "sprint", path: s.sprintStatusPath });
    if (s.epicsPath) jobs.push({ key: "epics", path: s.epicsPath });
    for (const ep of epicFilePaths) jobs.push({ key: `epic-file:${ep}`, path: ep });
    for (const sp of storyPaths) jobs.push({ key: `story:${sp}`, path: sp });

    const results = await mapLimit(jobs, READ_CONCURRENCY, async (job) => {
      try {
        return { key: job.key, content: await ctx.readFile(job.path), error: null as string | null };
      } catch (e) {
        return { key: job.key, content: "", error: e instanceof Error ? e.message : "Read failed" };
      }
    });

    const parseErrors: ParseErrorEntry[] = [];
    let sprintStatus: SprintStatus | null = null;
    let epicStatuses: { id: string; status: EpicStatus }[] = [];
    let rawEpics: Epic[] = [];
    const rawStories: ParsedStory[] = [];
    const epicByMetaPath = new Map<string, Epic>();
    const storyByPath = new Map<string, ParsedStory>();
    let totalFiles = 0;

    for (const e of derivedFolderEpics) {
      rawEpics.push({
        id: e.id,
        title: e.title || `Epic ${e.id}`,
        description: "",
        status: "not-started",
        stories: [],
        totalStories: 0,
        completedStories: 0,
        progressPercent: 0,
      });
    }

    for (const { key, content, error } of results) {
      totalFiles++;
      const file = key === "sprint" ? s.sprintStatusPath! : key === "epics" ? s.epicsPath! : key.replace(/^(?:epic-file|story):/, "");
      const contentType =
        key === "sprint" ? "sprint-status" : key.startsWith("story:") ? "story" : "epic";
      if (error !== null) {
        parseErrors.push({ file, error: `Could not read the file: ${error}`, contentType });
        continue;
      }
      if (key === "sprint") {
        const parsed = parseSprintStatus(content);
        if (parsed) {
          sprintStatus = parsed.sprintStatus;
          epicStatuses = parsed.epicStatuses;
        } else {
          parseErrors.push({ file, error: "Failed to parse sprint status YAML. Check the file syntax.", contentType });
        }
      } else if (key === "epics") {
        const parsed = parseEpics(content);
        rawEpics = parsed.epics;
        if (parsed.error) parseErrors.push({ file, error: parsed.error, contentType });
      } else if (key.startsWith("epic-file:")) {
        const filename = file.split("/").pop() || "";
        const epic = parseEpicFile(content, filename);
        if (epic) {
          rawEpics.push(epic);
          epicByMetaPath.set(file, epic);
        } else {
          parseErrors.push({ file, error: "Failed to parse individual epic file. Check format (frontmatter or heading).", contentType });
        }
      } else {
        const filename = file.split("/").pop() || "";
        const story = parseStory(content, filename);
        if (story) {
          const folderEpicId = epicIdByStoryPath.get(file);
          if (folderEpicId) {
            // Story lives inside epic-N/ — fix epicId and (re)build composite id
            story.epicId = folderEpicId;
            if (!story.id.includes(".")) story.id = `${folderEpicId}.${story.id}`;
          }
          rawStories.push(story);
          storyByPath.set(file, story);
        } else {
          parseErrors.push({ file, error: "Failed to parse story. Check the markdown format and section structure.", contentType });
        }
      }
    }

    // Reconcile epic id when epic.md frontmatter declared a different id than
    // the folder name implied.
    for (const ef of epicFolders) {
      if (!ef.metaPath) continue;
      const parsedEpic = epicByMetaPath.get(ef.metaPath);
      if (!parsedEpic || parsedEpic.id === ef.id) continue;
      const oldPrefix = ef.id + ".";
      const newPrefix = parsedEpic.id + ".";
      for (const sp of ef.storyPaths) {
        const story = storyByPath.get(sp);
        if (!story) continue;
        story.epicId = parsedEpic.id;
        if (story.id.startsWith(oldPrefix)) story.id = newPrefix + story.id.slice(oldPrefix.length);
      }
    }

    return {
      ...result,
      epics: rawEpics,
      stories: rawStories,
      sprintStatus,
      epicStatuses,
      parseErrors,
      totalFiles,
    };
  },
};
