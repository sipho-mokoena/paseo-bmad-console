import { cache } from "react";
import { getBmadProject } from "./parser";
import { createContentProvider } from "@/lib/content-provider";
import { createOctokit } from "@/lib/github/client";
import type { RepoConfig } from "@/lib/types";
import type { BmadProject } from "./types";

/**
 * React.cache()-wrapped version of getBmadProject.
 * Deduplicates calls within the same React Server Component render tree,
 * so Overview / Stories / Epics pages sharing a layout trigger only one
 * fetch per navigation.
 *
 * F38 CRITICAL: The argument must keep a stable identity so React.cache()
 * comparison works across sibling pages (the config comes from the cached
 * getRepoConfig). The ContentProvider is constructed INSIDE the cached
 * function, not passed as argument.
 */
export const getCachedBmadProject = cache(
  async (config: RepoConfig): Promise<BmadProject | null> => {
    const octokit = config.sourceType === "github" ? createOctokit() : undefined;
    const provider = createContentProvider(config, octokit);
    return getBmadProject(config, provider);
  },
);
