"use client";

import { useMemo, useState } from "react";
import { Columns3, LayoutList } from "lucide-react";
import { PillToggle } from "@/components/shared/list-kit";
import { StoryFilters, type Filter } from "@/components/stories/story-filters";
import { StoriesTable } from "@/components/stories/stories-table";
import { KanbanBoard } from "@/components/stories/kanban-board";
import { filterStoriesByStatus, searchStories, storyHref } from "@/lib/stories-browse";
import type { StoryDetail } from "@/lib/bmad/types";

interface EpicStoriesViewProps {
  epicId: string;
  stories: StoryDetail[];
  /** `/repo/<owner>/<repo>` */
  base: string;
}

/** The epic page's toolbar (search, status filter, Table | Board) and its stories. */
export function EpicStoriesView({ epicId, stories, base }: EpicStoriesViewProps) {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter<string>[]>([]);

  const visible = useMemo(
    () => filterStoriesByStatus(searchStories(stories, search), filters),
    [stories, search, filters],
  );
  const hrefFor = (s: StoryDetail) => storyHref(base, epicId, s.id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <StoryFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          placeholder="Search this epic"
        />
        <PillToggle
          label="Display mode"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table", icon: LayoutList, ariaLabel: "Table view" },
            { value: "kanban", label: "Board", icon: Columns3, ariaLabel: "Board view" },
          ]}
          className="order-2 sm:order-none"
        />
      </div>
      {view === "table" ? (
        <StoriesTable stories={visible} hrefFor={hrefFor} hideEpicColumn />
      ) : (
        <KanbanBoard stories={visible} hrefFor={hrefFor} />
      )}
    </>
  );
}
