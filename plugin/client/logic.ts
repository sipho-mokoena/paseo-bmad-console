import type { ConsoleSettingsValues, ConsoleState, ConsoleStatus } from "../shared/console";

/** Pure UI decisions, free of React so they can be tested. */

export type ChipTone = "success" | "warning" | "danger" | "muted";

export function statusChip(state: ConsoleState): { label: string; tone: ChipTone } {
  switch (state) {
    case "running":
    case "external":
      return { label: "Running", tone: "success" };
    case "starting":
      return { label: "Starting", tone: "warning" };
    case "stopping":
      return { label: "Stopping", tone: "warning" };
    case "crashed":
      return { label: "Crashed", tone: "danger" };
    case "stopped":
      return { label: "Stopped", tone: "muted" };
    case "not_configured":
      return { label: "Not configured", tone: "muted" };
  }
}

/** Right-hand value and hint of the Status row. */
export function statusRow(status: ConsoleStatus): { value: string; hint: string | undefined } {
  if (status.settingsError) return { value: "error", hint: status.settingsError };
  switch (status.state) {
    case "not_configured":
      return { value: "Not configured", hint: "Choose the console folder below" };
    case "running":
      return { value: "running", hint: status.pid === null ? undefined : `PID ${status.pid}` };
    case "external":
      return { value: "running", hint: "Started outside Paseo, so Paseo will not stop it" };
    case "starting":
      return { value: "starting", hint: "Waiting for the console to answer" };
    case "stopping":
      return { value: "stopping", hint: undefined };
    case "crashed": {
      const { code, signal } = status.lastExit ?? { code: null, signal: null };
      const how = signal ? `signal ${signal}` : code !== null ? `code ${code}` : "an error";
      return { value: "crashed", hint: `Stopped unexpectedly (${how}). See the logs.` };
    }
    case "stopped":
      return { value: "stopped", hint: status.configError ?? undefined };
  }
}

export interface ActionsToShow {
  start: { disabled: boolean } | null;
  restart: { disabled: boolean } | null;
  stop: boolean;
}

/** Which of Start, Restart and Stop apply to the state. */
export function actionsFor(status: Pick<ConsoleStatus, "state" | "configError">): ActionsToShow {
  const blocked = status.configError !== null || status.state === "not_configured";
  switch (status.state) {
    case "not_configured":
    case "stopped":
    case "crashed":
      return { start: { disabled: blocked }, restart: null, stop: false };
    case "running":
      return { start: null, restart: { disabled: blocked }, stop: true };
    default:
      return { start: null, restart: null, stop: false };
  }
}

/** The workspace for the Paseo browser tab: the one the page was opened for, else the first. */
export function pickWorkspace(
  requestedId: string | null | undefined,
  entries: readonly { id: string }[],
): string | null {
  if (requestedId) return requestedId;
  return entries[0]?.id ?? null;
}

export function normalizeValues(values: ConsoleSettingsValues): ConsoleSettingsValues {
  return {
    ...values,
    consoleDirectory: values.consoleDirectory.trim(),
    bindHost: values.bindHost.trim(),
    publicUrl: values.publicUrl.trim(),
    allowedDevOrigins: values.allowedDevOrigins.trim(),
  };
}

/** True when the draft differs from what is saved, ignoring surrounding whitespace. */
export function hasChanges(saved: ConsoleSettingsValues, draft: ConsoleSettingsValues): boolean {
  const a = normalizeValues(saved);
  const b = normalizeValues(draft);
  return (Object.keys(a) as (keyof ConsoleSettingsValues)[]).some((key) => !Object.is(a[key], b[key]));
}
