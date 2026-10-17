# BMAD layouts

BMAD projects store epics, stories and status in different places depending on the BMAD version and on how a team organises its work. This page explains which layouts Paseo BMAD Console understands, how it picks one, what each layout reads, how statuses are mapped and how to add a layout. The code is in `src/lib/bmad/layouts/`, and the entry point is `getBmadProject` in `src/lib/bmad/parser.ts`.

## Supported layouts

| Id | Label in the UI | Typical project |
| --- | --- | --- |
| `v6-default` | BMad v6 · default | A BMAD v6 install with `planning-artifacts` and `implementation-artifacts` |
| `v6-project` | BMad v6 · project layout | A v6 install with one file per epic and one spec per story, using ids like `E1` and `E1-S1` |
| `ticket-tree` | Ticket tree | Initiatives, epics and tickets kept as `tickets.toml` files with plan files |
| `v4` | BMAD v4 | A `.bmad-core` project with `docs/prd.md`, `docs/epics` and `docs/stories` |

v4 support is minimal and tested with fixtures only. The UI says so in the layout notes.

## The output folder

Most paths below are relative to the BMAD output folder, written `<out>`. It is `_bmad-output` unless the project says otherwise. The app reads, in this order:

1. `_bmad/core/config.yaml`, key `output_folder`.
2. `_bmad/config.toml`, key `output_folder` under `[core]` (or the first `output_folder` key found).
3. Default: `_bmad-output`.

A leading `{project-root}/` and surrounding slashes are removed, so `{project-root}/out` becomes `out`. A nested value such as `custom/out` is accepted. For local projects the provider then opens the top segment (`custom`) but the app refuses to read anything under it that is outside `custom/out`.

## How a layout is chosen

Every adapter has a `detect` function that returns a score from 0 (no match) upwards. It runs on the file list of the project and must be cheap.

| Adapter | Score | Signal |
| --- | --- | --- |
| `v6-project` | 90 | At least one flat epic file `<out>/epics/E<n>-*.md` (file name starts with `E<n>`, `DEFERRED-E<n>` style prefixes allowed) |
| `v6-project` | 75 | No such file, but a top-level `.agentic` folder (or `.agentic/.../spec.md` files) |
| `v6-default` | 70 | A single `<out>/planning-artifacts/epics.md` or `epic.md`, epic files or folders in `<out>/planning-artifacts/epics/`, or story files in `<out>/implementation-artifacts/` |
| `v6-default` | 50 | Only `<out>/implementation-artifacts/sprint-status.yaml` |
| `ticket-tree` | 60 | A file `<out>/initiative-*/tickets.toml` |
| `v4` | 40 | A `.bmad-core` folder and a `docs` folder |
| `v4` | 30 | A `.bmad-core` folder only |
| `v4` | 20 | `docs/prd.md` plus epic or story files in `docs/` |

Adapters are tried from the highest score down, and equal scores keep the order of the registry (`v6-project`, `v6-default`, `ticket-tree`, `v4`). The first adapter that produces any epics, stories or sprint entries wins. A project-specific layout beats the default one because the default rules would ignore its file names. The default beats a ticket tree, which acts as a fallback.

If no adapter yields content, the best match is shown as "not recognised". If nothing matches at all, the layout is reported as "Unknown layout".

## What each layout reads

### v6 default

```
_bmad-output/
  planning-artifacts/
    epics.md                         one file with "## Epic 1: Title" headings
    epics/
      epic-1.md                      one file per epic (frontmatter or heading)
      epic-1-foundation/             an epic folder
        epic.md                      optional epic file
        1-1-first-story.md           stories inside the folder
  implementation-artifacts/
    sprint-status.yaml               development_status map
    1-1-first-story.md               story files named N-N-title.md or story-N.md
```

- Epics come from `epics.md` if it exists. Otherwise they come from flat files in `epics/` and from `epic.md` inside epic folders. A folder named like `epic-1`, `epic_1`, `1` or `epic-1-some-title` creates an epic even without `epic.md`; the title is derived from the folder name.
- Stories come from `implementation-artifacts` (`N-N-title.md`, `story-N.md`) and, when there is no `epics.md`, from the Markdown files inside epic folders.
- A story file may declare its status in frontmatter (`status` or `state`) or on a `Status:` line. It is parsed for title, acceptance criteria (the `## Acceptance Criteria` section) and tasks (checkbox items).
- `sprint-status.yaml` supplies the status of stories that declare none, and creates placeholder stories for entries that have no file. It also supplies epic status for epics that have no stories.

### v6 project layout

