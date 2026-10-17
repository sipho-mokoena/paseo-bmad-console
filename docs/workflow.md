# Workflow session: building with BMAD and the console

This is the ordered procedure for a working session with BMAD and Paseo BMAD Console. It assumes you have read the practices in [best-practices.md](./best-practices.md). The console reads project files and shows them, so every step that changes the project is done in BMAD (or by hand), and every step that checks the result is done in the console. Nothing in the console edits a project.

Two flows are covered:

- **Ticket tree**: the `bmad-ticket` and `bmad-build` skills of the current BMAD release. Names and the `mark` command below are from the installed skills (`SKILL.md` and `references/board.md` of `bmad-ticket`, `tickets.py --help`).
- **v6 default**: the sprint workflows of the v6 releases, with `sprint-status.yaml`. The workflow names are from the BMAD v6.0.0 documentation and sources (`docs/reference/workflow-map.md`). Slash command names follow the pattern `bmad-<module>-<workflow>`, for example `/bmad-bmm-dev-story`. Names change between versions: check your BMAD version with `/bmad-help` or the command folder of your IDE. The latest upstream documentation no longer describes this flow.

Anything marked "check your BMAD version" was not verified against your installation.

## Roles

| Who | Updates | Reads in the console |
| --- | --- | --- |
| Developer | Code, the story or plan status while building (the BMAD skills do this), tasks | Ready now, story page, Verify and criteria |
| Reviewer | The review outcome, and `done` when the review passes | In review rows, the story page |
| Lead | Epics, ids, dependencies, risk, retire or drop decisions, the retrospective | Overview, Timeline, Details notes, Specs and Design |

The console is not a task editor and not a tracker. It cannot assign, move or close work, and it keeps no history. If it shows something wrong, change the file and refresh.

## 1. Before you start

