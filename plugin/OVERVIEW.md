# BMAD Console

Starts and stops the Paseo BMAD Console web app (a local Next.js dashboard for BMAD projects) on the machine that runs the Paseo daemon, and opens it from Paseo. It adds a sidebar item, a workspace panel and two Command Center items: "Open BMAD Console" and "Start/Stop BMAD Console".

## How it works

The plugin does not bundle the console. It runs a copy of the console that you already have on disk. When you press Start, the daemon-side part of the plugin runs `pnpm exec next dev` (dev mode) or `pnpm exec next start` (start mode) in the console directory, without a shell, in its own process group. It checks the console by requesting `/api/health` on the configured port, with a 1.5 second timeout. It keeps the last 300 lines of the console's output in memory so you can read them in the plugin screen.

The plugin only stops the process it started. If a console is already answering on the port, the plugin reports it as started outside Paseo and leaves it alone. This also applies to a standalone deployment folder: the plugin can open it but cannot start or stop it, because it only starts a source checkout. It does not restart a crashed console automatically; it shows the exit code and the last lines of output instead. When the plugin unloads, it stops the process it started.

## Setup

You need:

- A checkout of the Paseo BMAD Console with its dependencies installed using pnpm, its own `.env` file, and its database running.
- `pnpm` on the PATH of the Paseo daemon.
- Paseo 0.11.0 or later on the daemon and in the app.
- Linux or macOS on the daemon machine. Windows is not supported.

Open the BMAD Console screen (or Settings, Plugins, BMAD Console) and fill in:

- Console directory: absolute path to the checkout. It must contain a package.json named `paseo-bmad-console` and a `next.config.ts`.
- Port: 1024 to 65535, default 7002.
- Mode: `dev`, or `start` (needs a production build from `pnpm build`; the plugin tells you when it is missing).
- Bind host: default 127.0.0.1, reachable from this machine only. Use 0.0.0.0 or a Tailscale or LAN address to reach it from another device.
- Public URL (optional): the address other devices should use, for example a Tailscale URL. It is shown first on mobile.
- Allowed dev origins (optional): comma separated host names passed to the console as `ALLOWED_DEV_ORIGINS`.
- Start with Paseo: start the console when the plugin loads. Off by default.

## Opening the console

- Electron desktop app: "Open in Paseo browser" opens the console in a browser tab of a Paseo workspace. This is available only on Electron.
- Web and mobile apps: use "Open in browser" or "Copy URL". The public URL is shown first. A phone cannot use 127.0.0.1, so set the public URL and a bind host that the phone can reach.

## What it reads and runs

- Reads the console directory's package.json, the existence of `next.config.ts`, `node_modules/next` and `.next/BUILD_ID`.
- Runs `pnpm` as a local process with the daemon user's permissions. The child gets the daemon's environment plus `NODE_ENV`, and `ALLOWED_DEV_ORIGINS` when configured. It never prints the environment.
- Makes HTTP GET requests to the console's `/api/health` on the configured port, on the daemon machine.
- Stores its settings as plain JSON on the daemon host. They contain paths and host names, not credentials.
- Sends no data to any remote service and downloads or installs nothing.

Plugins are trusted, unsandboxed code. Binding the console to a non-loopback address makes it reachable from your network, and the console has no login, so use a non-loopback bind host only on a private network (for example your Tailscale network).
