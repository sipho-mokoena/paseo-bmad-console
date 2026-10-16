import type { RepoConfig } from "@/lib/types";

/** The branch settings modal only applies to GitHub-backed projects. */
export function shouldShowSettings(repo: Pick<RepoConfig, "sourceType">): boolean {
  return repo.sourceType !== "local";
}
