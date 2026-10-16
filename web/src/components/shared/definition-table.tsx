import { cn } from "@/lib/utils";

export interface DefinitionRow {
  label: string;
  value: React.ReactNode;
}

/** Two-column hairline table with a subtle raised label column (Paseo frontmatter table). */
export function DefinitionTable({
  rows,
  className,
}: {
  rows: DefinitionRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(5.5rem,9rem)_minmax(0,1fr)] overflow-hidden rounded-lg border text-sm",
        className,
      )}
    >
      {rows.map((r, i) => (
        <div key={r.label} className="contents">
          <dt
            className={cn(
              "bg-card px-3 py-2 text-muted-foreground",
              i > 0 && "border-t",
            )}
          >
            {r.label}
          </dt>
          <dd
            className={cn(
              "min-w-0 break-words px-3 py-2",
              i > 0 && "border-t",
            )}
          >
            {r.value || <span className="text-muted-foreground">&nbsp;</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
