import { describe, expect, it } from "vitest";
import {
  groupsWithErrors,
  hasUnsavedChanges,
  noLoginWarning,
  pickWorkspace,
  statusNote,
  statusPill,
  statusSubtitle,
  validateFolder,
  visibleActions,
} from "../client/logic";
import { consoleSettings, type ConsoleSettingsValues, type ConsoleState, type ConsoleStatus } from "../shared/console";

const defaults = consoleSettings.schema.parse({}) as ConsoleSettingsValues;
const ids = (state: ConsoleState, configError: string | null = null) =>
  visibleActions({ state, configError }).map((a) => a.id);

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

describe("visibleActions", () => {
  it("shows only what makes sense per state", () => {
    expect(ids("not_configured")).toEqual([]);
    expect(ids("stopped")).toEqual(["start"]);
    expect(ids("crashed")).toEqual(["start"]);
    expect(ids("starting")).toEqual(["starting"]);
    expect(ids("stopping")).toEqual(["stopping"]);
    expect(ids("running")).toEqual(["open", "restart", "stop"]);
    expect(ids("external")).toEqual(["open"]);
  });
  it("makes Open the only primary action while running", () => {
    const primary = visibleActions({ state: "running", configError: null }).filter((a) => a.primary);
    expect(primary.map((a) => a.id)).toEqual(["open"]);
  });
  it("shows transitional states as a disabled spinner", () => {
    const [starting] = visibleActions({ state: "starting", configError: null });
    expect(starting).toMatchObject({ disabled: true, pending: true });
  });
  it("disables Start while the settings cannot start the console", () => {
    expect(visibleActions({ state: "stopped", configError: "bad" })[0].disabled).toBe(true);
  });
});

describe("status text", () => {
  it("maps states to pill labels", () => {
    expect(statusPill("external")).toEqual({ label: "Running", tone: "success" });
    expect(statusPill("crashed").tone).toBe("danger");
    expect(statusPill("not_configured").label).toBe("Not configured");
  });
  it("builds the subtitle", () => {
    expect(statusSubtitle(status({ state: "stopped" }))).toBe("Port 3002 · dev");
    expect(statusSubtitle(status({ state: "running", uptimeSeconds: 125 }))).toBe("Port 3002 · dev · up 2m");
  });
  it("explains an external console once", () => {
    expect(statusNote(status({ state: "external" }))?.text).toMatch(/started outside Paseo/);
    expect(statusNote(status({ state: "running" }))).toBeNull();
  });
  it("summarises a crash", () => {
    const note = statusNote(status({ state: "crashed", lastExit: { code: 1, signal: null, at: 0 } }));
    expect(note?.tone).toBe("danger");
    expect(note?.text).toMatch(/code 1/);
  });
});

describe("pickWorkspace", () => {
  const entries = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ];
  it("prefers the requested workspace", () => {
    expect(pickWorkspace({ requestedId: "c", rememberedId: "b", entries })).toBe("c");
  });
  it("falls back to the remembered one, then the first", () => {
    expect(pickWorkspace({ requestedId: null, rememberedId: "b", entries })).toBe("b");
    expect(pickWorkspace({ requestedId: null, rememberedId: "gone", entries })).toBe("a");
    expect(pickWorkspace({ requestedId: "", rememberedId: "", entries })).toBe("a");
  });
  it("ignores a requested workspace that no longer exists", () => {
    expect(pickWorkspace({ requestedId: "zzz", rememberedId: "b", entries })).toBe("b");
  });
  it("trusts the requested workspace before the list loads and returns null with nothing", () => {
    expect(pickWorkspace({ requestedId: "x", rememberedId: "", entries: [] })).toBe("x");
    expect(pickWorkspace({ requestedId: null, rememberedId: "", entries: [] })).toBeNull();
  });
});

describe("hasUnsavedChanges", () => {
  it("is false without a draft or when the draft equals the saved values", () => {
    expect(hasUnsavedChanges(defaults, null)).toBe(false);
    expect(hasUnsavedChanges(defaults, { ...defaults })).toBe(false);
  });
  it("ignores surrounding whitespace and a missing lastWorkspaceId", () => {
    const { lastWorkspaceId: _omit, ...rest } = defaults;
    expect(hasUnsavedChanges(defaults, { ...rest, publicUrl: "  " })).toBe(false);
  });
  it("detects real edits and a reverted edit", () => {
    expect(hasUnsavedChanges(defaults, { ...defaults, port: 3003 })).toBe(true);
    expect(hasUnsavedChanges(defaults, { ...defaults, autoStart: true })).toBe(true);
    expect(hasUnsavedChanges(defaults, { ...defaults, port: defaults.port })).toBe(false);
  });
});

describe("settings validation messages", () => {
  it("places errors in their group", () => {
    expect(groupsWithErrors({ ...defaults, port: 80, consoleDirectory: "rel" })).toEqual(["console", "network"]);
    expect(groupsWithErrors({ ...defaults, noLoginMode: true, bindHost: "0.0.0.0" })).toEqual(["security"]);
    expect(groupsWithErrors(defaults)).toEqual([]);
  });
  it("validates the onboarding folder", () => {
    expect(validateFolder("", false)).toBeNull();
    expect(validateFolder("", true)).toMatch(/Enter the folder/);
    expect(validateFolder("relative/path", false)).toMatch(/full path/);
    expect(validateFolder("  /home/me/console  ", true)).toBeNull();
  });
  it("words the no-login warning for each situation", () => {
    expect(noLoginWarning({ noLoginMode: false, bindHost: "127.0.0.1", mode: "dev" })).toMatch(/trusted machine/);
    expect(noLoginWarning({ noLoginMode: true, bindHost: "0.0.0.0", mode: "dev" })).toMatch(/127\.0\.0\.1/);
    expect(noLoginWarning({ noLoginMode: true, bindHost: "127.0.0.1", mode: "start" })).toMatch(/dev mode/);
    expect(noLoginWarning({ noLoginMode: true, bindHost: "127.0.0.1", mode: "dev" })).toMatch(/Login is off/);
  });
});
