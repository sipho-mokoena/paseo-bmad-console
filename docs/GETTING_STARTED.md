# Getting Started

Step-by-step guide to run Paseo BMAD Console locally.

## Prerequisites

- **Node.js** 22+
- **pnpm** 10+
- **Docker** (for PostgreSQL, or use your own PostgreSQL 15+ instance)
- A **GitHub Personal Access Token** — optional: raises the rate limit and lets you read private GitHub repositories

## 1. Clone the repository

```bash
git clone <this repository URL>
cd paseo-bmad-console
```

## 2. Install dependencies

```bash
pnpm install
```

## 3. Set up environment variables

**Quick method** — generates `REVALIDATE_SECRET` and `DATABASE_URL` for you:

```bash
bash scripts/setup.sh
```

**Manual method** — copy the template and edit by hand:

```bash
cp .env.example .env
```

Then fill in each variable as described below.

### Database (`DATABASE_URL`)

If you use the included Docker Compose (step 4), the default value works out of the box:

```
DATABASE_URL=postgresql://bmad:bmad_dev_password@localhost:7433/bmad_dashboard
```

The format is `postgresql://<user>:<password>@<host>:<port>/<database>`. Adjust if you use your own PostgreSQL instance.

### Revalidation secret (`REVALIDATE_SECRET`)

A random string to protect the cache revalidation API endpoint. Generate one with:

```bash
openssl rand -hex 32
```

### GitHub Personal Access Token (`GITHUB_PAT`) — optional

The app has no GitHub login. Without a PAT it reads public repositories unauthenticated, and GitHub allows only 60 requests/hour. With one you get 5,000/hour and can read private repositories. Restart the server after changing it.

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `public_repo` — for public repositories only
   - `repo` — if you also need private repositories
4. Copy the token into `GITHUB_PAT`

## 4. Start PostgreSQL with Docker Compose (optional)

If you don't have a local PostgreSQL instance:

```bash
docker compose up -d
```

This starts a PostgreSQL instance on `127.0.0.1:7433` (to avoid conflicts with a local PostgreSQL on 5432).

## 5. Run database migrations

```bash
pnpm db:migrate
```

## 6. Start the development server

```bash
pnpm dev
```

Open [http://127.0.0.1:7002](http://127.0.0.1:7002) and add a project: a GitHub repository by `owner/name`, or a local folder when `ENABLE_LOCAL_FS=true`.

> **Security:** the app has no login. The dev server binds to `127.0.0.1`. Anyone who can reach the port can add and remove projects and read their BMAD folders, so keep it on localhost or a private network. See [SECURITY.md](../SECURITY.md).

---

## Environment Variables Reference

| Variable | Required | Default / How to generate | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://bmad:bmad_dev_password@localhost:7433/bmad_dashboard` | PostgreSQL connection string. Works out of the box with the included Docker Compose. |
| `REVALIDATE_SECRET` | Yes | `openssl rand -hex 32` | Secret to protect the cache revalidation endpoint. |
| `GITHUB_PAT` | No | — | Personal Access Token: higher GitHub API rate limits (60 → 5,000 req/h) and access to private repositories. |
| `ENABLE_LOCAL_FS` | No | `false` | Set to `true` to enable [local folder imports](./LOCAL_FOLDER.md). Self-hosted only: the server reads folders on its own machine. |
| `ALLOWED_DEV_ORIGINS` | No | empty | Comma-separated extra hostnames/IPs allowed to reach `next dev` (Tailscale name, LAN IP). |

> The `scripts/setup.sh` script generates `REVALIDATE_SECRET` for you.
