import Link from "next/link";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { ROW_CLASS } from "@/components/shared/list-kit";
import { epicLabel } from "@/lib/bmad/ids";
import { cn } from "@/lib/utils";
import type { Epic, EpicStatus } from "@/lib/bmad/types";

const kanbanColumns: { status: EpicStatus; label: string }[] = [
  { status: "not-started", label: "Planning" },
  { status: "in-progress", label: "In progress" },
  { status: "done", label: "Done" },
];

interface EpicsKanbanProps {
  epics: Epic[];
  /** Builds the epic page link. */
  hrefFor: (epicId: string) => string;
}

export function EpicsKanban({ epics, hrefFor }: EpicsKanbanProps) {
  if (epics.length === 0) {
    return (
      <p className="py-10 text-center text-[13px] text-muted-foreground">
        No epic found in this project
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0 [&>*]:min-w-0">
      {kanbanColumns.map((col) => {
        const columnEpics = epics.filter((e) => e.status === col.status);
        return (
          <section key={col.status} aria-label={col.label} className="space-y-1 p-2 lg:min-h-60">
            <h3 className="px-2 pb-1 text-xs text-muted-foreground">
              {col.label}
              <span className="ml-1.5 opacity-60">{columnEpics.length}</span>
            </h3>
            {columnEpics.map((epic) => (
              <Link
                key={epic.id}
                href={hrefFor(epic.id)}
                aria-label={`Open epic ${epic.id}: ${epic.title}`}
                className={cn(ROW_CLASS, "flex-wrap gap-x-2 gap-y-1")}
              >
                <span className="font-mono text-xs text-muted-foreground">{epicLabel(epic.id)}</span>
                <span className="min-w-0 flex-1 truncate">{epic.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {epic.completedStories}/{epic.totalStories}
                </span>
                <ProgressBar
                  percent={epic.progressPercent}
                  label={`Epic ${epic.id} progress`}
                  className="basis-full"
                />
              </Link>
            ))}
            {columnEpics.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">No epics</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
