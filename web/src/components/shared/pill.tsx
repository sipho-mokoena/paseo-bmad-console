import { Check, Circle, CircleDashed, Clock, Eye, Ban, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryStatus, EpicStatus } from "@/lib/bmad/types";

/** The one pill style: 11-12px text, 6px radius, hairline border, optional 12px icon. */
export const PILL_BASE =
  "inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-normal leading-none [&>svg]:size-3 [&>svg]:shrink-0";

export type PillTone = "neutral" | "success" | "info" | "danger" | "fill";

const TONE: Record<PillTone, string> = {
  neutral: "border-border text-muted-foreground",
  success: "border-border text-success-foreground",
  info: "border-border text-info-foreground",
  danger: "border-destructive/40 text-destructive-foreground",
  fill: "border-transparent bg-secondary text-secondary-foreground",
};

export function Pill({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: PillTone }) {
  return (
    <span
      data-slot="pill"
      className={cn(PILL_BASE, TONE[tone], className)}
      {...props}
    />
  );
}

const STATUS: Record<
  string,
  { label: string; tone: PillTone; icon: React.ElementType }
> = {
  done: { label: "Done", tone: "success", icon: Check },
  "in-progress": { label: "In progress", tone: "info", icon: Clock },
  review: { label: "In review", tone: "info", icon: Eye },
  blocked: { label: "Blocked", tone: "danger", icon: Ban },
  "ready-for-dev": { label: "Ready for dev", tone: "neutral", icon: Rocket },
  backlog: { label: "Backlog", tone: "neutral", icon: Circle },
  "not-started": { label: "Not started", tone: "neutral", icon: Circle },
  unknown: { label: "Unknown", tone: "neutral", icon: CircleDashed },
};

export function statusLabel(status: StoryStatus | EpicStatus): string {
  return (STATUS[status] ?? STATUS.unknown).label;
}

export function StatusPill({
  status,
  className,
}: {
  status: StoryStatus | EpicStatus;
  className?: string;
}) {
  const cfg = STATUS[status] ?? STATUS.unknown;
  const Icon = cfg.icon;
  return (
    <Pill tone={cfg.tone} className={className}>
      <Icon aria-hidden="true" />
      {cfg.label}
    </Pill>
  );
}
