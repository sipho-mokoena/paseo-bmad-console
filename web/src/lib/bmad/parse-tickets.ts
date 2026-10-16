import { parse as parseToml } from "smol-toml";
import type { ContentProvider } from "@/lib/content-provider";
import matter from "gray-matter";
import type { Epic, StoryDetail, StoryStatus } from "./types";

const INITIATIVE_TICKETS = /^(.*\/initiative-[^/]+)\/tickets\.toml$/;

interface TicketEpicRow {
  id?: number | string;
  slug?: string;
  title?: string;
}

interface TicketEntryRow {
  id?: number | string;
  type?: string;
  title?: string;
  description?: string;
  verify?: string;
  risk?: string;
  hitl?: boolean;
  covers?: string[];
  after?: unknown[];
}

function table(content: string): Record<string, unknown> | null {
  try {
    return parseToml(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** board.md: none/draft/ready-for-dev backlog; in-progress/blocked in-progress; in-review/built review. */
function planStatus(raw: unknown): StoryStatus | "dropped" {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (s === "done") return "done";
  if (s === "dropped") return "dropped";
  if (s === "in-progress") return "in-progress";
  if (s === "blocked") return "blocked";
  if (s === "in-review" || s === "built") return "review";
  if (s === "ready-for-dev") return "ready-for-dev";
  return "backlog";
}

interface Plan {
  status: StoryStatus | "dropped";
  assignee?: string;
  blockedReason?: string;
}

/** Plans (`<type>-<slug>-plan.md`) beside the tickets, keyed by their `ticket` id. */
async function readPlans(
  provider: ContentProvider,
  paths: string[],
  epicDir: string,
): Promise<{ plans: Map<string, Plan>; files: number }> {
  const plans = new Map<string, Plan>();
  let files = 0;
  const prefix = epicDir + "/";
  for (const p of paths) {
    if (!p.startsWith(prefix) || !p.endsWith("-plan.md")) continue;
    if (p.slice(prefix.length).includes("/")) continue;
    files++;
    const fm = matter(await provider.getFileContent(p)).data;
    if (fm.ticket === undefined) continue;
    const id = String(fm.ticket).split(".").pop() as string;
    plans.set(id, {
      status: planStatus(fm.status),
      assignee: fm.assignee ? String(fm.assignee) : undefined,
      blockedReason: fm.blocked_reason ? String(fm.blocked_reason) : undefined,
    });
  }
  return { plans, files };
}

function epicDescription(md: string): string {
  const m = md.match(/^##\s+Description\s*\n+([\s\S]*?)(?=\n##\s|$)/im);
  return (m?.[1] ?? "").trim();
}

/**
 * Reads the ticket-tree layout (bmad-ticket skill):
 *   <out>/initiative-x/tickets.toml                 [[epic]] id, slug, title
 *   <out>/initiative-x/<slug>/tickets.toml          [[entry]] id, type, title, ...
 *   <out>/initiative-x/<slug>/<slug>.md             epic description
 * Story ids are "<epicId>.<entryId>", matching the "after" references.
 */
export async function parseTicketTree(
  provider: ContentProvider,
  paths: string[],
): Promise<{ epics: Epic[]; stories: StoryDetail[]; files: number }> {
  const epics: Epic[] = [];
  const stories: StoryDetail[] = [];
  let files = 0;
  const pathSet = new Set(paths);

  for (const initPath of paths) {
    const dir = initPath.match(INITIATIVE_TICKETS)?.[1];
    if (!dir) continue;
    const init = table(await provider.getFileContent(initPath));
    files++;
    const rows = (init?.epic ?? []) as TicketEpicRow[];

    for (const row of rows) {
      if (row.id === undefined || !row.slug) continue;
      const epicId = String(row.id);
      const ticketsPath = `${dir}/${row.slug}/tickets.toml`;
      const mdPath = `${dir}/${row.slug}/${row.slug}.md`;

      let description = "";
      if (pathSet.has(mdPath)) {
        description = epicDescription(await provider.getFileContent(mdPath));
        files++;
      }

      const entries: TicketEntryRow[] = pathSet.has(ticketsPath)
        ? (((table(await provider.getFileContent(ticketsPath)))?.entry ??
            []) as TicketEntryRow[])
        : [];
      if (pathSet.has(ticketsPath)) files++;

      const { plans, files: planFiles } = await readPlans(
        provider,
        paths,
        `${dir}/${row.slug}`,
      );
      files += planFiles;

      const epicTitle = row.title ?? row.slug;
      const storyIds: string[] = [];
      for (const e of entries) {
        if (e.id === undefined) continue;
        const id = `${epicId}.${e.id}`;
        const plan = plans.get(String(e.id));
        if (plan?.status === "dropped") continue;
        const status = plan?.status ?? "backlog";
        storyIds.push(id);
        stories.push({
          id,
          title: e.title ?? `Story ${id}`,
          status,
          statusExplicit: Boolean(plan),
          epicId,
          epicTitle,
          description: e.description ?? "",
          ticket: {
            type: e.type,
            risk: e.risk,
            hitl: e.hitl,
            covers: (e.covers ?? []).map(String),
            // a bare number is a sibling in this epic; "4.1" is already a ref
            after: (e.after ?? []).map((a) =>
              String(a).includes(".") ? String(a) : `${epicId}.${a}`,
            ),
            assignee: plan?.assignee,
            blockedReason: plan?.blockedReason,
          },
          acceptanceCriteria: e.verify ? [e.verify] : [],
          tasks: [],
          completedTasks: 0,
          totalTasks: 0,
        });
      }

      epics.push({
        id: epicId,
        title: epicTitle,
        description,
        status: "not-started",
        stories: storyIds,
        totalStories: storyIds.length,
        completedStories: 0,
        progressPercent: 0,
      });
    }
  }
  return { epics, stories, files };
}
