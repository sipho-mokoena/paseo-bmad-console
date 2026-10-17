import { describe, expect, it } from "vitest";
import { actionsFor, hasChanges, normalizeValues, pickWorkspace, statusChip, statusRow } from "../client/logic";
import { consoleSettings, type ConsoleSettingsValues, type ConsoleStatus } from "../shared/console";

const defaults = consoleSettings.schema.parse({}) as ConsoleSettingsValues;

function status(patch: Partial<ConsoleStatus>): ConsoleStatus {
  return {
    state: "stopped",
    configured: true,
    running: false,
    external: false,
    reachable: false,
    pid: null,
    uptimeSeconds: null,
    port: 3002,
    mode: "dev",
    noLoginActive: false,
    bindHost: "127.0.0.1",
    autoStart: false,
    urls: { local: "http://127.0.0.1:3002", public: null, all: [], preferred: "http://127.0.0.1:3002" },
    configError: null,
    lastExit: null,
    crashLines: [],
    settingsError: null,
    ...patch,
  };
}

describe("actionsFor", () => {
  it("offers Start when stopped or crashed, blocked by a config error", () => {
    expect(actionsFor({ state: "stopped", configError: null })).toEqual({ start: { disabled: false }, restart: null, stop: false });
    expect(actionsFor({ state: "crashed", configError: null }).start).toEqual({ disabled: false });
    expect(actionsFor({ state: "stopped", configError: "bad" }).start).toEqual({ disabled: true });
  });
  it("shows a disabled Start when not configured", () => {
    expect(actionsFor({ state: "not_configured", configError: null }).start).toEqual({ disabled: true });
  });
  it("offers Restart and Stop when the plugin runs it", () => {
    expect(actionsFor({ state: "running", configError: null })).toEqual({ start: null, restart: { disabled: false }, stop: true });
  });
  it("offers nothing when started outside Paseo or changing state", () => {
    for (const state of ["external", "starting", "stopping"] as const) {
      expect(actionsFor({ state, configError: null })).toEqual({ start: null, restart: null, stop: false });
    }
  });
});

describe("statusChip and statusRow", () => {
  it("labels every state", () => {
    expect(statusChip("external")).toEqual({ label: "Running", tone: "success" });
    expect(statusChip("crashed").tone).toBe("danger");
    expect(statusChip("not_configured").label).toBe("Not configured");
  });
  it("describes the Status row", () => {
    expect(statusRow(status({ state: "running", pid: 1234 }))).toEqual({ value: "running", hint: "PID 1234" });
    expect(statusRow(status({ state: "external" })).hint).toContain("outside Paseo");
    expect(statusRow(status({ state: "not_configured" }))).toEqual({
      value: "Not configured",
      hint: "Choose the console folder below",
    });
    expect(statusRow(status({ state: "crashed", lastExit: { code: 1, signal: null, at: 0 } })).hint).toContain("code 1");
  });
});

describe("pickWorkspace", () => {
  it("prefers the requested workspace, else the first", () => {
    expect(pickWorkspace("b", [{ id: "a" }, { id: "b" }])).toBe("b");
    expect(pickWorkspace(null, [{ id: "a" }, { id: "b" }])).toBe("a");
    expect(pickWorkspace(null, [])).toBeNull();
  });
});

describe("hasChanges", () => {
  it("ignores surrounding whitespace", () => {
    expect(hasChanges(defaults, { ...defaults, bindHost: " 127.0.0.1 " })).toBe(false);
    expect(hasChanges(defaults, { ...defaults, port: 3003 })).toBe(true);
    expect(normalizeValues({ ...defaults, publicUrl: " https://x " }).publicUrl).toBe("https://x");
  });
});
