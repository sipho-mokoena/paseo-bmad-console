"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { repoTag } from "@/lib/github/cache-tags";
import {
  createOctokit,
  getCachedRepoTree,
  getCachedRawContent,
  isRateLimitError,
  rateLimitMessage,
} from "@/lib/github/client";
import { LocalProvider } from "@/lib/content-provider/local-provider";
import { buildFileTree } from "@/lib/bmad/utils";
import { openProject } from "@/lib/bmad/scope";
import { parseBmadFile } from "@/lib/bmad/parser";
import {
  getBmadConfig,
  resolveBmadOutputDir,
  isPathOutsideNestedOutput,
  DEFAULT_OUTPUT_DIR,
} from "@/lib/bmad/parse-config";
import { prisma } from "@/lib/db/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { z } from "zod";
import { createHash } from "node:crypto";
import path from "node:path";
import type { FileTreeNode, ParsedBmadFile } from "@/lib/bmad/types";
import type { ActionResult } from "@/lib/types";
import { sanitizeError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

const BMAD_CORE = "_bmad";

// ---------------------------------------------------------------------------
// GitHub-only actions
// ---------------------------------------------------------------------------

// GitHub owner/repo names: letters, digits, ".", "_" and "-".
const GITHUB_NAME = /^[A-Za-z0-9._-]+$/;

const addGitHubRepoSchema = z.object({
  owner: z.string().min(1).max(100).trim().regex(GITHUB_NAME, "Invalid owner"),
  name: z.string().min(1).max(100).trim().regex(GITHUB_NAME, "Invalid repository name"),
  branch: z
    .string()
    .max(255)
    .trim()
    .optional()
    .transform((b) => (b ? b : undefined)),
});

/**
 * Register a GitHub repository by owner/name (and optionally a branch).
 * The repository is checked against the GitHub API first, using GITHUB_PAT when
 * set. Without a token only public repositories can be added.
 */
export async function addGitHubRepo(input: {
  owner: string;
  name: string;
  branch?: string;
}): Promise<
  ActionResult<{ id: string; owner: string; name: string; displayName: string }>
> {
  const parsed = addGitHubRepoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid data: " + parsed.error.issues[0].message,
      code: "VALIDATION_ERROR",
    };
  }
  const data = parsed.data;

  if (!checkRateLimit("add-github", 10, 60000)) {
    return { success: false, error: "Too many requests", code: "RATE_LIMIT" };
  }

  let description: string | null;
  let branch: string;
  try {
    const octokit = createOctokit();
    const { data: repoInfo } = await octokit.rest.repos.get({
      owner: data.owner,
      repo: data.name,
    });
    description = repoInfo.description ?? null;
    branch = data.branch ?? repoInfo.default_branch ?? "main";
    if (data.branch) {
      await octokit.rest.repos.getBranch({
        owner: data.owner,
        repo: data.name,
        branch: data.branch,
      });
    }
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      return { success: false, error: rateLimitMessage(), code: "RATE_LIMITED" };
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status: number }).status === 404
    ) {
      return {
        success: false,
        error: data.branch
          ? "Repository or branch not found. Private repositories need GITHUB_PAT on the server."
          : "Repository not found. Private repositories need GITHUB_PAT on the server.",
        code: "NOT_FOUND",
      };
    }
    return { success: false, error: sanitizeError(error, "GITHUB_ERROR"), code: "GITHUB_ERROR" };
  }

  try {
    const repo = await prisma.repo.create({
      data: {
        owner: data.owner,
        name: data.name,
        branch,
        displayName: data.name,
        description,
        sourceType: "github",
        lastSyncedAt: new Date(),
      },
      select: { id: true, owner: true, name: true, displayName: true },
    });

    revalidatePath("/(dashboard)");
    return { success: true, data: repo };
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "This repository is already added.",
        code: "DUPLICATE",
      };
    }
    return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
  }
}

// ---------------------------------------------------------------------------
// Source-type-aware actions (GitHub + Local)
// ---------------------------------------------------------------------------

const deleteRepoSchema = z.object({
  owner: z.string().min(1).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
});

/**
 * Delete a registered repo (GitHub or local).
 */
