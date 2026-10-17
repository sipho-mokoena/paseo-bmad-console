import {
  buildUrlCandidates,
  MAX_LOG_LINES,
  validateSettings,
  type ConsoleActionResult,
  type ConsoleMode,
  type ConsoleSettingsValues,
  type ConsoleState,
  type ConsoleStatus,
} from "../shared/console";
import { LogBuffer } from "./log-buffer";
import { validateConsoleDirectory, type DirectoryFs } from "./validate-directory";

export const PROBE_TIMEOUT_MS = 1500;
export const STOP_GRACE_MS = 5000;
export const KILL_WAIT_MS = 2000;
const POLL_MS = 100;
const SPAWN_ERROR_WAIT_MS = 50;
const CRASH_LINES = 15;

/** Environment keys the manager sets or removes for the child. Nothing else is touched. */
export const MANAGED_ENV_KEYS = [
  "NODE_ENV",
  "ALLOWED_DEV_ORIGINS",
  "DEV_BYPASS_AUTH",
  "ELECTRON_RUN_AS_NODE",
] as const;

interface StreamLike {
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
}

export interface ChildLike {
  pid?: number;
  stdout: StreamLike | null;
  stderr: StreamLike | null;
  on(event: "exit", listener: (code: number | null, signal: string | null) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
}

export interface SpawnOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  shell: false;
  detached: true;
  stdio: ["ignore", "pipe", "pipe"];
}

export interface ProbeResponse {
  status: number;
}

export interface ProcessManagerDeps {
  spawn(command: string, args: string[], options: SpawnOptions): ChildLike;
  fetch(url: string, init: { signal: AbortSignal; redirect: "manual" }): Promise<ProbeResponse>;
  now(): number;
  sleep(ms: number): Promise<void>;
  /** Signals a whole process group. Signal 0 only checks existence. Throws ESRCH when gone. */
  killGroup(pid: number, signal: NodeJS.Signals | 0): void;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  fs: DirectoryFs;
  env: NodeJS.ProcessEnv;
  platform: string;
}

export type ProbeResult =
  | { kind: "up"; status: number }
  | { kind: "refused" }
  | { kind: "other"; reason: string };

function wildcard(host: string): boolean {
  const value = host.trim();
  return value === "" || value === "0.0.0.0" || value === "::" || value === "[::]";
}

export function probeHostFor(bindHost: string): string {
  const host = bindHost.trim();
  if (wildcard(host) || host.toLowerCase() === "localhost") return "127.0.0.1";
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

/**
 * The child's environment: the plugin's own env, with only the keys the console
 * reads set or cleared. DEV_BYPASS_AUTH exists only in dev mode with opt-in.
 */
export function buildChildEnv(
  base: NodeJS.ProcessEnv,
  options: { mode: ConsoleMode; allowedDevOrigins: string; noLoginMode: boolean },
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const key of MANAGED_ENV_KEYS) delete env[key];
  env.NODE_ENV = options.mode === "dev" ? "development" : "production";
  const origins = options.allowedDevOrigins.trim();
  if (origins !== "") env.ALLOWED_DEV_ORIGINS = origins;
  if (options.mode === "dev" && options.noLoginMode) env.DEV_BYPASS_AUTH = "true";
  return env;
}

export function buildCommand(
  mode: ConsoleMode,
  port: number,
  bindHost: string,
): { command: string; args: string[] } {
  return {
    command: "pnpm",
    args: ["exec", "next", mode === "dev" ? "dev" : "start", "-p", String(port), "-H", bindHost.trim()],
  };
}

interface Owned {
  child: ChildLike;
  pid: number;
  startedAt: number;
  port: number;
  mode: ConsoleMode;
  noLogin: boolean;
  exited: boolean;
  stopping: boolean;
}

interface LastExit {
  code: number | null;
  signal: string | null;
  at: number;
}

