# Timeline

The Timeline draws the dependencies between epics and stories. It is a section of the project Overview page, below the stats, and replaces the Overview's epics list when the project has dependency data. Projects without dependency data keep the searchable epics list, and the Epics tab always lists every epic.

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

Toolbar: the view toggle, a View dropdown, a Filter dropdown, then the scope select and search on the right. The Filter dropdown is a multiselect of Ready now and the statuses (Done, In review, In progress, Blocked, Ready for dev, Backlog); the selection shows as removable chips with a Clear action, and maps to the `ready` and `status` URL params. The View dropdown holds checkable Highlight critical path, Show all dependencies (Gantt only) and Size by risk (only when risk data exists), plus Expand all and Collapse all (Gantt only); a badge counts the toggles that are on. Scope narrows to one epic (outside prerequisites show as collapsed external nodes).

## URL parameters

The parameters live on the Overview URL: `view` (gantt, graph, list), `scope`, `status` (comma list), `q`, `critical=1`, `all=1`, `focus`, `ready=1`, `risk=1`, `level` (stories, epics). Story and epic pages link to the Overview with `#timeline` ("View on timeline"), which scrolls the section into view. The old `/repo/<owner>/<repo>/timeline` URL redirects to the Overview and keeps its query.

## Code

`src/lib/bmad/deps.ts` (parsing), `src/lib/dependency-graph.ts` (graph, waves, critical path, scoping), `src/lib/timeline-params.ts` (including the redirect target and the Overview decision), `src/lib/timeline-data.ts`, `src/lib/timeline-layout.ts`, and the components in `src/components/timeline/`.
