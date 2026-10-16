import { Pill } from "@/components/shared/pill";
import type { LayoutInfo, ParseErrorEntry } from "@/lib/bmad/types";

/** Where epics are looked for, as one sentence fragment: "a, b, c". */
export function lookedForText(layout: Pick<LayoutInfo, "lookedFor">): string {
  return layout.lookedFor.join(", ");
}

/** Small muted pill naming the detected layout; notes and search places are in its tooltip. */
export function LayoutPill({ layout }: { layout: LayoutInfo }) {
  const title = [
    layout.recognised ? layout.label : `${layout.label} (not recognised)`,
    ...layout.notes,
    `Looked for: ${lookedForText(layout)}`,
  ].join("\n");
  return (
    <Pill title={title} data-testid="layout-pill" className="font-normal">
      {layout.label}
    </Pill>
  );
}

/** Flat muted notice when the layout was not recognised or produced no epics. */
export function LayoutNotice({ layout }: { layout: LayoutInfo }) {
  if (layout.recognised) return null;
  return (
    <p role="status" className="px-2 text-[13px] text-muted-foreground">
      Layout not recognised: looked for {lookedForText(layout)}.
    </p>
  );
}

/** Collapsible list of layout notes (exclusions, status disagreements) and parse errors. */
export function LayoutDetails({
  layout,
  errors,
}: {
  layout: LayoutInfo;
  errors: ParseErrorEntry[];
}) {
  if (layout.notes.length === 0 && errors.length === 0) return null;
  return (
    <details className="px-2 text-[13px] text-muted-foreground">
      <summary className="cursor-pointer select-none py-1 hover:text-foreground">
        Details
        <span className="ml-1.5 opacity-60">{layout.notes.length + errors.length}</span>
      </summary>
      <ul className="list-disc space-y-1 pb-2 pl-6 [overflow-wrap:anywhere]">
        {layout.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        {errors.slice(0, 20).map((e) => (
          <li key={e.file}>
            <span className="font-mono text-xs">{e.file}</span>: {e.error}
          </li>
        ))}
        {errors.length > 20 && <li>and {errors.length - 20} more files with errors</li>}
      </ul>
    </details>
  );
}
