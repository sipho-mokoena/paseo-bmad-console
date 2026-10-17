# Contributing to Paseo BMAD Console

This guide explains how to set up a development environment, which checks to run before you commit, how the code is organised, how to add support for a new BMAD layout and what a pull request should contain. Participation is covered by the [Code of Conduct](./CODE_OF_CONDUCT.md), and contributions are licensed under the project's MIT license.

## Reporting bugs and requesting features

Open an issue on the repository. For a bug, include the steps to reproduce, what you expected, what happened, the layout shown in the layout pill and your environment (Node.js version, local folder or GitHub project). Do not post secrets, and report security problems privately (see [SECURITY.md](./SECURITY.md)).

## Development setup

Requirements: Node.js 22 or later, pnpm 10 or later, and PostgreSQL 15 or later (or Docker).

```bash
git clone https://github.com/<you>/paseo-bmad-console.git
cd paseo-bmad-console
pnpm install
cp .env.example .env              # edit DATABASE_URL, see docs/configuration.md
docker compose up -d              # PostgreSQL on 127.0.0.1:7433
pnpm exec prisma migrate deploy   # apply the committed migrations
pnpm dev                          # http://127.0.0.1:7002
```

The app has no authentication and no seed data. Add a project from the UI (see [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)). Ports in this project are in the 7xxx range: 7002 for the app and 7433 for the development database.

When you change `prisma/schema.prisma`, create a migration with `pnpm db:migrate` (`prisma migrate dev`), commit the generated folder under `prisma/migrations`, and run `pnpm db:generate` if the client does not regenerate. Use `migrate deploy`, never `migrate dev`, on a database you care about.

## Checks

**There is no CI workflow in this repository.** Nothing runs automatically, so run the checks yourself before you commit:

```bash
pnpm exec tsc --noEmit       # type check
pnpm lint                    # ESLint
pnpm test                    # Vitest, runs once
pnpm build                   # optional: a production build compiles and type checks the app
```

Use `pnpm test:watch` while you work. The plugin has its own checks (see below).

Tests live next to the code in `__tests__` folders: `src/lib/bmad/__tests__` (parsers and layouts), `src/lib/content-provider/__tests__` (providers and path guards), `src/lib/github/__tests__`, `src/lib/db/__tests__`, `src/lib/docs/__tests__`, `src/lib/__tests__` (search, epic list, doc groups, type scale and the no-auth guard), `src/actions/__tests__` and `src/components/docs/` (Markdown and Mermaid). Add tests for new behaviour, and prefer pure functions that are easy to test. Use neutral names such as `acme` in fixtures.

### Plugin checks

`plugin/` is a separate npm project, excluded from the root TypeScript, ESLint and Vitest runs:

```bash
cd plugin
npm install
npm run typecheck
npm test
```

After editing the plugin, apply the change in a running Paseo daemon with `paseo plugin reload bmad-console`. See [docs/plugin.md](./docs/plugin.md).

## Code layout

```
src/app/          pages and API routes only
src/actions/      server actions
src/components/   UI components
src/lib/          parsing, providers, search, database and other logic
```

See the tree in the [README](./README.md#project-structure) and [docs/architecture.md](./docs/architecture.md).

## Conventions

- TypeScript strict mode. Avoid `any`, and give function signatures explicit types.
- Server components by default. Add `"use client"` only where you need state or effects.
- Mutations are server actions in `src/actions/`. They validate input with Zod, return `ActionResult<T>` and pass errors through `sanitizeError` (see [CLAUDE.md](./CLAUDE.md)).
- Tailwind CSS 4 with theme tokens in `src/app/globals.css`. Do not use arbitrary bracket values when a canonical class exists (`w-40`, not `w-[160px]`; `ring-3`, not `ring-[3px]`). Arbitrary values are fine for `calc()` expressions, CSS variables and non-standard values. Add repeated colours as theme tokens. Keep text at 12px or larger. See [docs/paseo-ui.md](./docs/paseo-ui.md).
- Do not add authentication. The app is deliberately single-tenant and a test fails if an auth dependency returns.
- Do not widen what the local provider can read without updating its tests (`src/lib/content-provider/__tests__`).
- Use ports in the 7xxx range in code, docs and examples.

## Adding a layout adapter

A layout adapter teaches the app a new way of storing epics, stories and status. Implement `LayoutAdapter` in `src/lib/bmad/layouts/<id>.ts`, add its id to `LayoutId` in `src/lib/bmad/types.ts`, register it in `src/lib/bmad/layouts/index.ts`, and test it in `src/lib/bmad/__tests__/layouts.test.ts` with a fake provider built from a `path: content` object. The detailed steps, scores and rules are in [docs/layouts.md](./docs/layouts.md#adding-a-new-layout-adapter).

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

Optional body that explains why, not what.
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. Scopes seen in the history are `web` for the app and `plugin` for the Paseo plugin. Keep commits small and focused on one concern.

```
feat(web): epics list opens on the board view
fix(plugin): probe /api/health instead of the home page
docs: describe the standalone deployment
```

Commit with your own configured git identity.

## Pull request checklist

- [ ] The change is focused on one concern and unrelated code is untouched.
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm test` pass locally. (There is no CI to do it for you.)
- [ ] Plugin changes: `npm run typecheck` and `npm test` pass in `plugin/`.
- [ ] New behaviour has tests.
- [ ] A new migration is committed when the schema changed.
- [ ] Documentation is updated when behaviour, configuration, routes or layouts changed: [docs/](./docs/README.md), `.env.example`, [CHANGELOG.md](./CHANGELOG.md).
- [ ] No secrets, `.env` files or personal paths are committed.
- [ ] UI changes were checked on a phone-sized viewport and in light and dark themes.
