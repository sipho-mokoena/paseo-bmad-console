# Getting started

This guide takes you from a fresh checkout to a running Paseo BMAD Console with your first project, explains what each tab shows and lists fixes for common problems. It covers a development setup. For a production-style folder see [deployment.md](./deployment.md).

The app has no login. It binds to `127.0.0.1` by default, so only the machine it runs on can reach it. Keep it that way, or restrict it to a private network (see [SECURITY.md](../SECURITY.md)).

## Prerequisites

- Node.js 22 or later (at least 20.12 for local folder import).
- pnpm 10 or later.
- PostgreSQL 15 or later, or Docker to run the included compose file (PostgreSQL 17).
- Optional: a GitHub personal access token, to read private repositories or to raise the GitHub rate limit.

## 1. Get the code and install

```bash
git clone https://github.com/sipho-mokoena/paseo-bmad-console.git
cd paseo-bmad-console
pnpm install
```

`pnpm install` also runs `prisma generate`. The repository is private, so the clone needs access to it.

## 2. Create `.env`

Either copy the template:

```bash
cp .env.example .env
```

or let the script write a `.env` with a generated `REVALIDATE_SECRET` and the development `DATABASE_URL`:

```bash
bash scripts/setup.sh
```

If you copied the template, edit `DATABASE_URL`. With the included compose file it is:

```
DATABASE_URL=postgresql://bmad:bmad_dev_password@localhost:7433/bmad_dashboard
```

Every variable is described in [configuration.md](./configuration.md). Two you may want now:

- `ENABLE_LOCAL_FS=true` to add projects from folders on this machine.
- `GITHUB_PAT=<token>` to read private repositories (scope `repo`) or to get 5,000 GitHub requests per hour instead of 60 (scope `public_repo` is enough for public repositories).

## 3. Start PostgreSQL

```bash
docker compose up -d
```

This starts PostgreSQL 17 and publishes it on `127.0.0.1:7433`. Skip this step if you use your own PostgreSQL, and point `DATABASE_URL` at it.

## 4. Create the tables

```bash
pnpm exec prisma migrate deploy
```

This applies the committed migrations to an empty database and records them. It is the right command for a fresh database and for every later update. Do not use `pnpm db:push` on a database you want to keep: it creates the tables without recording migrations, and `migrate deploy` then refuses to run on it (error P3005). `pnpm db:migrate` (`prisma migrate dev`) is for creating new migrations while developing.

## 5. Start the app

```bash
pnpm dev
```

Open [http://127.0.0.1:7002](http://127.0.0.1:7002).

## Add your first project

Press **Add a project** (the plus button in the sidebar, or the tile on the home page).

### From GitHub

1. Open the **GitHub** tab. When local import is disabled it is the only form.
2. Enter `owner/name`, for example `acme/shop`.
3. Optionally enter a branch. Without one, the repository's default branch is used.
4. Submit. The app checks the repository on GitHub and adds it.

Private repositories need `GITHUB_PAT` with the `repo` scope, and the server must be restarted after you set it. You can change the tracked branch later from the project's row menu, under **Settings**.

### From a local folder

Requires `ENABLE_LOCAL_FS=true` and a restart.

1. Open the **Local Folder** tab.
2. Enter the absolute path of the project on the server's disk, for example `/home/user/acme`.
3. Submit. The folder must contain a `_bmad` or `_bmad-output` folder at its top level.

Details and limits are in [LOCAL_FOLDER.md](./LOCAL_FOLDER.md).

### Project actions

Each project in the sidebar has a row menu with **Refresh data**, **Settings** (GitHub projects only: the tracked branch) and **Remove project**. Removing a project deletes only its entry in the database.

## What each tab shows

A project has up to five tabs. **Specs** and **Design** appear only when the project has matching documents.

- **Overview**: where the project comes from, the detected layout (a small pill; its tooltip lists notes and the places searched), the sprint strip, project stats (epics, stories, completed, in progress, progress), a collapsible **Details** line with layout notes and files that failed to parse, the epic list and the **Key files** list from the planning artifacts. With six or more epics the list gets a search box, status filter, sort menu and pagination (15 per page). The state is kept in the URL.
- **Epics**: all epics as a **Board** (default) or a **List**. Open an epic to see its description, progress and stories. Open a story to see its rendered Markdown, status, ticket details (type, risk, covers) when the layout has them, the stories it comes after and the stories it blocks, and previous and next buttons.
- **Specs**: briefs, PRDs, specs and architecture documents, grouped, with a rail to switch between them.
- **Design**: UX and design documents, wireframes and reviews, grouped the same way.
- **Library**: every file of the project's BMAD folders in a tree. Choose **Preview** for rendered Markdown (with syntax highlighting and Mermaid diagrams) or **Source** for the raw text. The tree can switch between the BMAD output folder and the project's `docs` folder, and shows the BMAD configuration and layout-declared folders such as `.agentic` when present. The **Filter files** field above the tree narrows it to files whose path contains every word you type (case-insensitive, folder names count), with matches highlighted and a count under the field; Esc or the x button clears it. On a phone the tree is a collapsible section.

**Search** is global, not per project. Press `Ctrl+K` (`Cmd+K` on macOS) or `/` anywhere, type at least 2 characters and pick an epic, a story or a document from any project.

Which projects and files show up depends on the project's BMAD layout. See [layouts.md](./layouts.md).

## Troubleshooting

### Port 7002 is in use

Another process, or another instance of the console, listens on the port. Find it with `ss -ltnp | grep 7002`. Stop it, or start the dev server on another 7xxx port:

```bash
pnpm dev -p 7102
```

Two `next dev` servers cannot run from the same checkout (the second one fails with a lock error), so stop the first one or use another checkout.

### The database is not reachable

Symptoms: pages fail with a database error, `/api/health` returns 503, Prisma commands cannot connect.

- Check that the container runs: `docker compose ps`.
- Check that `DATABASE_URL` uses the port you published (7433 with the compose file) and the right password.
- Prisma commands read `.env`, but a `DATABASE_URL` exported in your shell wins over it.
- Run `curl -i http://127.0.0.1:7002/api/health`. A `503` with `"db":"disconnected"` confirms the app cannot reach the database.

### "Local file access is disabled" or no Local Folder tab

`ENABLE_LOCAL_FS` is not exactly `true`, or the server was not restarted after you set it. See [configuration.md](./configuration.md).

### GitHub rate limit

The UI says "GitHub rate limit reached". Without a token GitHub allows 60 requests per hour. Set `GITHUB_PAT` in `.env` and restart. With a token the limit is 5,000 per hour, so wait a few minutes. Data already cached (5 minutes) keeps being shown.

### "Repository not found" for a private repository

The server has no token, or the token has no access. Set `GITHUB_PAT` with the `repo` scope, restart the server and add the project again.

### A project shows 0 epics

The layout was not recognised, or the project has no epics yet. The Overview shows "Layout not recognised: looked for ..." with the locations that were checked, and the layout pill and **Details** show notes. Compare your folder with the layouts in [layouts.md](./layouts.md). Common causes: the BMAD output folder is not at the default location and `_bmad/core/config.yaml` is missing from the repository, epics live outside `planning-artifacts` or `epics`, or story files do not follow the naming of the layout. If files are present but fail to parse, **Details** lists them.

### The Specs or Design tab is missing

The tab is hidden when the project has no document that matches its groups. The Library still shows every file.

### A local project no longer loads

The folder was moved or deleted. Remove the project and add it again at the new path.