export async function deleteRepo(input: {
  owner: string;
  name: string;
}): Promise<ActionResult<{ deleted: boolean }>> {
  const parsed = deleteRepoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid data", code: "VALIDATION_ERROR" };
  }

  try {
    const deleted = await prisma.repo.deleteMany({
      where: { owner: parsed.data.owner, name: parsed.data.name },
    });

    if (deleted.count === 0) {
      return { success: false, error: "Repo not found", code: "NOT_FOUND" };
    }

    revalidatePath("/(dashboard)");
    return { success: true, data: { deleted: true } };
  } catch (error: unknown) {
    return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
  }
}

const refreshRepoSchema = z.object({
  owner: z.string().min(1).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
});

/**
 * Refresh repo data: re-fetch tree, count BMAD files, update lastSyncedAt.
 * Routes by sourceType for GitHub vs Local repos.
 */
export async function refreshRepoData(input: {
  owner: string;
  name: string;
}): Promise<ActionResult<{ totalFiles: number; lastSyncedAt: string }>> {
  const parsed = refreshRepoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid data", code: "VALIDATION_ERROR" };
  }

  try {
    const repoConfig = await prisma.repo.findFirst({
      where: { owner: parsed.data.owner, name: parsed.data.name },
      select: { id: true, branch: true, sourceType: true, localPath: true },
    });

    if (!repoConfig) {
      return { success: false, error: "Project not found", code: "NOT_FOUND" };
    }

    if (repoConfig.sourceType === "local") {
      return refreshLocalRepo(repoConfig);
    }

    return refreshGitHubRepo(parsed.data, repoConfig);
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      return {
        success: false,
        error: rateLimitMessage() + " Cached data is displayed.",
        code: "RATE_LIMITED",
      };
    }
    return { success: false, error: sanitizeError(error, "GITHUB_ERROR"), code: "GITHUB_ERROR" };
  }
}

async function refreshLocalRepo(
  repoConfig: { id: string; localPath: string | null },
): Promise<ActionResult<{ totalFiles: number; lastSyncedAt: string }>> {
  if (!repoConfig.localPath) {
    return { success: false, error: sanitizeError(null, "FS_ERROR"), code: "FS_ERROR" };
  }

  try {
    const provider = new LocalProvider(repoConfig.localPath);
    await provider.validateRoot();

    const initialTree = await provider.getTree();
    const { outputDir, paths } = await resolveBmadOutputDir(
      provider,
      initialTree.paths,
    );
    const totalFiles = paths.filter((p) => p.startsWith(outputDir + "/")).length;

    const now = new Date();
    await prisma.repo.update({
      where: { id: repoConfig.id },
      data: { lastSyncedAt: now, totalFiles },
    });

    // F8: Revalidate dashboard RSC
    revalidatePath("/(dashboard)");
    // F37: No revalidateTag for local repos (no unstable_cache)

    return { success: true, data: { totalFiles, lastSyncedAt: now.toISOString() } };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PATH_NOT_FOUND" || msg === "LOCAL_DISABLED") {
      return { success: false, error: sanitizeError(error, "PATH_STALE"), code: "PATH_STALE" };
    }
    return { success: false, error: sanitizeError(error, "FS_ERROR"), code: "FS_ERROR" };
  }
}

async function refreshGitHubRepo(
  input: { owner: string; name: string },
  repoConfig: { id: string; branch: string },
): Promise<ActionResult<{ totalFiles: number; lastSyncedAt: string }>> {
  const octokit = createOctokit();

  // Use the branch already configured for this repo — don't override it
  const syncBranch = repoConfig.branch;

  const { data: tree } = await octokit.rest.git.getTree({
    owner: input.owner,
    repo: input.name,
    tree_sha: syncBranch,
    recursive: "1",
  });

  const allPaths = tree.tree
    .filter((item) => item.type === "blob" && typeof item.path === "string")
    .map((item) => item.path as string);

  const ghProviderShim = {
    async getTree() {
      return { paths: allPaths, rootDirectories: [] };
    },
    async getFileContent(p: string) {
      return getCachedRawContent(
        octokit,
        input.owner,
        input.name,
        syncBranch,
        p,
      );
    },
    async validateRoot() {},
  };
  const { outputDir } = await getBmadConfig(ghProviderShim, allPaths);

  const totalFiles = allPaths.filter((p) => p.startsWith(outputDir + "/")).length;

  const now = new Date();
  await prisma.repo.update({
    where: { id: repoConfig.id },
    data: { lastSyncedAt: now, totalFiles },
  });

  // Invalidate the cache only after the fetch and DB update succeed. If
  // we did this before the fetch (as the previous version did), a
  // network error or 4xx from GitHub would leave the cache invalidated
  // with no recovery path until a future successful refresh.
  revalidateTag(repoTag(input.owner, input.name), "default");

  return { success: true, data: { totalFiles, lastSyncedAt: now.toISOString() } };
}

