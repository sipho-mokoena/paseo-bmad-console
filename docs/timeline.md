# Timeline

The Timeline tab draws the dependencies between epics and stories. It sits between Epics and Specs and appears only when the project has dependency data.

## Where the dependencies come from

- Ticket tree: story `after` lists, and the `[[epic]] after` rows with `needs` text in the initiative `tickets.toml`.
- v6 project layout: `depends_on` in epic and story frontmatter. The v6 default and v4 layouts read the same keys (`depends_on`, `dependsOn`, `after`).
- References are normalised to epic or story ids. A dependency on an epic id means every story of that epic. Prose and slugs are ignored, and references to unknown items are listed in the status line, never dropped silently.

## Waves, not dates

BMAD data has no dates, so the chart is a schedule computed from the dependency graph. Wave 1 holds items with no prerequisites, and every other item starts in the wave after its last prerequisite ends. With "Size by risk", a low, medium or high risk item lasts 1, 2 or 3 waves.

- Ready: the item is not done and every prerequisite is done.
- Blocked by: the item's unfinished prerequisites.
- Critical path: the heaviest chain of unfinished work. Done items cost nothing.
- Cycles are reported and one back edge per cycle is dropped, so the layout never loops.

## Views

- Gantt: epics as collapsible groups, bars coloured by status, an epic bar spanning its stories with a progress fill, and connectors for the selected item or for all items.
- Graph: a layered left-to-right graph with hover highlighting of upstream and downstream chains, zoom from 50 to 200 percent, and arrow-key navigation. With all epics and more than 150 nodes it asks you to pick an epic.
- List: every item with its wave, prerequisites and dependents. It is the default under 640px and the text alternative for screen readers.

Options: Ready now, status filters, search, scope to one epic (outside prerequisites show as collapsed external nodes), Highlight critical path, Show all dependencies and Size by risk (only when risk data exists).

## URL parameters

`view` (gantt, graph, list), `scope`, `status` (comma list), `q`, `critical=1`, `all=1`, `focus`, `ready=1`, `risk=1`, `level` (stories, epics). Story and epic pages link to the timeline ("View on timeline").

## Code

`src/lib/bmad/deps.ts` (parsing), `src/lib/dependency-graph.ts` (graph, waves, critical path, scoping), `src/lib/timeline-params.ts`, `src/lib/timeline-data.ts`, `src/lib/timeline-layout.ts`, and the components in `src/components/timeline/`.
