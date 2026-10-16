import { EpicRow } from "@/components/epics/epic-row";
import { GroupLabel, StateMessage } from "@/components/shared/list-kit";
import { epicHref } from "@/lib/stories-browse";
import { compareEpicIds } from "@/lib/bmad/ids";
import type { Epic } from "@/lib/bmad/types";

interface EpicsListProps {
  epics: Epic[];
  owner: string;
  repo: string;
  /** Where epics were looked for (shown when there are none). */
  lookedFor?: string[];
}

export function EpicsList({ epics, owner, repo, lookedFor }: EpicsListProps) {
  if (epics.length === 0) {
    return <StateMessage>
        {lookedFor && lookedFor.length > 0
          ? `No epic found. Looked for: ${lookedFor.join(", ")}.`
          : "No epic found in this project"}
      </StateMessage>;
  }

  const sorted = [...epics].sort((a, b) => compareEpicIds(a.id, b.id));

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
