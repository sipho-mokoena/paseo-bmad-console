# Best practices for BMAD projects in the console

This guide is for teams that plan and build with BMAD and use Paseo BMAD Console to see where the work stands. It lists the project practices that give the clearest view in the console, and why each one matters, based on what the console reads. For the ordered procedure of a working session, with commands and a worked example, see [workflow.md](./workflow.md).

The console reads files. It lists the files of the project's BMAD folders (from GitHub or from a folder on the server), parses epics, stories, statuses and dependencies out of them, and renders the result. It has no database of work items and writes nothing back to the project: it is a read-only view. A local project is read from disk on every request, a GitHub project is cached for 5 minutes, and **Refresh data** (header button and sidebar row menu) re-reads it. If a fact is not in a file the console can parse, the console cannot show it.

Statements below are of two kinds. "The console reads ..." is behaviour checked against the code. "Recommended" is advice that is not enforced by any parser, and says why.

## What the console shows, by practice

| If your project has ... | the console shows ... |
| --- | --- |
| A recognised layout (see [layouts.md](./layouts.md)) | The layout pill on the Overview, the epics list and board, the Epics and Overview counts |
| Epics with a description paragraph | The epic header, and a one-line summary on list rows (first block, Markdown stripped, up to 300 characters) |
| Stories with a status | Status pills, epic progress (done stories divided by all stories) and the project progress bar |
| Story descriptions in Markdown | The Description section of the story page (tables and fenced code render) |
| Acceptance criteria as a list, or a `verify` field | The Acceptance criteria list, or the Verify section (ticket tree) |
| Tasks as `- [ ]` checkboxes in a story file | A Tasks section with a progress bar and "n of m completed" |
| `depends_on` or `after` declarations | "after" and "blocks" links on story pages, and the Timeline (Gantt and Graph) on the Overview |
| `risk`, `type`, `hitl`, `covers` on tickets (ticket tree) | Risk pills, "Size by risk" in the Timeline and a details table on the story page |
| Brief, PRD, spec, architecture documents in recognised folders | The Specs tab, grouped as Brief, PRD, Spec, Architecture |
| UX documents, wireframes, reviews in recognised folders | The Design tab, grouped as Design, Wireframes, Reviews |
| Any Markdown file in the BMAD folders | The Library tree with Preview and Source, Mermaid diagrams and the Filter files field |
| Epics, stories and documents | Global search (`Ctrl+K`, `Cmd+K` on macOS, or `/`) |
| Notes the layout produced, and files that failed to parse | The layout pill tooltip and the collapsible Details line on the Overview |

## Practices

### 1. Choose one supported layout and stay on it

