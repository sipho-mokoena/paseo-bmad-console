import Link from "next/link";
import { X } from "lucide-react";
import { Pill, StatusPill } from "@/components/shared/pill";
import { riskTone } from "@/components/epics/story-ticket-meta";
import { epicLabel } from "@/lib/bmad/ids";
import { epicHref, storyHref } from "@/lib/stories-browse";
import { cn } from "@/lib/utils";
import { waveLabel } from "./timeline-style";

export interface DetailRef {
  /** Selection key to jump to. */
  key: string;
  label: string;
  title: string;
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

const LINK =
  "inline-flex min-h-10 items-center rounded-md px-1 text-sm underline decoration-dotted underline-offset-2 outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-7";
const PAGE_LINK =
  "inline-flex h-10 items-center rounded-md border border-input px-3 text-sm outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-8";

function RefList({ title, refs, onSelect }: { title: string; refs: DetailRef[]; onSelect(key: string): void }) {
  return (
    <div className="space-y-0.5">
      <h4 className="text-xs text-muted-foreground">
        {title} <span className="opacity-60">{refs.length}</span>
      </h4>
      {refs.length === 0 ? (
        <p className="text-xs text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-0.5">
          {refs.map((r) => (
            <li key={r.key} className="min-w-0">
              <button type="button" onClick={() => onSelect(r.key)} className={cn(LINK, "max-w-full text-left")}>
                <span className="mr-1.5 shrink-0 font-mono text-xs text-muted-foreground">{r.label}</span>
                <span className="truncate">{r.title}</span>
              </button>
              {r.needs && <p className="pl-1 text-xs text-muted-foreground">needs {r.needs}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  return (
    <aside aria-label={`Details of ${item.id}`} className="min-w-0 space-y-3 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{item.kind === "story" ? item.id : epicLabel(item.id)}</p>
          <h3 className="break-words text-base font-medium leading-snug">{item.title}</h3>
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-8"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.kind === "external" ? <Pill>Outside this epic</Pill> : <StatusPill status={item.status as never} />}
        {item.ready && <Pill tone="success">Ready now</Pill>}
        {item.critical && <Pill tone="danger">Critical path</Pill>}
        {item.type && <Pill className="capitalize">{item.type}</Pill>}
        {item.risk && (
          <Pill tone={riskTone(item.risk)} className="capitalize">
            {item.risk} risk
          </Pill>
        )}
        <Pill>{waveLabel(item.start, item.end)}</Pill>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-xs text-muted-foreground">Epic</dt>
        <dd className="min-w-0 truncate">
          <span className="mr-1.5 font-mono text-xs text-muted-foreground">{epicLabel(item.epicId)}</span>
          {item.epicTitle}
        </dd>
        {item.progress && (
          <>
            <dt className="text-xs text-muted-foreground">Stories</dt>
            <dd className="tabular-nums">
              {item.progress.done} of {item.progress.total} done
            </dd>
          </>
        )}
        {item.members && (
          <>
            <dt className="text-xs text-muted-foreground">Stands for</dt>
            <dd className="min-w-0 break-words font-mono text-xs">{item.members.join(", ")}</dd>
          </>
        )}
      </dl>
      <RefList title={item.kind === "epic" ? "Depends on" : "Blocked by"} refs={item.kind === "epic" ? item.after : item.blockedBy} onSelect={onSelect} />
      {item.kind !== "epic" && item.after.length > item.blockedBy.length && (
        <RefList title="Prerequisites (done and open)" refs={item.after} onSelect={onSelect} />
      )}
      <RefList title="Blocks" refs={item.blocks} onSelect={onSelect} />
      <div className="flex flex-wrap gap-2 pt-1">
        {item.kind === "story" && (
          <Link href={storyHref(base, item.epicId, item.id)} className={PAGE_LINK}>
            Open story
          </Link>
        )}
        <Link href={epicHref(base, item.epicId)} className={PAGE_LINK}>
          Open epic
        </Link>
      </div>
    </aside>
  );
}