```
acme/
  _bmad-output/
    epics/
      E1-foundations.md              one file per epic, frontmatter epic_id and name
      E2-payments.md
    implementation-artifacts/
      sprint-status.yaml             development_status: E1, E1-S1-slug, ...
      E1-S3-extra.md                 story file without a spec (optional)
  .agentic/
    epics/
      E1-foundations/
        E1-S1-sign-up-form/
          spec.md                    one spec per story, frontmatter status
        spec.md                      optional epic-level spec
    specs/
      E2-S1-checkout/
        spec.md                      flat variant of a story spec
```

- Epics come from the flat files in `<out>/epics/`. Epic folders in `.agentic/epics/` named like `E1-foundations` add epics and fill gaps (the title from the folder name, the description from `<folder>/spec.md` or `<folder>/E1-INDEX.md`).
- Stories come from `spec.md` files at `.agentic/epics/<epic folder>/<E<n>-S<k>-slug>/spec.md` or `.agentic/specs/<E<n>-S<k>-slug>/spec.md`. If the same story exists in both places, the one inside its own epic folder is used and a note is added.
- `<out>/implementation-artifacts/E<n>-S<k>-slug.md` files are used for stories that have no spec.
- `sprint-status.yaml` entries such as `E1: in-progress` and `E1-S1-first: done` supply epic and story status.
- This adapter declares two extra roots, `.agentic` and `docs`. The local provider opens them only after the layout is detected, and `.agentic` is the only dot-folder the provider will ever open.

Ids keep their letters (`E1`, `E1-S1`, `DEFERRED-E10`) in this layout. In the v6 default layout ids are plain numbers (`1`, `1.1`).

### Ticket tree

```
_bmad-output/
  initiative-payments/
    tickets.toml                     [[epic]] id, slug, title
    checkout/
      tickets.toml                   [[entry]] id, type, title, description, verify, risk, hitl, covers, after
      checkout.md                    epic description (## Description section)
      feature-pay-plan.md            plan file: frontmatter ticket, status, assignee, blocked_reason
```

- Epics come from the `[[epic]]` rows of `initiative-*/tickets.toml`. Each epic's tickets come from `<slug>/tickets.toml`.
- Story ids are `<epic id>.<entry id>`. In `after`, a bare number refers to a sibling in the same epic and `4.1` is a full reference.
- Plan files named `*-plan.md` next to the tickets carry the status, matched by their `ticket` frontmatter field.
- Ticket metadata (type, risk, human-in-the-loop flag, covers, after, assignee, blocked reason) is shown on story rows and the story page. `verify` becomes the story's single acceptance criterion.
- A ticket without a plan file is `backlog` with no explicit status.

### v4

```
docs/
  prd.md                             "## Epic 1: Title" headings, used when no epic files exist
  architecture.md
  epics.md                           alternative single file with epic headings
  epics/epic-1-setup.md              one file per epic (also docs/epic-1-setup.md)
  stories/1.1.first-story.md         story files named N.M.slug.md
.bmad-core/
```

- Story status is read from frontmatter, a `## Status` section or a `Status:` line. The v4 words `Approved` and `InProgress` map to ready-for-dev and in-progress.
- The adapter declares `docs` as an extra root.

## Dependencies between stories and epics

Stories and epics can declare what must be done first. The story page shows these as "after" links (the prerequisites) and "blocks" links (the stories that wait for this one).

- **Story files** (v6 default, v6 project layout, v4): frontmatter key `depends_on`, `dependsOn`, `depends-on` or `after`, the first one present. The value can be a list or a string separated by commas or semicolons, for example `[E1-S1, E1-S2]` or `"1.2, 1.3 (partial)"`. Each entry is a story id (`E1-S4`, `1.2`) or an epic id (`E2`, `3`, meaning the whole epic). A trailing note after the id is ignored, `none` and `n/a` mean no dependency, and entries that are not ids are dropped.
- **Ticket tree**: the `after` list of a ticket in `tickets.toml`. A bare number is a sibling in the same epic, and `4.1` is a full story reference.
- **Epics**: the same frontmatter keys in an epic file (`epic.md`, `epics/epic-1.md`, `E1-name.md`) give the epic's `after` list. A story id there becomes a dependency on that story's epic, with the story id kept as the reason. In the ticket tree, an epic row can carry `after = [{ epic = 1, needs = "reason" }]`, or bare ids.

`src/lib/bmad/deps.ts` holds the parsing (`parseDependencyRefs`, `frontmatterDependencies`, `storyDeps`). `src/lib/dependency-graph.ts` builds a graph from these declarations and computes waves (an abstract schedule, since BMAD data has no dates), the critical path through unfinished items, cycle reporting and scoping to the neighbourhood of one item. The Timeline tab uses it, see [timeline.md](./timeline.md).

## How statuses map

All adapters normalise story status words the same way. Matching is case-insensitive.

