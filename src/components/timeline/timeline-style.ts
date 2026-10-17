import type { StoryStatus } from "@/lib/bmad/types";

/** Status colours from the theme tokens (same hues as the status pills), light and dark. */
export const STATUS_STYLE: Record<string, { label: string; bar: string; dot: string; dotFill: string; fill: string; stroke: string }> = {
  done: { label: "Done", bar: "border-success/70 bg-success/20", dot: "bg-success", dotFill: "fill-success", fill: "fill-success/20", stroke: "stroke-success/70" },
  review: { label: "In review", bar: "border-info/70 bg-info/15", dot: "bg-info", dotFill: "fill-info", fill: "fill-info/15", stroke: "stroke-info/70" },
  "in-progress": { label: "In progress", bar: "border-info bg-info/30", dot: "bg-info", dotFill: "fill-info", fill: "fill-info/30", stroke: "stroke-info" },
  blocked: { label: "Blocked", bar: "border-destructive/70 bg-destructive/20", dot: "bg-destructive", dotFill: "fill-destructive", fill: "fill-destructive/20", stroke: "stroke-destructive/70" },
  "ready-for-dev": { label: "Ready for dev", bar: "border-foreground/40 bg-card", dot: "bg-foreground/60", dotFill: "fill-foreground/60", fill: "fill-card", stroke: "stroke-foreground/40" },
  backlog: { label: "Backlog", bar: "border-border bg-secondary/60", dot: "bg-muted-foreground/60", dotFill: "fill-muted-foreground/60", fill: "fill-secondary/60", stroke: "stroke-border" },
  "not-started": { label: "Not started", bar: "border-border bg-secondary/60", dot: "bg-muted-foreground/60", dotFill: "fill-muted-foreground/60", fill: "fill-secondary/60", stroke: "stroke-border" },
  unknown: { label: "Unknown", bar: "border-dashed border-border bg-card", dot: "bg-muted-foreground/40", dotFill: "fill-muted-foreground/40", fill: "fill-card", stroke: "stroke-border" },
};

export const statusStyle = (status: string) => STATUS_STYLE[status] ?? STATUS_STYLE.unknown;
export const statusLabel = (status: string) => statusStyle(status).label;

export const FILTER_STATUS_OPTIONS: { value: StoryStatus; label: string }[] = [
  { value: "done", label: "Done" },
  { value: "review", label: "In review" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "ready-for-dev", label: "Ready for dev" },
  { value: "backlog", label: "Backlog" },
];

export const waveLabel = (start: number, end: number) =>
  end - start <= 1 ? `Wave ${start + 1}` : `Waves ${start + 1} to ${end}`;

/** Toggle chip: 40px on phones, 28px from md. */
export const CHIP =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-input bg-card px-3 text-xs text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-7 md:px-2.5";
export const CHIP_ON = "border-foreground/40 bg-secondary text-foreground";
