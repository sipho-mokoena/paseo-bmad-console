import { EventEmitter } from "node:events";
import {
  ProcessManager,
  type ChildLike,
  type ProcessManagerDeps,
  type SpawnOptions,
} from "../server/process-manager";
import { LogBuffer } from "../server/log-buffer";
import type { ConsoleSettingsValues } from "../shared/console";
import type { DirectoryFs } from "../server/validate-directory";

export const DIR = "/work/paseo-bmad-console";

export const baseConfig: ConsoleSettingsValues = {
  consoleDirectory: DIR,
  port: 3011,
  mode: "dev",
  bindHost: "127.0.0.1",
  publicUrl: "",
  allowedDevOrigins: "",
  autoStart: false,
};

export class FakeChild extends EventEmitter implements ChildLike {
  pid?: number;
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  constructor(pid: number | undefined) {
    super();
    this.pid = pid;
  }
}

export function makeFs(files: Record<string, string | null> = {}): DirectoryFs {
  const entries: Record<string, string> = {
    [`${DIR}/package.json`]: JSON.stringify({ name: "paseo-bmad-console" }),
    [`${DIR}/next.config.ts`]: "export default {};",
    [`${DIR}/node_modules/next/package.json`]: "{}",
    [`${DIR}/.next/BUILD_ID`]: "abc",
  };
  for (const [key, value] of Object.entries(files)) {
    if (value === null) delete entries[key];
    else entries[key] = value;
  }
  return {
    isDirectory: (target) => target === DIR,
    isFile: (target) => target in entries,
    readText: (target) => entries[target] ?? null,
  };
}

export interface Harness {
  manager: ProcessManager;
  logs: LogBuffer;
  spawned: Array<{ command: string; args: string[]; options: SpawnOptions; child: FakeChild }>;
  signals: Array<{ pid: number; signal: NodeJS.Signals | 0 }>;
  clock: { now: number };
  /** What the fake HTTP probe answers. */
  probe: { mode: "refused" | "up" | "status" | "timeout"; status: number };
  /** Process groups that currently exist. */
  groups: Set<number>;
  /** When true, SIGTERM is ignored by the fake process group. */
  ignoreTerm: boolean;
  exit(child: FakeChild, code: number | null, signal?: string | null): void;
}

export function makeHarness(
  options: { env?: NodeJS.ProcessEnv; fs?: DirectoryFs; pids?: number; failSpawn?: boolean } = {},
): Harness {
  const spawned: Harness["spawned"] = [];
  const signals: Harness["signals"] = [];
  const clock = { now: 1_000_000 };
  const probe: Harness["probe"] = { mode: "refused", status: 200 };
  const groups = new Set<number>();
  let nextPid = options.pids ?? 4000;
  const harness = { ignoreTerm: false } as { ignoreTerm: boolean };

  const deps: ProcessManagerDeps = {
    spawn(command, args, spawnOptions) {
      if (options.failSpawn) {
        const failed = new FakeChild(undefined);
        spawned.push({ command, args, options: spawnOptions, child: failed });
        queueMicrotask(() =>
          failed.emit("error", Object.assign(new Error("spawn pnpm ENOENT"), { code: "ENOENT" })),
        );
        return failed;
      }
      const child = new FakeChild(nextPid++);
      groups.add(child.pid as number);
      spawned.push({ command, args, options: spawnOptions, child });
      return child;
    },
    async fetch(_url, init) {
      if (probe.mode === "refused") {
        throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      }
      if (probe.mode === "timeout") {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      }
      void init;
      return { status: probe.mode === "up" ? 200 : probe.status };
    },
    now: () => clock.now,
    async sleep(ms) {
      clock.now += ms;
    },
    killGroup(pid, signal) {
      signals.push({ pid, signal });
      if (!groups.has(pid)) throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
      if (signal === "SIGKILL" || (signal === "SIGTERM" && !harness.ignoreTerm)) {
        // The group dies, and the leader's exit event is delivered.
        const entry = spawned.find((item) => item.child.pid === pid);
        groups.delete(pid);
        entry?.child.emit("exit", null, signal);
      }
    },
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    fs: options.fs ?? makeFs(),
    env: options.env ?? { PATH: "/usr/bin", HOME: "/home/test" },
    platform: "linux",
  };
  const logs = new LogBuffer({ maxLines: 300 });
  const manager = new ProcessManager(deps, logs);
  const result: Harness = {
    manager,
    logs,
    spawned,
    signals,
    clock,
    probe,
    groups,
    get ignoreTerm() {
      return harness.ignoreTerm;
    },
    set ignoreTerm(value: boolean) {
      harness.ignoreTerm = value;
    },
    exit(child, code, signal = null) {
      groups.delete(child.pid as number);
      child.emit("exit", code, signal);
    },
  };
  return result;
}