// ---------------------------------------------------------------------------
// BMAD file browsing Server Actions
// ---------------------------------------------------------------------------

const fetchBmadFilesSchema = z.object({
  owner: z.string().min(1).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
});

/**
 * Fetch the BMAD file tree for a repo.
 * Routes by sourceType for GitHub vs Local.
 */
export async function fetchBmadFiles(input: {
  owner: string;
  name: string;
}): Promise<
  ActionResult<{
    fileTree: FileTreeNode[];
    docsTree: FileTreeNode[];
    bmadCoreTree: FileTreeNode[];
    /** Layout-declared roots outside the output folder, e.g. ".agentic". */
    extraTrees: { root: string; tree: FileTreeNode[] }[];
    bmadFiles: string[];
  }>
> {
  const parsed = fetchBmadFilesSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid data", code: "VALIDATION_ERROR" };
  }

  const repoConfig = await prisma.repo.findFirst({
    where: { owner: parsed.data.owner, name: parsed.data.name },
    select: { branch: true, sourceType: true, localPath: true },
  });
  if (!repoConfig) {
    return { success: false, error: "Project not found", code: "NOT_FOUND" };
  }

  try {
    if (repoConfig.sourceType === "local") {
      if (!repoConfig.localPath) {
        return { success: false, error: sanitizeError(null, "FS_ERROR"), code: "FS_ERROR" };
      }
      return fetchBmadFilesLocal(repoConfig.localPath);
    }
    return fetchBmadFilesGitHub(parsed.data, repoConfig.branch);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PATH_NOT_FOUND" || msg === "LOCAL_DISABLED") {
      return { success: false, error: sanitizeError(error, "PATH_STALE"), code: "PATH_STALE" };
    }
    if (isRateLimitError(error)) {
      return {
        success: false,
        error: rateLimitMessage() + " Cached data is displayed.",
        code: "RATE_LIMITED",
      };
    }
    return { success: false, error: sanitizeError(error, "GITHUB_ERROR"), code: "GITHUB_ERROR" };
  }
}

async function fetchBmadFilesLocal(localPath: string) {
  const provider = new LocalProvider(localPath);
  await provider.validateRoot();
  // Opens the output folder and the roots the detected layout declares (e.g. .agentic, docs).
  const scope = await openProject(provider);
  const { outputDir, paths: allPaths } = scope;

  const bmadPaths = allPaths.filter((p) => p.startsWith(outputDir + "/"));
  const fileTree = buildFileTree(bmadPaths, outputDir);

  const bmadCorePaths = allPaths.filter((p) => p.startsWith(BMAD_CORE + "/"));
  const bmadCoreTree = buildFileTree(bmadCorePaths, BMAD_CORE);

  // F20/F35: Detect docs/ via rootDirectories
  const docsFolderName = scope.rootDirectories.find(
    (d) => d.toLowerCase() === "docs"
  ) ?? null;
  const docsTree = docsFolderName
    ? buildFileTree(
        allPaths.filter((p) => p.startsWith(docsFolderName + "/")),
        docsFolderName,
      )
    : [];

  // Adapter-declared roots other than docs (e.g. ".agentic") as extra Library trees.
  const declared = new Set(scope.candidates.flatMap((c) => c.adapter.extraRoots));
  const extraTrees = scope.openedRoots
    .filter((root) => declared.has(root) && root.toLowerCase() !== "docs")
    .map((root) => ({
      root,
      tree: buildFileTree(allPaths.filter((p) => p.startsWith(root + "/")), root),
    }))
    .filter((t) => t.tree.length > 0);

  return {
    success: true as const,
    data: { fileTree, docsTree, bmadCoreTree, extraTrees, bmadFiles: bmadPaths },
  };
}

