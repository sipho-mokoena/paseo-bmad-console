import { isLoopbackHost, validateSettings, type ConsoleSettingsValues, type ConsoleState, type ConsoleStatus, isAbsolutePath } from "../shared/console";

/** Pure UI decisions. Kept free of React so they can be tested. */

export type ActionId = "start" | "open" | "restart" | "stop" | "starting" | "stopping";

export interface VisibleAction {
  id: ActionId;
  primary: boolean;
  /** Shown but not pressable (a spinner while the console changes state, or a blocked start). */
  disabled: boolean;
  pending: boolean;
}

export function visibleActions(
  status: Pick<ConsoleStatus, "state" | "configError">,
): VisibleAction[] {
  const blocked = status.configError !== null;
  switch (status.state) {
    case "not_configured":
      return [];
    case "stopped":
    case "crashed":
      return [{ id: "start", primary: true, disabled: blocked, pending: false }];
    case "starting":
      return [{ id: "starting", primary: true, disabled: true, pending: true }];
    case "stopping":
      return [{ id: "stopping", primary: true, disabled: true, pending: true }];
    case "running":
      return [
        { id: "open", primary: true, disabled: false, pending: false },
        { id: "restart", primary: false, disabled: blocked, pending: false },
        { id: "stop", primary: false, disabled: false, pending: false },
      ];
    case "external":
      return [{ id: "open", primary: true, disabled: false, pending: false }];
  }
}

export const ACTION_LABEL: Record<ActionId, string> = {
  start: "Start",
  open: "Open",
  restart: "Restart",
  stop: "Stop",
  starting: "Starting",
  stopping: "Stopping",
};

export type PillTone = "success" | "warning" | "danger" | "muted";

export function statusPill(state: ConsoleState): { label: string; tone: PillTone } {
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

export function formatUptimeShort(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total >= 3600) return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  if (total >= 60) return `${Math.floor(total / 60)}m`;
  return `${total}s`;
}

/** "Port 3002 · dev", plus the uptime while the plugin owns the process. */
export function statusSubtitle(
  status: Pick<ConsoleStatus, "state" | "port" | "mode" | "uptimeSeconds">,
): string {
  if (status.state === "not_configured") return "Not set up yet";
  const parts = [`Port ${status.port}`, status.mode];
  if (status.state === "running" && status.uptimeSeconds !== null) {
    parts.push(`up ${formatUptimeShort(status.uptimeSeconds)}`);
  }
  return parts.join(" · ");
}

/** The one muted line that explains the state, or null when the state needs no explanation. */
export function statusNote(status: ConsoleStatus): { tone: "muted" | "danger" | "warning"; text: string } | null {
  if (status.settingsError) return { tone: "danger", text: status.settingsError };
  switch (status.state) {
    case "external":
      return {
        tone: "muted",
        text: "Running (started outside Paseo). Paseo can open it but will not stop it.",
      };
    case "starting":
      return { tone: "muted", text: "Waiting for the console to answer. The first start can take a while." };
    case "crashed": {
      const code = status.lastExit?.code;
      const signal = status.lastExit?.signal;
      const how = signal ? `signal ${signal}` : code !== null && code !== undefined ? `code ${code}` : "an error";
      return { tone: "danger", text: `The console stopped unexpectedly (${how}). Start it again, or check the logs.` };
    }
    case "stopped":
      return status.configError ? { tone: "danger", text: status.configError } : null;
    case "running":
      return status.noLoginActive ? { tone: "warning", text: "Login is disabled for this run (no-login mode)." } : null;
    default:
      return null;
  }
}

export function isRunningState(state: ConsoleState): boolean {
  return state === "running" || state === "external";
}

export interface WorkspaceEntry {
  id: string;
  name: string;
}

/** Best workspace for the Paseo browser: the one asked for, the last used, then the first. */
export function pickWorkspace(input: {
  requestedId: string | null | undefined;
  rememberedId: string | null | undefined;
  entries: readonly WorkspaceEntry[];
}): string | null {
  const known = (id: string | null | undefined) =>
    id ? input.entries.some((entry) => entry.id === id) : false;
  if (input.requestedId) {
    // A workspace passed in by the caller is trusted even before the list loads.
    return input.entries.length === 0 || known(input.requestedId) ? input.requestedId : fallback(input);
  }
  return fallback(input);
}

function fallback(input: {
  rememberedId: string | null | undefined;
  entries: readonly WorkspaceEntry[];
}): string | null {
  if (input.rememberedId && input.entries.some((entry) => entry.id === input.rememberedId)) {
    return input.rememberedId;
  }
  return input.entries[0]?.id ?? null;
}

export function normalizeValues(
  values: ConsoleSettingsValues,
): ConsoleSettingsValues & { lastWorkspaceId: string } {
  return {
    ...values,
    consoleDirectory: values.consoleDirectory.trim(),
    bindHost: values.bindHost.trim(),
    publicUrl: values.publicUrl.trim(),
    allowedDevOrigins: values.allowedDevOrigins.trim(),
    lastWorkspaceId: values.lastWorkspaceId ?? "",
  };
}

/** True when the draft differs from what is saved, ignoring surrounding whitespace. */
export function hasUnsavedChanges(saved: ConsoleSettingsValues, draft: ConsoleSettingsValues | null): boolean {
  if (draft === null) return false;
  const a = normalizeValues(saved);
  const b = normalizeValues(draft);
  return (Object.keys(a) as (keyof ConsoleSettingsValues)[]).some((key) => !Object.is(a[key], b[key]));
}

export type SettingsGroupId = "console" | "network" | "behavior" | "security";

export const SETTINGS_GROUPS: readonly {
  id: SettingsGroupId;
  title: string;
  fields: readonly (keyof ConsoleSettingsValues)[];
}[] = [
  { id: "console", title: "Console", fields: ["consoleDirectory", "mode"] },
  { id: "network", title: "Network", fields: ["port", "bindHost", "publicUrl", "allowedDevOrigins"] },
  { id: "behavior", title: "Behavior", fields: ["autoStart"] },
  { id: "security", title: "Security", fields: ["noLoginMode"] },
];

/** Which groups contain a validation error, in display order. */
export function groupsWithErrors(values: ConsoleSettingsValues): SettingsGroupId[] {
  const errors = validateSettings(values);
  return SETTINGS_GROUPS.filter((group) => group.fields.some((field) => errors[field] !== undefined)).map(
    (group) => group.id,
  );
}

/** Folder step of onboarding. Empty is "not yet", so no message until the user submits. */
export function validateFolder(text: string, submitted: boolean): string | null {
  const value = text.trim();
  if (value === "") return submitted ? "Enter the folder where paseo-bmad-console is checked out." : null;
  if (value.includes("\0") || !isAbsolutePath(value)) {
    return "Use the full path, starting with / (or a drive letter on Windows).";
  }
  return null;
}

export function noLoginWarning(values: Pick<ConsoleSettingsValues, "noLoginMode" | "bindHost" | "mode">): string {
  if (!values.noLoginMode) {
    return "Skips the login screen. Only for a trusted machine, on the local address, in dev mode.";
  }
  if (!isLoopbackHost(values.bindHost)) return "No-login mode needs the bind host to be 127.0.0.1 or localhost.";
  if (values.mode !== "dev") return "No-login mode is on, but it only applies in dev mode and is ignored in start mode.";
  return "Login is off. Anyone who can reach this machine's console can use it.";
}
