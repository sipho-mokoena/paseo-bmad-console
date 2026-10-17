# Paseo BMAD Console

## Tailwind CSS

- Uses Tailwind CSS v4 with `@theme inline` in `src/app/globals.css` (no tailwind.config file)
- **Never use arbitrary bracket values** when a canonical Tailwind class exists:
  - Spacing/sizing: divide px by 4 (e.g. `160px` → `w-40`, `15px` → `mt-3.75`, `2px` → `h-0.5`)
  - Ring width: `ring-3` not `ring-[3px]`
  - Percentages: fraction notation (`top-1/2` not `top-[50%]`)
  - Rem: convert to spacing scale (`8rem` = 128px / 4 = `min-w-32`)
- Arbitrary values are OK only for: calc expressions, non-standard values, CSS variable references
- Repeated hex colors should be added as theme tokens in `globals.css` rather than as inline arbitrary values
- shadcn UI components live in `src/components/ui/` and are project-owned — they can and should follow these conventions

## Error Handling Pattern

All server actions return `ActionResult<T>`:

```typescript
type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: string }
```

Always use `sanitizeError()` from `@/lib/errors` to sanitize error messages before returning them to clients. Never expose `error.message` directly.

```typescript
import { sanitizeError } from "@/lib/errors";
// ...
} catch (error) {
  return { success: false, error: sanitizeError(error, "DB_ERROR"), code: "DB_ERROR" };
}
```

## Server Actions Conventions

- Always validate input with Zod at the top of the action
- The app has no users or sessions: do not add auth checks. Repos are global; read them with `getRepos()` / `getRepoConfig(owner, name)` from `@/lib/db/helpers`
- Call `revalidatePath()` or `revalidateTag()` after mutations
- Return `ActionResult<T>` shape consistently
- Actions live in `src/actions/`

## Database Migrations

- **Development:** `pnpm prisma migrate dev --name <description>`
- **Production:** `pnpm prisma migrate deploy` (never use `migrate dev` in production)
- **After schema changes:** `pnpm prisma generate` to regenerate the client

## Testing

- **Framework:** Vitest
- **Run tests:** `pnpm test`
- **Watch mode:** `pnpm test:watch`
- **Test locations:**
  - BMAD parsers: `src/lib/bmad/__tests__/`
  - Repo helpers: `src/lib/db/__tests__/`
  - GitHub client (`GITHUB_PAT`): `src/lib/github/__tests__/`
  - Utilities: `src/lib/__tests__/`

## No authentication

The app is single-tenant and has no login, sessions, users or roles (and no `better-auth`). Network isolation is the access control: it binds to `127.0.0.1` by default. Keep the local provider path guards, the repo-asset image allowlist and CSP headers, search/path validation and the `ENABLE_LOCAL_FS` gate intact: they are the only safety nets. GitHub access uses the optional `GITHUB_PAT` (see `src/lib/github/client.ts`). `src/lib/__tests__/no-auth.test.ts` fails if an auth dependency or import comes back.
