import { v6ProjectAdapter } from "./v6-project";
import { v6DefaultAdapter } from "./v6-default";
import { ticketTreeAdapter } from "./ticket-tree";
import { v4Adapter } from "./v4";
import type { LayoutAdapter, LayoutContext } from "./types";

export type { LayoutAdapter, LayoutContext, LayoutResult } from "./types";

/**
 * Registered adapters, in tie-break order (earlier wins on equal scores).
 *
 * Precedence is by detect() score:
 *   v6-project  90  flat <out>/epics/E<n>-*.md   (75 for a bare .agentic folder)
 *   v6-default  70  planning-artifacts epics / N-N-*.md stories  (50: bare sprint-status.yaml)
 *   ticket-tree 60  <out>/initiative-*\/tickets.toml
 *   v4          40  .bmad-core + docs/
 * A project-specific layout beats the default one because its file names would otherwise be
 * ignored by the default rules; the default beats a ticket tree because v6 epics/stories used
 * to win and the tree was only a fallback.
 */
export const LAYOUT_ADAPTERS: readonly LayoutAdapter[] = [
  v6ProjectAdapter,
  v6DefaultAdapter,
  ticketTreeAdapter,
  v4Adapter,
];

export interface LayoutCandidate {
  adapter: LayoutAdapter;
  score: number;
}

/** Adapters that match, best first; equal scores keep registry order. */
export function detectLayouts(
  ctx: LayoutContext,
  adapters: readonly LayoutAdapter[] = LAYOUT_ADAPTERS,
): LayoutCandidate[] {
  return adapters
    .map((adapter, order) => ({ adapter, score: adapter.detect(ctx), order }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ adapter, score }) => ({ adapter, score }));
}

/** The single best adapter, or null when none matches. */
export function detectLayout(
  ctx: LayoutContext,
  adapters: readonly LayoutAdapter[] = LAYOUT_ADAPTERS,
): LayoutAdapter | null {
  return detectLayouts(ctx, adapters)[0]?.adapter ?? null;
}