| Source word | Story status |
| --- | --- |
| `done`, `complete`, `completed` | done |
| contains `progress`, `started`, starts with `partially` | in-progress |
| `review`, `built`, or contains `review` | review |
| `blocked` | blocked |
| `ready`, `ready-for-dev` | ready-for-dev |
| anything else, or no status | backlog |

Ticket-tree plan files use their own small table: `done`, `in-progress`, `blocked`, `in-review` and `built` (review), `ready-for-dev`, and everything else is backlog.

Which source wins:

- A status written in the story file or spec beats `sprint-status.yaml`. The sprint file is the fallback when the story declares none.
- Epic status is derived from the epic's stories: all done is done, any done or in progress is in progress, otherwise not started. Only an epic without stories uses the status from `sprint-status.yaml`.
- Epic progress is completed stories divided by total stories. Project progress is completed stories divided by the larger of the story count and the number of sprint entries.

## What is excluded

Stories whose status is `retired`, `superseded`, `dropped` or `deferred` are removed from every count and progress figure. Ticket-tree tickets with plan status `dropped` are removed too. The v6 project and v4 adapters list the excluded ids in the layout notes. Retrospective entries (keys containing `retrospective`) in `sprint-status.yaml` are ignored.

## Layout pill, notices and Details

- The **layout pill** next to the source line on the Overview page names the detected layout. Its tooltip lists the notes and the places that were searched.
- When the layout is not recognised, or recognised but yields no epics, a **notice** reads "Layout not recognised: looked for ..." followed by the searched locations, while the epic list says "No epic found. Looked for: ..." (the Epics page says "Layout not recognised. Looked for: ..."). This is the message to look at when a project shows zero epics.
- The collapsible **Details** line lists the layout notes and up to 20 files that failed to parse, with the reason.

Notes you can see, depending on the layout: how many stories were left out as retired or superseded, stories whose spec status differs from `sprint-status.yaml` (the spec wins), specs that exist twice, sprint entries without a spec, "No story specs found; story data comes from sprint-status.yaml only", "BMAD v4 support is minimal", "<layout> matched but no epics were found", "No known BMAD layout matched this project" and "Could not open ..." when an extra root was refused.

## Document groups for Specs and Design

The Specs and Design tabs are independent of the layout adapters. `src/lib/doc-groups.ts` classifies Markdown files of the output folder by name:

- Specs groups: Brief (`product-brief*`, `brief-*`), PRD (`prd*`), Spec (`spec-*`, `project-context`, `research`), Architecture (`architecture*`).
- Design groups: Design (`ux-design*`, `ux-*`, `design-*`), Wireframes (a `wireframes` folder), Reviews (`review*` files or a `reviews` folder).
- Files under dot-folders are skipped. The Library still lists every file, so a document can appear in both places.
- A tab is shown only when it has at least one document.

## Adding a new layout adapter

1. Create `src/lib/bmad/layouts/<id>.ts` and export an object that implements `LayoutAdapter` from `layouts/types.ts`:
   - `id` and `label`.
   - `extraRoots`: top-level folders outside the output folder that the adapter reads. Leave it empty if none.
   - `lookedFor(outputDir)`: human-readable locations, shown when nothing is found.
   - `detect(ctx)`: a score, 0 for no match. Pure and cheap, using `ctx.paths` and `ctx.rootDirectories` only.
   - `load(ctx)`: read files with `ctx.readFile` (use `mapLimit` and `READ_CONCURRENCY` from `../concurrency`) and return a `LayoutResult`: epics, stories, optional sprint status, `storyPaths` (so the Library does not list stories as documents), notes, parse errors and the number of files tried. `emptyResult()` gives a starting value.
2. Add the new id to the `LayoutId` union in `src/lib/bmad/types.ts`.
3. Register the adapter in `LAYOUT_ADAPTERS` in `src/lib/bmad/layouts/index.ts`. Choose a score that fits the table above and the position that breaks ties.
4. Use the shared helpers: `normalizeStoryStatus`, `isExcludedStatus` (`utils.ts`), id parsing in `ids.ts`, `capBody` and `plainSummary` (`body.ts`).
5. If the layout needs a dot-folder other than `.agentic`, add its name to `DECLARABLE_DOT_DIRS` in `src/lib/content-provider/types.ts`. This widens what the local provider may read, so add it only together with the adapter and update the security tests.
6. Add tests. `src/lib/bmad/__tests__/layouts.test.ts` builds a project from a plain object of `path: content` pairs behind a fake `ContentProvider` and checks detection, parsing, statuses and notes. Declared roots are tested in `src/lib/content-provider/__tests__/declared-roots.test.ts`. Use neutral names such as `acme` in fixtures.
7. Run `pnpm test`, `pnpm lint` and `pnpm exec tsc --noEmit`, then update this page.
