import { Layers, BookOpen, CheckCircle2, Clock, FolderGit2 } from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { BmadProject } from "@/lib/bmad/types";

interface GlobalStatsBarProps {
  projects: BmadProject[];
}

function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function GlobalStatsBar({ projects }: GlobalStatsBarProps) {
  const totalEpics = projects.reduce((sum, p) => sum + p.epics.length, 0);
  const totalStories = projects.reduce((sum, p) => sum + p.totalStories, 0);
  const completedStories = projects.reduce(
    (sum, p) => sum + p.completedStories,
    0
  );
  const inProgressStories = projects.reduce(
    (sum, p) => sum + p.inProgressStories,
    0
  );
  const activeProjects = projects.filter((p) => p.inProgressStories > 0).length;
  const pct = (n: number) =>
    totalStories > 0 ? Math.round((n / totalStories) * 100) : 0;

  return (
    <StaggeredList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StaggeredItem className="h-full">
        <StatsCard
          title="Projects"
          value={projects.length}
          icon={FolderGit2}
          color="primary"
          description={
            projects.length === 0
              ? "No projects yet"
              : activeProjects > 0
                ? `${activeProjects} active`
                : "None in progress"
          }
        />
      </StaggeredItem>
      <StaggeredItem className="h-full">
        <StatsCard
          title="Epics"
          value={totalEpics}
          icon={Layers}
          color="violet"
          description={`Across ${count(projects.length, "project")}`}
        />
      </StaggeredItem>
      <StaggeredItem className="h-full">
        <StatsCard
          title="Stories"
          value={totalStories}
          icon={BookOpen}
          color="info"
          description={`Across ${count(totalEpics, "epic")}`}
        />
      </StaggeredItem>
      <StaggeredItem className="h-full">
        <StatsCard
          title="Completed"
          value={completedStories}
          icon={CheckCircle2}
          color="success"
          description={
            totalStories > 0
              ? `${pct(completedStories)}% completed`
              : "No stories yet"
          }
        />
      </StaggeredItem>
      <StaggeredItem className="h-full sm:col-span-2 xl:col-span-1">
        <StatsCard
          title="In Progress"
          value={inProgressStories}
          icon={Clock}
          color="warning"
          description={
            totalStories > 0
              ? `${pct(inProgressStories)}% of ${count(totalStories, "story", "stories")}`
              : "No stories yet"
          }
        />
      </StaggeredItem>
    </StaggeredList>
  );
}
