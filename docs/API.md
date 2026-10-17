# HTTP API and server actions

This page documents the HTTP endpoints of Paseo BMAD Console and the server actions that the UI uses to change data. **There is no authentication**: every endpoint is open to anyone who can reach the port. The only secret in the HTTP API is the `x-revalidate-secret` header of `/api/revalidate`, which is a guard for cache invalidation and not a user login. Run the app on `localhost` or a private network only (see [SECURITY.md](../SECURITY.md)).

The examples use `http://127.0.0.1:7002`, the default of `pnpm dev` and `pnpm start`. Use your own host and port if you changed them.

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Liveness and database check |
| `GET /api/search?q=` | Search epics, stories and documents of all projects |
| `GET /api/repo-asset?owner=&repo=&path=` | Image of a local project |
| `POST /api/revalidate` | Invalidate cached GitHub data by tag |

### `GET /api/health`

Runs `SELECT 1` against the database. Not cached.

```bash
curl -i http://127.0.0.1:7002/api/health
```

- `200` with `{"status":"ok","db":"connected"}`
- `503` with `{"status":"error","db":"disconnected"}` when the database cannot be reached

The Paseo plugin uses this endpoint to check that the console is up.

### `GET /api/search`

Query parameter `q`: the search text. The server trims it, collapses whitespace, cuts it at 200 characters and requires at least 2 characters. Every term of the query must match. Responses are sent with `Cache-Control: no-store`.

```bash
curl -s 'http://127.0.0.1:7002/api/search?q=checkout'
```

Response `200`:

```json
{
  "result": {
    "query": "checkout",
    "terms": ["checkout"],
    "epics":   { "total": 1, "items": [ { "project": { "owner": "acme", "name": "shop", "displayName": "shop" }, "epic": { } } ] },
    "stories": { "total": 3, "items": [ { "project": { }, "story": { } } ] },
    "docs":    { "total": 2, "items": [ { "project": { }, "path": "_bmad-output/planning-artifacts/prd.md", "name": "prd.md", "snippet": "... checkout ..." } ] },
    "notes": []
  }
}
```

- `result` is `null` (still status `200`) when the query is shorter than 2 characters.
- Each group holds at most 50 items, and `total` is the number of matches before that cap.
- `notes` lists projects that could not be searched, for example `shop: could not be searched`.
- Epic and story items omit the long Markdown body, and stories omit tasks.
- `500` with `{"error":"Search failed"}` on an unexpected failure.

### `GET /api/repo-asset`

Serves an image from a registered local project so Markdown documents can reference it with a relative path. It works only for local projects and only when `ENABLE_LOCAL_FS=true`.

Parameters: `owner` and `repo` (the registered project, each up to 200 characters) and `path` (the repository-relative path of the image, up to 1024 characters).

```bash
curl -o logo.png 'http://127.0.0.1:7002/api/repo-asset?owner=local&repo=acme-1a2b3c4d&path=_bmad-output/planning-artifacts/logo.png'
```

Allowed types are `svg`, `png`, `jpg`, `jpeg`, `gif` and `webp`, up to 5 MB. The path must be relative, with no `..`, empty or `.` segments, no backslash and no null byte, and it must lie in a folder the project is allowed to read (see [LOCAL_FOLDER.md](./LOCAL_FOLDER.md)). Error bodies are JSON of the form `{"error":"..."}`.

| Status | Meaning |
| --- | --- |
| `200` | The image, with a fixed `Content-Type`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=60`. SVG also gets a sandboxing `Content-Security-Policy` |
| `400` | Missing or invalid `owner`, `repo` or `path`, absolute path, path too long, or unsupported file type |
| `403` | The path is outside the readable folders, or a symbolic link |
| `404` | Unknown project, not a local project, or file not found |
| `413` | File larger than 5 MB |
| `503` | Local file access is disabled |
| `500` | Unexpected error |

### `POST /api/revalidate`

Invalidates the cached GitHub tree and file content that carry a tag. Cache tags are `repo:<owner>/<name>` for a whole project and `file:<owner>/<name>/<path>` for one file. Local projects are not cached, so tags only matter for GitHub projects.

Header `x-revalidate-secret` must equal the `REVALIDATE_SECRET` environment variable. Body (JSON): `{"tag": "<tag>"}`, 1 to 256 characters.

```bash
curl -X POST http://127.0.0.1:7002/api/revalidate \
  -H 'Content-Type: application/json' \
  -H 'x-revalidate-secret: <your secret>' \
  -d '{"tag": "repo:acme/shop"}'
