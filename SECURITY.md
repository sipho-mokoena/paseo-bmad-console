# Security Policy

## Supported Versions

As this project is in early development (`0.x`), only the latest version on the `main` branch receives security fixes.

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| Older releases | No |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability, please report it responsibly:

### Option 1 — GitHub Security Advisories (Preferred)

Use GitHub's private vulnerability reporting (the **Security** tab of this repository, then **Report a vulnerability**) to report the issue confidentially.

### Option 2 — Direct Contact

Reach out through the repository's contact channels listed on the GitHub profile.

---

## What to Include in Your Report

Please provide as much of the following as possible:

- A clear description of the vulnerability
- Steps to reproduce the issue
- The potential impact (what an attacker could do)
- Affected versions or components
- Any suggested fix (optional)

---

## Response Process

1. We will acknowledge receipt within **72 hours**
2. We will investigate and provide an initial assessment within **7 days**
3. We will work on a fix and coordinate disclosure with you
4. We will credit you in the release notes (unless you prefer to remain anonymous)

---

## Scope

### In Scope

- SQL injection or database access issues
- Path traversal or reads outside the BMAD folders of a registered local project
- GitHub token (`GITHUB_PAT`) or secret exposure
- Server-Side Request Forgery (SSRF)
- Cross-Site Scripting (XSS) in rendered content

### Out of Scope

- The absence of authentication. The app has none by design (see below)
- Vulnerabilities in third-party dependencies (report directly to maintainers)
- Self-inflicted issues from misconfigured deployments, including exposing the port to untrusted networks
- Social engineering attacks
- Rate limiting or denial of service in development environments

---

## Security Model: No Authentication

Paseo BMAD Console is a single-tenant tool. It has **no login, no accounts, no sessions and no roles**. Network isolation is the access control.

Anyone who can reach the port can:

- list, add, remove and refresh projects;
- read the documents of every registered project;
- when `ENABLE_LOCAL_FS=true`, register any absolute folder on the server that contains a `_bmad` or `_bmad-output` directory and read the BMAD directories inside it (the local provider refuses everything else: path traversal, symlinks, other folders, oversized files);
- spend the GitHub API quota of the server, and read any private repository that `GITHUB_PAT` can see, by adding it as a project.

Therefore:

- Run it on `localhost` or on a private network only, for example behind Tailscale. Do not expose it to the internet and do not put it behind a public reverse proxy without adding authentication in front of it.
- The `pnpm dev` and `pnpm start` scripts bind to `127.0.0.1`. Binding to `0.0.0.0` or a LAN address exposes the app to that whole network.
- Leave `ENABLE_LOCAL_FS` unset on any shared host.
- Use a minimally scoped `GITHUB_PAT` (`public_repo`, or `repo` only if you need private repositories).

The safety nets that remain regardless of the network: local provider path guards, the repo-asset image allowlist with its CSP headers, search and path validation, and the `ENABLE_LOCAL_FS` gate. `/api/revalidate` additionally requires `REVALIDATE_SECRET`.

---

## Security Best Practices for Deployment

When self-hosting Paseo BMAD Console:

- **Never commit** `.env` or `.env.local` files to version control
- Use a strong, randomly generated `REVALIDATE_SECRET`
- Store `GITHUB_PAT` only in the server environment, with the smallest scope that works
- Keep your dependencies up to date
- Restrict database access to the application only (the compose file publishes PostgreSQL on `127.0.0.1` only)
- Keep the app on localhost or a private network (see above)

---

## Known Risks and Mitigations

### Cross-site requests

Without a session there is no cookie to protect, but a web page you visit on the same machine can still send requests to a local, unauthenticated server. Next.js server actions reject cross-origin calls (they compare the `Origin` and `Host` headers), which covers adding, removing and refreshing projects. The read-only GET endpoints (`/api/search`, `/api/repo-asset`) are not protected by an origin check, but a foreign page cannot read their responses (no CORS headers are sent).

### GitHub token

`GITHUB_PAT` lives only in the server environment. It is never stored in the database, never sent to the browser and not logged.
