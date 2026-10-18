# Paseo plugin

The `plugin/` folder contains a [Paseo](https://paseo.sh) plugin that starts, stops and opens Paseo BMAD Console from inside Paseo. This page explains what it does, how to install and configure it, its limits and how to develop it. A shorter description in the plugin's own words is in [plugin/OVERVIEW.md](../plugin/OVERVIEW.md).

## What it does

- Adds a **BMAD Console** item to the sidebar, a workspace panel and a settings screen under Settings, Plugins.
- Adds two Command Center items: "Open BMAD Console" and "Start/Stop BMAD Console".
- Starts the console as a child process on the machine that runs the Paseo daemon, stops it, restarts it and shows its recent output.
- Checks whether a console answers on the configured port by requesting `/api/health`.

The plugin does not bundle the console. It runs a checkout of this repository that you already have.

## Requirements

- Paseo daemon and app 0.11.0 or later (`paseo-plugin.json` declares `"paseo": ">=0.11.0"`).
- A checkout of this repository on the daemon machine, with dependencies installed using pnpm, a `.env` file and a running database.
- `pnpm` on the `PATH` of the daemon process.
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

| Setting | Default | Meaning |
| --- | --- | --- |
| Console directory | empty | Absolute path of the checkout. It must contain a `package.json` with the name `paseo-bmad-console`, a `next.config.ts` and `node_modules/next`, and a production build (`pnpm build`), because the plugin checks for `.next/BUILD_ID` |
| Port | 7002 | 1024 to 65535 |
| Bind host | `127.0.0.1` | Interface to listen on. Use a Tailscale or LAN address, or `0.0.0.0`, to reach it from another device |
| Public URL | empty | Address other devices should use, for example a Tailscale URL. It is shown first, and it must start with `http://` or `https://` |
| Start with Paseo | off | Start the console when the plugin loads. One attempt, no retry loop |

The command that runs is `pnpm exec next start -p <port> -H <bind host>` in the console directory, without a shell, in its own process group. The child gets the daemon's environment plus `NODE_ENV=production`.

## What the page shows

- Status chips: the state (Not configured, Stopped, Starting, Running, Stopping or Crashed), and the port. A console that was started outside Paseo shows as running with the hint "Started outside Paseo, so Paseo will not stop it".
- A **Console** group with Start, Restart, Stop, Open, and the address (with a copy action).
- After a crash, the exit code and the last line of output in the Status row.
- The settings form below it, with validation.

## Opening the console

- **Electron desktop app**: Open opens the console in a browser tab inside a Paseo workspace.
- **Web and mobile apps**: "Open in Paseo browser" is not available. Use "Open in browser" or copy the address. The public URL is shown first. A phone cannot use `127.0.0.1`, so set the public URL and a bind host that the phone can reach (see [deployment.md](./deployment.md) for exposing the app on a private network).

## Limits

- **Source checkout only.** The plugin starts the console from a source checkout with `pnpm exec next start`. It cannot start, stop or restart a standalone deployment folder (see [deployment.md](./deployment.md)), which has no source and no Next.js CLI. If a console already answers `/api/health` on the port, whatever started it, the plugin shows it as running with that "Started outside Paseo" hint, lets you open it and never touches it. So it can open a standalone deployment but not manage it.
- **Production only.** The plugin always runs `next start`. Earlier versions had a development mode, an allowed dev origins setting and a log viewer; an old saved `dev` mode is ignored.
- **`next start` warning.** The repository builds with `output: "standalone"`, so `next start` prints a warning that it does not work with that setting. The server still starts and answers.
- **It only stops what it started.** When the plugin unloads it stops its own process. It does not restart a crashed console automatically.
- **Port in use by something else.** If the port is taken by a process that does not answer like the console, the plugin refuses to start and asks for another port.
- **No authentication.** The console has none. A non-loopback bind host exposes it to that network, so use one only on a private network.

## Troubleshooting

```bash
paseo plugin ls
paseo plugin logs bmad-console
```

- The plugin is missing or disabled: check `paseo plugin ls`, enable plugins in Settings and run `paseo reload`.
- "Set the console directory in the plugin settings": fill in the absolute path of the checkout.
- "Dependencies are not installed": run `pnpm install` in the checkout.
- "No production build": run `pnpm build` in the checkout.
- "Could not run `pnpm`": `pnpm` is not on the daemon's `PATH`.
- The console starts and exits at once: read the last output in the Status row, or `paseo plugin logs bmad-console`. The usual causes are a missing or wrong `DATABASE_URL` in the checkout's `.env` or the database not running.
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
