"use client";

import { useState, useMemo, useCallback } from "react";
import { PillToggle } from "@/components/shared/list-kit";
import { LayoutList, Columns3 } from "lucide-react";
import { StoryFilters, type Filter } from "./story-filters";
import { StoriesTable } from "./stories-table";
import { KanbanBoard } from "./kanban-board";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { StoryDetailView } from "@/components/epics/story-detail-view";
import type { StoryDetail, Epic } from "@/lib/bmad/types";

interface StoriesViewProps {
  stories: StoryDetail[];
  epics: Epic[];
}

export function StoriesView({ stories, epics }: StoriesViewProps) {
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter<string>[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryDetail | null>(null);

  const applyFilters = useCallback(
    (story: StoryDetail) => {
      for (const filter of filters) {
        if (filter.field === "status" && filter.values.length > 0) {
          const match =
            filter.operator === "is_not" || filter.operator === "is_not_any_of"
              ? !filter.values.includes(story.status)
              : filter.values.includes(story.status);
          if (!match) return false;
        }
        if (filter.field === "epicId" && filter.values.length > 0) {
          const match =
            filter.operator === "is_not" || filter.operator === "is_not_any_of"
              ? !filter.values.includes(story.epicId)
              : filter.values.includes(story.epicId);
          if (!match) return false;
        }
      }
      return true;
    },
    [filters]
  );

  const filtered = useMemo(() => {
    return stories.filter((story) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !story.title.toLowerCase().includes(q) &&
          !story.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return applyFilters(story);
    });
  }, [stories, search, applyFilters]);

  return (
    <div className="min-w-0 space-y-3" role="region" aria-label="Stories list">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <StoryFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          epics={epics}
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
        <StoriesTable stories={filtered} onStorySelect={setSelectedStory} />
      ) : (
        <KanbanBoard stories={filtered} onStorySelect={setSelectedStory} />
      )}

      <Sheet
        open={selectedStory !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStory(null);
        }}
      >
        <SheetContent side="right" className="w-full max-w-full sm:max-w-2xl overflow-y-auto overflow-x-hidden">
          {/* Visible heading lives in StoryDetailView; this is the accessible name. */}
          <SheetTitle className="sr-only">
            {selectedStory
              ? `Story ${selectedStory.id}: ${selectedStory.title}`
              : "Story"}
          </SheetTitle>
          <div className="px-3 pt-12 md:pt-4 md:px-4 pb-4">
            {selectedStory && <StoryDetailView story={selectedStory} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
