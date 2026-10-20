import { spawn } from "node:child_process";
import { homedir, networkInterfaces } from "node:os";
import { existsSync, readFileSync, statSync } from "node:fs";
import type { PluginServerContext } from "@getpaseo/plugin/server";
import { defaultInstallDirectory, pickNetworkAddress } from "./server/detect";
import { ProcessManager } from "./server/process-manager";
import { createService } from "./server/service";
import { consoleSettings, logsRpc, restartRpc, startRpc, statusRpc, stopRpc } from "./shared/console";

function realFs() {
  return {
    isDirectory: (target: string) => {
      try {
        return statSync(target).isDirectory();
      } catch {
        return false;
      }
    },
    isFile: (target: string) => existsSync(target) && statSync(target).isFile(),
    readText: (target: string) => {
      try {
        return readFileSync(target, "utf8");
      } catch {
        return null;
      }
    },
  };
}

export default function contribute(server: PluginServerContext) {
  const fs = realFs();
  const manager = new ProcessManager({
    spawn: (command, args, options) => spawn(command, args, options),
    // The cast bridges react-native's AbortSignal typing and the Node one.
    fetch: (url, init) => fetch(url, init as unknown as RequestInit),
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    killGroup: (pid, signal) => {
      process.kill(-pid, signal);
    },
    setTimeout: (callback, ms) => setTimeout(callback, ms),
    clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    fs,
    env: process.env,
    platform: process.platform,
  });
  const settings = server.registerSettings(consoleSettings);
  const detect = {
    directory: () => defaultInstallDirectory(homedir()),
    networkAddress: () => pickNetworkAddress(networkInterfaces()),
  };
  const service = createService(manager, settings, detect);

  server.handle(statusRpc, () => service.status());
  server.handle(startRpc, () => service.start());
  server.handle(stopRpc, () => service.stop());
  server.handle(restartRpc, () => service.restart());
  server.handle(logsRpc, ({ lines }) => service.logs(lines));

  // Auto start once per load. A failure is logged and shown in the status; there is no retry loop.
  void (async () => {
    const current = await settings.read();
    if (current.status !== "ready" || !current.values.autoStart) return;
    const result = await service.start();
    if (!result.ok) console.error(`BMAD Console auto start failed: ${result.error}`);
    else console.log(`BMAD Console auto start: ${result.alreadyRunning ? "already running" : "started"}.`);
  })().catch((error: unknown) => {
    console.error("BMAD Console auto start failed:", error instanceof Error ? error.message : String(error));
  });

  return async () => {
    await manager.dispose();
  };
}
