import { markdownToPlainText } from "@/lib/markdown-text";
import type { StoryTask } from "./types";

const SECTION = /^##\s+Tasks\s*(?:&|and)\s*Acceptance\b/i;
const HEADING = /^#{1,2}\s/;
const CRITERIA = /^\s*\*\*\s*Acceptance Criteria\s*:?\s*\*\*/i;
const FENCE = /^\s*(```|~~~)/;
// a top-level checkbox: at most three spaces of indent (deeper is a nested sub-bullet)
const CHECKBOX = /^ {0,3}[-*+]\s+\[([ xX])\]\s+(.*\S)\s*$/;
// the unfilled template line: `FILE` -- ACTION -- RATIONALE
const PLACEHOLDER = /^`?FILE`?\s+--\s+ACTION\s+--\s+RATIONALE$/;

/**
 * Tasks of a ticket-tree plan file (bmad-build plan template): the checkbox lines in the
 * `## Tasks & Acceptance` section, up to `**Acceptance Criteria:**` or the next heading.
 * Checkboxes elsewhere in the plan (review logs, notes) are not tasks.
 */
export function extractPlanTasks(body: string): StoryTask[] {
  const tasks: StoryTask[] = [];
  let inSection = false;
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (HEADING.test(line)) {
      if (inSection) break;
      inSection = SECTION.test(line);
      continue;
    }
    if (!inSection) continue;
    if (CRITERIA.test(line)) break;
    const m = line.match(CHECKBOX);
    if (!m || PLACEHOLDER.test(m[2].trim())) continue;
    const description = markdownToPlainText(m[2]);
    if (!description) continue;
    tasks.push({ description, completed: m[1] !== " " });
  }
  return tasks;
}
