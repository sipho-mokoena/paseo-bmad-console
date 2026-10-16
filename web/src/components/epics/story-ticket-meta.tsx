import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StoryDetail, StoryTicketMeta } from "@/lib/bmad/types";

const RISK_TONE: Record<string, string> = {
  low: "bg-success/15 text-success-foreground border-success/25",
  medium: "bg-warning/15 text-warning-foreground border-warning/25",
  high: "bg-destructive/15 text-destructive-foreground border-destructive/25",
};

const CHIP = "px-1.5 py-0 text-[11px] font-normal leading-4";

export function riskToneClass(risk: string): string {
  return RISK_TONE[risk.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

/**
 * Compact summary under a story row: description (2-line clamp) and, for
 * ticket-tree stories only, a metadata row. BMad v6 stories render the
 * description alone.
 */
export function StoryRowDetails({
  story,
  className,
}: {
  story: StoryDetail;
  /** Indent so the text lines up under the title, past the id bubble. */
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {story.description && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {story.description}
        </p>
      )}
      {story.ticket && <TicketMetaRow ticket={story.ticket} />}
    </div>
  );
}

export function TicketMetaRow({ ticket }: { ticket: StoryTicketMeta }) {
  const hasAny =
    ticket.type ||
    ticket.risk ||
    ticket.hitl ||
    ticket.covers.length > 0 ||
    ticket.after.length > 0;
  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {ticket.type && (
        <Badge variant="outline" className={cn(CHIP, "capitalize")}>
          {ticket.type}
        </Badge>
      )}
      {ticket.risk && (
        <Badge
          variant="outline"
          className={cn(CHIP, "capitalize", riskToneClass(ticket.risk))}
        >
          {ticket.risk} risk
        </Badge>
      )}
      {ticket.hitl && (
        <Badge
          variant="outline"
          title="Human in the loop"
          className={cn(CHIP, "bg-info/15 text-info-foreground border-info/25")}
        >
          HIL
        </Badge>
      )}
      {ticket.covers.map((cap) => (
        <Badge
          key={cap}
          variant="secondary"
          className={cn(CHIP, "font-mono")}
        >
          {cap}
        </Badge>
      ))}
      {ticket.after.length > 0 && (
        <span className="text-[11px] text-muted-foreground">
          after {ticket.after.join(", ")}
        </span>
      )}
    </div>
  );
}
