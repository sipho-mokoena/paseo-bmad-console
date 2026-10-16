import { redirect, notFound } from "next/navigation";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { getGitHubToken } from "@/lib/github/client";
import { ProjectStatsGrid } from "@/components/dashboard/project-stats-grid";
import { EpicsList } from "@/components/dashboard/epics-list";
import { VelocityMetrics } from "@/components/dashboard/velocity-metrics";
import { LayoutDetails, LayoutNotice, LayoutPill } from "@/components/dashboard/layout-info";
import { KeyArtifactsCard } from "@/components/dashboard/key-artifacts-card";
import { GitBranch, Clock, FolderOpen } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { DeleteRepoButton } from "@/components/shared/delete-repo-button";
import { RefreshRepoButton } from "@/components/shared/refresh-repo-button";
import { RepoSettingsModal } from "@/components/shared/repo-settings-modal";
import {
  getAuthenticatedUserId,
  getAuthenticatedRepoConfig,
} from "@/lib/db/helpers";
import type { FileTreeNode } from "@/lib/bmad/types";

interface RepoPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

function extractPlanningArtifacts(fileTree: FileTreeNode[]): FileTreeNode[] {
  const planningDir = fileTree.find(
    (node) =>
      node.type === "directory" &&
      node.name.toLowerCase().includes("planning-artifacts"),
  );
  return planningDir?.children ?? [];
}

export default async function RepoOverviewPage({ params }: RepoPageProps) {
  const { owner, repo: repoName } = await params;
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const repoConfig = await getAuthenticatedRepoConfig(userId, owner, repoName);
  if (!repoConfig) return notFound();

  const isLocal = repoConfig.sourceType === "local";
  const token = isLocal ? undefined : (await getGitHubToken(userId)) ?? undefined;
  const project = await getCachedBmadProject(repoConfig, token, userId);
  if (!project) return notFound();

  const planningArtifacts = extractPlanningArtifacts(project.fileTree);

  return (
    <div className="space-y-4">
      {/* Source line + actions (the title lives in the header) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-x-2 overflow-hidden text-[13px] text-muted-foreground [&>svg]:shrink-0">
          {isLocal ? (
            <>
              <FolderOpen className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">{repoConfig.localPath ?? "Local folder"}</span>
            </>
          ) : (
            <>
              <GitBranch className="h-3.5 w-3.5" />
              <span>
                {project.owner}/{project.repo} ({project.branch})
              </span>
            </>
          )}
          <LayoutPill layout={project.layout} />
          {repoConfig.lastSyncedAt && (
            <span className="hidden shrink-0 items-center gap-2 sm:flex">
              <span className="text-muted-foreground/50">·</span>
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(repoConfig.lastSyncedAt)}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RefreshRepoButton owner={owner} name={repoName} />
          {!isLocal && (
            <RepoSettingsModal
              owner={owner}
              name={repoName}
              currentBranch={project.branch}
            />
          )}
          <DeleteRepoButton
            owner={owner}
            name={repoName}
            displayName={project.displayName}
          />
        </div>
      </div>

      <LayoutNotice layout={project.layout} />

      <ProjectStatsGrid
        totalEpics={project.epics.length}
        totalStories={project.totalStories}
        completedStories={project.completedStories}
        inProgressStories={project.inProgressStories}
        progressPercent={project.progressPercent}
      />

      {project.sprintStatus && (
        <VelocityMetrics sprintStatus={project.sprintStatus} />
      )}

      <LayoutDetails layout={project.layout} errors={project.parseHealth?.errors ?? []} />

      <EpicsList epics={project.epics} owner={owner} repo={repoName} lookedFor={project.layout.lookedFor} />

      <KeyArtifactsCard
        planningArtifacts={planningArtifacts}
        owner={owner}
        repo={repoName}
      />
    </div>
  );
}
