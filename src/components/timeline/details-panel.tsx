import Link from "next/link";
import { X } from "lucide-react";
import { DefinitionTable, type DefinitionRow } from "@/components/shared/definition-table";
import { Pill, StatusPill } from "@/components/shared/pill";
import { statusStyle } from "./timeline-style";
import { epicLabel } from "@/lib/bmad/ids";
import { epicHref, storyHref } from "@/lib/stories-browse";
import { cn } from "@/lib/utils";

export interface DetailRef {
  /** Selection key to jump to. */
  key: string;
  label: string;
  title: string;
  status?: string;
  /** Epic dependencies: why it is needed. */
  needs?: string;
}

export interface DetailItem {
  key: string;
  id: string;
  kind: "story" | "epic" | "external";
  title: string;
  status: string;
  epicId: string;
  epicTitle: string;
  risk?: string;
  type?: string;
  start: number;
  end: number;
  ready: boolean;
  critical: boolean;
  blockedBy: DetailRef[];
  after: DetailRef[];
  blocks: DetailRef[];
  /** External nodes: stories they stand for. */
  members?: string[];
  /** Epics: number of stories (done / total). */
  progress?: { done: number; total: number };
}

const BTN =
  "inline-flex h-10 flex-1 items-center justify-center rounded-md border px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:flex-none";
const BTN_PRIMARY = cn(BTN, "border-transparent bg-primary text-primary-foreground hover:bg-primary/90");
const BTN_SECONDARY = cn(BTN, "border-input hover:bg-accent");

function RefSection({
  title,
  refs,
  onSelect,
  note,
  openKeys,
}: {
  title: string;
  refs: DetailRef[];
  onSelect(key: string): void;
  note?: string;
  openKeys?: Set<string>;
}) {
  if (refs.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-1">
      <h4 className="text-xs text-muted-foreground">
        {title} <span className="tabular-nums opacity-60">{refs.length}</span>
      </h4>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <ul className="overflow-hidden rounded-lg border">
        {refs.map((r, i) => {
          const open = openKeys?.has(r.key) ?? false;
          const st = statusStyle(r.status ?? "unknown");
          return (
            <li key={r.key} className={cn("min-w-0", i > 0 && "border-t")}>
              <button
                type="button"
                title={`${r.label} ${r.title}`}
                onClick={() => onSelect(r.key)}
                className="flex min-h-10 w-full min-w-0 items-center gap-2 px-3 py-1.5 text-left text-sm outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:min-h-8"
              >
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", st.dot)} />
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.label}</span>
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {open && <span className="shrink-0 text-xs text-muted-foreground">open</span>}
              </button>
              {r.needs && <p className="px-3 pb-1.5 pl-7 text-xs text-muted-foreground">needs {r.needs}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Compact details of the selected item: below the chart on phones, to its right on desktop. */
export function DetailsPanel({
  item,
  base,
  onSelect,
  onClose,
}: {
  item: DetailItem;
  base: string;
  onSelect(key: string): void;
  onClose(): void;
}) {
  const isEpic = item.kind === "epic";
  const prereqs = item.after;
  const openKeys = new Set(item.blockedBy.map((r) => r.key));
  const openCount = isEpic ? 0 : item.blockedBy.length;
  const rows: DefinitionRow[] = [];
  if (!isEpic) {
    rows.push({
      label: "Epic",
      value: (
        <Link href={epicHref(base, item.epicId)} className="block truncate rounded-sm outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring" title={item.epicTitle}>
          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{epicLabel(item.epicId)}</span>
          {item.epicTitle}
        </Link>
      ),
    });
  }
  if (item.progress) {
    rows.push({ label: "Stories", value: <span className="tabular-nums">{item.progress.done} of {item.progress.total} done</span> });
  }
  const span = item.end - item.start > 1;
  rows.push({
    label: "Wave",
    value: (
      <span className="tabular-nums">
        {item.start + 1}
        {span && <span className="text-muted-foreground">{` (Waves ${item.start + 1} to ${item.end})`}</span>}
      </span>
    ),
  });
  if (item.risk) rows.push({ label: "Risk", value: <span className="capitalize">{item.risk}</span> });
  if (item.type) rows.push({ label: "Type", value: <span className="capitalize">{item.type}</span> });
  if (item.members) rows.push({ label: "Stands for", value: <span className="font-mono text-xs">{item.members.join(", ")}</span> });
  if (item.ready || item.critical) {
    rows.push({
      label: "Flags",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {item.ready && <Pill tone="success">Ready now</Pill>}
          {item.critical && <Pill tone="danger">Critical path</Pill>}
        </span>
      ),
    });
  }
  const noDeps = prereqs.length === 0 && item.blocks.length === 0;
  return (
    <aside aria-label={`Details of ${item.id}`} className="min-w-0 space-y-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {item.kind === "story" ? item.id : epicLabel(item.id)}
            {item.kind === "external" && <span className="ml-2 font-sans">Outside this epic</span>}
          </p>
          {item.kind !== "external" && <StatusPill status={item.status as never} />}
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="-mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-8"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <h3 title={item.title} className="line-clamp-2 break-words text-base font-medium leading-snug">
          {item.title}
        </h3>
      </div>
      <DefinitionTable rows={rows} className="grid-cols-[minmax(4.5rem,6rem)_minmax(0,1fr)]" />
      <RefSection
        title={isEpic ? "Depends on" : "Prerequisites"}
        refs={prereqs}
        onSelect={onSelect}
        openKeys={openKeys}
        note={openCount > 0 ? `Blocked by ${openCount} open ${openCount === 1 ? "prerequisite" : "prerequisites"}` : undefined}
      />
      <RefSection title="Blocks" refs={item.blocks} onSelect={onSelect} />
      {noDeps && <p className="text-xs text-muted-foreground">No dependencies</p>}
      <div className="flex gap-2 pt-1">
        {item.kind === "story" && (
          <Link href={storyHref(base, item.epicId, item.id)} className={BTN_PRIMARY}>
            Open story
          </Link>
        )}
        <Link href={epicHref(base, item.epicId)} className={item.kind === "story" ? BTN_SECONDARY : BTN_PRIMARY}>
          Open epic
        </Link>
      </div>
    </aside>
  );
}
