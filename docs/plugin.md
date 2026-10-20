# Paseo plugin

The `plugin/` folder contains a [Paseo](https://paseo.sh) plugin that starts, stops and opens Paseo BMAD Console from inside Paseo. This page explains what it does, how to install and configure it, its limits and how to develop it. A shorter description in the plugin's own words is in [plugin/OVERVIEW.md](../plugin/OVERVIEW.md).

## What it does

- Adds a **BMAD Console** item to the sidebar, a workspace panel and a settings screen under Settings, Plugins.
- Adds two Command Center items: "Open BMAD Console" and "Start/Stop BMAD Console".
- Starts the console as a child process on the machine that runs the Paseo daemon, stops it, restarts it and shows its recent output.
- Checks whether a console answers on the configured port by requesting `/api/health`.

The plugin does not bundle the console. It runs an installed build of it from a folder that holds build output only (no source), so the source checkout can be moved, changed or deleted without breaking the running console. `pnpm deploy:local` in the checkout builds the console and installs it there.

## Requirements

- Paseo daemon and app 0.11.0 or later (`paseo-plugin.json` declares `"paseo": ">=0.11.0"`).
- The console installed with `pnpm deploy:local` (see below), and a running database.
- `node` on the `PATH` of the daemon process, or `NODE_BIN` set to its absolute path in the daemon environment. `pnpm` is needed only to install, not to run.
- Linux or macOS on the daemon machine. Starting the console is refused on Windows.

## Trust warning

**Plugins are trusted, unsandboxed code.** They run with the permissions of the Paseo daemon user. This plugin runs `pnpm` in the directory you configure and passes it the daemon's environment. Read the code in `plugin/` before you install it, and install only plugins you trust.

Plugins are off by default. Turn on **Enable plugins** under Paseo Settings, Plugins. This sets `pluginsEnabled` in the daemon's `config.json`, and `paseo reload` applies it.

## Install

```bash
cd plugin
npm install
npm run typecheck
npm test
cd ..
paseo plugin install /absolute/path/to/paseo-bmad-console/plugin
paseo plugin ls
```

`npm install` is only needed to run the type check and the tests, but the plugin must be installed from its absolute path. `paseo plugin install` asks you to trust the plugin. The plugin id is `bmad-console`. The CLI also has `enable`, `disable`, `reload` and `remove` for it. Use `--host` to target a daemon on another machine (see `paseo plugin install --help`).

## Settings

Open **BMAD Console** in the sidebar, or Settings, Plugins, BMAD Console. Settings are stored on the daemon host as plain JSON and contain paths and host names, not credentials.

The plugin fills in the install folder and the address for other devices by itself, so an installed console needs no setup. The install folder is `~/.paseo/bmad-console`. When the console listens on all interfaces and no address is saved, it builds one from this machine's first external IPv4 address, Tailscale (`100.64.0.0/10`) before private LAN ranges. Saved values always win over detected ones.

| Setting | Default | Meaning |
| --- | --- | --- |
| Open from my phone and other devices | off | Off binds `127.0.0.1`. On binds `0.0.0.0`. |
| Start with Paseo | off | Start the console when the plugin loads. One attempt, no retry loop |
| Console folder (Advanced) | `~/.paseo/bmad-console` | Absolute path of the install folder. It must hold `app/server.js` and `app/.next/BUILD_ID`. A folder that holds `server.js` directly, like the one in [deployment.md](./deployment.md), also works |
| Port (Advanced) | 7002 | 1024 to 65535 |
| Address for other devices (Advanced) | found automatically | Address other devices should use, for example a Tailscale URL. It is shown first, and it must start with `http://` or `https://` |

A bind host other than `127.0.0.1` or `0.0.0.0` that was saved earlier is kept and shown under Advanced as "Listen on".

### Install the console

```bash
pnpm deploy:local
```

Run it in a checkout. It runs `pnpm build` and copies the standalone build into the install folder:

```
~/.paseo/bmad-console/
  app/    build output only: server.js, .next, public, node_modules, the Prisma engine
  .env    your settings
```

`app/` is replaced on every run. `.env` is created once, from the checkout's `.env` if there is one, with mode 600, and is never overwritten. Set `PASEO_BMAD_CONSOLE_HOME` to install somewhere else and enter that folder under Advanced. Restart the console from the plugin screen after an install so it loads the new build. The install folder is separate from a deployment folder you run yourself, and `pnpm deploy:local` never writes to it.

The command that runs is `node server.js` in `app/`, without a shell, in its own process group. The child gets the daemon's environment, then the variables in `.env`, then `NODE_ENV=production`, `PORT` and `HOSTNAME` set from the plugin settings, which win over the same names in `.env`.

## What the page shows

- A Console group in the same style as Paseo's own settings, with the state (Not configured, Stopped, Starting, Running, Stopping or Crashed), and an amber notice when the settings are wrong or the console crashed. A console that was started outside Paseo shows as running with the hint "Started outside Paseo, so Paseo will not stop it".
- The address with a copy action, and buttons: Open console (or Open in browser) when it answers, Start and open when it is stopped, Restart and Stop when the plugin runs it.
- After a crash, the exit code and the last line of output in the Status row.
- The settings form below it, with validation.

## Opening the console

- **Electron desktop app**: Open opens the console in a browser tab inside a Paseo workspace.
- **Web and mobile apps**: "Open in Paseo browser" is not available. Use "Open in browser" or copy the address. The public URL is shown first. A phone cannot use `127.0.0.1`, so set the public URL and a bind host that the phone can reach (see [deployment.md](./deployment.md) for exposing the app on a private network).

## Limits

- **Installed build only.** The plugin runs the standalone build from the install folder and never a source checkout. It does not build or update the console; run `pnpm deploy:local` for that. If a console already answers `/api/health` on the port, whatever started it, the plugin shows it as running with the "Started outside Paseo" hint, lets you open it and never touches it.
- **Production only.** Earlier versions had a development mode, an allowed dev origins setting and a log viewer; an old saved `dev` mode is ignored.
- **It only stops what it started.** When the plugin unloads it stops its own process. It does not restart a crashed console automatically.
- **Port in use by something else.** If the port is taken by a process that does not answer like the console, the plugin refuses to start and asks for another port.
- **No authentication.** The console has none. A non-loopback bind host exposes it to that network, so use one only on a private network.

## Troubleshooting

```bash
paseo plugin ls
paseo plugin logs bmad-console
```

- The plugin is missing or disabled: check `paseo plugin ls`, enable plugins in Settings and run `paseo reload`.
- "The console is not installed" or "No installed console found": run `pnpm deploy:local` in a checkout, or enter the folder under Advanced.
- "The build is incomplete": run `pnpm deploy:local` again.
- "Could not run `node`": `node` is not on the daemon's `PATH`. Set `NODE_BIN` in the daemon environment.
- The console starts and exits at once: read the last output in the Status row, or `paseo plugin logs bmad-console`. The usual causes are a missing or wrong `DATABASE_URL` in the install folder's `.env` or the database not running.
- "Could not reach the plugin on the Paseo daemon": the daemon is not running or the plugin did not load; see `paseo plugin logs bmad-console`.

## Development

The plugin is a separate npm project (the rest of the repository uses pnpm) and is excluded from the root TypeScript, ESLint and Vitest runs.

```bash
cd plugin
npm install
npm run typecheck      # tsc --noEmit
npm test               # vitest run
```

After editing the plugin, apply the change in a running daemon:

```bash
paseo plugin reload bmad-console
```

Layout of `plugin/`:

- `paseo-plugin.json`: manifest (id, name, icon, Paseo version requirement).
- `index.server.ts`: daemon side. Registers the settings and the RPCs (status, start, stop, restart, logs) and handles auto start.
- `index.client.tsx`: app side. Screens, sidebar item, workspace panel, settings screen, Command Center items.
- `server/`: process manager, log buffer, directory validation and the RPC service.
- `client/`: the page, hooks and pure UI logic.
- `shared/console.ts`: settings schema and validation, RPC definitions, URL helpers.
- `tests/`: Vitest tests for the pure logic and the process manager, using fakes.
- `OVERVIEW.md`: the plain-language description of the plugin. Keep it plain: no install commands and no em dashes.
