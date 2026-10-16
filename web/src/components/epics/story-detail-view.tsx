import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { CheckCircle2, Circle } from "lucide-react";
import { SegmentedProgressBar } from "@/components/shared/segmented-progress-bar";
import { riskToneClass } from "./story-ticket-meta";
import type { StoryDetail, StoryTicketMeta } from "@/lib/bmad/types";

interface StoryDetailViewProps {
  story: StoryDetail;
}

const LABEL = "text-xs text-muted-foreground";
const CHIP = "px-1.5 py-0 text-[11px] font-normal leading-4";

function TicketDefinitions({
  ticket,
  status,
}: {
  ticket: StoryTicketMeta;
  status: StoryDetail["status"];
}) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5 space-y-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <div>
            <dt className={LABEL}>Type</dt>
            <dd className="mt-1 text-sm capitalize">{ticket.type ?? "-"}</dd>
          </div>
          <div>
            <dt className={LABEL}>Risk</dt>
            <dd className="mt-1">
              {ticket.risk ? (
                <Badge
                  variant="outline"
                  className={`${CHIP} capitalize ${riskToneClass(ticket.risk)}`}
                >
                  {ticket.risk}
                </Badge>
              ) : (
                <span className="text-sm">-</span>
              )}
            </dd>
          </div>
          <div>
            <dt className={LABEL}>Human in the loop</dt>
            <dd className="mt-1 text-sm">{ticket.hitl ? "Yes" : "No"}</dd>
          </div>
          {ticket.assignee && (
            <div>
              <dt className={LABEL}>Assignee</dt>
              <dd className="mt-1 text-sm">{ticket.assignee}</dd>
            </div>
          )}
        </dl>

        {(ticket.covers.length > 0 || ticket.after.length > 0) && (
          <dl className="grid gap-4 sm:grid-cols-2">
            {ticket.covers.length > 0 && (
              <div>
                <dt className={LABEL}>Covers</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {ticket.covers.map((cap) => (
                    <Badge key={cap} variant="secondary" className={`${CHIP} font-mono`}>
                      {cap}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
            {ticket.after.length > 0 && (
              <div>
                <dt className={LABEL}>After</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {ticket.after.map((ref) => (
                    <Badge key={ref} variant="outline" className={`${CHIP} font-mono`}>
                      {ref}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}

        {status === "blocked" && ticket.blockedReason && (
          <p className="text-sm text-destructive-foreground">
            Blocked: {ticket.blockedReason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function StoryDetailView({ story }: StoryDetailViewProps) {
  const ticket = story.ticket;
  // Ticket stories: acceptanceCriteria[0] is the verify text, the rest are criteria.
  const verify = ticket ? story.acceptanceCriteria[0] : undefined;
  const criteria = ticket ? story.acceptanceCriteria.slice(1) : story.acceptanceCriteria;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pr-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            Story {story.id}
          </span>
          <h3 className="text-lg font-medium">{story.title}</h3>
        </div>
        <StatusBadge status={story.status} />
      </div>

      {/* Ticket metadata (ticket-tree stories only) */}
      {ticket && <TicketDefinitions ticket={ticket} status={story.status} />}

      {/* Description */}
      {story.description && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Description
            </h4>
            <MarkdownRenderer content={story.description} />
          </CardContent>
        </Card>
      )}

      {/* Verify: for ticket stories acceptanceCriteria[0] is the verify text */}
      {ticket && verify && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Verify
            </h4>
            <p className="text-sm leading-relaxed">{verify}</p>
          </CardContent>
        </Card>
      )}

      {/* Acceptance Criteria (BMad v6: all items; ticket stories: items after Verify) */}
      {criteria.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Acceptance Criteria
            </h4>
            <ul className="space-y-2">
              {criteria.map((criterion, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-muted-foreground">•</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      {story.tasks.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Tasks
              </h4>
              <span className="text-xs text-muted-foreground">
                {story.completedTasks} of {story.totalTasks} completed
              </span>
            </div>
            <SegmentedProgressBar
              percent={story.totalTasks > 0 ? Math.round((story.completedTasks / story.totalTasks) * 100) : 0}
              color={story.completedTasks === story.totalTasks ? "bg-success" : "bg-warning"}
              className="h-2 mb-4"
            />
            <ul className="space-y-2">
              {story.tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={task.completed ? "text-muted-foreground line-through" : ""}>
                    {task.description}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
