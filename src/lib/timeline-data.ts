import { storyDeps } from "@/lib/bmad/deps";
import type { BmadProject } from "@/lib/bmad/types";
import type { GraphEpicInput, GraphStoryInput } from "@/lib/dependency-graph";

/** What the Timeline charts need from a project: no bodies, descriptions or tasks. */
export interface TimelineData {
  epics: GraphEpicInput[];
  stories: GraphStoryInput[];
  /** Any story has a risk, so "Size by risk" makes sense. */
  hasRisk: boolean;
}

export function toTimelineData(project: Pick<BmadProject, "epics" | "stories">): TimelineData {
  const stories: GraphStoryInput[] = project.stories.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    epicId: s.epicId,
    deps: storyDeps(s),
    ...(s.ticket?.risk ? { risk: s.ticket.risk } : {}),
    ...(s.ticket?.type ? { type: s.ticket.type } : {}),
  }));
  return {
    epics: project.epics.map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      ...(e.after?.length ? { after: e.after } : {}),
    })),
    stories,
    hasRisk: stories.some((s) => s.risk),
  };
}
