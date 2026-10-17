# Architecture

This page describes how Paseo BMAD Console is built: the stack, how a request becomes a page, the content providers, search, Markdown rendering, routes, caching, the database and the main design decisions. It is meant for people who change the code. For setup see [GETTING_STARTED.md](./GETTING_STARTED.md), and for layout detection see [layouts.md](./layouts.md).

## Stack

| Part | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, server components, server actions), React 19 |
| Language | TypeScript |
| Database | PostgreSQL through Prisma 6 (generated client in `src/generated/prisma`, not committed) |
| GitHub access | `@octokit/rest` with the throttling and retry plugins |
| Styling | Tailwind CSS 4 with tokens in `src/app/globals.css`, shadcn components in `src/components/ui`, Radix primitives |
| Markdown | `react-markdown`, `remark-gfm`, `rehype-sanitize`, `rehype-slug`, `rehype-autolink-headings`, `rehype-highlight`, Mermaid |
| Parsing | `gray-matter` (frontmatter), `js-yaml`, `smol-toml` |
| Validation | `zod` |
| Tests | Vitest |

The app reads BMAD files on demand. It does not copy them into the database.

## Request and data flow

```
Browser
  -> page or layout (server component)
       -> getRepos / getRepoConfig            Prisma, table repos
       -> getCachedBmadProject(config)        React cache, once per request
            -> createContentProvider(config)  GitHubProvider or LocalProvider
            -> getBmadProject(config, provider)
                 -> openProject(provider)     output folder, tree, layout detection
                 -> adapter.load(ctx)         best adapter that yields content
                 -> correlate(...)            merge sprint status, derive epic status
                 -> computeProjectStats(...)
       -> page components (props are plain data)
```

In more detail:

