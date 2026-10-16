import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StoryStatus, EpicStatus } from "@/lib/bmad/types";

const statusConfig: Record<string, { label: string; className: string }> = {
  done: {
    label: "Done",
    className: "bg-success/15 text-success-foreground border-success/25",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-info/15 text-info-foreground border-info/25",
  },
  review: {
    label: "Review",
    className: "bg-warning/15 text-warning-foreground border-warning/25",
  },
  blocked: {
    label: "Blocked",
    className: "bg-destructive/15 text-destructive-foreground border-destructive/25",
  },
  "ready-for-dev": {
    label: "Ready for Dev",
    className: "bg-merged/15 text-merged-foreground border-merged/25",
  },
  backlog: {
    label: "Backlog",
    className: "bg-muted text-muted-foreground border-border",
  },
  "not-started": {
    label: "Not Started",
    className: "bg-muted text-muted-foreground border-border",
  },
  unknown: {
    label: "Unknown",
    className: "bg-muted text-muted-foreground border-border",
  },
};

interface StatusBadgeProps {
  status: StoryStatus | EpicStatus;
  compact?: boolean;
}

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unknown;
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 whitespace-nowrap justify-center md:min-w-24", config.className, compact && "px-1.5 py-0 text-[10px] leading-4")}
    >
      {config.label}
    </Badge>
  );
}
