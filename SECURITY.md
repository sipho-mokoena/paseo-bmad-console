# Security policy

This document describes the security model of Paseo BMAD Console, how to report a vulnerability and how to run the app safely. The most important fact comes first: **the app has no authentication.** It is a local tool for one user or one trusted group on a private network.

## Security model: no authentication

Paseo BMAD Console is single-tenant. It has no login, no accounts, no sessions and no roles. Network isolation is the only access control.

Anyone who can reach the port can:

- list, add, remove and refresh projects;
- read the documents of every registered project;
- when `ENABLE_LOCAL_FS=true`, register any readable absolute folder on the server that contains a `_bmad` or `_bmad-output` directory and read the BMAD directories inside it (the local provider refuses everything else: path traversal, symbolic links, other folders, oversized files);
- spend the GitHub API quota of the server, and read any private repository that `GITHUB_PAT` can see by adding it as a project.

What follows from that:

- Run it on `localhost` or on a private network only, for example behind Tailscale. Do not expose it to the internet. Do not put it behind a public reverse proxy or `tailscale funnel` without adding authentication in front of it.
- The `pnpm dev` and `pnpm start` scripts bind to `127.0.0.1`. Binding to `0.0.0.0` or to a LAN address exposes the app to that whole network.
- Leave `ENABLE_LOCAL_FS` unset on any host that other people can reach.
- Use a minimally scoped `GITHUB_PAT`.

The safety nets that remain whatever the network:

- the local provider's path guards (see [docs/LOCAL_FOLDER.md](./docs/LOCAL_FOLDER.md));
- the `ENABLE_LOCAL_FS` switch;
- the image allowlist and size limit of `/api/repo-asset`, with a sandboxing `Content-Security-Policy` on SVG responses;
- input validation with Zod in the server actions, and error messages that do not reveal paths or internals;
- Markdown rendering through `rehype-sanitize`, and Mermaid in strict mode with plain SVG labels;
- the response headers `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`;
- `POST /api/revalidate`, which additionally requires `REVALIDATE_SECRET` (it is a guard for cache invalidation, not a login) and is disabled when the secret is empty.

A test (`src/lib/__tests__/no-auth.test.ts`) fails if an authentication dependency or import returns, so the model stays consistent.

## Reporting a vulnerability

**Do not report vulnerabilities in public issues.** Use GitHub's private vulnerability reporting: open the **Security** tab of the repository, choose **Advisories** and then **Report a vulnerability**. This keeps the report confidential until a fix exists.

Please include:

- a description of the problem and its impact;
- steps to reproduce, with the layout and source type (local or GitHub) involved;
- the affected version or commit;
- a suggested fix, if you have one.

This is a small project, so responses are best effort and there are no fixed response times. Only the latest commit on `main` receives fixes.

### In scope

- Reading files outside the allowed BMAD folders of a local project (path traversal, symbolic link escape).
- Reading or writing the database in ways the UI does not allow (SQL injection).
- Exposure of `GITHUB_PAT` or `REVALIDATE_SECRET`.
- Server-side request forgery.
- Cross-site scripting through rendered Markdown, Mermaid diagrams or served images.
- Bypassing the `ENABLE_LOCAL_FS` switch.

### Out of scope

- The absence of authentication. It is by design.
- Problems that need the port to be exposed to untrusted networks.
- Vulnerabilities in third-party dependencies (report them to the maintainers of those projects).
- Denial of service against a development server.

## Hardening advice

- **Bind address.** Keep the server on `127.0.0.1`. To use it from a phone, forward a private port to the loopback listener (for example `tailscale serve --bg --tcp=7002 tcp://127.0.0.1:7002`, see [docs/deployment.md](./docs/deployment.md)) instead of binding to `0.0.0.0`.
- **Private network only.** Everyone who can reach the port can change and read everything. Trust the network accordingly.
- **`ENABLE_LOCAL_FS`.** Enable it only on a machine you control, with projects you are willing to expose to everyone on the private network. Keep it off otherwise.
- **`GITHUB_PAT`.** Use a classic token with `public_repo` if you only need public repositories, and `repo` only when you need private ones. Prefer a token of an account that can see only the repositories you intend to show. Revoke it when it is no longer needed. It stays in the server environment, not in the database and not in the browser. Restart the server after changing it.
- **Secrets.** Never commit `.env` or `.env.local`. Restrict the file (`chmod 600 .env`). Generate `REVALIDATE_SECRET` with `openssl rand -hex 32`, or leave it empty to disable the endpoint.
- **Database.** Keep PostgreSQL on loopback or a private network. `docker-compose.yml` publishes it on `127.0.0.1` only and uses a development password: use your own password for any database you keep.
- **Backups.** The only state is the `repos` table. Back it up with `pg_dump` (see [docs/deployment.md](./docs/deployment.md#9-back-up-the-database)), and keep the dumps private because they contain local folder paths.
- **Updates.** Keep Node.js and the dependencies up to date.
- **Paseo plugin.** Plugins are trusted, unsandboxed code that runs with the daemon user's permissions. Read `plugin/` before installing it, and use a non-loopback bind host only on a private network (see [docs/plugin.md](./docs/plugin.md)).

## Known risks

### Requests from other web pages

Without a session there is no cookie to steal, but a web page you open on the same machine could still send requests to a local, unauthenticated server. Next.js server actions compare the `Origin` and `Host` headers and reject cross-origin calls, which covers adding, removing and refreshing projects. The read-only GET endpoints (`/api/search`, `/api/repo-asset`) have no origin check, but no CORS headers are sent, so a foreign page cannot read their responses.

### GitHub token

`GITHUB_PAT` is read from the server environment on each request. It is not stored in the database, not sent to the browser and not written to logs by the app.
