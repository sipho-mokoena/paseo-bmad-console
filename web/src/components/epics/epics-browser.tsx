"use client";

import { useState, useMemo, useEffect } from "react";
import { GroupLabel, PillToggle, StateMessage } from "@/components/shared/list-kit";
import { StoryFilters, type Filter } from "@/components/stories/story-filters";
import { EpicRow } from "./epic-row";
import { StoryRow } from "./story-row";
import { EpicsKanban } from "./epics-kanban";
import {
  epicHref,
  filterStoriesByStatus,
  groupEpicsByStatus,
  searchStories,
  storyHref,
} from "@/lib/stories-browse";
import type { Epic, StoryDetail } from "@/lib/bmad/types";

type EpicsLayout = "timeline" | "kanban";

interface EpicsBrowserProps {
  epics: Epic[];
  stories: StoryDetail[];
  /** `/repo/<owner>/<repo>` */
  base: string;
}

/** Level 1: the grouped epic list, plus search and filter across every story. */
export function EpicsBrowser({ epics, stories, base }: EpicsBrowserProps) {
  const [layout, setLayout] = useState<EpicsLayout>("timeline");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filter<string>[]>([]);

  // Clicking the active "Epics" tab clears the search.
  useEffect(() => {
    const handleReset = () => {
      setSearch("");
      setFilters([]);
    };
    window.addEventListener("section-reset", handleReset);
    return () => window.removeEventListener("section-reset", handleReset);
  }, []);

  const groups = useMemo(() => groupEpicsByStatus(epics), [epics]);
  const searching = search.trim() !== "";
  const totalStories = stories.length;

  const results = useMemo(
    () => (searching ? filterStoriesByStatus(searchStories(stories, search), filters) : []),
    [stories, searching, search, filters],
  );

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label="Epics">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <StoryFilters
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          placeholder="Search all stories"
          hideFilters={!searching}
        />
        {!searching && (
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
        )}
      </div>

      {searching ? (
        <>
          <GroupLabel count={results.length}>Results</GroupLabel>
          {results.length === 0 ? (
            <StateMessage>No story matches the search</StateMessage>
          ) : (
            <div role="list" aria-label="Search results">
              {results.map((story) => (
                <div key={story.id} role="listitem">
                  <StoryRow story={story} showEpic href={storyHref(base, story.epicId, story.id)} />
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
            {epics.length} epics &middot; {totalStories} stories
          </p>
          {layout === "timeline" ? (
            <div>
              {groups.map((g) => (
                <section key={g.status} aria-label={g.label}>
                  <GroupLabel count={g.epics.length}>{g.label}</GroupLabel>
                  <div role="list">
                    {g.epics.map((epic) => (
                      <div key={epic.id} role="listitem">
                        <EpicRow epic={epic} href={epicHref(base, epic.id)} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EpicsKanban epics={epics} hrefFor={(id) => epicHref(base, id)} />
          )}
        </>
      )}
    </div>
  );
}
