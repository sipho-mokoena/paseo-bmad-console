import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import { describe, expect, it } from "vitest";
import { ProcessManager } from "../server/process-manager";
import type { ConsoleSettingsValues } from "../shared/console";

/**
 * Starts the REAL console through the real process manager on a spare port.
 * Skipped unless SMOKE=1. Run by hand:
 *   SMOKE=1 SMOKE_DIR=/abs/path/to/install-folder SMOKE_PORT=7011 npx vitest run tests/smoke.test.ts
 */
const enabled = process.env.SMOKE === "1";
const dir = process.env.SMOKE_DIR ?? "";
const port = Number(process.env.SMOKE_PORT ?? 7011);

function portFree(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!enabled)("real console smoke test", () => {
  it("starts, answers /api/health with 200, stops and leaves nothing behind", async () => {
    expect(port).not.toBe(7002);
    expect(await portFree()).toBe(true);
    const manager = new ProcessManager({
      spawn: (command, args, options) => spawn(command, args, options),
      fetch: (url, init) => fetch(url, init as unknown as RequestInit),
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      killGroup: (pid, signal) => {
        process.kill(-pid, signal);
      },
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      fs: {
        isDirectory: (target) => existsSync(target) && statSync(target).isDirectory(),
        isFile: (target) => existsSync(target) && statSync(target).isFile(),
        readText: (target) => (existsSync(target) ? readFileSync(target, "utf8") : null),
      },
      env: process.env,
      platform: process.platform,
    });
    const config: ConsoleSettingsValues = {
      consoleDirectory: dir,
      port,
      mode: "dev",
      bindHost: "127.0.0.1",
      publicUrl: "",
      allowedDevOrigins: "",
      autoStart: false,
    };
    const started = await manager.start(config);
    console.log("start:", started.ok, started.error, "state:", started.status.state, "pid:", started.status.pid);
    expect(started.ok).toBe(true);
    const pid = started.status.pid as number;

    let state = started.status.state;
    const deadline = Date.now() + 150_000;
    while (state !== "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      state = (await manager.status(config)).state;
      if (state === "crashed") break;
    }
    const log = manager.readLogs(8).lines.join("\n");
    expect(state, `console log tail:\n${log}`).toBe("running");
    console.log("state after wait:", state, "uptime ok");

    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { redirect: "manual" });
    console.log("GET /api/health ->", response.status);
    expect(response.status).toBe(200);

    // A second start must not spawn another process.
    const again = await manager.start(config);
    expect(again.alreadyRunning).toBe(true);
    expect(again.status.pid).toBe(pid);

    const stopped = await manager.stop(config);
    console.log("stop:", stopped.ok, stopped.error, "state:", stopped.status.state);
    expect(stopped.ok).toBe(true);
    expect(await portFree()).toBe(true);
    expect(groupAlive(pid)).toBe(false);
    console.log("port free after stop: true; process group", pid, "alive: false");
  }, 240_000);
});
