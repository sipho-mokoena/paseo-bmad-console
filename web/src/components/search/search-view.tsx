"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Search, X } from "lucide-react";
import { GroupLabel, ROW_CLASS, StateMessage } from "@/components/shared/list-kit";
import { EpicRow } from "@/components/epics/epic-row";
import { StoryRow } from "@/components/epics/story-row";
import { cn } from "@/lib/utils";
import { epicHref, storyHref } from "@/lib/stories-browse";
import {
  MAX_QUERY_LENGTH,
  highlightSegments,
  normalizeQuery,
  type DocHit,
  type EpicHit,
  type Ranked,
  type SearchResponse,
  type StoryHit,
} from "@/lib/search";

const DEBOUNCE_MS = 200;

type Target =
  | { kind: "epic"; hit: EpicHit }
  | { kind: "story"; hit: StoryHit }
  | { kind: "doc"; hit: DocHit };

function base(p: { owner: string; name: string }) {
  return `/repo/${encodeURIComponent(p.owner)}/${encodeURIComponent(p.name)}`;
}

function hrefFor(t: Target): string {
  switch (t.kind) {
    case "epic":
      return epicHref(base(t.hit.project), t.hit.epic.id);
    case "story":
      return storyHref(base(t.hit.project), t.hit.story.epicId, t.hit.story.id);
    case "doc":
      return `${base(t.hit.project)}/docs?file=${encodeURIComponent(t.hit.path)}`;
  }
}

