import { StatStrip } from "@/components/shared/list-kit";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import type { BmadProject } from "@/lib/bmad/types";

interface GlobalStatsBarProps {
  projects: BmadProject[];
}

export function GlobalStatsBar({ projects }: GlobalStatsBarProps) {
  const totalEpics = projects.reduce((sum, p) => sum + p.epics.length, 0);
  const totalStories = projects.reduce((sum, p) => sum + p.totalStories, 0);
  const completed = projects.reduce((sum, p) => sum + p.completedStories, 0);
  const inProgress = projects.reduce((sum, p) => sum + p.inProgressStories, 0);
  const pct = totalStories > 0 ? Math.round((completed / totalStories) * 100) : 0;

  return (
    <div className="space-y-2">
      <StatStrip
        stats={[
          { label: "Projects", value: projects.length },
          { label: "Epics", value: totalEpics },
          { label: "Stories", value: totalStories },
          { label: "Completed", value: completed },
          { label: "In progress", value: inProgress },
          { label: "Complete", value: `${pct}%` },
        ]}
      />
      <ProgressBar percent={pct} label={`Overall progress: ${pct}%`} />
    </div>
  );
}
