import { StatStrip } from "@/components/shared/list-kit";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";

interface ProjectStatsGridProps {
  totalEpics: number;
  totalStories: number;
  completedStories: number;
  inProgressStories: number;
  progressPercent: number;
}

/** Compact summary: one strip of label+number pairs and a slim progress bar. */
export function ProjectStatsGrid({
  totalEpics,
  totalStories,
  completedStories,
  inProgressStories,
  progressPercent,
}: ProjectStatsGridProps) {
  return (
    <div className="space-y-2">
      <StatStrip
        stats={[
          { label: "Epics", value: totalEpics },
          { label: "Stories", value: totalStories },
          { label: "Completed", value: completedStories },
          { label: "In progress", value: inProgressStories },
          { label: "Complete", value: `${progressPercent}%` },
        ]}
      />
      <ProgressBar percent={progressPercent} label={`Project progress: ${progressPercent}%`} />
    </div>
  );
}