async function fetchBmadFilesGitHub(
  input: { owner: string; name: string },
  branch: string,
) {
  const octokit = createOctokit();

  const tree = await getCachedRepoTree(
    octokit,
    input.owner,
    input.name,
    branch,
  );

  const allPaths: string[] = tree.tree
    .filter((item) => item.type === "blob" && typeof item.path === "string")
    .map((item) => item.path as string);

  const ghProviderShim = {
    async getTree() {
      return { paths: allPaths, rootDirectories: [] };
    },
    async getFileContent(p: string) {
      return getCachedRawContent(
        octokit,
        input.owner,
        input.name,
        branch,
        p,
      );
    },
    async validateRoot() {},
  };
  const { outputDir } = await getBmadConfig(ghProviderShim, allPaths);

  const bmadPaths = allPaths.filter((p) => p.startsWith(outputDir + "/"));
  const fileTree = buildFileTree(bmadPaths, outputDir);

  const bmadCorePaths = allPaths.filter((p) => p.startsWith(BMAD_CORE + "/"));
  const bmadCoreTree = buildFileTree(bmadCorePaths, BMAD_CORE);

  // F20/F35: Detect docs/ via rootDirectories (from tree items)
  const docsFolder = tree.tree.find(
    (item) =>
      item.type === "tree" &&
      !item.path.includes("/") &&
      item.path.toLowerCase() === "docs",
  );
  const docsFolderName = docsFolder?.path ?? null;
  const docsTree = docsFolderName
    ? buildFileTree(
        allPaths.filter((p) => p.startsWith(docsFolderName + "/")),
        docsFolderName,
      )
    : [];

  return { success: true as const, data: { fileTree, docsTree, bmadCoreTree, extraTrees: [] as { root: string; tree: FileTreeNode[] }[], bmadFiles: bmadPaths } };
}

const fetchFileContentSchema = z.object({
  owner: z.string().min(1).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
  path: z
    .string()
    .min(1)
    .max(1024)
    .trim()
    .refine((p) => !p.includes(".."), { message: "Invalid path" }),
});

/**
 * Fetch individual file content (lazy loading).
 * Routes by sourceType for GitHub vs Local.
 */
export async function fetchFileContent(input: {
  owner: string;
  name: string;
  path: string;
}): Promise<
  ActionResult<{
    content: string;
    contentType: "markdown" | "yaml" | "json" | "text";
  }>
> {
  const parsed = fetchFileContentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid data: " + parsed.error.issues[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  const repoConfig = await prisma.repo.findFirst({
    where: { owner: parsed.data.owner, name: parsed.data.name },
    select: { branch: true, sourceType: true, localPath: true },
  });
  if (!repoConfig) {
    return { success: false, error: "Project not found", code: "NOT_FOUND" };
  }

  const ext = parsed.data.path.split(".").pop()?.toLowerCase() ?? "";
  let contentType: "markdown" | "yaml" | "json" | "text" = "text";
  if (ext === "md") contentType = "markdown";
  else if (ext === "yaml" || ext === "yml") contentType = "yaml";
  else if (ext === "json") contentType = "json";

  try {
    let content: string;

    if (repoConfig.sourceType === "local") {
      if (!repoConfig.localPath) {
        return { success: false, error: sanitizeError(null, "FS_ERROR"), code: "FS_ERROR" };
      }
      const provider = new LocalProvider(repoConfig.localPath);
      // The default LocalProvider whitelist covers `_bmad` and `_bmad-output`.
      // When the project declares a custom (possibly nested) `output_folder`,
      // we extend the whitelist to its top-level segment so the provider can
      // read inside it — but the provider only validates by single segment.
      // Re-check the requested path here so a nested config like
      // `output_folder: custom/out` cannot be used to read `custom/secret.txt`.
      // openProject also opens the roots the detected layout declares (e.g. .agentic),
      // so the viewer can read them; the provider still refuses every other path.
      const { outputDir } = await openProject(provider);
      const requestedPath = parsed.data.path;
      if (
        outputDir !== DEFAULT_OUTPUT_DIR &&
        isPathOutsideNestedOutput(requestedPath, outputDir)
      ) {
        return {
          success: false,
          error: sanitizeError(null, "ACCESS_DENIED"),
          code: "ACCESS_DENIED",
        };
      }
      content = await provider.getFileContent(requestedPath);
    } else {
      const octokit = createOctokit();
      content = await getCachedRawContent(
        octokit,
        parsed.data.owner,
        parsed.data.name,
        repoConfig.branch,
        parsed.data.path,
      );
    }

    return { success: true, data: { content, contentType } };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PATH_NOT_FOUND" || msg === "LOCAL_DISABLED") {
      return { success: false, error: sanitizeError(error, "PATH_STALE"), code: "PATH_STALE" };
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error
    ) {
      const status = (error as { status: number }).status;
      if (status === 403 || status === 429) {
        return { success: false, error: rateLimitMessage(), code: "RATE_LIMITED" };
      }
      if (status === 404) {
        return { success: false, error: "File not found.", code: "NOT_FOUND" };
      }
    }
    return { success: false, error: sanitizeError(error, "GITHUB_ERROR"), code: "GITHUB_ERROR" };
  }
}

