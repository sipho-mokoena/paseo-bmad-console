"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { EpicRow } from "@/components/epics/epic-row";
import { GroupLabel, SearchField, StateMessage } from "@/components/shared/list-kit";
import { Filters, type Filter } from "@/components/reui/filters";
import { SortMenu, statusChips, statusFilterField, statusValues } from "@/components/shared/list-controls";
import { cn } from "@/lib/utils";
import { epicHref } from "@/lib/stories-browse";
import {
  DEFAULT_DIR,
  DEFAULT_STATE,
  EPIC_STATUSES,
  SORT_KEYS,
  SORT_LABELS,
  computeEpicList,
  isFiltered,
  pageItems,
  parseListState,
  serializeListState,
  showToolbar,
  type EpicListState,
  type EpicSortKey,
} from "@/lib/epic-list";
import type { Epic, EpicStatus } from "@/lib/bmad/types";

interface EpicsListViewProps {
  epics: Epic[];
  /** `/repo/<owner>/<repo>` */
  base: string;
}

const dirWord = (dir: "asc" | "desc") => (dir === "asc" ? "ascending" : "descending");

/** Overview epic list: search, status filter, sort and pagination, kept in the URL. */
export function EpicsListView({ epics, base }: EpicsListViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlState = useMemo(() => parseListState(searchParams), [searchParams]);
  const toolbar = showToolbar(epics.length);

  // Typing and the filter chips keep local state so the caret and half-made chips
  // survive; the URL is the source of truth for everything else.
  const [query, setQuery] = useState(urlState.query);
  const [filters, setFilters] = useState<Filter<string>[]>(statusFilters(urlState.statuses));
  const written = useRef({ query: urlState.query, statuses: urlState.statuses.join(",") });
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (urlState.query !== written.current.query) setQuery(urlState.query);
    written.current.query = urlState.query;
  }, [urlState.query]);
  const urlStatuses = urlState.statuses.join(",");
  useEffect(() => {
    if (urlStatuses !== written.current.statuses) setFilters(statusFilters(urlState.statuses));
    written.current.statuses = urlStatuses;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStatuses]);

  // The toolbar is hidden for short lists, so its params would only hide epics.
  const state: EpicListState = toolbar ? urlState : DEFAULT_STATE;
  const { counts, filtered, page } = useMemo(() => computeEpicList(epics, state), [epics, state]);
  const filteredNow = isFiltered(state);

  const commit = useCallback(
    (patch: Partial<EpicListState>, mode: "replace" | "push" = "replace") => {
      const next = { ...urlState, ...patch };
      if (!("page" in patch)) next.page = 1;
      const params = serializeListState(window.location.search, next);
      const qs = params.toString();
      const url = `${pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      if (mode === "push") window.history.pushState(null, "", url);
      else window.history.replaceState(null, "", url);
    },
    [urlState, pathname],
  );

  const onQuery = (value: string) => {
    written.current.query = value;
    setQuery(value);
    commit({ query: value });
  };
  const onFilters = (next: Filter<string>[]) => {
    const statuses = statusesOf(next);
    written.current.statuses = statuses.join(",");
    setFilters(next);
    commit({ statuses });
  };
  const setSort = (sort: EpicSortKey, dir = DEFAULT_DIR[sort]) => commit({ sort, dir });
  const toggleColumn = (key: EpicSortKey) =>
    state.sort === key
      ? commit({ dir: state.dir === "asc" ? "desc" : "asc" })
      : setSort(key);
  const goTo = (n: number) => {
    commit({ page: n }, "push");
    const el = sectionRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
  };
  const clearAll = () => {
    written.current = { query: "", statuses: "" };
    setQuery("");
    setFilters([]);
    commit({ query: "", statuses: [] });
  };

  const fields = [statusFilterField(EPIC_STATUSES, counts)];

  const countLabel = filteredNow
    ? `${filtered.length} of ${epics.length}`
    : `${epics.length}`;
  const rangeStart = page.from;

  return (
    <section ref={sectionRef} aria-label="Epics" className="scroll-mt-24">
      <GroupLabel count={countLabel}>Epics</GroupLabel>
      <p className="sr-only" role="status" aria-live="polite">
        {countLabel} epics
      </p>

      {toolbar && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
          <SearchField
            value={query}
            onChange={onQuery}
            placeholder="Search epics"
            clearable
            className="basis-full sm:max-w-xs sm:basis-64 sm:flex-1"
          />
          <Filters
            filters={filters}
            fields={fields}
            onChange={onFilters}
            allowMultiple={false}
            size="sm"
          />
          <SortMenu
            keys={SORT_KEYS}
            labels={SORT_LABELS}
            sort={state.sort}
            dir={state.dir}
            defaultKey="default"
            onSort={(k) => setSort(k)}
            onDir={(dir) => commit({ dir })}
            className="ml-auto sm:ml-0"
          />
        </div>
      )}

      {toolbar && filtered.length > 0 && (
        <div
          role="group"
          aria-label="Sort epics by column"
          className="sticky top-[calc(var(--app-header-h)+2.5rem)] z-10 hidden items-center gap-3 border-b bg-background px-2 py-1 text-xs text-muted-foreground md:flex"
        >
          <ColumnHead label="ID" k="id" state={state} onSort={toggleColumn} className="min-w-7" />
          <ColumnHead label="Title" k="title" state={state} onSort={toggleColumn} className="flex-1" />
          <ColumnHead label="Stories" k="stories" state={state} onSort={toggleColumn} className="w-12 justify-end" />
          <ColumnHead label="Progress" k="progress" state={state} onSort={toggleColumn} className="w-24" />
          <ColumnHead label="Status" k="status" state={state} onSort={toggleColumn} className="w-24 justify-end" />
        </div>
      )}

      {filtered.length === 0 ? (
        <StateMessage className="min-h-32 flex-col gap-3">
          <span>
            {state.query.trim()
              ? `No epics match “${state.query.trim()}”`
              : "No epics match the filters"}
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex h-10 items-center rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-8"
          >
            Clear filters
          </button>
        </StateMessage>
      ) : (
        <div role="list">
          {page.items.map((epic) => (
            <div key={epic.id} role="listitem">
              <EpicRow epic={epic} href={epicHref(base, epic.id)} />
            </div>
          ))}
        </div>
      )}

      {page.pages > 1 && (
        <nav
          aria-label="Epics pagination"
          className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-2 pt-2 text-xs text-muted-foreground"
        >
          <span className="tabular-nums">
            Showing {rangeStart}-{page.to} of {page.total}
          </span>
          <div className="flex items-center gap-1">
            <PageButton
              label="Previous page"
              disabled={page.page <= 1}
              onClick={() => goTo(page.page - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Prev</span>
            </PageButton>
            <span className="px-2 tabular-nums sm:hidden" aria-hidden="true">
              {page.page} / {page.pages}
            </span>
            <div className="hidden items-center gap-1 sm:flex">
              {pageItems(page.page, page.pages).map((it, i) =>
                it === "…" ? (
                  <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                    …
                  </span>
                ) : (
                  <PageButton
                    key={it}
                    label={`Page ${it}`}
                    current={it === page.page}
                    onClick={() => goTo(it)}
                  >
                    {it}
                  </PageButton>
                ),
              )}
            </div>
            <PageButton
              label="Next page"
              disabled={page.page >= page.pages}
              onClick={() => goTo(page.page + 1)}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </PageButton>
          </div>
        </nav>
      )}
    </section>
  );
}

const statusFilters = (statuses: EpicStatus[]) => statusChips(statuses, "epic-status");
const statusesOf = (filters: Filter<string>[]) =>
  statusValues(filters, EPIC_STATUSES.map((s) => s.value)) as EpicStatus[];

function ColumnHead({
  label,
  k,
  state,
  onSort,
  className,
}: {
  label: string;
  k: EpicSortKey;
  state: EpicListState;
  onSort: (k: EpicSortKey) => void;
  className?: string;
}) {
  const active = state.sort === k;
  const Icon = state.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <span className={cn("flex shrink-0", className)}>
      <button
        type="button"
        onClick={() => onSort(k)}
        aria-label={
          active ? `Sort by ${label}, currently ${dirWord(state.dir)}` : `Sort by ${label}`
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-sm outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        {active && <Icon className="size-3" aria-hidden="true" />}
      </button>
    </span>
  );
}

function PageButton({
  label,
  current,
  disabled,
  onClick,
  children,
}: {
  label: string;
  current?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={current ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-md px-2 text-xs outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 md:h-8 md:min-w-8",
        current && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}
