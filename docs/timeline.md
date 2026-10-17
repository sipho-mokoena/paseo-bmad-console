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

The details panel of a selected item shows its id and status, the epic, wave, risk and type, flags (Ready now, Critical path) only when true, then Prerequisites (with open ones marked and a count of what blocks the item) and Blocks as rows that select that item in the chart, and the Open story and Open epic actions.

## Views

- Gantt: epics as collapsible groups, bars coloured by status, an epic bar spanning its stories with a progress fill, and connectors for the selected item or for all items.
- Graph: a layered left-to-right graph with hover highlighting of upstream and downstream chains. The arrow keys move between items: left goes to a prerequisite, right to a dependent, up and down within a column. With all epics and more than 150 nodes it asks you to pick an epic. When the scope is all epics, a Stories | Epics toggle sits on the row above the chart.

Both charts are the same on phones and desktops and scroll sideways inside their frame. There is no zoom. The mouse wheel only scrolls the chart left and right (a vertical wheel gesture moves it sideways, as does shift+wheel or a horizontal gesture), and pinch or ctrl+wheel does not zoom the page over a chart. At the start or end of the chart the wheel scrolls the page as usual.

## Resizable panes

From the `xl` breakpoint (1280px) the chart and the details panel of a selected item sit side by side with a draggable handle between them. The details panel is 30% wide by default (20% to 50%) and the chart keeps at least 40%. Drag the handle, or focus it and use the arrow keys, Home and End. Double-click the handle to reset the split. The chosen width is remembered in this browser (`localStorage`) and used the next time the panel opens. The panel and handle only exist while an item is selected. Below `xl` there is no handle: the panel stacks under the chart.

For screen readers, every bar and node has a name with its id, title, status, wave and the items blocking it ("3.8 A Peer joins, Backlog, wave 13, blocked by 3.6, 3.7"), and a hidden status line announces the waves, the item count, unresolved references and cycles.

Toolbar: the view toggle (Gantt | Graph), a View dropdown and a Filter dropdown on the left, then the Scope dropdown and search on the right. Scope is a styled dropdown, not the browser's native select. The Filter dropdown is a multiselect of Ready now and the statuses (Done, In review, In progress, Blocked, Ready for dev, Backlog); the selection shows as removable chips with a Clear action, and maps to the `ready` and `status` URL params. The View dropdown holds checkable Highlight critical path, Show all dependencies (Gantt only) and Size by risk (only when risk data exists), plus Expand all and Collapse all (Gantt only). Size by risk is a single-line item (its explanation is the tooltip and the Waves section above); a badge counts the toggles that are on. Scope narrows to one epic (outside prerequisites show as collapsed external nodes).

## URL parameters

The parameters live on the Overview URL: `view` (gantt, graph; the retired `list` falls back to gantt), `scope`, `status` (comma list), `q`, `critical=1`, `all=1`, `focus`, `ready=1`, `risk=1`, `level` (stories, epics). Story and epic pages link to the Overview with `#timeline` ("View on timeline"), which scrolls the section into view. The old `/repo/<owner>/<repo>/timeline` URL redirects to the Overview and keeps its query.

## Code

`src/lib/bmad/deps.ts` (parsing), `src/lib/dependency-graph.ts` (graph, waves, critical path, scoping), `src/lib/pane-size.ts` (split size limits and storage), `src/components/ui/resizable.tsx`, `src/lib/timeline-params.ts` (including the redirect target and the Overview decision), `src/lib/timeline-data.ts`, `src/lib/timeline-layout.ts`, and the components in `src/components/timeline/`.
