"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Filter, FilterFieldConfig } from "@/components/reui/filters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

const dirWord = (dir: SortDirection) => (dir === "asc" ? "ascending" : "descending");

export const SORT_BTN =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-9 [&_svg]:size-3.5";

/**
 * The "Sort" dropdown (key + Ascending/Descending) and the direction toggle button
 * next to it. Shared by the Overview epic list and the Epics page.
 */
export function SortMenu<K extends string>({
  keys,
  labels,
  sort,
  dir,
  defaultKey,
  onSort,
  onDir,
  className,
}: {
  keys: readonly K[];
  labels: Record<K, string>;
  sort: K;
  dir: SortDirection;
  /** The key that means "no override": the trigger then just reads "Sort". */
  defaultKey: K;
  onSort: (key: K) => void;
  onDir: (dir: SortDirection) => void;
  className?: string;
}) {
  const active = sort !== defaultKey;
  const SortDirIcon = dir === "asc" ? ArrowUp : ArrowDown;
  const other: SortDirection = dir === "asc" ? "desc" : "asc";
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger className={SORT_BTN} aria-label={`Sort: ${labels[sort]}`}>
          <ArrowUpDown aria-hidden="true" />
          <span>{active ? labels[sort] : "Sort"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as K)}>
            {keys.map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="text-sm">
                {labels[k]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={dir} onValueChange={(v) => onDir(v as SortDirection)}>
            <DropdownMenuRadioItem value="asc" className="text-sm">
              Ascending
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc" className="text-sm">
              Descending
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onClick={() => onDir(other)}
        aria-label={`Sort direction: ${dirWord(dir)}. Switch to ${dirWord(other)}`}
        className={cn(SORT_BTN, "w-10 justify-center px-0 md:w-9")}
      >
        <SortDirIcon aria-hidden="true" />
      </button>
    </div>
  );
}

/** The single "Status" multiselect field of the Filter control, options carrying counts. */
export function statusFilterField(
  options: { value: string; label: string }[],
  counts: Record<string, number>,
): FilterFieldConfig<string> {
  return {
    key: "status",
    label: "Status",
    type: "multiselect",
    operators: [{ value: "is_any_of", label: "is any of", supportsMultiple: true }],
    options: options.map((o) => ({ value: o.value, label: `${o.label} (${counts[o.value] ?? 0})` })),
  };
}

/** Status values as the one filter chip the Filter control shows (none when empty). */
export function statusChips(values: string[], id = "status-filter"): Filter<string>[] {
  return values.length ? [{ id, field: "status", operator: "is_any_of", values }] : [];
}

/** The status values selected in the chips, limited to `valid` ones. */
export function statusValues(filters: Filter<string>[], valid: readonly string[]): string[] {
  const ok = new Set(valid);
  return [
    ...new Set(
      filters.filter((f) => f.field === "status").flatMap((f) => f.values).filter((v) => ok.has(v)),
    ),
  ];
}
