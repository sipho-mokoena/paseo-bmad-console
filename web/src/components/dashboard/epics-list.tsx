import { Suspense } from "react";
import { EpicsListView } from "@/components/dashboard/epics-list-view";
import { StateMessage } from "@/components/shared/list-kit";
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

  return <Suspense>
      <EpicsListView epics={epics} base={`/repo/${owner}/${repo}`} />
    </Suspense>;
}
