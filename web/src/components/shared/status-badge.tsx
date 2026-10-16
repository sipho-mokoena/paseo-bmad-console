import { StatusPill } from "@/components/shared/pill";
import type { StoryStatus, EpicStatus } from "@/lib/bmad/types";

interface StatusBadgeProps {
  status: StoryStatus | EpicStatus;
  /** Kept for existing call sites; the pill is one size everywhere. */
  compact?: boolean;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <StatusPill status={status} />;
}