1. A page calls `loadProject(owner, repo)` (`src/lib/load-project.ts`), which reads the repo row and returns the parsed project, or a 404.
2. `getCachedBmadProject` (`src/lib/bmad/cached-project.ts`) is wrapped in React `cache()`, so the layout and the page of one request share a single load. The content provider is built inside the cached function so the argument keeps a stable identity.
3. `getBmadProject` (`src/lib/bmad/parser.ts`) calls `openProject` (`scope.ts`). That lists the tree, resolves the output folder (`parse-config.ts`), runs layout detection and, for local projects, opens the extra roots that the detected adapters declare, then lists the tree again.
4. The adapters are tried from the highest score down and the first one that returns epics, stories or sprint entries is used (see [layouts.md](./layouts.md)).
5. Stories and epics carry their declared dependencies (`deps.ts`, see [layouts.md](./layouts.md#dependencies-between-stories-and-epics)).
6. `correlate` (`correlate.ts`) merges sprint status into stories, creates placeholders for sprint entries without a file, derives each epic's status and progress and attaches the epic title to each story.
7. The result is a `BmadProject` (`types.ts`) with epics, stories, file trees for the Library, the layout info (id, label, notes, "recognised" flag, places searched) and parse health.
8. Pages pass the data to client components. List views get trimmed copies without the long Markdown bodies (`list-view.ts`).

The home page loads every registered project in parallel with `Promise.allSettled`, so one broken project shows a warning and the others still load.

## Content providers

`ContentProvider` (`src/lib/content-provider/types.ts`) has four methods: `getTree()` (all file paths and top-level folder names), `getFileContent(path)`, `validateRoot()` and an optional `extendBmadDirs(name)`. `createContentProvider` picks the implementation from the repo's `sourceType`.

**GitHubProvider** reads the recursive tree and raw file contents through Octokit, with `GITHUB_PAT` when set. Results go through `unstable_cache` (see [Caching](#caching)). A GitHub tree is complete, so every path is known up front.

**LocalProvider** reads the server's disk and has the guards listed in [LOCAL_FOLDER.md](./LOCAL_FOLDER.md):

- It refuses to start unless `ENABLE_LOCAL_FS` is `true`.
- It only walks and reads declared roots. By default these are `_bmad` and `_bmad-output`.
- Declared roots can grow in two ways: the resolved output folder (top segment) and the extra roots of a detected adapter (`docs`, `.agentic`). Names must be a single path segment. A name starting with a dot is refused unless it is in `DECLARABLE_DOT_DIRS`, which today holds only `.agentic`. Ignored folders such as `node_modules` and `.git` can never be declared.
- Paths are checked for null bytes, look-alike slashes, traversal, and the first segment must be a declared root. Symbolic links are skipped when walking and refused when reading, and the real path must stay inside the project root.
- Limits: 10 MB per file, 10,000 files, depth 20.

Every code path that reads project files for the UI goes through `openProject`, so a fresh provider ends up with the same access list: the Library actions, the repo-asset route and search.

## Search

Search lives in `src/lib/search.ts` (pure matching, scoring and snippets) and `src/lib/search-server.ts` (data gathering).

- The query is trimmed, whitespace is collapsed, it is cut at 200 characters and needs at least 2. The query is split into terms and every term must match.
- Epics, stories and documents are scored in tiers: exact id or title, title match, id match, `covers` match for tickets, then other fields. Each group returns at most 50 hits.
- The server builds one snapshot per project: the parsed epics and stories plus the text of up to 300 Markdown files of at most 512 KB each, read 8 at a time. Snapshots are cached for 30 seconds in memory (at most 24 entries), keyed by project, branch and last sync time.
- `GET /api/search` and the `/search` page both use it. `Ctrl+K` (`Cmd+K`) and `/` open the page from anywhere in the dashboard; `/` is ignored while typing in a field.

## Markdown pipeline

`src/components/docs/markdown-renderer.tsx` renders every Markdown document, epic body and story body.

1. `remark-gfm` adds tables, task lists and strikethrough.
2. `rehype-sanitize` runs first with the schema in `src/lib/bmad/sanitize-schema.ts`: the default schema plus `details` and `summary` elements and a `className` on `code` (needed for the language class). Raw HTML is not otherwise trusted.
3. `rehype-slug` and `rehype-autolink-headings` add heading anchors, and `rehype-highlight` highlights code.
4. Callouts such as `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]` are rendered as boxes.
5. Code blocks marked `mermaid` are rendered by `mermaid-diagram.tsx`. Mermaid is loaded lazily in the browser, runs with `securityLevel: "strict"` and plain SVG labels (no HTML labels), and renders are serialised because Mermaid keeps global configuration. A diagram that fails shows the error and its source instead of breaking the page.
6. Relative links to other Markdown documents are routed inside the app when the page supplies a link resolver. Relative image URLs are rewritten to `/api/repo-asset?owner=&repo=&path=`.

The repo-asset route (`src/app/api/repo-asset/route.ts`) serves images of local projects only. It checks the path syntax (`src/lib/docs/asset-paths.ts`), looks the project up in the database (the filesystem path never comes from the request), runs the same guards as the provider and allows only `svg`, `png`, `jpg`, `jpeg`, `gif` and `webp` up to 5 MB. SVG responses carry a sandboxing `Content-Security-Policy`. For GitHub projects the route answers 404, so relative images in GitHub projects do not load.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Home: global stats and the grid of registered projects |
| `/search` | Global search (`?q=`) |
| `/repo/[owner]/[repo]` | Overview: layout pill and notices, sprint strip, stats, epic list, key artifacts |
| `/repo/[owner]/[repo]/epics` | Epics browser with Board and List views |
| `/repo/[owner]/[repo]/epics/[epicId]` | Epic page with its stories |
| `/repo/[owner]/[repo]/epics/[epicId]/[storyId]` | Story page |
| `/repo/[owner]/[repo]/specs` | Specs documents (`?file=`), shows the not-found page when the project has none |
| `/repo/[owner]/[repo]/design` | Design documents (`?file=`), shows the not-found page when the project has none |
| `/repo/[owner]/[repo]/docs` | Library (`?file=`) |
| `/repo/[owner]/[repo]/stories` | Permanent redirect to `/epics` (also `?epic=` and `?story=` links) |
| `/api/health` | Health check |
| `/api/search` | Search as JSON |
| `/api/repo-asset` | Images of local projects |
| `/api/revalidate` | Cache invalidation by tag |

Old links of the form `/epics?epic=<id>` and `/epics?story=<id>` are redirected to the path forms. For projects added from a local folder, `owner` is `local` and `repo` is a generated name (see [LOCAL_FOLDER.md](./LOCAL_FOLDER.md)). The Overview epic list keeps its state in the URL (`eq` query, `es` statuses, `esort`, `edir`, `epage`). Server actions are listed in [API.md](./API.md).

## Caching

- GitHub tree and file content: `unstable_cache` with a 300 second lifetime and the tags `repo:<owner>/<name>` and `file:<owner>/<name>/<path>`. The Refresh action and the branch change call `revalidateTag`, and `POST /api/revalidate` does the same for a tag you send.
- Local projects are not cached by Next.js. Each request reads the disk again, and Refresh only updates the file count and the sync time.
- `getRepos`, `getRepoConfig` and `getCachedBmadProject` use React `cache()` so one render reads each thing once.
- The dashboard layout is `force-dynamic`, so the project list is read from the database on every request instead of at build time.
- Search snapshots are cached in memory for 30 seconds.
- `/api/search` and `/api/repo-asset` send `no-store` and `private, max-age=60` respectively. `/api/revalidate` has a small in-memory rate limit.

## Database

One table, `repos`, defined in `prisma/schema.prisma`:

| Column | Notes |
| --- | --- |
| `id` | cuid, primary key |
| `owner`, `name` | unique together. For local projects `owner` is `local` and `name` is `<folder>-<8 hex chars>` |
| `branch` | default `main`. The value `local` for local projects |
| `displayName`, `description` | shown in the UI |
| `sourceType` | `github` or `local` |
| `localPath` | absolute folder path for local projects |
| `totalFiles`, `lastSyncedAt` | set when a project is added or refreshed |
| `createdAt`, `updatedAt` | timestamps |

Migrations are in `prisma/migrations`. The last one, `remove_auth`, collapsed duplicates of `(owner, name)`, dropped the user column and the old auth tables, and kept the project rows. There are no users, sessions or accounts.

## Design decisions

- **No authentication.** The app is a single-tenant tool for localhost or a private network. Network isolation is the access control, the scripts bind to `127.0.0.1` and the safety nets that remain are the provider guards, the image allowlist, input validation and the `ENABLE_LOCAL_FS` switch. A test (`src/lib/__tests__/no-auth.test.ts`) fails if an authentication dependency or import returns. See [SECURITY.md](../SECURITY.md).
- **Standalone build.** `next.config.ts` sets `output: "standalone"`, so a deployment is a small folder with the traced server and no source tree. See [deployment.md](./deployment.md).
- **Files are the source of truth.** Projects are parsed from their BMAD files on each load, with caches only as a speed-up. The database stores only which projects exist.
- **Adapters per layout.** Detection and parsing of each BMAD layout sit behind one interface, so a new layout is a new file and a registry entry.
- **Server actions return `ActionResult<T>`.** They validate input with Zod and sanitise error messages before they reach the client (`src/lib/errors.ts`).
- **Plugin is separate.** `plugin/` is its own npm project and is excluded from the root TypeScript, ESLint and Vitest runs. See [plugin.md](./plugin.md).
