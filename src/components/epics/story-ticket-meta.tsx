import { Pill, type PillTone } from "@/components/shared/pill";
import { cn } from "@/lib/utils";
import type { StoryTicketMeta } from "@/lib/bmad/types";

const RISK_TONE: Record<string, PillTone> = {
  low: "neutral",
  medium: "info",
  high: "danger",
};

export function riskTone(risk: string): PillTone {
  return RISK_TONE[risk.toLowerCase()] ?? "neutral";
}

const MAX_COVERS = 2;

/** Type / risk / HIL / covers as small pills (inline, no wrapper element of its own). */
export function TicketChips({
  ticket,
  maxCovers = MAX_COVERS,
}: {
  ticket: StoryTicketMeta;
  /** Collapse extra covers into "+N" (keeps single-line rows tidy). */
  maxCovers?: number;
}) {
  const shown = ticket.covers.slice(0, maxCovers);
  const hidden = ticket.covers.length - shown.length;
  return (
    <>
      {ticket.type && <Pill className="capitalize">{ticket.type}</Pill>}
      {ticket.risk && (
        <Pill tone={riskTone(ticket.risk)} className="capitalize">
          {ticket.risk} risk
        </Pill>
      )}
      {ticket.hitl && <Pill title="Human in the loop">HIL</Pill>}
      {shown.map((cap) => (
        <Pill key={cap} tone="fill" className="font-mono">
          {cap}
        </Pill>
      ))}
      {hidden > 0 && (
        <Pill tone="fill" title={ticket.covers.join(", ")}>
          +{hidden}
        </Pill>
      )}
    </>
  );
}

export function hasTicketChips(ticket: StoryTicketMeta | undefined | null): boolean {
  return !!ticket && !!(ticket.type || ticket.risk || ticket.hitl || ticket.covers.length > 0);
}

/** "after 1.2, 1.3" in muted text. */
export function AfterText({
  ticket,
  className,
}: {
  ticket: StoryTicketMeta | undefined | null;
  className?: string;
}) {
  if (!ticket || ticket.after.length === 0) return null;
  const text = `after ${ticket.after.join(", ")}`;
  return (
    <span title={text} className={cn("truncate text-2xs text-muted-foreground", className)}>
      {text}
    </span>
  );
}
