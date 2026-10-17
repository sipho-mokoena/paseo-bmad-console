# Paseo BMAD Console

Paseo BMAD Console is a web dashboard for [BMAD](https://github.com/bmad-code-org/BMAD-METHOD) projects. It reads the planning and implementation artifacts of a project, from a GitHub repository or from a folder on the machine that runs the server, and shows them as epics, stories, specs, design documents and a searchable document library. It is a local, single-user tool for a private network.

> The application derives from the "my-bmad" dashboard by Hichem (DevHDI) and the bmad-method-ui lineage. See [NOTICE](./NOTICE).
> The UI follows the look of the Paseo desktop app. This project is not affiliated with Paseo.

## Security in one paragraph

**The app has no authentication.** There is no login, no accounts and no roles. Anyone who can reach the port can list, add, remove and refresh projects, read their documents and, when `ENABLE_LOCAL_FS=true`, read the BMAD folders of any local project. Run it on `localhost` or on a private network only, for example behind Tailscale, and never on the public internet. The `dev` and `start` scripts bind to `127.0.0.1`. See [SECURITY.md](./SECURITY.md).

## Features

- Projects from GitHub repositories (public, or private with the optional `GITHUB_PAT`) and from local folders on the server (`ENABLE_LOCAL_FS=true`).
- Overview page with project stats, the sprint strip and a searchable, sortable, filterable, paginated epic list.
- Epics page with a board view and a list view.
- Epic page with its description and stories, and story page with rendered Markdown, "after" and "blocks" links and previous/next navigation.
- Timeline on the Overview page with a dependency-driven Gantt chart and a dependency graph (shown in place of the epics list when the project has dependency data). See [docs/timeline.md](./docs/timeline.md).
- Specs and Design tabs that group the planning documents (shown only when the project has such documents).
- Library with a filterable file tree, Preview and Source views, syntax highlighting and Mermaid diagrams.
- Global search over epics, stories and documents of all projects, opened with `Ctrl+K` (`Cmd+K` on macOS) or `/`.
- Several BMAD layouts, detected automatically: v6 default, v6 project layout, ticket tree and v4. See [docs/layouts.md](./docs/layouts.md).
- Mobile-friendly UI in the style of the Paseo app, with light and dark themes.
- An optional [Paseo plugin](./docs/plugin.md) that starts, stops and opens the console from Paseo.

## Requirements

- Node.js 22 or later (the local provider needs at least 20.12).
- pnpm 10 or later.
- PostgreSQL 15 or later. `docker-compose.yml` starts PostgreSQL 17.
- Docker, only if you use the compose file.

## Quick start

```bash
docker compose up -d                  # PostgreSQL on 127.0.0.1:7433
cp .env.example .env                  # or: bash scripts/setup.sh
pnpm install
pnpm exec prisma migrate deploy       # create the schema on a fresh database
pnpm dev                              # http://127.0.0.1:7002
```

Edit `.env` first. `DATABASE_URL` must match the database: `.env.example` has a password placeholder, and `scripts/setup.sh` writes the compose password for you.

For a fresh database use `prisma migrate deploy`. It applies the committed migrations and records them. `pnpm db:push` also creates the tables but records no migration history, and a later `migrate deploy` then refuses to run on that database (error P3005). Use `db:push` only for throwaway databases.

Then open the app, press **Add a project** and enter `owner/name` of a GitHub repository, or a folder path when `ENABLE_LOCAL_FS=true`. [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md) has the full walkthrough and troubleshooting.

## Scripts

| Script | Command | What it does |
| --- | --- | --- |
| `pnpm dev` | `next dev -H 127.0.0.1 -p 7002` | Development server |
| `pnpm build` | `next build` | Production build (standalone output) |
| `pnpm start` | `next start -H 127.0.0.1 -p 7002` | Start a build from the source checkout |
| `pnpm lint` | `eslint` | Lint |
| `pnpm test` | `vitest run` | Run the tests once |
| `pnpm test:watch` | `vitest` | Run the tests in watch mode |
| `pnpm db:generate` | `prisma generate` | Generate the Prisma client (also runs after `pnpm install`) |
| `pnpm db:migrate` | `prisma migrate dev` | Create and apply a migration in development |
| `pnpm db:push` | `prisma db push` | Push the schema without a migration |
| `pnpm db:studio` | `prisma studio` | Open Prisma Studio |

Type check with `pnpm exec tsc --noEmit`.

## Configuration

Configuration is by environment variables in `.env`: `DATABASE_URL` (required), `GITHUB_PAT`, `ENABLE_LOCAL_FS`, `ALLOWED_DEV_ORIGINS` and `REVALIDATE_SECRET`. Ports are 7002 for the app and 7433 for the development database. See [docs/configuration.md](./docs/configuration.md) for every variable.

## Project structure

```
src/
  app/                 Next.js App Router
    (dashboard)/       pages: home, repo/[owner]/[repo]/..., search
    api/               health, search, repo-asset, revalidate
  actions/             server actions (add, import, refresh, remove, branch, file browsing)
  components/
    dashboard/         home and Overview widgets, layout pill and notices
    epics/             epics browser, board, rows, story detail, pager
    stories/           story table, filters and kanban board
    docs/              Library: file tree, document pane, Markdown, Mermaid
    search/            search screen
    layout/            sidebar, header, project tabs, add-project dialog
    shared/            pill, list kit, definition table, dialogs, buttons
    ui/                shadcn components (project-owned)
    reui/              vendored data grid and filters
  contexts/            breadcrumb context
  hooks/               use-mobile
  lib/
    bmad/              parsers, correlate, ids, scope and layouts/ (adapters)
    content-provider/  GitHub and local-folder providers
    github/            Octokit client (optional GITHUB_PAT) and cache tags
    db/                Prisma client and repo helpers
    docs/              image path helpers for the repo-asset route
    search*.ts         search scoring and server-side snapshot
    doc-groups.ts      Specs and Design classification
    dependency-graph.ts  dependency graph, waves and critical path (pure logic)
prisma/                schema and migrations
plugin/                Paseo plugin (separate npm project)
scripts/               setup.sh
docs/                  guides and references
```

## Documentation

The full index is in [docs/README.md](./docs/README.md).

- [Getting started](./docs/GETTING_STARTED.md)
- [Configuration](./docs/configuration.md)
- [BMAD layouts](./docs/layouts.md)
- [Timeline](./docs/timeline.md)
- [Architecture](./docs/architecture.md)
- [Local folder import](./docs/LOCAL_FOLDER.md)
- [HTTP API and server actions](./docs/API.md)
- [Deployment](./docs/deployment.md)
- [Paseo plugin](./docs/plugin.md)
- [Paseo UI reference](./docs/paseo-ui.md)
- [Contributing](./CONTRIBUTING.md), [Security](./SECURITY.md), [Changelog](./CHANGELOG.md), [Notes for AI agents](./CLAUDE.md)

## Credits and license

MIT, see [LICENSE](./LICENSE) and [NOTICE](./NOTICE). The application derives from the "my-bmad" dashboard by Hichem (DevHDI) and also credits bmad-method-ui by Elvince. It is built for the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD). The UI follows the Paseo desktop app, and this project is not affiliated with Paseo.
