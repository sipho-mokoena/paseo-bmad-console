"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { StatusPill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { GroupLabel, PillToggle, StateMessage } from "@/components/shared/list-kit";
import { EpicRow } from "./epic-row";
import { StoryRow } from "./story-row";
import { EpicsKanban } from "./epics-kanban";
import { EpicStoriesSheet } from "./epic-stories-sheet";
import { StoryDetailView } from "./story-detail-view";
import { groupEpicsByStatus } from "@/lib/stories-browse";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { ArrowLeft } from "lucide-react";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

type EpicsLayout = "timeline" | "kanban";

type View = "epics" | "stories" | "story";

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
  const [view, setView] = useState<View>("epics");
  const [selectedEpicId, setSelectedEpicId] = useState<string | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [layout, setLayout] = useState<EpicsLayout>("timeline");
  const [sheetEpicId, setSheetEpicId] = useState<string | null>(null);
  const { setExtraSegments, clearExtraSegments } = useBreadcrumb();

  const sheetEpic = useMemo(
    () => epics.find((e) => e.id === sheetEpicId) ?? null,
    [epics, sheetEpicId],
  );

  const sheetEpicStories = useMemo(
    () => (sheetEpicId ? stories.filter((s) => s.epicId === sheetEpicId) : []),
    [stories, sheetEpicId],
  );

  const openEpicSheet = useCallback((epicId: string) => {
    setSheetEpicId(epicId);
  }, []);

  const handleSheetOpenChange = useCallback((open: boolean) => {
    if (!open) setSheetEpicId(null);
  }, []);

  const selectedEpic = useMemo(
    () => epics.find((e) => e.id === selectedEpicId) ?? null,
    [epics, selectedEpicId],
  );

  const epicStories = useMemo(
    () =>
      selectedEpicId ? stories.filter((s) => s.epicId === selectedEpicId) : [],
    [stories, selectedEpicId],
  );

  const selectedStory = useMemo(
    () => stories.find((s) => s.id === selectedStoryId) ?? null,
    [stories, selectedStoryId],
  );

  const goToEpics = useCallback(() => {
    setView("epics");
    setSelectedEpicId(null);
    setSelectedStoryId(null);
  }, []);

  const goToStories = useCallback((epicId: string) => {
    setView("stories");
    setSelectedEpicId(epicId);
    setSelectedStoryId(null);
  }, []);

  const goToStory = useCallback((storyId: string) => {
    setView("story");
    setSelectedStoryId(storyId);
  }, []);

  // Listen for section-reset event from sidebar to reset to epics list
  useEffect(() => {
    const handleReset = () => goToEpics();
    window.addEventListener("section-reset", handleReset);
    return () => window.removeEventListener("section-reset", handleReset);
  }, [goToEpics]);

  // Sync breadcrumb context with internal navigation state
  useEffect(() => {
    const segments: { label: string; onClick?: () => void }[] = [];

    if (view === "epics") {
      // No extra segment — header already shows "Epics"
    } else if (view === "stories" && selectedEpic) {
      segments.push({ label: "Epics", onClick: goToEpics });
      segments.push({
        label: `Epic ${selectedEpic.id}`,
      });
    } else if (view === "story" && selectedEpic) {
      segments.push({ label: "Epics", onClick: goToEpics });
      segments.push({
        label: `Epic ${selectedEpic.id}`,
        onClick: () => goToStories(selectedEpic.id),
      });
      if (selectedStory) {
        segments.push({
          label: `Story ${selectedStory.id}`,
        });
      }
    }

    if (segments.length > 0) {
      setExtraSegments(segments);
    } else {
      clearExtraSegments();
    }
  }, [
    view,
    selectedEpic,
    selectedStory,
    setExtraSegments,
    clearExtraSegments,
    goToEpics,
    goToStories,
  ]);

  // Clear extra segments when unmounting
  useEffect(() => {
    return () => clearExtraSegments();
  }, [clearExtraSegments]);

  const groups = useMemo(() => groupEpicsByStatus(epics), [epics]);

  return (
    <div className="space-y-3 pb-4">
      {view !== "epics" && (
        <button
          type="button"
          onClick={
            view === "story" && selectedEpic
              ? () => goToStories(selectedEpic.id)
              : goToEpics
          }
          aria-label={view === "story" ? "Back to stories" : "Back to epics"}
          className="inline-flex h-8 items-center gap-1.5 rounded-md text-[13px] text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-7"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {view === "story" ? "Back to stories" : "Back to epics"}
        </button>
      )}

      {view === "epics" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
              {totalEpics} epics &middot; {totalStories} stories
            </p>
            <PillToggle
              label="Epics display mode"
              value={layout}
              onChange={setLayout}
              options={[
                { value: "timeline", label: "List", ariaLabel: "List view" },
                { value: "kanban", label: "Board", ariaLabel: "Board view" },
              ]}
            />
          </div>

          {epics.length === 0 ? (
            <StateMessage>
              No epic found. Epics will appear here once defined in the planning artifacts.
            </StateMessage>
          ) : layout === "timeline" ? (
            <div>
              {groups.map((g) => {
                const list = g.epics;
                return (
                  <section key={g.status} aria-label={g.label}>
                    <GroupLabel count={list.length}>{g.label}</GroupLabel>
                    <div role="list">
                      {list.map((epic) => (
                        <div key={epic.id} role="listitem">
                          <EpicRow epic={epic} onClick={() => goToStories(epic.id)} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <EpicsKanban epics={epics} onSelectEpic={openEpicSheet} />
          )}
        </>
      )}

      {view === "stories" && selectedEpic && (
        <div className="space-y-3">
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

          <GroupLabel count={epicStories.length}>Stories</GroupLabel>
          {epicStories.length === 0 ? (
            <StateMessage>No story found for this epic</StateMessage>
          ) : (
            <div role="list">
              {epicStories.map((story) => (
                <div key={story.id} role="listitem">
                  <StoryRow story={story} onClick={() => goToStory(story.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "story" && selectedStory && (
        <StoryDetailView story={selectedStory} />
      )}

      <EpicStoriesSheet
        open={sheetEpicId !== null}
        onOpenChange={handleSheetOpenChange}
        epic={sheetEpic}
        stories={sheetEpicStories}
      />
    </div>
  );
}
