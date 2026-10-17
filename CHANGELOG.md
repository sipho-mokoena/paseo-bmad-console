# Changelog

All notable changes to Paseo BMAD Console are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries are grouped by theme within each release. Dates are taken from the git history.

## [Unreleased]

### Changed

- Copy path now copies the full system path of the open document (the project folder on the server machine plus the file path) for local projects, and `<owner>/<repo>/<path>` for GitHub projects; the button title shows the same path.
- Epic page: the View on timeline link moved into the title row as a compact Timeline button (icon only on phones), and the story page's timeline link is now a compact ghost link with an icon.
- Timeline: a tidier details panel (definition list, Prerequisites and Blocks rows with status dots, no "Blocked by 0"), no description line under Size by risk, and more space above the graph's wave labels.
- Timeline: removed the List view (old `view=list` links open the Gantt) and the graph zoom, the wheel now only scrolls charts sideways, the Stories | Epics toggle moved above the graph, and Scope is a styled dropdown instead of the native select.
- Timeline toolbar: status chips are now a Filter multiselect with removable chips, the chart options are a View dropdown with a count badge, scope and search sit on the right, and the derived-schedule note is gone.
- The Timeline moved from its own tab into the project Overview, where it replaces the epics list when the project has dependency data. `/timeline` URLs redirect to the Overview with their query kept, and "View on timeline" links point there.
- Rewrote the documentation from the code: README, getting started, local folder import, API, Paseo UI reference, contributing, security and agent guidance.

### Added

- Documentation: a best practices guide for BMAD projects in the console (`docs/best-practices.md`) and a workflow session guide with a worked example (`docs/workflow.md`), linked from the README and the docs index.
- Timeline: the chart and the details panel sit in a resizable split from the xl breakpoint. Drag the handle (or use the arrow keys on it) to resize, double-click it to reset; the size is remembered. Below xl the panel still stacks under the chart.
- Header: a Refresh data button on project pages, with the same result dialog as the sidebar project menu.
- Library, Specs and Design: a Copy path button next to the Preview | Source toggle that copies the open file's repo-relative path (with a plain-http fallback). The code block and diagram copy buttons share the same helper.
- Library: a Filter files field above the tree that narrows it to files whose path contains every typed word, with highlighted matches, a result count and an empty state.
- Timeline with a dependency-driven Gantt chart, a dependency graph and a list view, and parsing of epic and story dependencies for every supported layout.

- Dependencies between stories and epics are parsed for every layout (`depends_on`, `dependsOn`, `depends-on` and `after` frontmatter, ticket-tree `after`), so the story page shows "after" and "blocks" links for the v6 and v4 layouts too.
- A dependency graph module (`src/lib/dependency-graph.ts`) with waves, critical path, cycle handling and scoping. No page uses it yet.
- Documentation: configuration reference, BMAD layouts guide, architecture overview, deployment guide, Paseo plugin guide and a docs index.

### Removed

- Overview: the Key files list. The planning documents are in the Specs, Design and Library tabs.

## [0.1.0] - 2026-10-17

First standalone release. The history before 2026-10-16 belongs to the upstream projects (see below).

### Authentication removed (2026-10-17)

- Removed authentication entirely: login, sign-up, sessions, users, roles, the admin area, the profile page, GitHub OAuth and the development bypass. The app is single-tenant and has no login. Run it on `localhost` or a private network.
- GitHub projects are added by `owner/name` and read with the optional `GITHUB_PAT`.
- Migration `remove_auth` keeps the registered projects, collapses duplicates of `(owner, name)` and drops the auth tables and the user column.
- Dropped the `better-auth` and `tsx` dependencies. `pnpm dev` and `pnpm start` bind to `127.0.0.1` on port 7002. The development database is on port 7433.
- The dashboard is rendered dynamically, because no session lookup does it any more.
- Added a test that fails if an authentication dependency or import returns.

### Standalone build (2026-10-17)

