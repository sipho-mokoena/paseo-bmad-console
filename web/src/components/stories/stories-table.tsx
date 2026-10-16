"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { StatusPill } from "@/components/shared/pill";
import { StateMessage } from "@/components/shared/list-kit";
import { StoryRow } from "@/components/epics/story-row";
import {
  AfterText,
  TicketChips,
} from "@/components/epics/story-ticket-meta";
import { cn } from "@/lib/utils";
import type { StoryDetail } from "@/lib/bmad/types";

/** Compares ticket ids such as "2.10" numerically, segment by segment. */
function compareStoryIds(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na !== nb) return na - nb;
    } else if (pa[i] !== pb[i]) {
      return pa[i].localeCompare(pb[i]);
    }
  }
  return 0;
}

type SortKey = "id" | "title" | "status" | "epicTitle";
type SortState = { key: SortKey; desc: boolean } | null;

const COMPARE: Record<SortKey, (a: StoryDetail, b: StoryDetail) => number> = {
  id: (a, b) => compareStoryIds(a.id, b.id),
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => a.status.localeCompare(b.status),
  epicTitle: (a, b) => (a.epicTitle ?? "").localeCompare(b.epicTitle ?? ""),
};

const HEADERS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "id", label: "ID", className: "w-16" },
  { key: "title", label: "Title" },
  { key: null, label: "Details", className: "hidden w-80 xl:table-cell" },
  { key: "status", label: "Status", className: "w-32" },
  { key: "epicTitle", label: "Epic", className: "hidden w-44 min-[1400px]:table-cell" },
  { key: null, label: "Tasks", className: "w-16 text-right" },
];

const PAGE = 60;

interface StoriesTableProps {
  stories: StoryDetail[];
  /** Opens the story detail (row click, Enter or Space). */
  onStorySelect?: (story: StoryDetail) => void;
}

export function StoriesTable({ stories, onStorySelect }: StoriesTableProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [visible, setVisible] = useState(PAGE);

  const sorted = useMemo(() => {
    if (!sort) return stories;
    const cmp = COMPARE[sort.key];
    return [...stories].sort((a, b) => (sort.desc ? -cmp(a, b) : cmp(a, b)));
  }, [stories, sort]);

  const shown = sorted.slice(0, visible);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      !s || s.key !== key ? { key, desc: false } : s.desc ? null : { key, desc: true },
    );

  const more =
    visible < sorted.length ? (
      <button
        type="button"
        onClick={() => setVisible((v) => v + PAGE)}
        className="mt-1 h-10 w-full rounded-md text-[13px] text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-8"
      >
        Show more ({sorted.length - visible} left)
      </button>
    ) : null;

  if (stories.length === 0) {
    return <StateMessage>No story matches the filters</StateMessage>;
  }

  return (
    <>
      {/* Phone: stacked History-style rows */}
      <div className="xl:hidden" role="list" aria-label="Stories">
        {shown.map((story) => (
          <div key={story.id} role="listitem">
            <StoryRow story={story} onClick={() => onStorySelect?.(story)} />
          </div>
        ))}
        {more}
      </div>

      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead className="sticky top-[calc(var(--app-header-h)+2.25rem)] z-10 bg-background">
            <tr className="border-b text-left text-xs text-muted-foreground">
              {HEADERS.map((h) => {
                const active = h.key && sort?.key === h.key;
                return (
                  <th
                    key={h.label}
                    scope="col"
                    aria-sort={
                      active ? (sort!.desc ? "descending" : "ascending") : h.key ? "none" : undefined
                    }
                    className={cn("px-2 py-2 font-normal", h.className)}
                  >
                    {h.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(h.key!)}
                        className="inline-flex items-center gap-1 rounded-sm outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {h.label}
                        {active &&
                          (sort!.desc ? (
                            <ArrowDown className="size-3" aria-hidden="true" />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden="true" />
                          ))}
                      </button>
                    ) : (
                      h.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((story) => (
              <tr
                key={story.id}
                tabIndex={0}
                aria-label={`Open story ${story.id}: ${story.title}`}
                onClick={() => onStorySelect?.(story)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStorySelect?.(story);
                  }
                }}
                className="group/row cursor-pointer outline-hidden transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <td className="rounded-l-md px-2 py-1.5 font-mono text-xs text-muted-foreground">
                  {story.id}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="min-w-0 max-w-[60%] shrink-0 truncate">{story.title}</span>
                    {story.description && (
                      <>
                        <span aria-hidden="true" className="text-muted-foreground">›</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {story.description.replace(/\s+/g, " ")}
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td className="hidden px-2 py-1.5 xl:table-cell">
                  <div className="flex items-center justify-start gap-1.5 overflow-hidden">
                    {story.ticket && <TicketChips ticket={story.ticket} />}
                    <AfterText ticket={story.ticket} />
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <StatusPill status={story.status} />
                </td>
                <td className="hidden truncate px-2 py-1.5 text-muted-foreground min-[1400px]:table-cell">
                  {story.epicTitle || "-"}
                </td>
                <td className="rounded-r-md px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                  {story.totalTasks > 0 ? `${story.completedTasks}/${story.totalTasks}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {more}
      </div>
    </>
  );
}
