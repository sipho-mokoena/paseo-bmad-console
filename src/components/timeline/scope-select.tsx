"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { epicLabel } from "@/lib/bmad/ids";

/** Radix items cannot have an empty value, so "All epics" travels as this. */
const ALL = "__all__";

export const scopeLabelOf = (epics: { id: string; title: string }[], scope: string): string => {
  const e = epics.find((x) => x.id === scope);
  return e ? `${epicLabel(e.id)} ${e.title}` : "All epics";
};

interface ScopeSelectProps {
  /** Epic id, or "" for all epics. */
  value: string;
  epics: { id: string; title: string }[];
  onChange: (scope: string) => void;
}

/** "Scope" picker of the Timeline toolbar: the styled Select, looking like the Filter and View buttons. */
export function ScopeSelect({ value, epics, onChange }: ScopeSelectProps) {
  const label = scopeLabelOf(epics, value);
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger
        aria-label={`Scope: ${label}`}
        className="h-10 max-w-full min-w-0 gap-1.5 rounded-lg border-input bg-card px-3 text-sm text-foreground shadow-none data-[size=default]:h-10 md:data-[size=default]:h-9 sm:max-w-[18rem]"
      >
        <span className="shrink-0 text-muted-foreground">Scope</span>
        <SelectValue>
          <span className="truncate">{label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" collisionPadding={8} className="max-h-[min(24rem,var(--radix-select-content-available-height))] max-w-[calc(100vw-1rem)] overflow-y-auto">
        <SelectItem value={ALL} className="min-h-10 md:min-h-8">
          All epics
        </SelectItem>
        {epics.map((e) => (
          <SelectItem key={e.id} value={e.id} className="min-h-10 md:min-h-8">
            {epicLabel(e.id)} {e.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
