"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Columns3, LayoutList } from "lucide-react";
import { StatusPill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { GroupLabel, PillToggle, StateMessage } from "@/components/shared/list-kit";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StoryFilters, type Filter } from "@/components/stories/story-filters";
import { StoriesTable } from "@/components/stories/stories-table";
import { KanbanBoard } from "@/components/stories/kanban-board";
import { EpicRow } from "./epic-row";
import { StoryRow } from "./story-row";
import { EpicsKanban } from "./epics-kanban";
import { EpicStoriesSheet } from "./epic-stories-sheet";
import { StoryDetailView } from "./story-detail-view";
import {
  epicHref,
  filterStoriesByStatus,
  groupEpicsByStatus,
  searchStories,
} from "@/lib/stories-browse";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

type EpicsLayout = "timeline" | "kanban";

interface EpicsBrowserProps {
  epics: Epic[];
  stories: StoryDetail[];
  totalEpics: number;
  totalStories: number;
  /** Kept for the page; the summary line no longer shows a ring. */
  totalEpicProgress?: number;
}

export function EpicsBrowser({
  epics,
  stories,
  totalEpics,
  totalStories,
}: EpicsBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setExtraSegments, clearExtraSegments } = useBreadcrumb();

  // The drill-in level lives in the URL (?epic=<id>) so Back and shared links work.
  // An unknown id falls back to the epic list.
  const epicParam = searchParams.get("epic");
  const selectedEpic = useMemo(
    () => (epicParam ? (epics.find((e) => e.id === epicParam) ?? null) : null),
    [epics, epicParam],
  );

  const [layout, setLayout] = useState<EpicsLayout>("timeline");
  const [storyView, setStoryView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter<string>[]>([]);
  const [localStory, setSelectedStory] = useState<StoryDetail | null>(null);
  // ?story=<id> (from global Search) opens that story's sheet; Back/Forward follow the URL.
  const storyParam = searchParams.get("story");
  const urlStory = useMemo(
    () => (storyParam ? (stories.find((s) => s.id === storyParam) ?? null) : null),
    [stories, storyParam],
  );
  const selectedStory = localStory ?? urlStory;
  const closeStory = useCallback(() => {
    setSelectedStory(null);
    if (!storyParam) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("story");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [storyParam, searchParams, router, pathname]);
  const [sheetEpicId, setSheetEpicId] = useState<string | null>(null);

  // Search and filters belong to one level: reset them when the level changes
  // (also covers browser Back/Forward). Derived from props at render time.
  const [trackedEpicId, setTrackedEpicId] = useState<string | null>(
    selectedEpic?.id ?? null,
  );
  if (trackedEpicId !== (selectedEpic?.id ?? null)) {
    setTrackedEpicId(selectedEpic?.id ?? null);
    setSearch("");
    setFilters([]);
    setSelectedStory(null);
  }

  const sheetEpic = useMemo(
    () => epics.find((e) => e.id === sheetEpicId) ?? null,
    [epics, sheetEpicId],
  );
  const sheetEpicStories = useMemo(
    () => (sheetEpicId ? stories.filter((s) => s.epicId === sheetEpicId) : []),
    [stories, sheetEpicId],
  );
  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) setSheetEpicId(null);
  }, []);

  const goToEpics = useCallback(() => {
    setSearch("");
    setFilters([]);
    router.push(pathname);
  }, [router, pathname]);

  const goToEpic = useCallback(
    (epicId: string) => router.push(epicHref(pathname, epicId)),
    [router, pathname],
  );

  // Clicking the active "Epics" tab returns to the epic list and clears search.
  useEffect(() => {
    const handleReset = () => {
      setSearch("");
      setFilters([]);
      setSelectedStory(null);
    };
    window.addEventListener("section-reset", handleReset);
    return () => window.removeEventListener("section-reset", handleReset);
  }, []);

  // Breadcrumb: "Epics > Epic N" while inside an epic.
  useEffect(() => {
    if (selectedEpic) {
      setExtraSegments([
        { label: "Epics", onClick: goToEpics },
        { label: `Epic ${selectedEpic.id}` },
      ]);
    } else {
      clearExtraSegments();
    }
  }, [selectedEpic, setExtraSegments, clearExtraSegments, goToEpics]);

  useEffect(() => () => clearExtraSegments(), [clearExtraSegments]);

  const groups = useMemo(() => groupEpicsByStatus(epics), [epics]);

  const searching = !selectedEpic && search.trim() !== "";

  const visibleStories = useMemo(() => {
    if (!selectedEpic && !searching) return [];
    const pool = selectedEpic
      ? stories.filter((s) => s.epicId === selectedEpic.id)
      : stories;
    return filterStoriesByStatus(searchStories(pool, search), filters);
  }, [stories, selectedEpic, searching, search, filters]);

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label="Epics">
      {selectedEpic && (
        <>
          <button
            type="button"
            onClick={goToEpics}
            aria-label="Back to epics"
            className="inline-flex h-10 items-center gap-1.5 rounded-md text-[13px] text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-7"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to epics
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
        {selectedEpic ? (
          <PillToggle
            label="Display mode"
            value={storyView}
            onChange={setStoryView}
            options={[
              { value: "table", label: "Table", icon: LayoutList, ariaLabel: "Table view" },
              { value: "kanban", label: "Board", icon: Columns3, ariaLabel: "Board view" },
            ]}
            className="order-2 sm:order-none"
          />
        ) : (
          !searching && (
            <PillToggle
              label="Epics display mode"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "timeline", label: "List", ariaLabel: "List view" },
                { value: "kanban", label: "Board", ariaLabel: "Board view" },
              ]}
              className="order-2 sm:order-none"
            />
          )
        )}
      </div>

      {selectedEpic ? (
        storyView === "table" ? (
          <StoriesTable stories={visibleStories} onStorySelect={setSelectedStory} hideEpicColumn />
        ) : (
          <KanbanBoard stories={visibleStories} onStorySelect={setSelectedStory} />
        )
      ) : searching ? (
        <>
          <GroupLabel count={visibleStories.length}>Results</GroupLabel>
          {visibleStories.length === 0 ? (
            <StateMessage>No story matches the search</StateMessage>
          ) : (
            <div role="list" aria-label="Search results">
              {visibleStories.map((story) => (
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
        <>
          <p className="text-[13px] text-muted-foreground">
            {totalEpics} epics &middot; {totalStories} stories
          </p>
          {layout === "timeline" ? (
            <div>
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
          ) : (
            <EpicsKanban epics={epics} onSelectEpic={setSheetEpicId} />
          )}
        </>
      )}

      <Sheet
        open={selectedStory !== null}
        onOpenChange={(open) => {
          if (!open) closeStory();
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

      <EpicStoriesSheet
        open={sheetEpicId !== null}
        onOpenChange={handleSheetOpenChange}
        epic={sheetEpic}
        stories={sheetEpicStories}
      />
    </div>
  );
}