The console detects a layout from the file list and uses the first adapter that yields content (see [How a layout is chosen](./layouts.md#how-a-layout-is-chosen)). A project that mixes layouts is read as one of them, and the files of the others are ignored.

| | v6 default | v6 project layout | Ticket tree | v4 |
| --- | --- | --- | --- | --- |
| Epics | `planning-artifacts/epics.md` (`## Epic 1: Title`), `epics/` files or folders | `<out>/epics/E1-name.md`, `.agentic/epics/E1-name/` | `[[epic]]` rows in `initiative-*/tickets.toml` | `docs/prd.md` or `docs/epics.md` headings, `docs/epics/` |
| Stories | `implementation-artifacts/1-1-title.md`, `story-1.md`, or files inside epic folders | `.agentic/.../E1-S1-slug/spec.md`, `implementation-artifacts/E1-S1-slug.md` | `[[entry]]` rows in `<epic>/tickets.toml` | `docs/stories/1.1.slug.md` |
| Status from | Story `Status:` or frontmatter, then `sprint-status.yaml` | Spec status, then `sprint-status.yaml` | Plan files `*-plan.md` | Story status |
| Dependencies | `depends_on` frontmatter | `depends_on` frontmatter | `after` lists | `depends_on` frontmatter |
| Extra metadata | Tasks, criteria | Tasks, criteria | Type, risk, human in the loop, covers, assignee, blocked reason, verify | Tasks, criteria |
| Ids | `1`, `1.2` | `E1`, `E1-S2` | `1`, `1.2` (`<epic>.<entry>`) | `1`, `1.2` |

The ticket tree gives the richest view: risk, type, human in the loop, covers and `after` per ticket, a plan status per ticket, and the data that "Size by risk" needs. v4 support is minimal and tested with fixtures only.

Recommended for a new project: use whatever your BMAD version generates, and do not hand-convert. The v6 default flow is the upstream standard of the v6 releases, and the console reads it fully. If you use the `bmad-ticket` skill, the ticket tree is what it writes, and it is the layout with the most metadata in the console. Pick one before the first epic is written. Changing layout later means rewriting ids and statuses.

If the layout is not recognised, or recognised but without epics, the Overview shows "Layout not recognised: looked for ..." with the locations searched, and the Epics page says "Layout not recognised. Looked for: ...". Compare those locations with your folder. The output folder is `_bmad-output` unless `output_folder` in `_bmad/core/config.yaml` or `_bmad/config.toml` says otherwise.

### 2. Use stable, unique ids and recognised names

What the console reads:

- Epic ids: `1`, `epic-1`, `Epic 1`, `E1`, or a prefixed form such as `DEFERRED-E10`. Story ids: `1.1`, `1-1-slug`, `E1-S1`, `E1-S1-slug`, and a letter suffix such as `E2-S8b` (`src/lib/bmad/ids.ts`).
- Numeric ids stay numbers (`1.2`), project-style ids keep their letters (`E1-S2`). Sorting is natural, so `E2` comes before `E10`.
- A story is attached to its epic by the epic id inside its own id, or by the folder it sits in. A story file with no recognisable id gets its file name as id and no epic.
- In the ticket tree a story id is `<epic id>.<entry id>`, and the epic folder name must equal the `slug` of its `[[epic]]` row.

Recommended:

- Never reuse an id. A reused id merges two pieces of work into one row, and every `after` that named it points to the wrong thing.
- Keep ids stable when you rename a story. The title can change, the id cannot.
- Do not renumber epics to "close gaps". Gaps are harmless.

Planning documents are classified by name (`src/lib/doc-groups.ts`), independent of the layout:

| Recognised | Tab and group |
| --- | --- |
| `planning-artifacts/product-brief*`, folders `brief-*` | Specs, Brief |
| `planning-artifacts/prd*`, folders `prd-*` | Specs, PRD |
| `planning-artifacts/project-context`, `research`, `spec*`, folders `spec-*` | Specs, Spec |
| `planning-artifacts/architecture*`, folders `architecture-*` | Specs, Architecture |
| `planning-artifacts/ux-design*`, folders `ux-*` and `design-*` | Design, Design (`DESIGN.md` first, then `EXPERIENCE.md`, then the folder's main file) |
| A `wireframes/` folder inside a design folder | Design, Wireframes |
| Files named `review*`, or a `reviews/` folder, in a design folder | Design, Reviews (in a spec folder they are listed last in their Specs group) |

Only `.md` files are classified, and anything under a dot-folder is skipped. Folder names compare case-insensitively.

### 3. Keep status as the single source of progress

Progress in the console is the status of each story and nothing else. Where it is stored:

| Layout | Status is read from |
| --- | --- |
| v6 default | The story's frontmatter `status` (or `state`) or a `Status:` line. `sprint-status.yaml` is the fallback when the story declares none |
| v6 project | The spec's status in the same way, then `sprint-status.yaml` |
| Ticket tree | The `status` in the plan file `<type>-<slug>-plan.md` next to the ticket, joined by its `ticket` field. No plan means backlog |
| v4 | Frontmatter, a `## Status` section or a `Status:` line |

The words the console understands (case-insensitive, `src/lib/bmad/utils.ts`):

| Written | Shown as |
| --- | --- |
| `done`, `complete`, `completed` | Done |
| contains `progress`, `started`, or starts with `partially` | In progress |
| `review`, `in-review`, `built`, anything containing `review` | In review |
| `blocked` | Blocked |
| `ready`, `ready-for-dev` | Ready for dev |
| `backlog`, `draft`, `planned`, `todo`, `optional`, and any other word | Backlog |

Ticket-tree plans use a smaller table: `done`, `in-progress`, `blocked`, `in-review` and `built` (In review), `ready-for-dev`, `dropped` (removed), and everything else (`draft`, a typo) is Backlog. A misspelt status therefore reads as Backlog without any warning.

Rules that follow:

- When a story file and `sprint-status.yaml` disagree, the story file wins in the console. Fix whichever is stale. The v6 project layout lists such stories in the Details notes ("spec status differs from sprint-status.yaml (spec wins)"). The v6 default layout applies the same rule silently.
- Epic status is derived from its stories (all done is done, any done or in progress is in progress). `sprint-status.yaml` only decides the status of an epic that has no stories. Epic progress is done stories divided by all stories.
- Stories with status `retired`, `superseded`, `dropped` or `deferred` leave every count in the v6 project and v4 layouts, and the Details notes list them. In the ticket tree only plan status `dropped` removes a ticket. The v6 default layout does not exclude any word: a `retired` story there counts as Backlog, so delete or move such a file instead.
- Retrospective keys in `sprint-status.yaml` (any key containing `retrospective`) are ignored.
- Recommended rule: update the status when the work lands, in the same commit, then refresh the console. A status that lags the code is the main reason a console view misleads.

### 4. Write epics and stories so they read well

The epic description is the first block of the epic text (ticket tree: the `## Description` section of the epic file). It becomes the one-line summary on list rows and the header of the epic page. Keep it to one paragraph that says what the epic delivers.

```markdown
# Product catalog

## Description

Shoppers can browse and search the acme catalog. Done when the list and search
pages work against the real product store.
```

For stories:

- A clear title. v6 stories take it from frontmatter `title` or the first `#` heading ("# Story 1.1: Title" is fine). Ticket entries take it from `title`.
- A short description as the body. Everything outside the criteria and task sections is shown as the Description section.
- Acceptance criteria as a list under `## Acceptance Criteria` (v6, v4). Numbered and bulleted items each become one criterion, and indented sub-bullets stay inside their parent. In the ticket tree write one sentence in `verify`: it is shown as the Verify section.
- Tasks as `- [ ]` and `- [x]` checkboxes. The console counts them for the Tasks progress bar. Any checkbox line in the file counts, so do not use checkboxes for other lists.
- Keep Markdown simple. Tables and fenced code render. Row summaries strip the markup, so do not put the key fact only in a table or a link target.

What you see if you do not: an epic without a description paragraph has an empty summary line, a story without criteria has no criteria section, and a story whose tasks are plain bullets has no progress bar.

Note for the ticket tree: the story page shows the `description` and `verify` of the `[[entry]]` in `tickets.toml`. The console does not read the pulled leaf file (`story-<slug>.md`) of a ticket. If you refine criteria in the leaf file, they appear in the Library, not on the story page, so keep the entry's `description` and `verify` current.

### 5. Declare dependencies

Dependencies unlock the Timeline. Without any, the Overview keeps the plain epics list and the story pages have no "after" and "blocks" links.

| Layout | How to declare |
| --- | --- |
| Ticket tree, story | `after = [1, "1.3"]` in the entry: a bare number is a sibling in the same epic, `"1.3"` is another epic's entry |
| Ticket tree, epic | `after = [{ epic = 1, needs = "the catalog API" }]` in the `[[epic]]` row |
| Other layouts | Frontmatter `depends_on` (also `dependsOn`, `depends-on`, `after`; the first one present is used) |

```yaml
---
depends_on: [E1-S1, E1-S2]
---
```

Accepted forms (`src/lib/bmad/deps.ts`): a list, or one string separated by commas or semicolons. Each entry is a story id (`E1-S4`, `1.2`) or an epic id (`E2`, meaning the whole epic). A trailing note such as `1.2 (partial)` is ignored, and `none` and `n/a` mean no dependency.

Avoid:

- Prose in dependency fields ("after the API is ready"). Entries that are not ids are dropped without a trace.
- References to ids that do not exist. They are reported on the Timeline status line ("n dependency references point to unknown items") and nothing is drawn for them.
- Cycles. They are reported, and the console drops one back edge per cycle so the layout stays readable. The real fix is in the files.
- Sequence disguised as dependency. Declare real prerequisites only. Extra edges stretch the schedule and the critical path.
- A ticket-tree `after` of the form `"epic-<slug>"`. The console prefixes bare strings with the epic id, so that reference is reported as unresolved. Use `<epic id>.<entry id>` instead, or an `[[epic]] after` row for a whole-epic gate.

Fill in `risk` (`low`, `medium`, `high`) and `type` on every ticket. "Size by risk" gives a low, medium or high item 1, 2 or 3 waves, and the details panel shows both. The Timeline derives waves, "Ready now" and the critical path from the graph, and waves are not dates. See [timeline.md](./timeline.md).

### 6. Put planning documents where the tabs look

Write the brief, PRD, spec, architecture and UX documents into the BMAD output folder with the names in the table in practice 2. In the v6 default layout that is `planning-artifacts/`. In the folder style (what the newer BMAD skills write) it is one folder per document set: `brief-acme/`, `prd-acme/`, `spec-acme/`, `architecture-acme/`, `ux-acme/`, each with a main file of the folder's name, and extras sorted after it. For UX, `DESIGN.md` and `EXPERIENCE.md` come first, and wireframes go in `ux-acme/wireframes/`.

- Draw diagrams as Mermaid fenced blocks (` ```mermaid `). They render in the Library, Specs and Design tabs in strict mode: scripts and click handlers are disabled, and a diagram with a syntax error shows the error message and the source instead of the picture.
- Put images next to the Markdown file and reference them with relative paths (`![Flow](./flow.png)`). Types: svg, png, jpg, jpeg, gif, webp, up to 5 MB. Images are served for local projects only. In a GitHub project a relative image does not load in the console.
- Keep wireframe source files (`.excalidraw`, exports) out of the main document list. Only `.md` files are classified, so put the Markdown description of each wireframe in `wireframes/` and leave the sources beside them.

What you see if you do not: no Specs or Design tab (a tab appears only when it has a document), a document that is only in the Library, or an image placeholder.

### 7. Keep the project folder tidy

- Keep BMAD artifacts in the output folder. The console opens `_bmad`, the output folder and the folders a layout declares (`docs`, `.agentic`). Everything else in the project is never read ([LOCAL_FOLDER.md](./LOCAL_FOLDER.md)).
- No secrets in any BMAD document. The console has no authentication: with `ENABLE_LOCAL_FS=true`, anyone who can reach it can read the BMAD folders of every registered local project, and for a GitHub project it shows whatever the token can read.
- Keep files small. Local limits: 10 MB per file, 10,000 files in the allowed folders, 20 directory levels, 5 MB per image. Search reads at most 300 Markdown files of 512 KB each per project.
- Do not commit generated clutter (exports, build output, logs, caches) into BMAD folders. They slow the scan and fill the Library tree. The scan already skips `node_modules`, `.git`, `dist`, `build` and similar.
- Avoid symbolic links inside BMAD folders. The local provider skips them.

### 8. Run the console deliberately

- Local folder or GitHub: use a local folder for a project on the server, because it always shows what is on disk and serves images. Use GitHub when the console runs elsewhere. A GitHub project shows the tracked branch, so push before you refresh.
- `GITHUB_PAT` is optional. Without it GitHub allows 60 requests per hour and only public repositories; with it 5,000 per hour and private repositories (scope `repo`). Data is cached 5 minutes. Restart the server after changing the token. See [configuration.md](./configuration.md).
- `ENABLE_LOCAL_FS=true` only on a machine you control. Run the console on `localhost` or a private network, never on the public internet ([SECURITY.md](../SECURITY.md)).
- Keep the production build updated: after you pull changes to the console, rebuild and restart as in [deployment.md](./deployment.md#6-update-a-deployment). A stale build shows stale parsing.
- After changing project files, press **Refresh data** (header, or the project's row menu) and reload the page.

## What good looks like

Paste this into a pull request or review:

- [ ] The project uses one supported layout, and the layout pill names it.
- [ ] The Overview Details line is empty, or every note in it is understood.
- [ ] Epic ids and story ids use the forms in practice 2, are unique and are never reused.
- [ ] Every epic has a one-paragraph description.
- [ ] Every story has a clear title, a short description and acceptance criteria (or a `verify` sentence).
- [ ] Tasks use `- [ ]` checkboxes, and only tasks do.
- [ ] Status words are from the vocabulary in practice 3, and the status was updated in the same commit as the work.
- [ ] No story shows a status that the story file and `sprint-status.yaml` disagree about.
- [ ] Dependencies are declared with ids only, point to existing items and contain no cycles.
- [ ] Tickets carry `risk` and `type` (ticket tree).
- [ ] The brief, PRD, spec, architecture and UX documents sit in folders the Specs and Design tabs recognise.
- [ ] Diagrams are Mermaid blocks, images use relative paths and sit beside the document.
- [ ] No secrets in BMAD documents, and no generated files in BMAD folders.
- [ ] The Timeline shows no cycles and no unresolved references.
- [ ] The console was refreshed after the change and the story page shows the new status.

## Common problems and fixes

| Symptom | Cause in the console | Fix in the project |
| --- | --- | --- |
| Epics page empty, "Layout not recognised" | No adapter found content in the places it searches | Move files to the layout's locations, or set `output_folder` in `_bmad/core/config.yaml` (see [layouts.md](./layouts.md)) |
| Epics show, but 0 stories | Story file names or ids are not recognised, or ticket entries have no `id` | Name stories `N-N-title.md` or `E1-S1-slug.md`, give every `[[entry]]` an `id`, and check the Details line for parse errors |
| Everything is backlog | No status found, a misspelt word, or a ticket without a plan file | Add `status` to the story or plan, use the vocabulary in practice 3, and check that the plan file ends in `-plan.md` and has a `ticket` field |
| Stories under the wrong epic | The epic id in the story id, frontmatter `epic_id`, or the folder differs from the epic | Make the story id, `epic_id` and folder agree, and rename the epic folder to match its `slug` (ticket tree) |
| No Timeline | The project has no dependency data, so the Overview shows the epics list | Declare `depends_on` or `after` with valid ids (practice 5) |
| Timeline reports unknown items | A dependency names an id that does not exist, or uses prose or `epic-<slug>` | Use existing story or epic ids only |
| Timeline reports a cycle | Two items wait on each other, directly or through others | Remove one edge in the files |
| No Specs or Design tab | No document matches a group name | Rename files or folders as in practice 2. The Library still lists everything |
| Details says "spec status differs from sprint-status.yaml" | The story file and the sprint file disagree (v6 project layout) | Update the stale one. The spec wins in the console meanwhile |
| Retired stories still counted | The v6 default layout does not exclude `retired` or `superseded` | Remove or move the story file, or use the v6 project layout or the ticket tree `dropped` status |
| Images do not load | The project is a GitHub project, the path is not relative, the type is not allowed, or the file is over 5 MB | Use a local project, a relative path next to the document and an allowed type |
| Diagram shows an error | The Mermaid source does not parse | Fix the syntax. The error block and the Source view show the raw text |
| "GitHub rate limit reached" | No token, so 60 requests per hour | Set `GITHUB_PAT`, restart, and wait for the 5 minute cache |
| A change does not appear | GitHub cache, or the change is not pushed to the tracked branch | Push, then **Refresh data** and reload |
| Local project does not load | The folder moved or has no `_bmad` or `_bmad-output` | Remove the project and add it again at the new path |
