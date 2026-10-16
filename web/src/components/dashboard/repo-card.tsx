import Link from "next/link";
import { ParseErrorsDialog } from "@/components/shared/parse-errors-dialog";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { ROW_CLASS } from "@/components/shared/list-kit";
import { Pill } from "@/components/shared/pill";
import { formatShortRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BmadProject } from "@/lib/bmad/types";

interface RepoCardProps {
  project: BmadProject;
  description: string | null;
  path?: string | null;
  syncedAt?: Date | string | null;
}

/** One project as a History-style row: name › path, counts, % complete, relative time. */
export function RepoCard({ project, description, path, syncedAt }: RepoCardProps) {
  const sub =
    project.owner === "local"
      ? (path ?? description ?? "")
      : `${project.owner}/${project.repo}`;
  const errors = project.parseHealth?.errors ?? [];

  return (
    <div className="relative">
      <Link
        href={`/repo/${project.owner}/${project.repo}`}
        className={cn(ROW_CLASS, "flex-wrap gap-y-0.5 lg:flex-nowrap", errors.length > 0 && "pr-9")}
      >
        <span className="min-w-0 max-w-full truncate font-medium lg:max-w-[40%] lg:shrink-0">
          {project.displayName}
        </span>
        {sub && (
          <span className="hidden min-w-0 flex-1 items-baseline gap-2 lg:flex">
            <span aria-hidden="true" className="text-muted-foreground">›</span>
            <span className="min-w-0 truncate text-muted-foreground">{sub}</span>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
          <span>{project.epics.length} epics</span>
          <span>{project.totalStories} stories</span>
          <ProgressBar
            percent={project.progressPercent}
            label={`${project.displayName} progress: ${project.progressPercent}%`}
            className="hidden w-20 sm:block"
          />
          <Pill className="tabular-nums">{project.progressPercent}%</Pill>
          <span className="hidden w-16 text-right lg:inline">
            {formatShortRelative(syncedAt)}
          </span>
        </span>
        {sub && (
          <span className="basis-full truncate text-xs text-muted-foreground lg:hidden">
            {sub}
          </span>
        )}
      </Link>
      {errors.length > 0 && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <ParseErrorsDialog errors={errors} />
        </span>
      )}
    </div>
  );
}
