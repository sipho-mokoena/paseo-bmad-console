# Configuration

This page lists every environment variable that the application reads, with defaults and examples, and the ports and bind address it uses. The template is [`.env.example`](../.env.example): copy it to `.env`, or run `bash scripts/setup.sh`, which writes a `.env` with a generated `REVALIDATE_SECRET` and the development `DATABASE_URL`. Never commit `.env`.

The app has no authentication, so none of these variables configure one. See [SECURITY.md](../SECURITY.md).

## Variables

| Variable | Required | Default | Read by |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | none | Prisma client and CLI (`prisma/schema.prisma`, `prisma.config.ts`) |
| `GITHUB_PAT` | No | empty | `src/lib/github/client.ts` |
| `ENABLE_LOCAL_FS` | No | unset (off) | local provider, import action, dashboard pages |
| `ALLOWED_DEV_ORIGINS` | No | empty | `next.config.ts` (development server only) |
| `REVALIDATE_SECRET` | No | empty (endpoint disabled) | `src/app/api/revalidate/route.ts` |

Two more variables belong to Node and Next.js rather than to the app: `PORT` and `HOSTNAME`, used by the standalone `server.js` (see [Ports and bind address](#ports-and-bind-address)).

### `DATABASE_URL`

Required. PostgreSQL connection string, format `postgresql://<user>:<password>@<host>:<port>/<database>`. Prisma CLI commands other than `prisma generate` fail without it. `prisma generate` uses a placeholder URL when it is missing, so `pnpm install` works before `.env` exists.

```
DATABASE_URL=postgresql://bmad:<your-db-password>@localhost:7433/bmad_dashboard
```

With the included `docker-compose.yml` the user is `bmad`, the database is `bmad_dashboard` and the password is `bmad_dev_password`. That password is for local development only. For any other database, use your own credentials.

### `GITHUB_PAT`

Optional. A GitHub personal access token (classic). The app has no GitHub login: projects are added by `owner/name`, and this token, when set, is used for every GitHub API call.

- Without it, GitHub allows 60 requests per hour and only public repositories can be read.
- With it, GitHub allows 5,000 requests per hour and private repositories can be read.
- Scopes: `public_repo` for public repositories only, `repo` for private ones.
- A blank or whitespace-only value counts as unset.
- The value is read when a request is made, but restart the server after changing it so every process sees the same environment.

```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The token stays in the server environment. It is not stored in the database and not sent to the browser.

### `ENABLE_LOCAL_FS`

Optional. Set to the exact string `true` to enable [local folder import](./LOCAL_FOLDER.md). Any other value, or leaving it unset, disables it. When disabled, the local provider refuses to start, the import action returns `LOCAL_DISABLED`, `/api/repo-asset` answers 503 and the add-project dialog shows only the GitHub form.

```
ENABLE_LOCAL_FS=true
```

Enable it only on a machine that holds the projects and only when everyone who can reach the port is trusted with read access to those folders. Restart the server after changing it.

### `ALLOWED_DEV_ORIGINS`

Optional, development only. Comma-separated host names or IP addresses that may reach `next dev` besides localhost. It feeds the `allowedDevOrigins` option of Next.js. Empty by default. Spaces around entries are trimmed and empty entries are dropped.

```
ALLOWED_DEV_ORIGINS=my-laptop.tailnet-name.ts.net,100.64.0.10
```

It has no effect on a production build. To reach the dev server from another device you must also bind it to that interface, for example `pnpm dev -H 0.0.0.0`, which exposes the unauthenticated app to that whole network. Do this only on a private network. The Paseo plugin passes this value to the process it starts (see [plugin.md](./plugin.md)).

### `REVALIDATE_SECRET`

Optional. Shared secret for `POST /api/revalidate`, sent in the `x-revalidate-secret` header. When it is empty the endpoint answers 503 and does nothing. Generate one with:

```bash
openssl rand -hex 32
```

See [API.md](./API.md) for the endpoint.

## Ports and bind address

| Use | Port | Notes |
| --- | --- | --- |
| The app (`pnpm dev`, `pnpm start`) | 7002 | Set by the scripts in `package.json` |
| Development PostgreSQL | 7433 | `docker-compose.yml` publishes it on `127.0.0.1` only |

This project uses ports in the 7xxx range only. If 7002 is taken, pass another 7xxx port to the script, for example `pnpm dev -p 7102`, and use that port in every URL.

Both scripts pass `-H 127.0.0.1`, so the server listens on the loopback interface only. To change the bind address in development use `pnpm dev -H <address>`. Binding to `0.0.0.0` or a LAN address exposes the app to that network, and it has no authentication.

The standalone production server (`node server.js`) takes `PORT` (it has a Next.js default that is not 7002, so always set it) and `HOSTNAME` (the interface to listen on). Set both, for example `PORT=7002 HOSTNAME=127.0.0.1`. Many shells and containers already export `HOSTNAME` with the machine name, which would make the server bind to that name instead of the loopback interface, so set it explicitly. [deployment.md](./deployment.md) has a sample start script.

## Where variables are loaded from

- `next dev` and `next start` load `.env` from the project folder.
- Prisma CLI commands load `.env` through `dotenv` in `prisma.config.ts`. A variable already present in the shell wins over `.env`.
- For the standalone `server.js`, do not rely on `.env` being picked up. Export the variables before starting it, as the sample script in [deployment.md](./deployment.md) does.
