import { consoleSettings, isWildcardHost, type ConsoleActionResult, type ConsoleSettingsValues, type ConsoleStatus } from "../shared/console";
import type { ProcessManager } from "./process-manager";

type SettingsRead =
  | { status: "ready"; values: ConsoleSettingsValues }
  | { status: "invalid"; error: string }
  | { status: "error"; error: string }
  | { status: "loading" };

export interface SettingsReader {
  read(): Promise<SettingsRead>;
}

export const DEFAULT_SETTINGS: ConsoleSettingsValues = consoleSettings.schema.parse({});

/** Things the plugin works out by itself so the user does not have to type them. */
export interface Detectors {
  /** The console checkout, found next to the plugin or in a common place. */
  directory(): string | null;
  /** This machine's address for other devices (Tailscale first, then LAN). */
  networkAddress(): string | null;
}

const NO_DETECTION: Detectors = { directory: () => null, networkAddress: () => null };

/** RPC-facing operations: read the saved settings, then delegate to the process manager. */
export function createService(manager: ProcessManager, settings: SettingsReader, detect: Detectors = NO_DETECTION) {
  /** Fills in what the user left empty. Saved values always win over detected ones. */
  function withDetected(values: ConsoleSettingsValues): ConsoleSettingsValues {
    const next = { ...values };
    if (next.consoleDirectory.trim() === "") next.consoleDirectory = detect.directory() ?? "";
    if (next.publicUrl.trim() === "" && isWildcardHost(next.bindHost)) {
      const address = detect.networkAddress();
      if (address) next.publicUrl = `http://${address}:${next.port}`;
    }
    return next;
  }

  async function load(): Promise<
    { ok: true; values: ConsoleSettingsValues } | { ok: false; error: string }
  > {
    const state = await settings.read();
    // The console always runs as a production build; an older saved `dev` mode is ignored.
    if (state.status === "ready") return { ok: true, values: withDetected({ ...state.values, mode: "start" }) };
    return {
      ok: false,
      error:
        state.status === "loading"
          ? "Settings are still loading."
          : `The plugin settings could not be read: ${state.error}`,
    };
  }

  async function failed(error: string): Promise<ConsoleActionResult> {
    return {
      ok: false,
      error,
      alreadyRunning: false,
      status: await manager.status(DEFAULT_SETTINGS, { settingsError: error }),
    };
  }

  return {
    async status(): Promise<ConsoleStatus> {
      const loaded = await load();
      return loaded.ok
        ? manager.status(loaded.values)
        : manager.status(DEFAULT_SETTINGS, { settingsError: loaded.error });
    },
    async start(): Promise<ConsoleActionResult> {
      const loaded = await load();
      return loaded.ok ? manager.start(loaded.values) : failed(loaded.error);
    },
    async stop(): Promise<ConsoleActionResult> {
      const loaded = await load();
      return manager.stop(loaded.ok ? loaded.values : DEFAULT_SETTINGS);
    },
    async restart(): Promise<ConsoleActionResult> {
      const loaded = await load();
      return loaded.ok ? manager.restart(loaded.values) : failed(loaded.error);
    },
    logs(lines?: number) {
      return manager.readLogs(lines);
    },
  };
}
