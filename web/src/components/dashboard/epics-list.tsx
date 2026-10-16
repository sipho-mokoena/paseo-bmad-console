import { EpicRow } from "@/components/epics/epic-row";
import { GroupLabel, StateMessage } from "@/components/shared/list-kit";
import { epicHref } from "@/lib/stories-browse";
import type { Epic } from "@/lib/bmad/types";

interface EpicsListProps {
  epics: Epic[];
  owner: string;
  repo: string;
}

export function EpicsList({ epics, owner, repo }: EpicsListProps) {
  if (epics.length === 0) {
    return <StateMessage>No epic found in this project</StateMessage>;
  }

  const sorted = [...epics].sort(
    (a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0),
  );

  return (
    <section aria-label="Epics">
      <GroupLabel count={sorted.length}>Epics</GroupLabel>
      <div role="list">
        {sorted.map((epic) => (
          <div key={epic.id} role="listitem">
            <EpicRow epic={epic} href={epicHref(`/repo/${owner}/${repo}`, epic.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