/**
 * Fetch and parse a BMAD file in a single server action call.
 */
export async function fetchParsedFileContent(input: {
  owner: string;
  name: string;
  path: string;
}): Promise<ActionResult<ParsedBmadFile>> {
  const result = await fetchFileContent(input);
  if (!result.success) return result;

  const parsed = parseBmadFile(result.data.content, result.data.contentType);
  return { success: true, data: parsed };
}

// ---------------------------------------------------------------------------
// Local folder import (Task 16)
// ---------------------------------------------------------------------------

const importLocalFolderSchema = z.object({
  localPath: z
    .string()
    .min(1)
    .max(4096)
    .trim()
    .refine((p) => !p.includes("\0"), { message: "Invalid path" }) // F12: null bytes
    .refine((p) => !/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(p), { message: "Invalid path" }), // F33
  displayName: z.string().min(1).max(255).trim().optional(),
});

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function sanitizeBasename(name: string): string {
  return name
    .replace(/[^a-z0-9-_]/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

/**
 * Import a local folder as a BMAD project.
 * F2: All FS operations go through LocalProvider (no direct fs calls).
 */
export async function importLocalFolder(input: {
  localPath: string;
  displayName?: string;
}): Promise<
  ActionResult<{ id: string; owner: string; name: string; displayName: string }>
> {
  // Guard: feature flag
  if (process.env.ENABLE_LOCAL_FS !== "true") {
    return { success: false, error: sanitizeError(null, "LOCAL_DISABLED"), code: "LOCAL_DISABLED" };
  }

  const parsed = importLocalFolderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid data: " + parsed.error.issues[0].message,
      code: "VALIDATION_ERROR",
    };
  }

  // F3: Rate limit
  if (!checkRateLimit("import-local", 10, 60000)) {
    return { success: false, error: "Too many requests", code: "RATE_LIMIT" };
  }

  try {
    // F2: Delegate all FS operations to LocalProvider
    const provider = new LocalProvider(parsed.data.localPath);
    await provider.validateRoot();

    const providerTree = await provider.getTree();

    // F36: Check for _bmad or _bmad-output in rootDirectories
    const hasBmad = providerTree.rootDirectories.some(
      (d) => d === "_bmad" || d === "_bmad-output"
    );
    if (!hasBmad) {
      return {
        success: false,
        error: "No _bmad or _bmad-output directory found in this folder.",
        code: "NO_BMAD",
      };
    }

    // F7/F19/F45: URL-safe name with collision-resistant hash
    const rawBasename = path.basename(parsed.data.localPath);
    const sanitizedBasename = sanitizeBasename(rawBasename);
    const hash = shortHash(parsed.data.localPath);
    const repoName = `${sanitizedBasename}-${hash}`;

    // F11: displayName fallback to raw basename
    const displayName = parsed.data.displayName ?? rawBasename;

    const { outputDir, paths: scannedPaths } = await resolveBmadOutputDir(
      provider,
      providerTree.paths,
    );
    const bmadOutputCount = scannedPaths.filter((p) =>
      p.startsWith(outputDir + "/"),
    ).length;

    const repo = await prisma.repo.create({
      data: {
        owner: "local",
        name: repoName,
        branch: "local",
        displayName,
        sourceType: "local",
        localPath: parsed.data.localPath,
        totalFiles: bmadOutputCount,
        lastSyncedAt: new Date(),
      },
      select: { id: true, owner: true, name: true, displayName: true },
    });

    revalidatePath("/(dashboard)");
    return { success: true, data: repo };
  } catch (error: unknown) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "This folder is already imported.",
        code: "DUPLICATE",
      };
    }
    const msg = error instanceof Error ? error.message : "";
    if (msg === "PATH_NOT_FOUND") {
      return { success: false, error: sanitizeError(error, "PATH_NOT_FOUND"), code: "PATH_NOT_FOUND" };
    }
    if (msg === "LOCAL_DISABLED") {
      return { success: false, error: sanitizeError(error, "LOCAL_DISABLED"), code: "LOCAL_DISABLED" };
    }
    return { success: false, error: sanitizeError(error, "FS_ERROR"), code: "FS_ERROR" };
  }
}

