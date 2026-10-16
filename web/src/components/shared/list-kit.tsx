import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small muted group label, like "Today" in Paseo History. */
export function GroupLabel({
  children,
  count,
  className,
}: {
  children: React.ReactNode;
  count?: number | string;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "px-2 pb-1 pt-4 text-xs font-normal text-muted-foreground",
        className,
      )}
    >
      {children}
      {count !== undefined && <span className="ml-1.5 opacity-60">{count}</span>}
    </h2>
  );
}

/** Row chrome: 36px, no border, hover fill, focus ring. Use on a button or link. */
export const ROW_CLASS =
  "group/row flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-hidden transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:py-1";

/** Flat, small, muted, centred message for empty / loading / error states. */
export function StateMessage({
  children,
  role,
  className,
}: {
  children: React.ReactNode;
  role?: string;
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-40 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ElementType;
  ariaLabel?: string;
}

/** Small pill toggle ("Preview | Source" in Paseo). */
export function PillToggle<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ToggleOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex shrink-0 items-center gap-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:h-6 md:px-2.5 [&_svg]:size-3.5",
              active && "bg-secondary text-foreground",
            )}
          >
            {Icon && <Icon aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Raised, bordered, 36px search field. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  clearable = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  ariaLabel?: string;
  /** Shows a clear button when there is text, and makes Esc clear it. */
  clearable?: boolean;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          clearable
            ? (e) => {
                if (e.key === "Escape" && value) {
                  e.preventDefault();
                  onChange("");
                }
              }
            : undefined
        }
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn("h-10 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-hidden placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 md:h-9 [&::-webkit-search-cancel-button]:hidden", clearable && "pr-10 md:pr-9")}
      />
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-0 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:size-9"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export interface Stat {
  label: string;
  value: React.ReactNode;
}

/** One row of small label + number pairs separated by hairlines (wraps on phones). */
export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "flex flex-wrap gap-px overflow-hidden rounded-lg border bg-border",
        className,
      )}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex min-w-0 flex-1 basis-[28%] flex-col gap-0.5 bg-background px-3 py-2 sm:basis-0"
        >
          <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
          <dd className="text-base font-medium tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
