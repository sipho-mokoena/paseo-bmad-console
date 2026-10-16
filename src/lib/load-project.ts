import { notFound, redirect } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getGitHubToken } from "@/lib/github/client";
import { getAuthenticatedUserId, getAuthenticatedRepoConfig } from "@/lib/db/helpers";

/** Loads the BMad project of a repo route on the server; redirects to login or 404s. */
export async function loadProject(owner: string, repoName: string) {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const repoConfig = await getAuthenticatedRepoConfig(userId, owner, repoName);
  if (!repoConfig) notFound();

  const isLocal = repoConfig.sourceType === "local";
  const token = isLocal ? undefined : ((await getGitHubToken(userId)) ?? undefined);
  const project = await getCachedBmadProject(repoConfig, token, userId);
  if (!project) notFound();
  return project;
}

/** Route params arrive percent-encoded in some paths; decode defensively. */
export function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
