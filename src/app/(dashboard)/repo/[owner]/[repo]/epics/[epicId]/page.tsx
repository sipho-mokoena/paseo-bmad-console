import Link from "next/link";
import { notFound } from "next/navigation";
import { GanttChart } from "lucide-react";
import { StatusPill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { EpicStoriesView } from "@/components/epics/epic-stories-view";
import { EpicBody } from "@/components/epics/epic-body";
import { storiesForList } from "@/lib/bmad/list-view";
import { epicLabel } from "@/lib/bmad/ids";
import { storyDeps } from "@/lib/bmad/deps";
import { hasDependencyData } from "@/lib/dependency-graph";
import { timelineHref } from "@/lib/timeline-params";
import { decodeParam, loadProject } from "@/lib/load-project";

interface EpicPageProps {
  params: Promise<{ owner: string; repo: string; epicId: string }>;
}

export default async function EpicPage({ params }: EpicPageProps) {
  const { owner, repo, epicId: rawEpicId } = await params;
  const epicId = decodeParam(rawEpicId);
  const project = await loadProject(owner, repo);
  const epic = project.epics.find((e) => e.id === epicId);
  if (!epic) notFound();

  const base = `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const showTimeline = hasDependencyData(project.epics, project.stories.map((s) => ({ deps: storyDeps(s) })));
  const stories = storiesForList(project.stories.filter((s) => s.epicId === epic.id));

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label={`Epic ${epic.id}`}>
      <div className="space-y-2 px-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">{epicLabel(epic.id)}</span>
          <h1 className="min-w-0 flex-1 truncate text-lg md:text-[1.375rem] leading-snug font-medium">{epic.title}</h1>
          {showTimeline && (
            <Link
              href={timelineHref(base, { scope: epic.id })}
              aria-label="View on timeline"
              title="View on timeline"
              className="inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-sm text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-auto md:px-2 [&_svg]:size-4"
            >
              <GanttChart aria-hidden="true" />
              <span className="hidden md:inline">Timeline</span>
            </Link>
          )}
          <StatusPill status={epic.status} />
        </div>
        {epic.body ? (
          <EpicBody markdown={epic.body} owner={owner} repo={repo} docPath={epic.sourcePath} />
        ) : (
          epic.description && <p className="text-sm text-muted-foreground">{epic.description}</p>
        )}
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {epic.completedStories}/{epic.totalStories} stories &middot; {epic.progressPercent}%
          </span>
          <ProgressBar percent={epic.progressPercent} label={`Epic ${epic.id} progress`} />
        </div>
      </div>
      <EpicStoriesView epicId={epic.id} stories={stories} base={base} />
    </div>
  );
}
