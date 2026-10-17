# Deployment

This page explains how to build Paseo BMAD Console, assemble a small deployment folder that contains build output only, run it in the background or as a systemd user service, update it, back up its database and make it reachable from a phone over a private network. It describes a single-machine, single-user setup. The app has no authentication, so it must stay on `localhost` or a private network (see [SECURITY.md](../SECURITY.md)).

Items marked **not verified here** were not run while writing this page.

## Overview

`next.config.ts` sets `output: "standalone"`. `pnpm build` therefore produces a self-contained server in `.next/standalone`. A deployment is that folder plus the static assets, a `.env` file and a start script. It needs Node.js and a reachable PostgreSQL, but no `node_modules` install and no application source tree. The folder you run is separate from your source checkout.

## 1. Build

In the source checkout (dependencies installed):

```bash
pnpm install
pnpm build
```

The build downloads the Geist fonts from Google Fonts (`next/font/google`), so it needs internet access. It does not need a database. The result is in `.next/`.

## 2. Assemble the deployment folder

```bash
DEPLOY=$HOME/paseo-bmad-console-deploy        # any folder outside the checkout
mkdir -p "$DEPLOY"
cp -a .next/standalone/. "$DEPLOY"/
mkdir -p "$DEPLOY/.next"
cp -a .next/static "$DEPLOY/.next/static"
cp -a public "$DEPLOY/public"
```

What the folder contains afterwards:

- `server.js`, the server entry point.
- `.next/` with the server build and, from the copy above, `.next/static`.
- `public/`, the favicon and logo.
- `node_modules/` with only the packages the server needs (Next.js, React and a few others).
- `package.json`.
- `src/generated/prisma/` with the Prisma query engine, and possibly a few traced `src/lib/...` files. These are not an application source tree and the server does not need your checkout.

**Check for a copied `.env`.** The build copies the checkout's `.env` into `.next/standalone`. Delete it from the deployment folder and write the production one yourself (next section), so the folder holds only the values you intend:

```bash
rm -f "$DEPLOY/.env"
```

The folder holds build output only. Do not edit files in it by hand, and rebuild and re-copy to change anything.

## 3. Production `.env`

Create `$DEPLOY/.env` with the variables from [configuration.md](./configuration.md). A minimal one:

```
DATABASE_URL=postgresql://bmad:<password>@127.0.0.1:7433/bmad_dashboard
# GITHUB_PAT=<token>
# ENABLE_LOCAL_FS=true
# REVALIDATE_SECRET=<openssl rand -hex 32>
```

Use a password of your own, not the development one from `docker-compose.yml`. Keep the file private:

```bash
chmod 600 "$DEPLOY/.env"
```

There is nothing else to configure: no admin account, no list of allowed origins and no login. `ALLOWED_DEV_ORIGINS` applies to `next dev` only.

## 4. Start script

The standalone `server.js` reads `PORT` and `HOSTNAME` from the environment and does not rely on `.env` being loaded for you, so a small script exports everything first. Save this as `$DEPLOY/start.sh` and make it executable (`chmod +x`):

```bash
#!/usr/bin/env bash
# Runs the Paseo BMAD Console production server (Next.js standalone build).
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a
export PORT="${PORT:-7002}"
# Use BIND_HOST, not HOSTNAME: shells and containers often set HOSTNAME to the machine name.
export HOSTNAME="${BIND_HOST:-127.0.0.1}"
# Use an absolute path to node if it is not on the PATH of the user that runs this.
exec "${NODE_BIN:-node}" server.js
```

Run it in the foreground to test, then check it:

```bash
$DEPLOY/start.sh
curl -i http://127.0.0.1:7002/api/health
```

A healthy server answers `200` with `{"status":"ok","db":"connected"}`. (This start script and the folder layout above were run end to end, against a scratch database on another 7xxx port, while writing this page.)

### Run it in the background

```bash
nohup "$DEPLOY/start.sh" > "$DEPLOY/server.log" 2>&1 &
echo $! > "$DEPLOY/server.pid"
```

Stop it with `kill "$(cat "$DEPLOY/server.pid")"`. Do not stop it with `pkill -f` on a pattern that your own command line also contains.

### Run it as a systemd user service

This is an example. The unit file passed `systemd-analyze --user verify`, but it was **not verified** by starting it here. Save it as `~/.config/systemd/user/paseo-bmad-console.service`:

