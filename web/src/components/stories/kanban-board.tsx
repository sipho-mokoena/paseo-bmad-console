import Link from "next/link";
import { ROW_CLASS, StateMessage } from "@/components/shared/list-kit";
import { cn } from "@/lib/utils";
import type { StoryDetail, StoryStatus } from "@/lib/bmad/types";

const kanbanColumns: { status: StoryStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "ready-for-dev", label: "Ready for dev" },
  { status: "in-progress", label: "In progress" },
  { status: "review", label: "In review" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

interface KanbanBoardProps {
  stories: StoryDetail[];
  /** Builds the story page link. */
  hrefFor: (story: StoryDetail) => string;
}

export function KanbanBoard({ stories, hrefFor }: KanbanBoardProps) {
  if (stories.length === 0) {
    return <StateMessage>No story matches the filters</StateMessage>;
  }

  return (
    <div className="-mx-2 flex scroll-px-2 snap-x snap-mandatory overflow-x-auto px-2 pb-2 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-6 lg:divide-x">
      {kanbanColumns.map((col) => {
        const columnStories = stories.filter(
          (s) =>
            s.status === col.status ||
            (col.status === "backlog" && s.status === "unknown"),
        );
        return (
          <section
            key={col.status}
            aria-label={col.label}
            className="w-[85%] shrink-0 snap-start space-y-0.5 border-r px-1 lg:w-auto lg:min-w-0 lg:shrink lg:border-r-0 lg:px-1.5"
          >
            <h3 className="px-2 pb-1 text-xs text-muted-foreground">
              {col.label}
              <span className="ml-1.5 opacity-60">{columnStories.length}</span>
            </h3>
            {columnStories.map((story) => (
              <Link
                key={story.id}
                href={hrefFor(story)}
                aria-label={`Open story ${story.id}: ${story.title}`}
                title={story.epicTitle ? `${story.title} (${story.epicTitle})` : story.title}
                className={cn(ROW_CLASS, "gap-2 lg:min-h-7 lg:py-1")}
              >
                <span className="min-w-8 shrink-0 font-mono text-xs text-muted-foreground">
                  {story.id}
                </span>
                <span className="min-w-0 flex-1 truncate">{story.title}</span>
                {story.totalTasks > 0 && (
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {story.completedTasks}/{story.totalTasks}
                  </span>
                )}
              </Link>
            ))}
            {columnStories.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No stories</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
