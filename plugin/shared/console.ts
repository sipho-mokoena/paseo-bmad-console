import { defineRpc, defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/** Package name the console checkout must declare in its package.json. */
export const CONSOLE_PACKAGE_NAME = "paseo-bmad-console";
export const DEFAULT_PORT = 7002;
export const MIN_PORT = 1024;
export const MAX_PORT = 65535;
export const MAX_LOG_LINES = 300;

export type ConsoleMode = "dev" | "start";

export interface ConsoleSettingsValues {
  consoleDirectory: string;
  port: number;
  mode: ConsoleMode;
  bindHost: string;
  publicUrl: string;
  allowedDevOrigins: string;
  autoStart: boolean;
  /** UI only: the workspace the Open button last used. Optional so older documents stay valid. */
  lastWorkspaceId?: string;
}

export type SettingsErrors = Partial<Record<keyof ConsoleSettingsValues, string>>;

const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const HOST_PATTERN = /^[A-Za-z0-9._:-]+$/;
const ORIGINS_PATTERN = /^[A-Za-z0-9._:*,\s-]*$/;

export function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || WINDOWS_ABSOLUTE.test(value) || value.startsWith("\\\\");
}

export function isLoopbackHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return value === "localhost" || value === "::1" || value === "[::1]" || /^127\./.test(value);
}

function isWildcardHost(host: string): boolean {
  const value = host.trim();
  return value === "" || value === "0.0.0.0" || value === "::" || value === "[::]";
}

/** Pure validation shared by the settings schema, the client form and the server. */
export function validateSettings(values: ConsoleSettingsValues): SettingsErrors {
  const errors: SettingsErrors = {};
  const directory = values.consoleDirectory.trim();
  if (directory !== "" && (!isAbsolutePath(directory) || directory.includes("\0"))) {
    errors.consoleDirectory = "Enter an absolute path to the console checkout.";
  }
  if (!Number.isInteger(values.port) || values.port < MIN_PORT || values.port > MAX_PORT) {
    errors.port = `Enter a port from ${MIN_PORT} to ${MAX_PORT}.`;
  }
  const bindHost = values.bindHost.trim();
  if (bindHost === "" || !HOST_PATTERN.test(bindHost)) {
    errors.bindHost = "Enter a host name or IP address, for example 127.0.0.1.";
  }
  const publicUrl = values.publicUrl.trim();
  if (publicUrl !== "") {
    let valid = false;
    try {
      const parsed = new URL(publicUrl);
      valid = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      valid = false;
    }
    if (!valid) errors.publicUrl = "Enter a full http:// or https:// URL, or leave it empty.";
  }
  if (!ORIGINS_PATTERN.test(values.allowedDevOrigins)) {
    errors.allowedDevOrigins = "Use a comma separated list of host names or IP addresses.";
  }
  return errors;
}

export const consoleSettings = defineSettings({
  id: "console",
  scope: "host",
  version: 1,
  schema: z
    // Not strict: unknown keys (for example an old `noLoginMode`) are ignored, so
    // documents written by earlier versions keep validating.
    .object({
      consoleDirectory: z.string().default(""),
      port: z.number().default(DEFAULT_PORT),
      mode: z.enum(["dev", "start"]).default("start"),
      bindHost: z.string().default("127.0.0.1"),
      publicUrl: z.string().default(""),
      allowedDevOrigins: z.string().default(""),
      autoStart: z.boolean().default(false),
      lastWorkspaceId: z.string().default(""),
    })
    .superRefine((values, ctx) => {
      for (const [field, message] of Object.entries(validateSettings(values))) {
        ctx.addIssue({ code: "custom", path: [field], message });
      }
    }),
});

export type UrlKind = "local" | "bind" | "public";

export interface UrlCandidate {
  kind: UrlKind;
  label: string;
  url: string;
}

export interface UrlCandidates {
  local: string;
  public: string | null;
  /** Local, bind-address and public URLs, deduplicated, in display order. */
  all: UrlCandidate[];
  /** The URL to hand to other devices: the public URL when set, else the local one. */
  preferred: string;
}

