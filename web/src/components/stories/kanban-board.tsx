"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StaggeredList, StaggeredItem } from "@/components/shared/staggered-list";
import type { StoryDetail, StoryStatus } from "@/lib/bmad/types";

const kanbanColumns: { status: StoryStatus; label: string; color: string }[] = [
  { status: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { status: "ready-for-dev", label: "Ready for Dev", color: "bg-merged" },
  { status: "in-progress", label: "In Progress", color: "bg-info" },
  { status: "review", label: "In Review", color: "bg-warning" },
  { status: "blocked", label: "Blocked", color: "bg-destructive" },
  { status: "done", label: "Done", color: "bg-success" },
];

interface KanbanBoardProps {
  stories: StoryDetail[];
}

export function KanbanBoard({ stories }: KanbanBoardProps) {
  if (stories.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-border/50 text-muted-foreground">
        No story matches the filters
      </div>
    );
  }

  return (
    <StaggeredList className="-mx-2 flex scroll-px-2 snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6">
      {kanbanColumns.map((col) => {
        const columnStories = stories.filter(
          (s) =>
            s.status === col.status ||
            (col.status === "backlog" && s.status === "unknown")
        );
        return (
          <StaggeredItem key={col.status} className="w-[85%] shrink-0 snap-start space-y-3 md:w-auto md:min-w-0 md:shrink">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} aria-hidden="true" />
              <h3 className="text-sm font-medium">{col.label}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {columnStories.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-25">
              {columnStories.map((story) => (
                <Card
                  key={story.id}
                  className="glass-card hover:shadow-sm transition-shadow duration-300"
                >
                  <CardContent className="px-3 py-0 md:p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium text-sm leading-tight">
                        {story.title}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        S{story.id}
                      </span>
                    </div>
                    {story.epicTitle && (
                      <p className="text-xs text-muted-foreground">
                        {story.epicTitle}
                      </p>
                    )}
                    {story.totalTasks > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Tasks</span>
                          <span>
                            {story.completedTasks}/{story.totalTasks}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{
                              width: `${
                                (story.completedTasks / story.totalTasks) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {columnStories.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
                  No stories
                </div>
              )}
            </div>
          </StaggeredItem>
        );
      })}
    </StaggeredList>
  );
}
