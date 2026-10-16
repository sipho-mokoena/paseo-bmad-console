"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GroupLabel, PillToggle, StateMessage } from "@/components/shared/list-kit";
import { StatusPill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { EpicRow } from "@/components/epics/epic-row";
import { StoryRow } from "@/components/epics/story-row";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { groupEpicsByStatus, searchStories } from "@/lib/stories-browse";
import { LayoutList, Columns3, ArrowLeft } from "lucide-react";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setExtraSegments, clearExtraSegments } = useBreadcrumb();

  // The drill-in level lives in the URL (?epic=<id>) so Back and shared links work.
  const epicParam = searchParams.get("epic");
  const selectedEpic = useMemo(
    () => (epicParam ? (epics.find((e) => e.id === epicParam) ?? null) : null),
    [epics, epicParam],
  );

  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter<string>[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryDetail | null>(null);

  const goToEpics = useCallback(() => {
    setSearch("");
    router.push(pathname);
  }, [router, pathname]);

  const goToEpic = useCallback(
    (epicId: string) => {
      setSearch("");
      router.push(`${pathname}?epic=${encodeURIComponent(epicId)}`);
    },
    [router, pathname],
  );

  // Clicking the active "Stories" tab returns to the epic list.
  useEffect(() => {
    const handleReset = () => {
      setSearch("");
      setSelectedStory(null);
    };
    window.addEventListener("section-reset", handleReset);
    return () => window.removeEventListener("section-reset", handleReset);
  }, []);

  // Breadcrumb: "Stories > Epic N" while inside an epic, like the Epics page.
  useEffect(() => {
    if (selectedEpic) {
      setExtraSegments([
        { label: "Stories", onClick: goToEpics },
        { label: `Epic ${selectedEpic.id}` },
      ]);
    } else {
      clearExtraSegments();
    }
  }, [selectedEpic, setExtraSegments, clearExtraSegments, goToEpics]);

  useEffect(() => () => clearExtraSegments(), [clearExtraSegments]);

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
      }
      return true;
    },
    [filters]
  );

  const groups = useMemo(() => groupEpicsByStatus(epics), [epics]);

  const searching = !selectedEpic && search.trim() !== "";

  const filtered = useMemo(() => {
    const pool = selectedEpic
      ? stories.filter((s) => s.epicId === selectedEpic.id)
      : stories;
    if (!selectedEpic && !searching) return [];
    return searchStories(pool, search).filter(applyFilters);
  }, [stories, selectedEpic, searching, search, applyFilters]);

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label="Stories list">
      {selectedEpic && (
        <>
          <button
            type="button"
            onClick={goToEpics}
            aria-label="Back to stories"
            className="inline-flex h-10 items-center gap-1.5 rounded-md text-[13px] text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-7"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to stories
          </button>
          <div className="space-y-2 px-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground">E{selectedEpic.id}</span>
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{selectedEpic.title}</h2>
              <StatusPill status={selectedEpic.status} />
            </div>
            {selectedEpic.description && (
              <p className="text-[13px] text-muted-foreground">{selectedEpic.description}</p>
            )}
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {selectedEpic.completedStories}/{selectedEpic.totalStories} stories &middot;{" "}
                {selectedEpic.progressPercent}%
              </span>
              <ProgressBar
                percent={selectedEpic.progressPercent}
                label={`Epic ${selectedEpic.id} progress`}
              />
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <StoryFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          placeholder={selectedEpic ? "Search this epic" : "Search all stories"}
          hideFilters={!selectedEpic && !searching}
        />
        {selectedEpic && (
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
        )}
      </div>

      {selectedEpic ? (
        view === "table" ? (
          <StoriesTable stories={filtered} onStorySelect={setSelectedStory} hideEpicColumn />
        ) : (
          <KanbanBoard stories={filtered} onStorySelect={setSelectedStory} />
        )
      ) : searching ? (
        <>
          <GroupLabel count={filtered.length}>Results</GroupLabel>
          {filtered.length === 0 ? (
            <StateMessage>No story matches the search</StateMessage>
          ) : (
            <div role="list" aria-label="Search results">
              {filtered.map((story) => (
                <div key={story.id} role="listitem">
                  <StoryRow story={story} showEpic onClick={() => setSelectedStory(story)} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : epics.length === 0 ? (
        <StateMessage>
          No epic found. Epics will appear here once defined in the planning artifacts.
        </StateMessage>
      ) : (
        <div>
          <p className="mb-1 text-[13px] text-muted-foreground">
            {epics.length} epics &middot; {stories.length} stories
          </p>
          {groups.map((g) => (
            <section key={g.status} aria-label={g.label}>
              <GroupLabel count={g.epics.length}>{g.label}</GroupLabel>
              <div role="list">
                {g.epics.map((epic) => (
                  <div key={epic.id} role="listitem">
                    <EpicRow epic={epic} onClick={() => goToEpic(epic.id)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
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