export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightSegments(text, terms).map((seg, i) =>
        seg.match ? (
          <mark key={i} className="rounded-xs bg-primary/30 px-px text-foreground">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function DocRow({
  hit,
  terms,
  selected,
  onClick,
}: {
  hit: DocHit;
  terms: string[];
  selected: boolean;
  onClick: () => void;
}) {
  const dir = hit.path.slice(0, Math.max(0, hit.path.length - hit.name.length)).replace(/\/$/, "");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open document ${hit.path}`}
      className={cn(ROW_CLASS, "flex-col items-stretch gap-0.5 py-1.5 md:py-1.5", selected && "bg-accent")}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 shrink-0 max-w-[60%] truncate">
          <Highlight text={hit.name} terms={terms} />
        </span>
        {dir && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{dir}</span>
        )}
        <span
          title={hit.project.displayName}
          className="ml-auto max-w-24 shrink-0 truncate text-xs text-muted-foreground lg:w-28 lg:max-w-none"
        >
          {hit.project.displayName}
        </span>
      </span>
      {hit.snippet && (
        <span className="line-clamp-2 break-words pl-[1.375rem] text-xs text-muted-foreground md:line-clamp-1">
          <Highlight text={hit.snippet} terms={terms} />
        </span>
      )}
    </button>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="space-y-1 pt-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

function CapNote({ group }: { group: Ranked<unknown> }) {
  if (group.total <= group.items.length) return null;
  return (
    <p className="px-2 pt-1 text-xs text-muted-foreground">
      Showing the first {group.items.length} of {group.total}. Refine the search to narrow down.
    </p>
  );
}

export function SearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);

  const [text, setText] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce typing into the committed query and mirror it into the URL (replace, not push).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      setQuery(text);
      const t = text.trim();
      router.replace(t ? `/search?q=${encodeURIComponent(t)}` : "/search", { scroll: false });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text, router]);

  // Fetch for the committed query; abort superseded requests.
  const normalized = normalizeQuery(query);
  useEffect(() => {
    if (!normalized) return;
    const ctrl = new AbortController();
    let cancelled = false;
    queueMicrotask(() => !cancelled && setStatus("loading"));
    fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as { result: SearchResponse | null };
      })
      .then(({ result }) => {
        if (cancelled) return;
        setData(result);
        setSelected(0);
        setStatus("done");
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [normalized]);

  const active = normalized && data && data.query === normalized ? data : null;
  const shown = normalized ? data : null;

  const targets = useMemo<Target[]>(() => {
    if (!shown) return [];
    return [
      ...shown.epics.items.map((hit): Target => ({ kind: "epic", hit })),
      ...shown.stories.items.map((hit): Target => ({ kind: "story", hit })),
      ...shown.docs.items.map((hit): Target => ({ kind: "doc", hit })),
    ];
  }, [shown]);

  const open = useCallback(
    (t: Target) => router.push(hrefFor(t)),
    [router],
  );

  // Keep the selected row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-result-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, targets]);

  // "/" focuses the field; arrows and Enter work while focus is in the field or nowhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inField = el === inputRef.current;
      const typing =
        !inField &&
        !!el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" && !inField) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      const idle = inField || el === document.body;
      if (!idle || targets.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, targets.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && inField) {
        e.preventDefault();
        const t = targets[Math.min(selected, targets.length - 1)];
        if (t) open(t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [targets, selected, open]);

  const clear = () => {
    setText("");
    inputRef.current?.focus();
  };

  const terms = shown?.terms ?? [];
  const storyOffset = shown?.epics.items.length ?? 0;
  const docOffset = storyOffset + (shown?.stories.items.length ?? 0);
  const rowProps = (t: Target, i: number) => ({
    i,
    selected: i === selected,
    onOpen: () => open(t),
  });

  const trimmed = text.trim();
  const tooShort = trimmed.length > 0 && !normalizeQuery(trimmed);
  const total = shown ? shown.epics.total + shown.stories.total + shown.docs.total : 0;
  const busy = status === "loading";

  return (
    <div className="min-w-0 space-y-1 pb-4" role="search">
      <div className="relative min-w-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          autoFocus
          type="search"
          value={text}
          maxLength={MAX_QUERY_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              setText("");
            }
          }}
          placeholder="Search epics, stories and documents"
          aria-label="Search epics, stories and documents"
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-10 text-[13px] outline-hidden placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            <X />
          </button>
        )}
      </div>

      {!normalized ? (
        <StateMessage className="min-h-32">
          {tooShort
            ? "Type at least 2 characters to search."
            : "Search across all your projects: epics, stories and documents."}
        </StateMessage>
      ) : status === "error" && !shown ? (
        <StateMessage role="alert">Search is unavailable right now. Try again.</StateMessage>
      ) : !shown ? (
        <Skeleton />
      ) : (
        <div ref={listRef} aria-busy={busy} className={cn(busy && !active && "opacity-60 transition-opacity")}>
          <p className="sr-only" role="status" aria-live="polite">
            {busy ? "Searching" : `${total} results`}
          </p>
          {status === "error" && (
            <p role="alert" className="px-2 pt-3 text-xs text-muted-foreground">
              The last search failed. Showing earlier results.
            </p>
          )}
          {total === 0 ? (
            <StateMessage className="min-h-32">
              No results for &ldquo;{shown.query}&rdquo;
            </StateMessage>
          ) : (
            <>
              {shown.epics.items.length > 0 && (
                <section aria-label="Epics">
                  <GroupLabel count={shown.epics.total}>Epics</GroupLabel>
                  <div role="list">
                    {shown.epics.items.map((hit, n) => {
                      const r = rowProps({ kind: "epic", hit }, n);
                      return (
                        <div
                          key={`${hit.project.owner}/${hit.project.name}#${hit.epic.id}`}
                          role="listitem"
                          data-result-index={r.i}
                        >
                          <EpicRow
                            epic={hit.epic}
                            project={hit.project.displayName}
                            href={hrefFor({ kind: "epic", hit })}
                            className={r.selected ? "bg-accent" : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <CapNote group={shown.epics} />
                </section>
              )}
              {shown.stories.items.length > 0 && (
                <section aria-label="Stories">
                  <GroupLabel count={shown.stories.total}>Stories</GroupLabel>
                  <div role="list">
                    {shown.stories.items.map((hit, n) => {
                      const r = rowProps({ kind: "story", hit }, storyOffset + n);
                      return (
                        <div
                          key={`${hit.project.owner}/${hit.project.name}#${hit.story.id}`}
                          role="listitem"
                          data-result-index={r.i}
                        >
                          <StoryRow
                            story={hit.story}
                            showEpic
                            project={hit.project.displayName}
                            href={hrefFor({ kind: "story", hit })}
                            className={r.selected ? "bg-accent" : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <CapNote group={shown.stories} />
                </section>
              )}
              {shown.docs.items.length > 0 && (
                <section aria-label="Documents">
                  <GroupLabel count={shown.docs.total}>Documents</GroupLabel>
                  <div role="list">
                    {shown.docs.items.map((hit, n) => {
                      const r = rowProps({ kind: "doc", hit }, docOffset + n);
                      return (
                        <div
                          key={`${hit.project.owner}/${hit.project.name}:${hit.path}`}
                          role="listitem"
                          data-result-index={r.i}
                        >
                          <DocRow
                            hit={hit}
                            terms={terms}
                            selected={r.selected}
                            onClick={r.onOpen}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <CapNote group={shown.docs} />
                </section>
              )}
            </>
          )}
          {shown.notes.length > 0 && (
            <div className="px-2 pt-4 text-xs text-muted-foreground">
              {shown.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