```ini
[Unit]
Description=Paseo BMAD Console
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/paseo-bmad-console-deploy
ExecStart=%h/paseo-bmad-console-deploy/start.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Then:

```bash
systemctl --user daemon-reload
systemctl --user enable --now paseo-bmad-console
systemctl --user status paseo-bmad-console
journalctl --user -u paseo-bmad-console -f
```

User services stop when you log out unless lingering is enabled (`loginctl enable-linger "$USER"`). A user service has a short `PATH`, so set `NODE_BIN` to the absolute path of `node` in `.env` or in `start.sh` if the service cannot find it.

## 5. Database

For the development database use `docker compose up -d` from the checkout (PostgreSQL 17 on `127.0.0.1:7433`). A production database can be that container or any PostgreSQL 15 or later. Keep it bound to loopback or a private network.

Apply migrations from the **source checkout**, because the deployment folder does not contain the Prisma CLI. Point `DATABASE_URL` at the production database:

```bash
DATABASE_URL='postgresql://bmad:<password>@127.0.0.1:7433/bmad_dashboard' pnpm exec prisma migrate deploy
```

Run it before the first start and after every update that adds a migration. It is safe to run when there is nothing to apply. For a fresh database it creates the `repos` table and records the migrations. Do not use `prisma db push` for a database you keep: afterwards `migrate deploy` fails with P3005. Never use `prisma migrate dev` against production.

## 6. Update a deployment

1. In the checkout: `git pull`, `pnpm install`, `pnpm build`.
2. Stage the new build next to the old one, without the copied `.env`:

   ```bash
   STAGE=$(mktemp -d)
   cp -a .next/standalone/. "$STAGE"/
   rm -f "$STAGE/.env"
   mkdir -p "$STAGE/.next" && cp -a .next/static "$STAGE/.next/static" && cp -a public "$STAGE/public"
   ```

3. Back up the database (see below).
4. Apply migrations from the checkout: `pnpm exec prisma migrate deploy` with the production `DATABASE_URL`.
5. Stop the server (`systemctl --user stop paseo-bmad-console`, or kill the process).
6. Replace the build output and keep `.env`, `start.sh` and the log:

   ```bash
   rm -rf "$DEPLOY/.next" "$DEPLOY/node_modules" "$DEPLOY/src" "$DEPLOY/public" "$DEPLOY/server.js" "$DEPLOY/package.json"
   cp -a "$STAGE"/. "$DEPLOY"/
   rm -rf "$STAGE"
   ```

7. Start the server and check `/api/health`.

The project list lives in the database, so projects survive an update.

## 7. Bind address and private network access

The start script binds to `127.0.0.1`, so only the local machine can connect. To reach the app from a phone or another computer on your tailnet, keep the app on loopback and forward a tailnet port to it with Tailscale:

```bash
tailscale serve --bg --tcp=7002 tcp://127.0.0.1:7002
```

`--bg` keeps the forward running in the background. `tailscale serve status` shows it and `tailscale serve reset` removes all serve configuration. The flags were checked against `tailscale serve --help`; the command itself is **not verified here** on a fresh machine. Then open `http://<machine name>.<tailnet name>.ts.net:7002` (or the machine's Tailscale address) from a device on the tailnet.

Notes:

- This is a plain TCP forward, so the app sees the original `Host` and `Origin` headers, which server actions compare. A reverse proxy that changes `Host` without sending `x-forwarded-host` can make actions fail.
- Do not use `tailscale funnel`, and do not bind the app to `0.0.0.0` on a network you do not control. Anyone who reaches the port can change and read everything.
- Binding the app itself to a Tailscale or LAN address (`BIND_HOST=100.x.y.z`) also works but exposes the port to everyone on that network.
- On a phone, the UI is responsive and uses the Paseo mobile layout. Use the address above; `127.0.0.1` on a phone means the phone itself.
- Local folder import reads the server's disk. A phone adds projects by server paths, not by phone paths.

## 8. Health check

`GET /api/health` runs a trivial query against the database:

```bash
curl -fsS http://127.0.0.1:7002/api/health
```

`200` means the server and the database are up. `503` with `"db":"disconnected"` means the server runs but cannot reach PostgreSQL. `curl -f` exits non-zero for 503, which suits a monitoring script or a cron job.

## 9. Back up the database

The only state is the `repos` table (the list of registered projects). Back it up with `pg_dump`. With the compose container (use your container's name from `docker ps`):

```bash
docker exec <postgres container> pg_dump -U bmad bmad_dashboard > bmad-backup-$(date +%F).sql
```

With a PostgreSQL on the host:

```bash
pg_dump 'postgresql://bmad:<password>@127.0.0.1:7433/bmad_dashboard' > bmad-backup-$(date +%F).sql
```

Restore into an empty database:

```bash
psql 'postgresql://bmad:<password>@127.0.0.1:7433/bmad_dashboard' < bmad-backup-2026-01-01.sql
```

The backup holds local folder paths and GitHub owner and repository names but no tokens: `GITHUB_PAT` lives only in `.env`. Keep both private. Your BMAD files are not in the database, so they need their own backup (they are normally in git).

## The live setup on this machine

The deployment this project was developed with is a folder in a home directory that holds only build output, a private `.env` and a start script like the one above. The server listens on `127.0.0.1:7002`, PostgreSQL runs in Docker and is published on `127.0.0.1:7433`, and Tailscale forwards port 7002 of the tailnet address to the loopback listener. Nothing else is exposed.

## Running from the source checkout

`pnpm start` runs `next start -H 127.0.0.1 -p 7002` from a checkout that has been built. With `output: "standalone"` Next.js prints `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.` but the server still starts and answers (checked here on another 7xxx port). The Paseo plugin uses this mode, see [plugin.md](./plugin.md). For a real deployment use the standalone folder.
