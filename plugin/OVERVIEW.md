# BMAD Console

Starts and stops the Paseo BMAD Console web app (a local Next.js dashboard for BMAD projects) on the machine that runs the Paseo daemon, and opens it from Paseo. It adds a sidebar item, a workspace panel and two Command Center items: "Open BMAD Console" and "Start/Stop BMAD Console".

## How it works

The plugin does not bundle the console. It runs an installed build of it from a folder that holds build output only, so the source checkout can be moved or deleted. When you press Start, the daemon-side part of the plugin runs `node server.js` in the installed app folder, without a shell, in its own process group, with the port, the bind host and the variables from the folder's `.env` file. It checks the console by requesting `/api/health` on the configured port, with a 1.5 second timeout. It keeps the last 300 lines of the console's output in memory so you can read them in the plugin screen.

The plugin only stops the process it started. If a console is already answering on the port, the plugin reports it as started outside Paseo and leaves it alone. It does not restart a crashed console automatically; it shows the exit code and the last lines of output instead. When the plugin unloads, it stops the process it started.

## Setup

You need:

- The console installed with `pnpm deploy:local`, run once in a checkout. It builds the console and installs the build output, and only that, in `~/.paseo/bmad-console`, next to a `.env` file with the database settings.
- The console's database running.
- `node` on the PATH of the Paseo daemon.
- Paseo 0.11.0 or later on the daemon and in the app.
- Linux or macOS on the daemon machine. Windows is not supported.

Open the BMAD Console screen (or Settings, Plugins, BMAD Console). The Console group at the top shows whether the console runs, its address, and the Open, Start, Restart and Stop buttons. Start and open starts a stopped console and opens it when it answers.

The plugin uses `~/.paseo/bmad-console` as the install folder. It also works out this machine's address for other devices (a Tailscale address first, then a LAN address). Nothing needs to be filled in once the console is installed. The page says what to run when it is not.

Settings has two switches:

- Open from my phone and other devices: off by default, so only this machine can open the console. When on, the console listens on all interfaces and the page shows the detected address. The console has no login, so use it on a private network only.
- Start with Paseo: start the console when the plugin loads. Off by default.

Under Advanced, each of these overrides what the plugin found:

- Console folder: absolute path of a different install folder. It must hold `app/server.js` and `app/.next/BUILD_ID`, or `server.js` directly.
- Port: 1024 to 65535, default 7002.
- Address for other devices: the link other devices should use, for example a Tailscale URL. It is shown first on mobile.

## Opening the console

- Electron desktop app: "Open console" opens the console in a browser tab of a Paseo workspace. This is available only on Electron.
- Web and mobile apps: use "Open in browser" or "Copy". The public URL is shown first. A phone cannot use 127.0.0.1, so set the public URL and a bind host that the phone can reach.

## What it reads and runs

- Reads the install folder's `.env` file and checks for `server.js`, `.next/BUILD_ID` and `package.json` in the app folder.
- Runs `node` as a local process with the daemon user's permissions. The child gets the daemon's environment, the variables from `.env`, and `NODE_ENV`, `PORT` and `HOSTNAME`. It never prints the environment.
- Makes HTTP GET requests to the console's `/api/health` on the configured port, on the daemon machine.
- Stores its settings as plain JSON on the daemon host. They contain paths and host names, not credentials.
- Sends no data to any remote service and downloads or installs nothing.

Plugins are trusted, unsandboxed code. Binding the console to a non-loopback address makes it reachable from your network, and the console has no login, so use a non-loopback bind host only on a private network (for example your Tailscale network).