```

| Status | Body | Meaning |
| --- | --- | --- |
| `200` | `{"revalidated":true,"tag":"repo:acme/shop"}` | Done |
| `400` | `{"error":"Invalid JSON"}` or `{"error":"Invalid body"}` | Bad request body |
| `401` | `{"error":"Invalid secret"}` | Missing or wrong secret |
| `429` | `{"error":"Too many requests"}` | More than 30 valid calls in a minute (process-wide limit) |
| `503` | `{"error":"Not configured"}` | `REVALIDATE_SECRET` is empty, so the endpoint is disabled |

The same effect is available in the UI as **Refresh data** in a project's row menu.

## Server actions

The UI changes data through Next.js server actions in `src/actions/repo-actions.ts`. They are not a public HTTP API: Next.js generates the request format and action ids, rejects cross-origin calls, and may change them between versions. Do not call them from scripts. They are listed here because they define what the app can do.

Every action returns `{ success: true, data }` or `{ success: false, error, code }`. Error text is sanitised before it reaches the client (some of the fixed messages are in French, see `src/lib/errors.ts`), so use `code` to tell failures apart.

| Action | Input | Result and notes |
| --- | --- | --- |
| `addGitHubRepo` | `owner`, `name`, optional `branch` | Checks the repository (and branch) on GitHub, using `GITHUB_PAT` if set, then stores it. Returns `id`, `owner`, `name`, `displayName`. Names allow letters, digits, `.`, `_`, `-` up to 100 characters. The default branch is used when none is given. Rate limited to 10 per minute. Codes: `VALIDATION_ERROR`, `RATE_LIMIT`, `RATE_LIMITED` (GitHub), `NOT_FOUND`, `DUPLICATE`, `GITHUB_ERROR`, `DB_ERROR` |
| `importLocalFolder` | `localPath`, optional `displayName` | Requires `ENABLE_LOCAL_FS=true`. Validates the folder, requires `_bmad` or `_bmad-output`, stores it with owner `local`. Rate limited to 10 per minute. Codes: `LOCAL_DISABLED`, `VALIDATION_ERROR`, `RATE_LIMIT`, `PATH_NOT_FOUND`, `NO_BMAD`, `DUPLICATE`, `FS_ERROR` |
| `refreshRepoData` | `owner`, `name` | Counts the files of the output folder, updates `totalFiles` and `lastSyncedAt`. For GitHub projects it also invalidates the cache tag of the project. Returns `totalFiles`, `lastSyncedAt`. Codes: `NOT_FOUND`, `PATH_STALE` (local folder gone), `RATE_LIMITED`, `FS_ERROR`, `GITHUB_ERROR` |
| `deleteRepo` | `owner`, `name` | Removes the project row. Codes: `NOT_FOUND`, `DB_ERROR` |
| `listRepoBranches` | `owner`, `name` | Branch names of a GitHub project. Code `NOT_APPLICABLE` for local projects |
| `updateRepoBranch` | `owner`, `name`, `branch` | The settings dialog. Changes the tracked branch of a GitHub project and invalidates its cache. Code `NOT_APPLICABLE` for local projects |
| `fetchBmadFiles` | `owner`, `name` | File trees for the Library: output folder, `docs`, `_bmad` and layout-declared roots |
| `fetchFileContent` | `owner`, `name`, `path` | Content of one file with its type (`markdown`, `yaml`, `json` or `text`). The path must not contain `..` |
| `fetchParsedFileContent` | `owner`, `name`, `path` | Same, with frontmatter and metadata parsed |

The Overview, Epics, epic and story pages load project data on the server (see [architecture.md](./architecture.md)). The Library and the Specs and Design tabs load the file tree on the server and read a document with `fetchParsedFileContent` when you select it.
