import { Suspense } from "react";
import { notFound } from "next/navigation";
import { epicsForList } from "@/lib/bmad/list-view";
import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { ProjectStatsGrid } from "@/components/dashboard/project-stats-grid";
import { TimelineView } from "@/components/timeline/timeline-view";
import { GroupLabel } from "@/components/shared/list-kit";
import { toTimelineData } from "@/lib/timeline-data";
import { TIMELINE_ANCHOR, shouldShowTimelineOnOverview } from "@/lib/timeline-params";
import { EpicsList } from "@/components/dashboard/epics-list";
import { VelocityMetrics } from "@/components/dashboard/velocity-metrics";
import { LayoutDetails, LayoutNotice, LayoutPill } from "@/components/dashboard/layout-info";
import { KeyArtifactsCard } from "@/components/dashboard/key-artifacts-card";
import { GitBranch, Clock, FolderOpen } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { getRepoConfig } from "@/lib/db/helpers";
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
  const repoConfig = await getRepoConfig(owner, repoName);
  if (!repoConfig) return notFound();

  const isLocal = repoConfig.sourceType === "local";
  const project = await getCachedBmadProject(repoConfig);
  if (!project) return notFound();

  const showTimeline = shouldShowTimelineOnOverview(project);
  const timelineItems = project.stories.length > 0 ? project.stories.length : project.epics.length;
  const planningArtifacts = extractPlanningArtifacts(project.fileTree);

  return (
    <div className="space-y-4">
      {/* Source line (the title lives in the header; project actions live in the sidebar) */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 items-center gap-x-2 overflow-hidden text-sm text-muted-foreground [&>svg]:shrink-0">
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
      </div>

      <LayoutNotice layout={project.layout} />

      {project.sprintStatus && (
        <VelocityMetrics sprintStatus={project.sprintStatus} />
      )}

      <ProjectStatsGrid
        totalEpics={project.epics.length}
        totalStories={project.totalStories}
        completedStories={project.completedStories}
        inProgressStories={project.inProgressStories}
        progressPercent={project.progressPercent}
      />

      <LayoutDetails layout={project.layout} errors={project.parseHealth?.errors ?? []} />

      {showTimeline ? (
        <section id={TIMELINE_ANCHOR} aria-labelledby="timeline-heading" className="scroll-mt-24">
          <GroupLabel count={timelineItems}>
            <span id="timeline-heading">Timeline</span>
          </GroupLabel>
          <Suspense fallback={null}>
            <TimelineView data={toTimelineData(project)} base={`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`} />
          </Suspense>
        </section>
      ) : (
        <EpicsList epics={epicsForList(project.epics)} owner={owner} repo={repoName} lookedFor={project.layout.lookedFor} />
      )}

      <KeyArtifactsCard
        planningArtifacts={planningArtifacts}
        owner={owner}
        repo={repoName}
      />
    </div>
  );
}
