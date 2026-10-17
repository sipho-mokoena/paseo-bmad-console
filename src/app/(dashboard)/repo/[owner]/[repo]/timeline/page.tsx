import { Suspense } from "react";
import { TimelineView } from "@/components/timeline/timeline-view";
import { loadProject } from "@/lib/load-project";
import { toTimelineData } from "@/lib/timeline-data";

interface TimelinePageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function TimelinePage({ params }: TimelinePageProps) {
  const { owner, repo } = await params;
  const project = await loadProject(owner, repo);
  const base = `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  // Only ids, titles, status, epic ids, dependencies and risk/type travel to the client.
  return (
    <Suspense fallback={null}>
      <TimelineView data={toTimelineData(project)} base={base} />
    </Suspense>
  );
}