export class ProcessManager {
  private readonly logs: LogBuffer;
  private current: Owned | null = null;
  private lastExit: LastExit | null = null;
  private crashed = false;
  private spawnError: string | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly deps: ProcessManagerDeps,
    logs: LogBuffer = new LogBuffer({ maxLines: MAX_LOG_LINES }),
  ) {
    this.logs = logs;
  }

  /** Runs `task` after every earlier start/stop/restart has finished. */
  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  readLogs(lines?: number): { lines: string[]; total: number; capacity: number } {
    return {
      lines: this.logs.tail(lines ?? this.logs.capacity),
      total: this.logs.total,
      capacity: this.logs.capacity,
    };
  }

  isOwnedRunning(): boolean {
    return this.current !== null && !this.current.exited;
  }

  async probe(bindHost: string, port: number): Promise<ProbeResult> {
    const controller = new AbortController();
    const timer = this.deps.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      const response = await this.deps.fetch(`http://${probeHostFor(bindHost)}:${port}/login`, {
        signal: controller.signal,
        redirect: "manual",
      });
      return response.status >= 200 && response.status < 400
        ? { kind: "up", status: response.status }
        : { kind: "other", reason: `HTTP ${response.status}` };
    } catch (error) {
      const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
        (error as { code?: string })?.code;
      if (code === "ECONNREFUSED") return { kind: "refused" };
      return { kind: "other", reason: controller.signal.aborted ? "timeout" : code ?? "no answer" };
    } finally {
      this.deps.clearTimeout(timer);
    }
  }

  async status(
    config: ConsoleSettingsValues,
    extra: { settingsError?: string | null } = {},
  ): Promise<ConsoleStatus> {
    const owned = this.current && !this.current.exited ? this.current : null;
    const port = owned?.port ?? config.port;
    const mode = owned?.mode ?? config.mode;
    const bindHost = config.bindHost;
    const probe = await this.probe(bindHost, port);
    const reachable = probe.kind === "up";
    const configured = config.consoleDirectory.trim() !== "";

    let configError: string | null = null;
    if (configured) {
      const settingsErrors = validateSettings(config);
      const first = Object.values(settingsErrors)[0];
      if (first) configError = first;
      else {
        const check = validateConsoleDirectory(config.consoleDirectory, config.mode, this.deps.fs);
        if (!check.ok) configError = check.message;
      }
    }

    let state: ConsoleState;
    if (owned) {
      state = owned.stopping ? "stopping" : reachable ? "running" : "starting";
    } else if (reachable) {
      state = "external";
    } else if (this.crashed) {
      state = "crashed";
    } else {
      state = configured ? "stopped" : "not_configured";
    }

    return {
      state,
      configured,
      running: reachable,
      external: state === "external",
      reachable,
      pid: owned?.pid ?? null,
      uptimeSeconds: owned ? Math.max(0, Math.floor((this.deps.now() - owned.startedAt) / 1000)) : null,
      port,
      mode,
      noLoginActive: owned ? owned.noLogin : mode === "dev" && config.noLoginMode,
      bindHost: config.bindHost.trim(),
      autoStart: config.autoStart,
      urls: buildUrlCandidates({ port, bindHost, publicUrl: config.publicUrl }),
      configError,
      lastExit: this.lastExit,
      crashLines: state === "crashed" ? this.logs.tail(CRASH_LINES) : [],
      settingsError: extra.settingsError ?? null,
    };
  }

  start(config: ConsoleSettingsValues): Promise<ConsoleActionResult> {
    return this.serialize(() => this.doStart(config));
  }

  stop(config: ConsoleSettingsValues): Promise<ConsoleActionResult> {
    return this.serialize(() => this.doStop(config));
  }

  restart(config: ConsoleSettingsValues): Promise<ConsoleActionResult> {
    return this.serialize(async () => {
      const stopped = await this.doStop(config);
      if (!stopped.ok) return stopped;
      return this.doStart(config);
    });
  }

  /** Stops the owned child, if any. Called when the plugin unloads. */
  dispose(): Promise<void> {
    return this.serialize(async () => {
      await this.terminateOwned();
    });
  }

  private async result(
    config: ConsoleSettingsValues,
    ok: boolean,
    error: string | null,
    alreadyRunning = false,
  ): Promise<ConsoleActionResult> {
    return { ok, error, alreadyRunning, status: await this.status(config) };
  }

  private async doStart(config: ConsoleSettingsValues): Promise<ConsoleActionResult> {
    if (this.current && !this.current.exited) {
      return this.result(config, true, null, true);
    }
    if (this.deps.platform === "win32") {
      return this.result(config, false, "Starting the console from this plugin is not supported on Windows.");
    }
    const settingsErrors = validateSettings(config);
    const firstError = Object.values(settingsErrors)[0];
    if (firstError) return this.result(config, false, firstError);
    const check = validateConsoleDirectory(config.consoleDirectory, config.mode, this.deps.fs);
    if (!check.ok) return this.result(config, false, check.message);

    const probe = await this.probe(config.bindHost, config.port);
    if (probe.kind === "up") {
      // Something answers like the console. Never spawn a second one or touch it.
      return this.result(config, true, null, true);
    }
    if (probe.kind === "other") {
      return this.result(
        config,
        false,
        `Port ${config.port} is already in use by something that is not answering like the BMAD Console (${probe.reason}). Choose another port.`,
      );
    }

    const { command, args } = buildCommand(config.mode, config.port, config.bindHost);
    const env = buildChildEnv(this.deps.env, {
      mode: config.mode,
      allowedDevOrigins: config.allowedDevOrigins,
      noLoginMode: config.noLoginMode,
    });
    this.spawnError = null;
    this.crashed = false;
    this.lastExit = null;
    this.logs.clear();

    let child: ChildLike;
    try {
      child = this.deps.spawn(command, args, {
        cwd: check.directory,
        env,
        shell: false,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      return this.result(config, false, this.describeSpawnError(error));
    }

    const owned: Owned = {
      child,
      pid: child.pid ?? -1,
      startedAt: this.deps.now(),
      port: config.port,
      mode: config.mode,
      noLogin: config.mode === "dev" && config.noLoginMode,
      exited: false,
      stopping: false,
    };
    this.current = owned;
    child.stdout?.on("data", (chunk) => this.logs.push(String(chunk), "stdout"));
    child.stderr?.on("data", (chunk) => this.logs.push(String(chunk), "stderr"));
    child.on("error", (error) => {
      if (child.pid === undefined) {
        this.spawnError = this.describeSpawnError(error);
        this.handleExit(owned, null, null);
      } else {
        this.logs.note(`Process error: ${error.message}`);
      }
    });
    child.on("exit", (code, signal) => this.handleExit(owned, code, signal));

    if (child.pid === undefined) {
      await this.deps.sleep(SPAWN_ERROR_WAIT_MS);
      if (!owned.exited) this.handleExit(owned, null, null);
      return this.result(config, false, this.spawnError ?? "The console process could not be started.");
    }
    this.logs.note(
      `Started \`${command} ${args.join(" ")}\` (pid ${child.pid}, mode ${config.mode}${owned.noLogin ? ", login disabled" : ""}).`,
    );
    return this.result(config, true, null);
  }

  private describeSpawnError(error: unknown): string {
    const code = (error as { code?: string })?.code;
    if (code === "ENOENT") {
      return "Could not run `pnpm`: it was not found on the Paseo daemon's PATH, or the console directory is missing.";
    }
    return `Could not start the console: ${error instanceof Error ? error.message : String(error)}`;
  }

  private handleExit(owned: Owned, code: number | null, signal: string | null): void {
    if (owned.exited) return;
    owned.exited = true;
    this.logs.flush();
    this.lastExit = { code, signal, at: this.deps.now() };
    if (!owned.stopping) {
      this.crashed = true;
      this.logs.note(
        `Console exited unexpectedly (code ${code ?? "none"}, signal ${signal ?? "none"}). It will not be restarted automatically.`,
      );
      // The leader is gone; clean up anything it left behind in our own group.
      this.signalGroup(owned.pid, "SIGTERM");
    }
    if (this.current === owned) this.current = null;
  }

  private signalGroup(pid: number, signal: NodeJS.Signals | 0): boolean {
    if (pid <= 0) return false;
    try {
      this.deps.killGroup(pid, signal);
      return true;
    } catch {
      return false;
    }
  }

  private groupAlive(pid: number): boolean {
    return this.signalGroup(pid, 0);
  }

  private async waitUntilGone(owned: Owned, timeoutMs: number): Promise<boolean> {
    const deadline = this.deps.now() + timeoutMs;
    for (;;) {
      if (owned.exited && !this.groupAlive(owned.pid)) return true;
      if (this.deps.now() >= deadline) return false;
      await this.deps.sleep(POLL_MS);
    }
  }

  /** SIGTERM the group, SIGKILL after the grace period. Returns an error message on failure. */
  private async terminateOwned(): Promise<string | null> {
    const owned = this.current;
    if (!owned) return null;
    owned.stopping = true;
    this.signalGroup(owned.pid, "SIGTERM");
    if (await this.waitUntilGone(owned, STOP_GRACE_MS)) {
      this.finishStop(owned);
      return null;
    }
    this.logs.note(`Console did not stop within ${STOP_GRACE_MS / 1000}s; sending SIGKILL.`);
    this.signalGroup(owned.pid, "SIGKILL");
    if (await this.waitUntilGone(owned, KILL_WAIT_MS)) {
      this.finishStop(owned);
      return null;
    }
    return `Could not stop the console process (pid ${owned.pid}).`;
  }

  private finishStop(owned: Owned): void {
    owned.exited = true;
    this.crashed = false;
    if (this.current === owned) this.current = null;
    this.logs.note("Console stopped.");
  }

  private async doStop(config: ConsoleSettingsValues): Promise<ConsoleActionResult> {
    if (!this.current) {
      const status = await this.status(config);
      if (status.state === "external") {
        return {
          ok: false,
          error: "The console was not started by this plugin, so it will not be stopped from here.",
          alreadyRunning: true,
          status,
        };
      }
      this.crashed = false;
      return { ok: true, error: null, alreadyRunning: false, status };
    }
    const error = await this.terminateOwned();
    return this.result(config, error === null, error);
  }
}
