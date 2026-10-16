import Link from "next/link";
import { StatusPill } from "@/components/shared/pill";
import { ROW_CLASS } from "@/components/shared/list-kit";
import { AfterText, TicketChips, hasTicketChips } from "./story-ticket-meta";
import { cn } from "@/lib/utils";
import type { StoryDetail } from "@/lib/bmad/types";

interface StoryRowProps {
  story: StoryDetail;
  href: string;
  /** Shows the owning epic (search results listing stories of many epics). */
  showEpic?: boolean;
  /** Muted project name column (results spanning several projects). */
  project?: string;
  className?: string;
}

/**
 * History-style story row: id, title › description, pills, after text, status.
 * One line on desktop; on phones the pills wrap to a second line.
 */
export function StoryRow({ story, href, showEpic, project, className }: StoryRowProps) {
  const ticket = story.ticket;
  const chips = hasTicketChips(ticket);
  const hasAfter = !!ticket && ticket.after.length > 0;
  return (
    <Link
      href={href}
      aria-label={`Open story ${story.id}: ${story.title}`}
      className={cn(ROW_CLASS, "flex-wrap gap-y-1 lg:flex-nowrap", className)}
    >
      <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">
        {story.id}
      </span>
      {showEpic && (
        <span
          title={story.epicTitle ? `Epic ${story.epicId}: ${story.epicTitle}` : `Epic ${story.epicId}`}
          className="shrink-0 rounded-sm bg-muted px-1.5 font-mono text-[11px] leading-5 text-muted-foreground"
        >
          E{story.epicId}
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="min-w-0 truncate lg:max-w-[50%] lg:shrink-0">{story.title}</span>
        {story.description && (
          <>
            <span aria-hidden="true" className="hidden text-muted-foreground lg:inline">
              ›
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-muted-foreground lg:inline">
              {story.description.replace(/\s+/g, " ")}
            </span>
          </>
        )}
      </span>
      {story.totalTasks > 0 && (
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground lg:inline">
          {story.completedTasks}/{story.totalTasks}
        </span>
      )}
      {project && (
        <span
          title={project}
          className="order-2 max-w-24 shrink-0 truncate text-xs text-muted-foreground lg:w-28 lg:max-w-none"
        >
          {project}
        </span>
      )}
      <span className="order-2 flex shrink-0 justify-end lg:w-28">
        <StatusPill status={story.status} />
      </span>
      {(chips || hasAfter || story.totalTasks > 0) && (
        <span className="order-3 flex basis-full flex-wrap items-center gap-1.5 pl-[3.25rem] lg:order-1 lg:basis-auto lg:flex-nowrap lg:pl-0">
          {ticket && <TicketChips ticket={ticket} />}
          <AfterText ticket={ticket} className="max-w-40 lg:w-32 lg:max-w-none lg:shrink-0 lg:text-right" />
          {story.totalTasks > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground lg:hidden">
              {story.completedTasks}/{story.totalTasks} tasks
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
