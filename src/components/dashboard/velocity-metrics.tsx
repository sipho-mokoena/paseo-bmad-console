import { StatStrip } from "@/components/shared/list-kit";
import type { SprintStatus } from "@/lib/bmad/types";

interface VelocityMetricsProps {
  sprintStatus: SprintStatus | null;
}

export function VelocityMetrics({ sprintStatus }: VelocityMetricsProps) {
  if (!sprintStatus) return null;

  const stories = sprintStatus.stories;
  const doneCount = stories.filter((s) => s.status === "done").length;
  const wipCount = stories.filter(
    (s) => s.status === "in-progress" || s.status === "review",
  ).length;
  const blockedCount = stories.filter((s) => s.status === "blocked").length;

  return (
    <StatStrip
      stats={[
        { label: "Sprint stories", value: stories.length },
        { label: "Velocity (done)", value: doneCount },
        { label: "WIP", value: wipCount },
        { label: "Blocked", value: blockedCount },
      ]}
    />
  );
}