/** Strips whitespace and trailing slashes; returns "" when nothing usable remains. */
export function normalizePublicUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function buildUrlCandidates(input: {
  port: number;
  bindHost: string;
  publicUrl: string;
}): UrlCandidates {
  const local = `http://127.0.0.1:${input.port}`;
  const publicUrl = normalizePublicUrl(input.publicUrl);
  const all: UrlCandidate[] = [{ kind: "local", label: "Local", url: local }];
  const bindHost = input.bindHost.trim();
  if (!isLoopbackHost(bindHost) && !isWildcardHost(bindHost)) {
    const host = bindHost.includes(":") && !bindHost.startsWith("[") ? `[${bindHost}]` : bindHost;
    all.push({ kind: "bind", label: "Bind address", url: `http://${host}:${input.port}` });
  }
  if (publicUrl !== "" && !all.some((candidate) => candidate.url === publicUrl)) {
    all.push({ kind: "public", label: "Public", url: publicUrl });
  }
  return {
    local,
    public: publicUrl === "" ? null : publicUrl,
    all,
    preferred: publicUrl === "" ? local : publicUrl,
  };
}

export const consoleStateSchema = z.enum([
  "not_configured",
  "stopped",
  "starting",
  "running",
  "external",
  "stopping",
  "crashed",
]);
export type ConsoleState = z.infer<typeof consoleStateSchema>;

const urlCandidatesSchema = z.object({
  local: z.string(),
  public: z.string().nullable(),
  all: z.array(z.object({ kind: z.enum(["local", "bind", "public"]), label: z.string(), url: z.string() })),
  preferred: z.string(),
});

export const consoleStatusSchema = z.object({
  state: consoleStateSchema,
  configured: z.boolean(),
  /** True when the console answers, whether this plugin started it or not. */
  running: z.boolean(),
  /** True when the console answers but this plugin did not start it. */
  external: z.boolean(),
  reachable: z.boolean(),
  pid: z.number().nullable(),
  uptimeSeconds: z.number().nullable(),
  port: z.number(),
  mode: z.enum(["dev", "start"]),
  bindHost: z.string(),
  autoStart: z.boolean(),
  urls: urlCandidatesSchema,
  /** Why the current settings cannot start the console, if they cannot. */
  configError: z.string().nullable(),
  lastExit: z
    .object({ code: z.number().nullable(), signal: z.string().nullable(), at: z.number() })
    .nullable(),
  /** Last log lines, only filled in after a crash. */
  crashLines: z.array(z.string()),
  /** Set when the settings document itself cannot be read. */
  settingsError: z.string().nullable(),
});
export type ConsoleStatus = z.infer<typeof consoleStatusSchema>;

const emptyInput = z.object({});

export const statusRpc = defineRpc({
  name: "bmad-console.status",
  input: emptyInput,
  output: consoleStatusSchema,
});

const actionOutput = z.object({
  ok: z.boolean(),
  /** Human readable reason when `ok` is false. */
  error: z.string().nullable(),
  /** True when the console was already up, started by this plugin or not. */
  alreadyRunning: z.boolean(),
  status: consoleStatusSchema,
});
export type ConsoleActionResult = z.infer<typeof actionOutput>;

export const startRpc = defineRpc({
  name: "bmad-console.start",
  input: emptyInput,
  output: actionOutput,
});
export const stopRpc = defineRpc({
  name: "bmad-console.stop",
  input: emptyInput,
  output: actionOutput,
});
export const restartRpc = defineRpc({
  name: "bmad-console.restart",
  input: emptyInput,
  output: actionOutput,
});

export const logsRpc = defineRpc({
  name: "bmad-console.logs",
  input: z.object({ lines: z.number().int().min(1).max(MAX_LOG_LINES).optional() }),
  output: z.object({ lines: z.array(z.string()), total: z.number(), capacity: z.number() }),
});

export function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
