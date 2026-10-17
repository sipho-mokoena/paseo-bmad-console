import { consoleSettings, type ConsoleActionResult, type ConsoleSettingsValues, type ConsoleStatus } from "../shared/console";
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

/** RPC-facing operations: read the saved settings, then delegate to the process manager. */
export function createService(manager: ProcessManager, settings: SettingsReader) {
  async function load(): Promise<
    { ok: true; values: ConsoleSettingsValues } | { ok: false; error: string }
  > {
    const state = await settings.read();
    if (state.status === "ready") return { ok: true, values: state.values };
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
