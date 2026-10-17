import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import { unstable_cache } from "next/cache";
import { GitHubTreeResponse } from "./types";
import { repoTag, fileTag } from "./cache-tags";

// Octokit with throttling and retry plugins
const OctokitWithPlugins = Octokit.plugin(throttling, retry);

/**
 * Read the optional personal access token from the environment.
 * Returns undefined when GITHUB_PAT is unset or blank (unauthenticated access).
 */
export function getGitHubPat(): string | undefined {
  const pat = process.env.GITHUB_PAT?.trim();
  return pat ? pat : undefined;
}

/**
 * Create an Octokit instance. Uses GITHUB_PAT when set; otherwise requests are
 * unauthenticated (public repositories only, 60 requests per hour).
 */
export function createOctokit() {
  const pat = getGitHubPat();
  return new OctokitWithPlugins({
    ...(pat ? { auth: pat } : {}),
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(
          `Rate limit hit for ${options.method} ${options.url}`
        );
        if (retryCount < 2) {
          octokit.log.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (_retryAfter, options, octokit) => {
        octokit.log.warn(
          `Secondary rate limit for ${options.method} ${options.url}`
        );
        return false;
      },
    },
  });
}

/**
 * Message shown when GitHub answers 403/429. Says how to lift the limit.
 */
export function rateLimitMessage(): string {
  return getGitHubPat()
    ? "GitHub rate limit reached. Try again in a few minutes."
    : "GitHub rate limit reached (60 requests per hour without a token). Set GITHUB_PAT in the server environment to raise it to 5,000 per hour, then restart.";
}

/** True when the error is an Octokit-style HTTP error with a rate-limit or forbidden status. */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const status = (error as { status: number }).status;
  return status === 403 || status === 429;
}

// ---------------------------------------------------------------------------
// Octokit helpers
// ---------------------------------------------------------------------------

export type GitHubOctokit = ReturnType<typeof createOctokit>;

/**
 * Fetch the full recursive tree of a repo using the given Octokit.
 */
export async function getRepoTree(
  octokit: GitHubOctokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubTreeResponse> {
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });

  return {
    sha: data.sha,
    url: data.url ?? "",
    tree: (data.tree as GitHubTreeResponse["tree"]),
    truncated: data.truncated ?? false,
  };
}

/**
 * Fetch raw file content from a repo using the given Octokit.
 * Decodes base64 content returned by the GitHub Contents API.
 */
export async function getRawContent(
  octokit: GitHubOctokit,
  owner: string,
  repo: string,
  branch: string,
  path: string,
): Promise<string> {
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error(`Path "${path}" is not a file`);
  }

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  // Fallback: content may already be decoded for small files
  return data.content ?? "";
}

// ---------------------------------------------------------------------------
// Cached Octokit helpers (TTL 5 min / 300s)
// ---------------------------------------------------------------------------

const CACHE_TTL = 300; // 5 minutes

/**
 * Cached version of getRepoTree. Uses Next.js unstable_cache with
 * repo-level tags for invalidation via revalidateTag().
 */
export function getCachedRepoTree(
  octokit: GitHubOctokit,
  owner: string,
  repo: string,
  branch: string,
) {
  return unstable_cache(
    () => getRepoTree(octokit, owner, repo, branch),
    [`repo-tree`, owner, repo, branch],
    { revalidate: CACHE_TTL, tags: [repoTag(owner, repo)] },
  )();
}

/**
 * Cached version of getRawContent. Uses Next.js unstable_cache with
 * file-level tags for granular invalidation.
 */
export function getCachedRawContent(
  octokit: GitHubOctokit,
  owner: string,
  repo: string,
  branch: string,
  path: string,
) {
  return unstable_cache(
    () => getRawContent(octokit, owner, repo, branch, path),
    [`file-content`, owner, repo, branch, path],
    { revalidate: CACHE_TTL, tags: [repoTag(owner, repo), fileTag(owner, repo, path)] },
  )();
}