- `next build` produces a self-contained server (`output: "standalone"`). A deployment folder holds build output only, with no source tree.
- Removed the Docker production setup (`Dockerfile`, `docker/`, `.dockerignore`) and the `.github` folder, including CI.

### Paseo plugin (2026-10-17)

- Added `plugin/`, a Paseo plugin that starts, stops, restarts and opens the console, with a sidebar item, a workspace panel, a settings screen and Command Center items.
- The plugin screen is a single settings-style page built from the host's Settings components. It probes `/api/health`, defaults to port 7002 and shows the last 300 log lines.
- `plugin/` is a separate npm project, excluded from the root TypeScript, ESLint and Vitest runs.

### Specs, Design and Library (2026-10-16)

- Specs and Design tabs that group briefs, PRDs, specs, architecture, design documents, wireframes and reviews, with icons for groups and documents.
- Library with a file tree, Preview and Source views and a shared document pane.
- Mermaid diagrams in the Markdown viewer, rendered in strict mode.
- Relative images in Markdown are served through `/api/repo-asset` for local projects.
- Markdown on epic and story pages is rendered whole, and rows show a plain-text summary.

### Epics, stories and search (2026-10-16 to 2026-10-17)

- Epics, epic and story are real pages. Story pages show structured ticket metadata (type, risk, human-in-the-loop, covers), "after" and "blocks" links and previous and next navigation.
- Stories merged into Epics. `/stories` redirects permanently to `/epics`, and old `?epic=` and `?story=` links redirect to the page URLs.
- The Epics page opens on the board view.
- Global search over epics, stories and documents, with `Ctrl+K` and `/` shortcuts, the `/api/search` route and a search screen.
- Overview epic list with search, status filter, sort and pagination, with its state kept in the URL.
- Project actions (refresh, settings, remove) moved into a sidebar row menu.

### Layout adapters and BMAD version support (2026-10-16)

- Layout detection with one adapter per layout: v6 default, v6 project layout (`E1`, `E1-S1` ids with `.agentic` specs), ticket tree (`tickets.toml` with plan files) and v4.
- The detected layout is shown as a pill, with an honest "Layout not recognised" notice, notes and parse errors.
- The BMAD output folder is read from `_bmad/core/config.yaml` or `_bmad/config.toml`.
- Retired, superseded, dropped and deferred stories are excluded from counts.
- Fixtures and tests for layouts, ids, statuses, config and declared provider roots.

### Mobile layout (2026-10-16)

- Mobile pass over the shell, header, drawer, viewport, cards, dialogs, sheets, badges, dashboard, Overview, epics, timeline, story detail, stories list and board, and the Library tree and Markdown.
- 40px touch targets and 16px form fields on phones.

### Paseo UI restyle (2026-10-16 to 2026-10-17)

- Neutral Paseo desktop colour tokens, Geist font and flat surfaces: edge-to-edge shell with the Paseo sidebar, header and project tab strip, flat dialogs and sheets, hairline sections.
- Shared pill, thin progress bar, list rows, toggle and definition table. Compact stats strip and dense lists.
- Raised type scale (body 15px, secondary 13.5px, micro 12px minimum) with re-fitted row, pill and tab heights.
- Renamed to Paseo BMAD Console, removed the GitHub stars, footer credit and starter assets.

### Initial fork and cleanup (2026-10-16 to 2026-10-17)

- Imported the web dashboard from the my-bmad lineage (bmad-code-org/bmad-method-ui) into the repository, then removed the upstream VS Code extension and moved the web app to the repository root.
- Removed unused components, dependencies, dead exports and starter assets.
- Neutral example names in fixtures and docs, repository metadata in `package.json`, and a rewritten README, notices and docs for the standalone project.

## Before the fork

The git history before 2026-10-16 comes from the upstream bmad-method-ui project: a VS Code extension with a dashboard, an epics browser, story views, a document library and workflow actions, released as versions 1.0.0 to 1.2.2 under semantic release. See [NOTICE](./NOTICE) for credits. Those release notes are not repeated here.
