import { notFound } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getRepoConfig } from "@/lib/db/helpers";

/** Loads the BMad project of a repo route on the server; 404s when unknown. */
export async function loadProject(owner: string, repoName: string) {
  const repoConfig = await getRepoConfig(owner, repoName);
  if (!repoConfig) notFound();

  const project = await getCachedBmadProject(repoConfig);
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
