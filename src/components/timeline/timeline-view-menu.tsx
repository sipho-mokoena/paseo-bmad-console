"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { viewToggleCount, viewToggleKeys, type TimelineState, type TimelineViewId, type ViewToggleKey } from "@/lib/timeline-params";

export const VIEW_TOGGLE_LABELS: Record<ViewToggleKey, { label: string; hint?: string }> = {
  critical: { label: "Highlight critical path" },
  all: { label: "Show all dependencies" },
  risk: { label: "Size by risk", hint: "Bars last 1, 2 or 3 waves for low, medium and high risk" },
};

const VIEW_BTN =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:text-foreground md:h-9 [&_svg]:size-3.5";

interface TimelineViewMenuProps {
  state: Pick<TimelineState, ViewToggleKey>;
  view: TimelineViewId;
  hasRisk: boolean;
  /** Offers Expand all / Collapse all. */
  canExpand: boolean;
  onToggle: (patch: Partial<Pick<TimelineState, ViewToggleKey>>) => void;
  onExpandAll: (open: boolean) => void;
}

/** "View" dropdown of the Timeline toolbar: chart toggles as checkable items, then the expand actions. */
export function TimelineViewMenu({ state, view, hasRisk, canExpand, onToggle, onExpandAll }: TimelineViewMenuProps) {
  const count = viewToggleCount(state, view, hasRisk);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={VIEW_BTN} aria-label={count ? `View options, ${count} on` : "View options"}>
        <SlidersHorizontal aria-hidden="true" />
        <span>View</span>
        {count > 0 && (
          <span aria-hidden="true" className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-xs leading-none text-foreground">
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={8} className="w-64 max-w-[calc(100vw-1rem)]">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chart</DropdownMenuLabel>
        {viewToggleKeys(view, hasRisk).map((k) => (
          <DropdownMenuCheckboxItem
            key={k}
            checked={state[k]}
            onCheckedChange={(on) => onToggle({ [k]: on })}
            onSelect={(e) => e.preventDefault()}
            className="min-h-10 md:min-h-8"
          >
            <span className="flex flex-col">
              <span>{VIEW_TOGGLE_LABELS[k].label}</span>
              {VIEW_TOGGLE_LABELS[k].hint && <span className="text-xs text-muted-foreground">{VIEW_TOGGLE_LABELS[k].hint}</span>}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
        {canExpand && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-10 md:min-h-8" onSelect={() => onExpandAll(true)}>
              Expand all
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-10 md:min-h-8" onSelect={() => onExpandAll(false)}>
              Collapse all
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
