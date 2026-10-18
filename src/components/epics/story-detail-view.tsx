import Link from "next/link";
import { CheckCircle2, Circle, GanttChart } from "lucide-react";
import { Pill } from "@/components/shared/pill";
import { DefinitionTable, type DefinitionRow } from "@/components/shared/definition-table";
import { InlineMarkdown } from "@/components/docs/inline-markdown";
import { EpicBody } from "./epic-body";
import { ProgressBar } from "@/components/shared/segmented-progress-bar";
import { riskTone } from "./story-ticket-meta";
import { cn } from "@/lib/utils";
import { storyHref } from "@/lib/stories-browse";
import { timelineHref } from "@/lib/timeline-params";
import type { StoryDetail } from "@/lib/bmad/types";

/** Ticket-tree task `path -- action -- rationale`: split off the path when it looks like one. */
function splitPlanTask(text: string): { path: string; rest: string } | null {
  const at = text.indexOf(" -- ");
  const head = at === -1 ? text : text.slice(0, at);
  if (!/[/.]/.test(head) || /\s/.test(head.trim())) return null;
  return { path: head, rest: at === -1 ? "" : text.slice(at + 4) };
}

export interface StoryRef {
  ref: string;
  /** Owning epic when the story is known (renders as a link); null for unknown refs. */
  epicId: string | null;
}

interface StoryDetailViewProps {
  story: StoryDetail;
  /** `/repo/<owner>/<repo>` */
  base: string;
  /** Prerequisites (`after`), resolved against the project. */
  after: StoryRef[];
  /** Stories that list this one in their `after`. */
  blocks: StoryRef[];
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
        <h2 className="text-xs font-normal text-muted-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const CHIP_LINK =
  "rounded-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&>[data-slot=pill]]:transition-colors hover:[&>[data-slot=pill]]:bg-accent hover:[&>[data-slot=pill]]:text-foreground";

function RefChips({ refs, base }: { refs: StoryRef[]; base: string }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {refs.map(({ ref, epicId }) =>
        epicId ? (
          <Link
            key={ref}
            href={storyHref(base, epicId, ref)}
            aria-label={`Open story ${ref}`}
            className={cn(CHIP_LINK, "inline-flex min-h-10 items-center md:min-h-0")}
          >
            <Pill className="font-mono">{ref}</Pill>
          </Link>
        ) : (
          <Pill key={ref} className="font-mono" title="Not found in this project">
            {ref}
          </Pill>
        ),
      )}
    </span>
  );
}

function detailRows(story: StoryDetail, base: string, after: StoryRef[], blocks: StoryRef[]): DefinitionRow[] {
  const ticket = story.ticket;
  const rows: DefinitionRow[] = [];
  if (ticket) {
    rows.push(
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
    );
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
    if (ticket.blockedReason) {
      rows.push({
        label: "blocked",
        value: <span className="text-destructive-foreground">{ticket.blockedReason}</span>,
      });
    }
  }
  if (after.length > 0) rows.push({ label: "after", value: <RefChips refs={after} base={base} /> });
  if (blocks.length > 0) rows.push({ label: "blocks", value: <RefChips refs={blocks} base={base} /> });
  if (after.length > 0 || blocks.length > 0) {
    rows.push({
      label: "dependencies",
      value: (
        <Link
          href={timelineHref(base, { focus: story.id })}
          className="-ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-7 [&_svg]:size-4"
        >
          <GanttChart aria-hidden="true" />
          View on timeline
        </Link>
      ),
    });
  }
  return rows;
}

/** Body of the story page (the page supplies the header). */
export function StoryDetailView({ story, base, after, blocks }: StoryDetailViewProps) {
  const ticket = story.ticket;
  // Ticket stories: acceptanceCriteria[0] is the verify text, the rest are criteria.
  const verify = ticket ? story.acceptanceCriteria[0] : undefined;
  const criteria = ticket ? story.acceptanceCriteria.slice(1) : story.acceptanceCriteria;
  const rows = detailRows(story, base, after, blocks);

  return (
    <div className="space-y-5">
      {rows.length > 0 && <DefinitionTable rows={rows} />}

      {(story.body ?? story.description) && (
        <Section title="Description">
          <EpicBody markdown={story.body ?? story.description} />
        </Section>
      )}

      {ticket && verify && (
        <Section title="Verify">
          <InlineMarkdown className="text-sm leading-relaxed">{verify}</InlineMarkdown>
        </Section>
      )}

      {criteria.length > 0 && (
        <Section title="Acceptance criteria">
          <ul className="space-y-1.5">
            {criteria.map((criterion, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-muted-foreground">•</span>
                <InlineMarkdown className="min-w-0 flex-1">{criterion}</InlineMarkdown>
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
            {story.tasks.map((task, i) => {
              const plain = story.ticket ? splitPlanTask(task.description) : null;
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  {task.completed ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <Circle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="sr-only">{task.completed ? "Done: " : "To do: "}</span>
                  {plain ? (
                    <span className={cn("min-w-0 flex-1", task.completed && "text-muted-foreground line-through")}>
                      <code className="font-mono text-xs break-all">{plain.path}</code>
                      {plain.rest && <span> -- {plain.rest}</span>}
                    </span>
                  ) : (
                    <InlineMarkdown
                      className={task.completed ? "flex-1 text-muted-foreground line-through" : "flex-1"}
                    >
                      {task.description}
                    </InlineMarkdown>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
