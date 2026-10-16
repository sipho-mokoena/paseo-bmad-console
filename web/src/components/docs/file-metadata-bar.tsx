import { StatusPill } from "@/components/shared/pill";
import { DefinitionTable, type DefinitionRow } from "@/components/shared/definition-table";
import type { BmadFileMetadata, StoryStatus } from "@/lib/bmad/types";

interface FileMetadataBarProps {
  metadata: BmadFileMetadata;
}

const statusValues = new Set([
  "done",
  "in-progress",
  "review",
  "blocked",
  "backlog",
  "unknown",
]);

/** Status, steps, workflow type and completion date as a flat two-column table. */
export function FileMetadataBar({ metadata }: FileMetadataBarProps) {
  const rows: DefinitionRow[] = [];
  if (
    metadata.status &&
    metadata.status !== "unknown" &&
    statusValues.has(metadata.status)
  ) {
    rows.push({ label: "status", value: <StatusPill status={metadata.status as StoryStatus} /> });
  }
  if (metadata.stepsCompleted && metadata.stepsCompleted.length > 0) {
    rows.push({ label: "steps completed", value: String(metadata.stepsCompleted.length) });
  }
  if (metadata.workflowType) rows.push({ label: "type", value: metadata.workflowType });
  if (metadata.completedAt) rows.push({ label: "completed", value: metadata.completedAt });

  if (rows.length === 0) return null;
  return <DefinitionTable rows={rows} className="mb-6" />;
}
