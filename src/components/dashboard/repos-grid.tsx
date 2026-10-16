import { RepoCard } from "./repo-card";
import { AddRepoCard } from "./add-repo-card";
import { GroupLabel, StateMessage } from "@/components/shared/list-kit";
import type { BmadProject } from "@/lib/bmad/types";
import type { RepoConfig } from "@/lib/types";

interface ReposGridProps {
  projects: BmadProject[];
  repos: RepoConfig[];
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

export function ReposGrid({ projects, repos, localFsEnabled, githubEnabled }: ReposGridProps) {
  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No project imported. Add a BMAD repo to get started.
        </p>
        <AddRepoCard localFsEnabled={localFsEnabled} githubEnabled={githubEnabled} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <StateMessage role="alert">
        Data from your {repos.length} repo{repos.length > 1 ? "s" : ""} could
        not be fetched. Check your connection or try again.
      </StateMessage>
    );
  }

  const byKey = new Map(repos.map((r) => [`${r.owner}/${r.name}`, r]));

  return (
    <section aria-label="Projects">
      <GroupLabel count={projects.length}>Projects</GroupLabel>
      <div role="list">
        {projects.map((project) => {
          const repo = byKey.get(`${project.owner}/${project.repo}`);
          return (
            <div key={`${project.owner}/${project.repo}`} role="listitem">
              <RepoCard
                project={project}
                description={repo?.description ?? null}
                path={repo?.localPath ?? null}
                syncedAt={repo?.lastSyncedAt ?? null}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1">
        <AddRepoCard localFsEnabled={localFsEnabled} githubEnabled={githubEnabled} />
      </div>
    </section>
  );
}
