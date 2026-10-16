import Link from "next/link";
import { StatusPill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { ROW_CLASS } from "@/components/shared/list-kit";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/bmad/types";

interface EpicRowProps {
  epic: Epic;
  href: string;
  /** Muted project name column (results spanning several projects). */
  project?: string;
  className?: string;
}

/** History-style epic row: E1  Title › description   12/14  ▬▬▬  [Done]. */
export function EpicRow({ epic, href, project, className }: EpicRowProps) {
  const body = (
    <>
      <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">
        E{epic.id}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="min-w-0 truncate lg:max-w-[55%] lg:shrink-0">{epic.title}</span>
        {epic.description && (
          <>
            <span aria-hidden="true" className="hidden text-muted-foreground lg:inline">
              ›
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-muted-foreground lg:inline">
              {epic.description}
            </span>
          </>
        )}
      </span>
      {project && (
        <span
          title={project}
          className="max-w-24 shrink-0 truncate text-xs text-muted-foreground lg:w-28 lg:max-w-none"
        >
          {project}
        </span>
      )}
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:w-12">
        {epic.completedStories}/{epic.totalStories}
      </span>
      <ProgressBar
        percent={epic.progressPercent}
        label={`Epic ${epic.id} progress: ${epic.progressPercent}%`}
        className="hidden w-24 shrink-0 sm:block"
      />
      <span className="flex shrink-0 justify-end sm:w-24">
        <StatusPill status={epic.status} />
      </span>
    </>
  );
  const cls = cn(ROW_CLASS, className);

  return (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}
