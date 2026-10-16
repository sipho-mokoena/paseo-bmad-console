"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { StateMessage } from "@/components/shared/list-kit";
import { StoryDetailView } from "./story-detail-view";
import { StoryRow } from "./story-row";
import { ArrowLeft } from "lucide-react";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

interface EpicStoriesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epic: Epic | null;
  stories: StoryDetail[];
}

export function EpicStoriesSheet({
  open,
  onOpenChange,
  epic,
  stories,
}: EpicStoriesSheetProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  // Reset internal navigation when the targeted epic changes (covers both
  // "open with a different epic" and "close then reopen") — derived from
  // props at render time, per React 19 guidance.
  const [trackedEpicId, setTrackedEpicId] = useState<string | null | undefined>(
    epic?.id,
  );
  if (trackedEpicId !== epic?.id) {
    setTrackedEpicId(epic?.id);
    setSelectedStoryId(null);
  }
  const selectedStory =
    stories.find((s) => s.id === selectedStoryId) ?? null;

  if (!epic) return null;

  const inDetailView = selectedStory !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-full sm:max-w-2xl overflow-y-auto overflow-x-hidden"
      >
        <SheetHeader className="border-b">
          {inDetailView && selectedStory ? (
            <>
              {/* SheetTitle stays mounted for the Radix Dialog accessible
                  name; the visible header in StoryDetailView already
                  displays the same information for sighted users. */}
              <SheetTitle className="sr-only">
                Story {selectedStory.id}: {selectedStory.title}
              </SheetTitle>
              <button
                type="button"
                onClick={() => setSelectedStoryId(null)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
                aria-label="Back to stories list"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to stories
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  E{epic.id}
                </span>
                <SheetTitle className="min-w-0 break-words text-sm font-medium">{epic.title}</SheetTitle>
              </div>
              {epic.description && (
                <SheetDescription className="text-[13px]">
                  {epic.description}
                </SheetDescription>
              )}
              <div className="mt-1 flex items-center gap-3">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {epic.completedStories}/{epic.totalStories} stories &middot;{" "}
                  {epic.progressPercent}%
                </span>
                <ProgressBar percent={epic.progressPercent} label={`Epic ${epic.id} progress`} />
              </div>
            </>
          )}
        </SheetHeader>

        <div className="px-2 pb-4">
          {inDetailView && selectedStory ? (
            <StoryDetailView story={selectedStory} />
          ) : stories.length === 0 ? (
            <StateMessage>No story found for this epic</StateMessage>
          ) : (
            <div role="list">
              {stories.map((story) => (
                <div key={story.id} role="listitem">
                  <StoryRow story={story} onClick={() => setSelectedStoryId(story.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
