# Paseo BMAD Console

Guidance for AI agents working in this repository. Paseo BMAD Console is a Next.js dashboard that reads BMAD projects (epics, stories, specs, design documents) from GitHub or from a local folder. This file lists the commands, the structure and the rules that matter when you change the code. Human-oriented docs are in [README.md](./README.md), [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/](./docs/README.md).

## Commands

```bash
pnpm install                  # also runs prisma generate
pnpm dev                      # next dev on 127.0.0.1:7002
pnpm build                    # standalone production build
pnpm lint                     # eslint
pnpm test                     # vitest run (once)
pnpm exec tsc --noEmit        # type check
pnpm exec prisma migrate deploy   # apply migrations
```

There is no CI. Run `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm test` yourself before you say a change is done. The plugin in `plugin/` is a separate npm project with its own `npm run typecheck` and `npm test`, excluded from the root tooling.

## Structure

- `src/app/`: App Router pages (`(dashboard)`) and API routes (`api/health`, `search`, `repo-asset`, `revalidate`).
- `src/actions/`: server actions (`repo-actions.ts`).
- `src/components/`: `dashboard`, `epics`, `stories`, `docs`, `search`, `layout`, `shared`, `ui` (shadcn, project-owned), `reui` (vendored, not linted).
- `src/lib/bmad/`: parsers, `correlate`, ids, scope and `layouts/` (one adapter per BMAD layout). Details in [docs/layouts.md](./docs/layouts.md).
- `src/lib/content-provider/`: GitHub and local providers with the path guards.
- `src/lib/github/`, `src/lib/db/`, `src/lib/search*.ts`, `src/lib/doc-groups.ts`, `src/lib/dependency-graph.ts` (pure dependency graph, waves and critical path; dependency parsing is `src/lib/bmad/deps.ts`).
- `prisma/`: one model (`Repo`, table `repos`) and migrations. The generated client in `src/generated/` is gitignored.
- `plugin/`: the Paseo plugin.
- `docs/`: documentation. Start with [docs/architecture.md](./docs/architecture.md).

## Rules

- **No authentication.** The app is single-tenant and has no login, sessions, users or roles (and no `better-auth`). Do not add auth checks or users. Network isolation is the access control and the app binds to `127.0.0.1` by default. Keep the local provider path guards, the repo-asset image allowlist and the SVG sandbox CSP, search and path validation, and the `ENABLE_LOCAL_FS` gate intact: they are the only safety nets. GitHub access uses the optional `GITHUB_PAT` (`src/lib/github/client.ts`). `src/lib/__tests__/no-auth.test.ts` fails if an auth dependency or import comes back.
- **Ports are in the 7xxx range.** The app is on 7002 and the development Postgres on 7433. Never use ports in the 3xxx, 4xxx, 5xxx or 8xxx ranges in code, docs, examples or tests (use 7xxx for scratch servers and databases).
- **The deployment folder is build output only.** Never put source, `.env` templates or hand edits in a deployment folder. Rebuild with `pnpm build` and copy `.next/standalone`, `.next/static` and `public` (see [docs/deployment.md](./docs/deployment.md)).
- **Never touch the live deployment from tests or experiments.** Do not run anything against the running server, its database, its Docker container or its `tailscale serve` forward, and do not write to its folder. Use scratch databases and other 7xxx ports, and remove them afterwards.
- **Never edit `node_modules`.** pnpm links packages from a shared store, so an edit there changes every project. Fix problems in this repository or with a documented override instead.
- **Commit identity.** Commit with the configured git identity only. Never pass `-c user.name` or `-c user.email`. Use Conventional Commits (`feat(web):`, `fix(plugin):`, `docs:`, `chore:`). Do not push unless asked.
- **Documentation style.** Plain, factual, sentence-case writing. No emoji, no em dashes, no marketing language. Each doc starts with a one-paragraph purpose. Only document what exists in the code.
- Keep `NOTICE` and `LICENSE` as they are (MIT, derived from "my-bmad" by Hichem (DevHDI), credits bmad-method-ui by Elvince, not affiliated with Paseo).
- Do not change `plugin/OVERVIEW.md` style: plain, no install commands, no em dashes.

## Tailwind CSS

- Tailwind CSS v4 with `@theme inline` in `src/app/globals.css` (no `tailwind.config` file).
- **Never use arbitrary bracket values** when a canonical Tailwind class exists:
  - Spacing and sizing: divide px by 4 (`160px` is `w-40`, `15px` is `mt-3.75`, `2px` is `h-0.5`).
  - Ring width: `ring-3`, not `ring-[3px]`.
  - Percentages: `top-1/2`, not `top-[50%]`.
  - Rem: convert to the spacing scale (`8rem` is 128px, so `min-w-32`).
- Arbitrary values are fine for `calc()` expressions, non-standard values and CSS variable references.
- Add repeated hex colours as theme tokens in `globals.css`.
- Keep text at 12px or larger (`type-scale.test.ts` enforces it). See [docs/paseo-ui.md](./docs/paseo-ui.md).
- shadcn components live in `src/components/ui/` and are project-owned, so they follow these rules too.

## Error handling

All server actions return `ActionResult<T>`:

```typescript
type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string }
```

Always pass errors through `sanitizeError()` from `@/lib/errors` before returning them to clients. Never expose `error.message` directly.

```typescript
import { sanitizeError } from "@/lib/errors";
// ...
} catch (error) {
  return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
}
```

## Server actions

- Validate input with Zod at the top of the action.
- Repos are global. Read them with `getRepos()` and `getRepoConfig(owner, name)` from `@/lib/db/helpers`.
- Call `revalidatePath()` or `revalidateTag()` after mutations.
- Return the `ActionResult<T>` shape consistently.
- Actions live in `src/actions/`.

## Database migrations

- Development: `pnpm exec prisma migrate dev --name <description>` (or `pnpm db:migrate`).
- Production and fresh databases: `pnpm exec prisma migrate deploy`. Never use `migrate dev` or `db push` on a database you keep (after `db push`, `migrate deploy` fails with P3005).
- After schema changes: `pnpm exec prisma generate`.

## Testing

- Framework: Vitest (`pnpm test`, `pnpm test:watch`).
- Locations: BMAD parsers and layouts in `src/lib/bmad/__tests__/`, providers and path guards in `src/lib/content-provider/__tests__/`, GitHub client (`GITHUB_PAT`) in `src/lib/github/__tests__/`, repo helpers in `src/lib/db/__tests__/`, search, epic list, doc groups, type scale and the no-auth guard in `src/lib/__tests__/`, actions in `src/actions/__tests__/`.
- Use neutral names such as `acme` in fixtures, not real project or personal names.
- A new layout adapter needs a fixture test in `src/lib/bmad/__tests__/layouts.test.ts`. Steps are in [docs/layouts.md](./docs/layouts.md#adding-a-new-layout-adapter).
