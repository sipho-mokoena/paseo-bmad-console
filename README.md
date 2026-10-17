# Paseo BMAD Console

A dashboard for [BMAD](https://github.com/bmad-code-org/BMAD-METHOD) projects. It reads the planning and implementation artifacts of a BMAD project, from a GitHub repository or from a folder on the machine running the server, and shows them as epics, stories, specs, design documents and a searchable document library.

> Fork of [bmad-code-org/bmad-method-ui](https://github.com/bmad-code-org/bmad-method-ui) (MIT). See [NOTICE](./NOTICE).
> The UI follows the look of the Paseo desktop app. This project is not affiliated with Paseo.

## Features

- Projects from GitHub repositories or, when self-hosted, from local folders ([docs/LOCAL_FOLDER.md](./docs/LOCAL_FOLDER.md)).
- Epics and stories with status, progress and ticket metadata (list and kanban views, epic and story detail pages).
- Specs and Design tabs that group the planning documents of a project.
- Library: browse project documents with Markdown rendering, syntax highlighting and Mermaid diagrams, and images referenced by relative path from local projects.
- Search across the documents of all your projects.
- Several BMAD layouts, detected automatically: v6 default, v6 project layout, ticket tree, and v4.
- Email/password login, optional GitHub OAuth, admin and user roles.

## Requirements

- Node.js 22+
- pnpm 10+
- PostgreSQL 15+ (a docker compose file with PostgreSQL 17 is included)

## Quick start

```bash
pnpm install
cp .env.example .env        # or: bash scripts/setup.sh  (generates the secrets for you)
docker compose up -d        # PostgreSQL on localhost:5433
pnpm db:push                # create the schema
pnpm db:create-admin --email you@example.com --password change-me --name Admin
pnpm dev                    # http://localhost:3002
```

Edit `.env` first: set `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` and `REVALIDATE_SECRET`. The full variable reference is in [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md).

### Local development without login

For a trusted, single-user machine you can skip the login screen:

```bash
# .env
DEV_BYPASS_AUTH=true
```

Every request then acts as a built-in local admin (`local@localhost`) and the server prints a loud warning at startup.

> **Warning: never enable this on a shared or public host.** It disables authentication completely.
> The bypass is only honoured when `NODE_ENV` is not `production` and `DEV_BYPASS_AUTH` is exactly `true`. If `DEV_BYPASS_AUTH` is set while `NODE_ENV=production`, `next build` and server start fail with an error.

### Local folders

Set `ENABLE_LOCAL_FS=true` to let users add a project by absolute folder path. **This is for self-hosted use only:** the server reads files on its own disk, so enable it only when the app runs on the machine that holds the projects and every user who can log in is trusted with that access. Leave it unset on any multi-tenant or public deployment.

### Reaching the dev server from a phone or another machine

`next dev` blocks requests from hostnames it does not know. To open the dev server over Tailscale or the LAN, bind it to the right interface and list the extra hostnames:

```bash
# .env
ALLOWED_DEV_ORIGINS=my-laptop.tailnet-name.ts.net,100.64.0.10

pnpm dev -H 0.0.0.0
```

`ALLOWED_DEV_ORIGINS` is a comma-separated list, empty by default. Set `BETTER_AUTH_URL` to the URL you browse from.

## Scripts

```bash
pnpm dev              # dev server on port 3002
pnpm build            # production build
pnpm start            # start the production server
pnpm lint             # ESLint
pnpm test             # Vitest
pnpm db:generate      # generate the Prisma client
pnpm db:migrate       # prisma migrate dev
pnpm db:push          # push the schema without a migration
pnpm db:studio        # Prisma Studio
pnpm db:create-admin  # create an admin user from the CLI
```

Type check with `pnpm exec tsc --noEmit`.

## Paseo plugin

`plugin/` contains a [Paseo](https://paseo.sh) plugin that starts, stops and opens this console from Paseo: a sidebar item, a workspace panel and Command Center items ("Open BMAD Console", "Start/Stop BMAD Console"). It is a separate npm project (the rest of the repo uses pnpm) and is excluded from the root TypeScript, ESLint and Vitest runs.

**Plugins are trusted, unsandboxed code.** This one runs `pnpm exec next dev` or `pnpm exec next start` on the machine that runs the Paseo daemon, with the daemon user's permissions. Read `plugin/` before installing it. Plugins are off by default: turn on **Enable plugins** under Paseo Settings, Plugins (the `pluginsEnabled` field in the daemon's `config.json`, applied with `paseo reload`). It needs Paseo 0.11.0 or later on the daemon and in the app.

```bash
cd plugin && npm install && npm run typecheck && npm test
paseo plugin install /absolute/path/to/paseo-bmad-console/plugin
paseo plugin ls
```

Then open **BMAD Console** in the sidebar (or Settings, Plugins, BMAD Console) and set:

- **Console directory**: absolute path to this checkout (dependencies installed, `.env` present, database running).
- **Port** (default 3002), **mode** (`dev`, or `start` after `pnpm build`) and **bind host** (default `127.0.0.1`).
- Optional: **public URL**, **allowed dev origins** (`ALLOWED_DEV_ORIGINS`), **start with Paseo**, and **no-login mode** (`DEV_BYPASS_AUTH`, dev mode and loopback only).

The plugin only stops the process it started and reports a console that is already running on the port without touching it. Note that two `next dev` servers cannot share one checkout, so stop a manually started `pnpm dev` first, or use another checkout.

On a phone or in the web app, "Open in Paseo browser" is not available (Electron only). Use the URL shown in the plugin and set the public URL to the machine's Tailscale or LAN address, with a bind host that device can reach: `127.0.0.1` is not reachable from a phone.

## Project structure

```
src/
  app/            Next.js App Router: (dashboard) pages, login, api/ (auth, health, revalidate, search, repo-asset)
  actions/        Server actions
  components/     dashboard, epics, stories, docs, search, layout, shared, ui (shadcn), reui (data grid, filters)
  lib/
    bmad/         parsers and the layout adapters (layouts/)
    content-provider/  GitHub and local-folder providers
    auth/         Better Auth setup and the dev-bypass guard
    db/           Prisma client and session helpers
docs/             guides and the Paseo UI reference
prisma/           schema and migrations
scripts/          setup.sh, create-admin.ts
```

## Documentation

- [Getting started and environment variables](./docs/GETTING_STARTED.md)
- [Local folder import](./docs/LOCAL_FOLDER.md)
- [API endpoints](./docs/API.md)
- [Paseo UI reference](./docs/paseo-ui.md)
- [Contributing](./CONTRIBUTING.md), [Security](./SECURITY.md)

## Credits and license

MIT, see [LICENSE](./LICENSE) and [NOTICE](./NOTICE). The application derives from the "my-bmad" dashboard by Hichem (DevHDI), itself part of the bmad-code-org/bmad-method-ui lineage. Built for the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD).
