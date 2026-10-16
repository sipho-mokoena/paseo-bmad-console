import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percent: number;
  /** Ignored: the fill is always the primary green. Kept for existing call sites. */
  color?: string;
  className?: string;
  label?: string;
}

/** Thin (4px) continuous bar: track #272a29, fill primary green. */
export function ProgressBar({ percent, className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={cn("h-1 w-full min-w-0 overflow-hidden rounded-full bg-accent", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
