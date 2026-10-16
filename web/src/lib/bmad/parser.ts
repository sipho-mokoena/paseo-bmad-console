import type { ContentProvider } from "@/lib/content-provider";
import type { BmadProject, LayoutInfo, ParseErrorEntry } from "./types";
import { correlate, computeProjectStats } from "./correlate";
import { buildFileTree } from "./utils";
import { compareEpicIds } from "./ids";
import { openProject } from "./scope";
import { LAYOUT_ADAPTERS } from "./layouts";
import { emptyResult, type LayoutResult } from "./layouts/types";
import type { RepoConfig } from "@/lib/types";
import type { ParsedBmadFile, BmadFileMetadata } from "./types";
import { normalizeStoryStatus } from "./utils";
import matter from "gray-matter";
import yaml from "js-yaml";

function hasContent(r: LayoutResult): boolean {
  return r.epics.length > 0 || r.stories.length > 0 || (r.sprintStatus?.stories.length ?? 0) > 0;
}

/**
 * Parse a full BMAD project using a ContentProvider abstraction.
 * Works with both GitHub repos and local folders.
 *
 * Layout detection: see layouts/index.ts. The best-scoring adapter that yields any
 * epics or stories wins; if none does, the best match is reported as not recognised.
 */
export async function getBmadProject(
  config: RepoConfig,
  provider: ContentProvider,
): Promise<BmadProject | null> {
  const { owner, name: repo, branch, displayName } = config;

  const scope = await openProject(provider);
  const { outputDir, paths: allPaths, ctx, candidates } = scope;
  const bmadPaths = allPaths.filter((p) => p.startsWith(outputDir + "/"));

  let chosen = candidates[0]?.adapter ?? null;
  let loaded: LayoutResult = emptyResult();
  for (const { adapter } of candidates) {
    const result = await adapter.load(ctx);
    if (hasContent(result)) {
      chosen = adapter;
      loaded = result;
      break;
    }
    if (adapter === candidates[0].adapter) loaded = result;
  }

  const parseErrors: ParseErrorEntry[] = loaded.parseErrors;
  const totalFiles = loaded.totalFiles;
  const successfulFiles = totalFiles - parseErrors.length;

  if (parseErrors.length > 0) {
    console.warn(`[BMAD Parse] ${owner}/${repo}: ${parseErrors.length} parsing errors out of ${totalFiles} files`);
  }

  const correlated = correlate(loaded.sprintStatus, loaded.epics, loaded.stories, loaded.epicStatuses);
  const epics = [...correlated.epics].sort((a, b) => compareEpicIds(a.id, b.id));
  const stories = correlated.stories;
  const sprintStatus = loaded.sprintStatus;
  const storyPathSet = new Set(loaded.storyPaths);
  const docPaths = bmadPaths.filter((p) => !storyPathSet.has(p));
  const fileTree = buildFileTree(docPaths, outputDir);

  // Detect a "Docs" folder (case-insensitive) via rootDirectories (F20)
  const docsFolderName = scope.rootDirectories.find((d) => d.toLowerCase() === "docs") ?? null;
  const docsTree = docsFolderName
    ? buildFileTree(allPaths.filter((p) => p.startsWith(docsFolderName + "/")), docsFolderName)
    : [];

  // Adapter-declared roots other than docs (e.g. ".agentic") get their own Library tree.
  const extraTrees = (chosen?.extraRoots ?? [])
    .filter((root) => root.toLowerCase() !== "docs")
    .map((root) => ({ root, tree: buildFileTree(allPaths.filter((p) => p.startsWith(root + "/")), root) }))
    .filter((t) => t.tree.length > 0);

  const recognised = chosen !== null && epics.length > 0;
  const lookedFor = recognised
    ? chosen!.lookedFor(outputDir)
    : Array.from(new Set(LAYOUT_ADAPTERS.flatMap((a) => a.lookedFor(outputDir))));
  const layout: LayoutInfo = {
    id: chosen?.id ?? "unknown",
    label: chosen?.label ?? "Unknown layout",
    notes: [...loaded.notes, ...scope.notes],
    recognised,
    lookedFor,
  };
  if (chosen && !recognised) {
    layout.notes.unshift(`${chosen.label} matched but no epics were found`);
  }
  if (!chosen) layout.notes.unshift("No known BMAD layout matched this project");

  const stats = computeProjectStats({
    owner,
    repo,
    branch,
    displayName,
    sprintStatus,
    epics,
    stories,
    fileTree,
    bmadFiles: bmadPaths,
    docsTree,
    docsFolderName,
    layout,
  });

  return {
    owner,
    repo,
    branch,
    displayName,
    sprintStatus,
    epics,
    stories,
    fileTree,
    bmadFiles: bmadPaths,
    docsTree,
    docsFolderName,
    parseHealth: {
      errors: parseErrors,
      totalFiles,
      successfulFiles,
    },
    layout,
    ...(extraTrees.length > 0 ? { extraTrees } : {}),
    ...stats,
  };
}