1. Install or update the console. For a first install follow [GETTING_STARTED.md](./GETTING_STARTED.md). For a deployed instance follow [deployment.md](./deployment.md#6-update-a-deployment).
2. Add the project: **Add a project**, then `owner/name` (GitHub) or the absolute folder path on the server (`ENABLE_LOCAL_FS=true`). The folder needs `_bmad` or `_bmad-output` at its top level. See [LOCAL_FOLDER.md](./LOCAL_FOLDER.md).
3. Open the project Overview. Check the layout pill: it should name the layout you intend to use. Hover it to see the notes and the places that were searched.
4. Open the **Details** line. Empty is good. Each note must be understood (for example "spec status differs from sprint-status.yaml") or fixed. Parse errors list the file and the reason.
5. For a GitHub project, check the tracked branch (**Settings** in the row menu). The console shows that branch, not your working copy.

## 2. Plan

Run the planning skills in order. After each one, press **Refresh data** and check the tab named in the last column.

| Step | Ticket-tree release skill | v6 default workflow | Console |
| --- | --- | --- | --- |
| Brief | `bmad-product-brief` | `/bmad-bmm-create-product-brief` | Specs, Brief |
| PRD | `bmad-prd` | `/bmad-bmm-create-prd` | Specs, PRD |
| Spec | `bmad-spec` | not part of the v6 flow | Specs, Spec |
| Architecture | `bmad-architecture` | `/bmad-bmm-create-architecture` | Specs, Architecture |
| UX | `bmad-ux` (writes `DESIGN.md`, `EXPERIENCE.md`) | `/bmad-bmm-create-ux-design` | Design |
| Epics and stories | `bmad-ticket` ("slice this initiative", "break this into stories") | `/bmad-bmm-create-epics-and-stories` | Overview, Epics |
| Readiness gate | `bmad-ticket` ("validate these tickets") | `/bmad-bmm-check-implementation-readiness` | not shown |
| Sprint tracking | not used (status lives in plans) | `/bmad-bmm-sprint-planning` writes `sprint-status.yaml` | Overview sprint strip |

Then, as lead:

1. Give every epic a one-paragraph description and every story a title, description and criteria (practice 4).
2. Declare dependencies with ids only (practice 5). In the ticket tree, `bmad-ticket` writes `after` and the `[[epic]] after` rows with `needs`. In v6 default, add `depends_on` to the story or epic frontmatter by hand.
3. Set `risk` and `type` on ticket entries.
4. Open the Overview **Timeline** (it replaces the epics list when the project has dependency data). Check:
   - the order is sensible: foundations in wave 1, dependants later;
   - the status line reports no cycles and no "references point to unknown items";
   - no epic or story is unexpectedly in wave 1 because a dependency is missing.
5. Fix what the Timeline reports in the files, commit, refresh. Waves are a schedule derived from the graph, not dates.

## 3. Pick work

1. On the Overview, open the Timeline **Filter** and select **Ready now**. These are items that are not done and whose prerequisites are all done.
2. Turn on **Highlight critical path** (View menu). Work on the critical path first when you want the finish line to move. Done items cost nothing on the path.
3. Select an item. The details panel shows wave, risk, type, the open prerequisites that block it and what it blocks.
4. With **Size by risk** on, high-risk items are drawn three waves long. Review high-risk items first and plan their checks.
5. Ticket tree only: the story page shows type, risk and "human in the loop". A human-in-the-loop ticket needs a person for part of the work, so schedule that person before you start.
6. Open the story page (**Open story**). Read Description, then Verify (ticket tree) or Acceptance criteria. This is the definition of done for the story. If it is missing or vague, stop and refine the ticket before building.
7. Check the "after" links. If a prerequisite is not done, do not start.

## 4. Build

Ticket-tree release:

1. Name the ticket to the build skill, for example "build 1.2" (a ref is `<epic id>.<entry id>`, resolved by `tickets.py find`). With no ticket named, `bmad-build` lists what is ready with `tickets.py next`.
2. `bmad-build` plans, then asks you to approve the plan. It writes the ticket's plan file `<type>-<slug>-plan.md` next to the ticket and moves its `status` through `draft`, `ready-for-dev`, `in-progress`, `in-review` and `built`. It records `risk` in the plan.
3. `bmad-build-auto` runs one iteration of an unattended loop and writes `blocked` with a reason when it halts. Use it only if your team has set up such a loop.
4. Refresh the console. The story shows In progress, then In review.

v6 default release (check your BMAD version for the exact names):

1. `/bmad-bmm-sprint-planning` once, to create `sprint-status.yaml`.
2. `/bmad-bmm-create-story` prepares the next story file and sets `Status: ready-for-dev` (and the sprint entry). Create the next story only after the previous one is done, so its learnings carry over.
3. `/bmad-bmm-dev-story` implements it, ticks tasks (`- [x]`) and moves the story to `review`.
4. Refresh the console. Task progress shows on the story page, status on the epic.

Either way, keep the story or plan status in the same commit as the code.

## 5. Review and close

1. Review the change. Ticket-tree release: the build runs its own review step, and you can run `bmad-code-review` or `bmad-review` on the diff. v6 default: `/bmad-bmm-code-review` (in v6.0.0 it sets the story to `done` when it approves and back to `in-progress` when it asks for changes).
2. Mark the ticket done. In the ticket tree no skill moves a ticket past `built`: the user (or an orchestrator) marks it done with `tickets.py mark`, or asks `bmad-ticket` to do it. From the project root:

   ```bash
   uv run .claude/skills/bmad-ticket/scripts/tickets.py --project-root . mark epic-catalog 1.2 done
   ```

   The path of `tickets.py` depends on where your agent keeps skills. The arguments are `mark [dir] ref status [--assignee who] [--blocked reason]`, where status is one of `draft`, `ready-for-dev`, `in-progress`, `in-review`, `built`, `done`, `blocked`, `dropped`. `mark` writes only the plan file.
3. Commit the code, the plan or story file and `sprint-status.yaml` together. If the console reads a GitHub project, push to the tracked branch.
4. Press **Refresh data** and reload. Confirm on the story page that the status is Done, on the epic that the progress bar moved, on the Overview that the project progress moved, and on the Timeline that dependants became Ready now.
5. Retire or supersede stories properly:
   - Ticket tree: set the plan status to `dropped` (`bmad-ticket` does this when you say so, after a `Dropped:` note). The ticket leaves all counts. Dependants still wait on it, so repoint their `after`.
   - v6 project layout and v4: set the story status to `retired`, `superseded`, `dropped` or `deferred`. The Details notes list the excluded ids.
   - v6 default: no status removes a story from the counts. Delete or move the file, and remove its `sprint-status.yaml` entry.
6. When all the stories of an epic are done, run the retrospective: `bmad-retrospective` on the epic folder (ticket-tree release), or `/bmad-bmm-retrospective` (v6 default).

## 6. Rhythm

Daily loop:

1. Refresh the console and open the Overview.
2. Open **Ready now** and the critical path. Pick one item.
3. Read its story page: Description, Verify or criteria, "after" links.
4. Build, review, commit with the status change.
5. Refresh, and confirm the new status before you stop.

Weekly check (lead):

1. Open **Details** on the Overview: resolve every status mismatch note, parse error and "no story specs" note.
2. Open the Timeline: clear unresolved references and cycles.
3. Filter by In progress and Blocked: find items that have not moved for a week, and update or unblock them.
4. Filter by In review: close what has been reviewed.
5. Search (`Ctrl+K`) for ids that appear in old documents and no longer exist.

Retrospective step: when an epic closes, run the retrospective, then record its action items as new tickets or stories so they show on the Timeline. The console shows the result of that retrospective only as a Markdown file in the Library.

## 7. Worked example: the acme project

A fictional project with 2 epics and 5 stories. The files are shown first, then what the console shows. Both flows are shown.

### Ticket tree

Planning produces these files:

```
_bmad-output/
  initiative-acme/
    tickets.toml
    epic-catalog/
      epic-catalog.md
      tickets.toml
    epic-checkout/
      epic-checkout.md
      tickets.toml
```

`initiative-acme/tickets.toml`:

```toml
[[epic]]
id = 1
slug = "epic-catalog"
title = "Product catalog"

[[epic]]
id = 2
slug = "epic-checkout"
title = "Checkout"
after = [{ epic = 1, needs = "the product list API" }]
```

`epic-catalog/tickets.toml`:

```toml
[[entry]]
id = 1
type = "story"
title = "Catalog service scaffold"
description = "Stands up the service with one list path through API and store."
verify = "A request to the list path returns an empty list from the deployed service."
after = []
hitl = true
risk = "low"

[[entry]]
id = 2
type = "story"
title = "List products"
description = "Returns the products of the store with paging."
verify = "Ten seeded products come back in two pages of five."
after = [1]
risk = "medium"

[[entry]]
id = 3
type = "story"
title = "Search products"
description = "Adds a text search to the list path."
verify = "A query for a product name returns only matching products."
after = [2]
risk = "low"
```

`epic-checkout/tickets.toml` has entry 1 "Cart" (`after = ["1.2"]`, risk medium) and entry 2 "Pay" (`after = [1]`, risk high).

What the console shows after planning:

- Overview: the pill reads "Ticket tree", 2 epics, 5 stories, progress 0%. The Timeline replaces the epics list. Wave 1 holds 1.1, wave 2 holds 1.2, wave 3 holds 1.3 and 2.1, wave 4 holds 2.2. Ready now: 1.1. The critical path is 1.1, 1.2, 2.1, 2.2.
- Story pages show type, risk, human in the loop (Yes for 1.1), the Verify section and "after" and "blocks" links.

Build 1.1, then close it. The build writes `epic-catalog/story-catalog-service-scaffold-plan.md`, and `mark` sets its status:

```markdown
---
ticket: 1
status: done
---
```

After refresh:

- Story 1.1 shows Done. Epic 1 shows In progress, 1 of 3 stories, 33%. Project progress is 20% (1 of 5).
- Ready now becomes 1.2. The critical path no longer counts 1.1.
- If the plan said `status: built`, the story would show In review and 1.2 would stay blocked by it.

Drop story 1.3 when search moves out of scope: `mark` it `dropped` after adding a `Dropped:` note. The story leaves the counts: 4 stories remain, and the project progress is 25% with 1.1 done.

### v6 default

Planning produces `planning-artifacts/epics.md` with `## Epic 1: Product catalog` and `## Epic 2: Checkout`, and sprint planning produces `implementation-artifacts/sprint-status.yaml`:

```yaml
development_status:
  epic-1: in-progress
  1-1-catalog-service-scaffold: done
  1-2-list-products: review
  1-3-search-products: backlog
  epic-1-retrospective: optional
  epic-2: backlog
  2-1-cart: backlog
  2-2-pay: backlog
  epic-2-retrospective: optional
```

A story file `implementation-artifacts/1-2-list-products.md`:

```markdown
---
depends_on: [1.1]
---

# Story 1.2: List products

Status: review

## Acceptance Criteria

1. Ten seeded products come back in two pages of five.

## Tasks

- [x] Add the list query
- [ ] Add paging
```

What the console shows: the pill reads "BMad v6 · default"; 5 stories, 1 done (20%); epic 1 In progress, epic 2 Not started; story 1.2 In review with a 1 of 2 task bar and an "after" link to 1.1. The retrospective keys are ignored. If the story file said `Status: in-progress` while the sprint file said `review`, the story file would win and the console would show In progress.

Stories without a file (here 1.3, 2.1, 2.2) appear from the sprint entries, with titles made from the key (for example "Search Products") and no description. Add `depends_on` to the story files of the others, or to the epic files, to get the Timeline.
