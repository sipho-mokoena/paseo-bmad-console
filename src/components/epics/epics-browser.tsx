"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GroupLabel, PillToggle, SearchField, StateMessage } from "@/components/shared/list-kit";
import { Filters, type Filter } from "@/components/reui/filters";
import {
  SortMenu,
  statusChips,
  statusFilterField,
  statusValues,
} from "@/components/shared/list-controls";
import { EpicRow } from "./epic-row";
import { StoryRow } from "./story-row";
import { EpicsKanban } from "./epics-kanban";
import { epicHref, groupEpicsByStatus, searchStories, storyHref } from "@/lib/stories-browse";
import {
  browseEpics,
  defaultDirFor,
  filterStoriesByStatuses,
  isGroupedLayout,
  isPageFiltered,
  modeOf,
  parseEpicsPageState,
  serializeEpicsPageState,
  sortKeys,
  sortLabels,
  sortStoryResults,
  statusOptions,
  storyStatusCounts,
  type EpicsPageState,
} from "@/lib/epics-page-params";
import { statusCounts } from "@/lib/epic-list";
import type { Epic, LayoutInfo, StoryDetail } from "@/lib/bmad/types";

type EpicsLayout = "timeline" | "kanban";

interface EpicsBrowserProps {
  epics: Epic[];
  stories: StoryDetail[];
  /** `/repo/<owner>/<repo>` */
  base: string;
  /** Detected layout; its search places explain an empty list. */
  projectLayout?: LayoutInfo;
}

const CLEAR_BTN =
  "inline-flex h-10 items-center rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-8";

/**
 * Level 1: the epics list or board, with search, Filter and Sort kept in the URL
 * (`q`, `st`, `sort`, `dir`). An empty search browses epics; a search lists stories.
 */
export function EpicsBrowser({ epics, stories, base, projectLayout }: EpicsBrowserProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseEpicsPageState(searchParams), [searchParams]);
  const [layout, setLayout] = useState<EpicsLayout>("kanban");

  // Typing and half-made chips keep local state; the URL is the source of truth otherwise.
  const [query, setQuery] = useState(urlState.query);
  const [filters, setFilters] = useState<Filter<string>[]>(statusChips(urlState.statuses));
  const written = useRef({ query: urlState.query, statuses: urlState.statuses.join(",") });

  useEffect(() => {
    if (urlState.query !== written.current.query) setQuery(urlState.query);
    written.current.query = urlState.query;
  }, [urlState.query]);
  const urlStatuses = urlState.statuses.join(",");
  useEffect(() => {
    if (urlStatuses !== written.current.statuses) setFilters(statusChips(urlState.statuses));
    written.current.statuses = urlStatuses;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStatuses]);

  const commit = useCallback(
    (patch: Partial<EpicsPageState>) => {
      const next = { ...urlState, ...patch };
      const qs = serializeEpicsPageState(window.location.search, next).toString();
      window.history.replaceState(null, "", `${pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    },
    [urlState, pathname],
  );

  const mode = modeOf(urlState.query);
  const state = urlState;
  const searching = mode === "stories";

  const onQuery = (value: string) => {
    written.current.query = value;
    setQuery(value);
    commit({ query: value });
  };
  const onFilters = (next: Filter<string>[]) => {
    const statuses = statusValues(next, statusOptions(mode).map((o) => o.value));
    written.current.statuses = statuses.join(",");
    setFilters(next);
    commit({ statuses });
  };
  const clearAll = useCallback(() => {
    written.current = { query: "", statuses: "" };
    setQuery("");
    setFilters([]);
    commit({ query: "", statuses: [] });
  }, [commit]);

  // Clicking the active "Epics" tab clears search, filters and sort.
  useEffect(() => {
    const handleReset = () => {
      written.current = { query: "", statuses: "" };
      setQuery("");
      setFilters([]);
      commit({ query: "", statuses: [], sort: "default", dir: "asc" });
    };
    window.addEventListener("section-reset", handleReset);
    return () => window.removeEventListener("section-reset", handleReset);
  }, [commit]);

  const totalStories = stories.length;

  const searched = useMemo(
    () => (searching ? searchStories(stories, state.query) : []),
    [stories, searching, state.query],
  );
  const results = useMemo(
    () =>
      searching
        ? sortStoryResults(filterStoriesByStatuses(searched, state.statuses), state.sort, state.dir)
        : [],
    [searching, searched, state.statuses, state.sort, state.dir],
  );
  const browsed = useMemo(() => (searching ? [] : browseEpics(epics, state)), [searching, epics, state]);
  const groups = useMemo(() => groupEpicsByStatus(browsed), [browsed]);

  const counts: Record<string, number> = searching
    ? storyStatusCounts(searched)
    : { ...statusCounts(epics) };
  const fields = [statusFilterField(statusOptions(mode), counts)];

  const filteredNow = isPageFiltered(state);
  const epicCount = filteredNow ? `${browsed.length} of ${epics.length}` : `${epics.length}`;
  const grouped = isGroupedLayout(state);

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchField
        value={query}
        onChange={onQuery}
        placeholder="Search all stories"
        clearable
        className="basis-full sm:max-w-xs sm:basis-64 sm:flex-1"
      />
      <Filters filters={filters} fields={fields} onChange={onFilters} allowMultiple={false} size="sm" />
      <SortMenu
        keys={sortKeys(mode)}
        labels={sortLabels(mode)}
        sort={state.sort}
        dir={state.dir}
        defaultKey="default"
        onSort={(sort) => commit({ sort, dir: defaultDirFor(mode, sort) })}
        onDir={(dir) => commit({ dir })}
        className="ml-auto sm:ml-0"
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
          className="sm:ml-auto"
        />
      )}
    </div>
  );

  return (
    <div className="min-w-0 space-y-3 pb-4" role="region" aria-label="Epics">
      {toolbar}

      {searching ? (
        <>
          <GroupLabel count={filteredNow && state.statuses.length > 0 ? `${results.length} of ${searched.length}` : results.length}>
            Results
          </GroupLabel>
          {results.length === 0 ? (
            <StateMessage className="min-h-32 flex-col gap-3">
              <span>No story matches the search</span>
              <button type="button" onClick={clearAll} className={CLEAR_BTN}>
                Clear filters
              </button>
            </StateMessage>
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
          {projectLayout && projectLayout.lookedFor.length > 0
            ? `${projectLayout.recognised ? "No epic found" : "Layout not recognised"}. Looked for: ${projectLayout.lookedFor.join(", ")}.`
            : "No epic found. Epics will appear here once defined in the planning artifacts."}
        </StateMessage>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {epicCount} epics &middot; {totalStories} stories
          </p>
          {browsed.length === 0 ? (
            <StateMessage className="min-h-32 flex-col gap-3">
              <span>No epics match</span>
              <button type="button" onClick={clearAll} className={CLEAR_BTN}>
                Clear filters
              </button>
            </StateMessage>
          ) : layout === "timeline" ? (
            grouped ? (
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
              <div role="list" aria-label="Sorted epics">
                {browsed.map((epic) => (
                  <div key={epic.id} role="listitem">
                    <EpicRow epic={epic} href={epicHref(base, epic.id)} />
                  </div>
                ))}
              </div>
            )
          ) : (
            <EpicsKanban epics={browsed} hrefFor={(id) => epicHref(base, id)} />
          )}
        </>
      )}
    </div>
  );
}
