import { cache } from "react";
import { prisma } from "@/lib/db/client";
import type { RepoConfig } from "@/lib/types";

const REPO_SELECT = {
  owner: true,
  name: true,
  branch: true,
  displayName: true,
  description: true,
  sourceType: true,
  localPath: true,
  lastSyncedAt: true,
} as const;

/**
 * Get all registered repos, newest first. Cached per request via React cache(),
 * which deduplicates across layout.tsx and page.tsx within the same render.
 * Repos are global: the app has a single tenant and no concept of a user.
 */
export const getRepos = cache(async (): Promise<RepoConfig[]> => {
  const rows = await prisma.repo.findMany({
    select: REPO_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return rows as RepoConfig[];
});

/**
 * Get a single repo config by owner and name. Cached per request.
 * Returns null if no such repo is registered.
 */
export const getRepoConfig = cache(
  async (owner: string, name: string): Promise<RepoConfig | null> => {
    const row = await prisma.repo.findFirst({
      where: { owner, name },
      select: REPO_SELECT,
    });
    return row as RepoConfig | null;
  }
);