function normalizeStatus(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return normalizeStoryStatus(raw);
}

function extractMetadata(
  data: Record<string, unknown> | null | undefined,
): BmadFileMetadata | null {
  if (!data || typeof data !== "object") return null;

  const status = normalizeStatus(
    typeof data.status === "string" ? data.status : undefined,
  );
  const stepsCompleted = Array.isArray(data.stepsCompleted)
    ? data.stepsCompleted.map(String)
    : Array.isArray(data.steps_completed)
      ? data.steps_completed.map(String)
      : undefined;
  const lastStep =
    typeof data.lastStep === "string" || typeof data.lastStep === "number"
      ? data.lastStep
      : typeof data.last_step === "string" || typeof data.last_step === "number"
        ? data.last_step
        : undefined;
  const title = typeof data.title === "string" ? data.title : undefined;
  const completedAt =
    typeof data.completedAt === "string"
      ? data.completedAt
      : typeof data.completed_at === "string"
        ? data.completed_at
        : undefined;
  const workflowType =
    typeof data.workflowType === "string"
      ? data.workflowType
      : typeof data.workflow_type === "string"
        ? data.workflow_type
        : undefined;

  const hasAny =
    status ||
    stepsCompleted ||
    lastStep !== undefined ||
    title ||
    completedAt ||
    workflowType;

  if (!hasAny) return null;

  return {
    status,
    stepsCompleted,
    lastStep,
    title,
    completedAt,
    workflowType,
  };
}

/**
 * Parse a BMAD file based on its content type.
 * Pure function — no network calls, no side effects.
 */
export function parseBmadFile(
  content: string,
  contentType: "markdown" | "yaml" | "json" | "text",
): ParsedBmadFile {
  try {
    switch (contentType) {
      case "markdown": {
        const { data, content: body } = matter(content);
        const frontmatter =
          data && Object.keys(data).length > 0 ? data : null;
        return {
          contentType,
          frontmatter,
          metadata: extractMetadata(frontmatter),
          body,
          rawContent: content,
          parseError: null,
        };
      }
      case "yaml": {
        const parsed = yaml.load(content);
        const data =
          parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)
            : null;
        return {
          contentType,
          frontmatter: null,
          metadata: extractMetadata(data),
          body: content,
          rawContent: content,
          parseError: null,
        };
      }
      case "json": {
        const parsed = JSON.parse(content);
        return {
          contentType,
          frontmatter: null,
          metadata: null,
          body: JSON.stringify(parsed, null, 2),
          rawContent: content,
          parseError: null,
        };
      }
      case "text":
      default:
        return {
          contentType,
          frontmatter: null,
          metadata: null,
          body: content,
          rawContent: content,
          parseError: null,
        };
    }
  } catch (e) {
    return {
      contentType,
      frontmatter: null,
      metadata: null,
      body: content,
      rawContent: content,
      parseError: e instanceof Error ? e.message : "Parsing error",
    };
  }
}