// ---------------------------------------------------------------------------
// Branch management (GitHub-only)
// ---------------------------------------------------------------------------

/**
 * List available branches for a repo from GitHub.
 * F21: Returns error for local repos (no branch concept).
 */
export async function listRepoBranches(input: {
  owner: string;
  name: string;
}): Promise<ActionResult<string[]>> {
  const parsed = z.object({ owner: z.string(), name: z.string() }).safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", code: "VALIDATION" };
  }

  // Scope guard: the repo must be registered before we proxy a GitHub call.
  // Without this, a null repoConfig (repo not registered) would silently fall
  // through to the GitHub API using caller-supplied owner/name.
  const repoConfig = await prisma.repo.findFirst({
    where: { owner: parsed.data.owner, name: parsed.data.name },
    select: { sourceType: true },
  });
  if (!repoConfig) {
    return { success: false, error: "Repository not found", code: "NOT_FOUND" };
  }
  // F21: Local repos don't have branches
  if (repoConfig.sourceType === "local") {
    return { success: false, error: "Branch management is not available for local projects", code: "NOT_APPLICABLE" };
  }

  try {
    const octokit = createOctokit();
    const branches = await octokit.paginate(
      octokit.rest.repos.listBranches,
      { owner: parsed.data.owner, repo: parsed.data.name, per_page: 100 },
    );
    return { success: true, data: branches.map((b) => b.name) };
  } catch (error: unknown) {
    return { success: false, error: sanitizeError(error, "GITHUB_ERROR"), code: "GITHUB_ERROR" };
  }
}

/**
 * Update the tracked branch for a repo.
 * F21: Returns error for local repos.
 */
export async function updateRepoBranch(input: {
  owner: string;
  name: string;
  branch: string;
}): Promise<ActionResult<{ branch: string }>> {
  const parsed = z
    .object({ owner: z.string(), name: z.string(), branch: z.string().min(1) })
    .safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input", code: "VALIDATION" };
  }

  // F21: Guard — local repos don't have branches
  const repoConfig = await prisma.repo.findFirst({
    where: { owner: parsed.data.owner, name: parsed.data.name },
    select: { id: true, sourceType: true },
  });
  if (!repoConfig) {
    return { success: false, error: "Project not found", code: "NOT_FOUND" };
  }
  if (repoConfig.sourceType === "local") {
    return { success: false, error: "Branch management is not available for local projects", code: "NOT_APPLICABLE" };
  }

  try {
    await prisma.repo.update({
      where: { id: repoConfig.id },
      data: { branch: parsed.data.branch },
    });

    revalidateTag(repoTag(parsed.data.owner, parsed.data.name), "default");
    revalidatePath("/(dashboard)");

    return { success: true, data: { branch: parsed.data.branch } };
  } catch (error: unknown) {
    return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
  }
}
