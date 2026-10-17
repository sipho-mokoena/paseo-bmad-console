import { getBmadProject } from "@/lib/bmad/parser";
import { createOctokit } from "@/lib/github/client";
import { createContentProvider } from "@/lib/content-provider";
import { ReposGrid } from "@/components/dashboard/repos-grid";
import { GlobalStatsBar } from "@/components/dashboard/global-stats-bar";
import { getRepos } from "@/lib/db/helpers";
import { AlertBanner } from "@/components/shared/alert-banner";
import type { BmadProject } from "@/lib/bmad/types";

const localFsEnabled = process.env.ENABLE_LOCAL_FS === "true";

export default async function DashboardPage() {
  const repos = await getRepos();

  // Only build an Octokit if at least one repo is GitHub-sourced (F34)
  const hasGithubRepos = repos.some((r) => r.sourceType === "github");
  const octokit = hasGithubRepos ? createOctokit() : undefined;

  const projects: BmadProject[] = [];
  const errors: string[] = [];
  const results = await Promise.allSettled(
    repos.map((repo) => {
      const provider = createContentProvider(repo, octokit);
      return getBmadProject(repo, provider);
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value !== null) {
      projects.push(result.value);
    } else if (result.status === "rejected") {
      const repo = repos[i];
      const msg = result.reason?.message || String(result.reason);
      console.error(`Failed to fetch ${repo.owner}/${repo.name}:`, msg);
      errors.push(`${repo.displayName}: ${msg}`);
    }
  }

  // F44: Separate error messages by source type
  const hasGithubErrors = errors.length > 0 && repos.some(
    (r, i) => r.sourceType === "github" && results[i].status === "rejected"
  );
  const hasLocalErrors = errors.length > 0 && repos.some(
    (r, i) => r.sourceType === "local" && results[i].status === "rejected"
  );

  return (
    <div className="page-pad space-y-4">
        {errors.length > 0 && (
          <AlertBanner
            variant="warning"
            title={errors.length === 1
              ? "1 project could not be loaded"
              : `${errors.length} projects could not be loaded`}
          >
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            {hasGithubErrors && errors.some((e) => /\b(404|Not Found)\b/i.test(e)) && (
              <p className="mt-2 text-xs text-muted-foreground">
                If the repository is private, set GITHUB_PAT in the server environment to a token with access to it, then restart the server.
              </p>
            )}
            {hasLocalErrors && (
              <p className="mt-2 text-xs text-muted-foreground">
                Check that the local folder still exists and is accessible on the server.
              </p>
            )}
          </AlertBanner>
        )}
        {projects.length > 0 && <GlobalStatsBar projects={projects} />}
        <ReposGrid
          projects={projects}
          repos={repos}
          localFsEnabled={localFsEnabled}
        />
    </div>
  );
}
