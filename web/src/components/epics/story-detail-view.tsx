import { StatusPill, Pill } from "@/components/shared/pill";
import { DefinitionTable, type DefinitionRow } from "@/components/shared/definition-table";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { CheckCircle2, Circle } from "lucide-react";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { riskTone } from "./story-ticket-meta";
import type { StoryDetail, StoryTicketMeta } from "@/lib/bmad/types";

interface StoryDetailViewProps {
  story: StoryDetail;
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs text-muted-foreground">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ticketRows(ticket: StoryTicketMeta): DefinitionRow[] {
  const rows: DefinitionRow[] = [
    { label: "type", value: <span className="capitalize">{ticket.type ?? "-"}</span> },
    {
      label: "risk",
      value: ticket.risk ? (
        <Pill tone={riskTone(ticket.risk)} className="capitalize">
          {ticket.risk}
        </Pill>
      ) : (
        "-"
      ),
    },
    { label: "human in the loop", value: ticket.hitl ? "Yes" : "No" },
  ];
  if (ticket.assignee) rows.push({ label: "assignee", value: ticket.assignee });
  if (ticket.covers.length > 0) {
    rows.push({
      label: "covers",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {ticket.covers.map((cap) => (
            <Pill key={cap} tone="fill" className="font-mono">
              {cap}
            </Pill>
          ))}
        </span>
      ),
    });
  }
  if (ticket.after.length > 0) {
    rows.push({
      label: "after",
      value: (
        <span className="flex flex-wrap gap-1.5">
          {ticket.after.map((ref) => (
            <Pill key={ref} className="font-mono">
              {ref}
            </Pill>
          ))}
        </span>
      ),
    });
  }
  return rows;
}

export function StoryDetailView({ story }: StoryDetailViewProps) {
  const ticket = story.ticket;
  // Ticket stories: acceptanceCriteria[0] is the verify text, the rest are criteria.
  const verify = ticket ? story.acceptanceCriteria[0] : undefined;
  const criteria = ticket ? story.acceptanceCriteria.slice(1) : story.acceptanceCriteria;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pr-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{story.id}</span>
          <h3 className="min-w-0 break-words text-base font-medium">{story.title}</h3>
        </div>
        <div className="shrink-0 self-start">
          <StatusPill status={story.status} />
        </div>
      </div>

      {ticket && (
        <div className="space-y-2">
          <DefinitionTable rows={ticketRows(ticket)} />
          {story.status === "blocked" && ticket.blockedReason && (
            <p className="text-[13px] text-destructive-foreground">
              Blocked: {ticket.blockedReason}
            </p>
          )}
        </div>
      )}

      {story.description && (
        <Section title="Description">
          <MarkdownRenderer content={story.description} />
        </Section>
      )}

      {ticket && verify && (
        <Section title="Verify">
          <p className="text-[13px] leading-relaxed">{verify}</p>
        </Section>
      )}

      {criteria.length > 0 && (
        <Section title="Acceptance criteria">
          <ul className="space-y-1.5">
            {criteria.map((criterion, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="mt-0.5 text-muted-foreground">•</span>
                <span className="min-w-0 break-words">{criterion}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {story.tasks.length > 0 && (
        <Section
          title="Tasks"
          aside={
            <span className="text-xs tabular-nums text-muted-foreground">
              {story.completedTasks} of {story.totalTasks} completed
            </span>
          }
        >
          <ProgressBar
            percent={
              story.totalTasks > 0
                ? Math.round((story.completedTasks / story.totalTasks) * 100)
                : 0
            }
            label="Task progress"
          />
          <ul className="space-y-1.5 pt-1">
            {story.tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                {task.completed ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={`min-w-0 break-words ${task.completed ? "text-muted-foreground line-through" : ""}`}
                >
                  {task.description}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
