import { permanentRedirect } from "next/navigation";
import { epicsForList, storiesForList } from "@/lib/bmad/list-view";
import { EpicsBrowser } from "@/components/epics/epics-browser";
import { loadProject } from "@/lib/load-project";
import { legacyEpicsTarget } from "@/lib/stories-browse";

interface EpicsPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ epic?: string | string[]; story?: string | string[] }>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EpicsPage({ params, searchParams }: EpicsPageProps) {
  const { owner, repo } = await params;
  const project = await loadProject(owner, repo);
  const base = `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  // Old links: /epics?epic=<id> and /epics?story=<id> now live at /epics/<epic>[/<story>].
  const query = await searchParams;
  const target = legacyEpicsTarget(
    base,
    { epic: first(query.epic), story: first(query.story) },
    project.epics,
    project.stories,
  );
  if (target) permanentRedirect(target);

  return <EpicsBrowser epics={epicsForList(project.epics)} stories={storiesForList(project.stories)} base={base} projectLayout={project.layout} />;
}
