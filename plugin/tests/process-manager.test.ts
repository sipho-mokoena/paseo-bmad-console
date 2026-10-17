import { describe, expect, it } from "vitest";
import {
  buildChildEnv,
  buildCommand,
  KILL_WAIT_MS,
  MANAGED_ENV_KEYS,
  STOP_GRACE_MS,
} from "../server/process-manager";
import { baseConfig, DIR, makeFs, makeHarness } from "./fakes";

describe("start", () => {
  it("spawns pnpm exec next dev without a shell, detached, in the console directory", async () => {
    const h = makeHarness();
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(true);
    expect(result.alreadyRunning).toBe(false);
    expect(h.spawned).toHaveLength(1);
    const call = h.spawned[0];
    expect(call.command).toBe("pnpm");
    expect(call.args).toEqual(["exec", "next", "dev", "-p", "3011", "-H", "127.0.0.1"]);
    expect(call.options.shell).toBe(false);
    expect(call.options.detached).toBe(true);
    expect(call.options.cwd).toBe(DIR);
    expect(result.status.pid).toBe(call.child.pid);
    expect(result.status.state).toBe("starting");
  });

  it("uses next start in start mode when a build exists", async () => {
    const h = makeHarness();
    await h.manager.start({ ...baseConfig, mode: "start", bindHost: "0.0.0.0" });
    expect(h.spawned[0].args).toEqual(["exec", "next", "start", "-p", "3011", "-H", "0.0.0.0"]);
    expect(h.spawned[0].options.env.NODE_ENV).toBe("production");
  });

  it("reports running once the probe answers", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    h.probe.mode = "up";
    h.clock.now += 65_000;
    const status = await h.manager.status(baseConfig);
    expect(status.state).toBe("running");
    expect(status.running).toBe(true);
    expect(status.external).toBe(false);
    expect(status.uptimeSeconds).toBe(65);
  });

  it("does not spawn twice on a double start", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    const second = await h.manager.start(baseConfig);
    expect(second.ok).toBe(true);
    expect(second.alreadyRunning).toBe(true);
    expect(h.spawned).toHaveLength(1);
  });

  it("serialises concurrent starts", async () => {
    const h = makeHarness();
    const [a, b] = await Promise.all([h.manager.start(baseConfig), h.manager.start(baseConfig)]);
    expect(a.ok && b.ok).toBe(true);
    expect(h.spawned).toHaveLength(1);
  });

  it("detects an externally started console and does not spawn or kill it", async () => {
    const h = makeHarness();
    h.probe.mode = "up";
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(true);
    expect(result.alreadyRunning).toBe(true);
    expect(result.status.state).toBe("external");
    expect(result.status.external).toBe(true);
    expect(result.status.pid).toBeNull();
    expect(h.spawned).toHaveLength(0);

    const stop = await h.manager.stop(baseConfig);
    expect(stop.ok).toBe(false);
    expect(stop.error).toMatch(/not started by this plugin/);
    expect(h.signals).toHaveLength(0);
  });

  it("refuses to spawn when the port answers with something that is not the console", async () => {
    const h = makeHarness();
    h.probe.mode = "status";
    h.probe.status = 404;
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already in use/);
    expect(h.spawned).toHaveLength(0);
  });

  it("refuses to spawn when the port does not answer in time", async () => {
    const h = makeHarness();
    h.probe.mode = "timeout";
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(false);
    expect(h.spawned).toHaveLength(0);
  });

  it("returns a clear error in start mode without a build", async () => {
    const h = makeHarness({ fs: makeFs({ [`${DIR}/.next/BUILD_ID`]: null }) });
    const result = await h.manager.start({ ...baseConfig, mode: "start" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pnpm build/);
    expect(h.spawned).toHaveLength(0);
  });

  it("reports a spawn failure such as a missing pnpm and leaves nothing running", async () => {
    const h = makeHarness({ failSpawn: true });
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pnpm/);
    expect(result.status.pid).toBeNull();
    expect(h.manager.isOwnedRunning()).toBe(false);
  });
});

describe("directory validation", () => {
  const cases: Array<[string, Record<string, string | null>, Partial<typeof baseConfig>, RegExp]> = [
    ["empty directory", {}, { consoleDirectory: "" }, /Set the console directory/],
    ["relative path", {}, { consoleDirectory: "paseo-bmad-console" }, /absolute/],
    ["missing directory", {}, { consoleDirectory: "/nope" }, /does not exist/],
    ["no package.json", { [`${DIR}/package.json`]: null }, {}, /No package.json/],
    ["invalid package.json", { [`${DIR}/package.json`]: "{" }, {}, /not valid JSON/],
    [
      "wrong package name",
      { [`${DIR}/package.json`]: JSON.stringify({ name: "other" }) },
      {},
      /not the Paseo BMAD Console/,
    ],
    ["no next.config.ts", { [`${DIR}/next.config.ts`]: null }, {}, /next\.config\.ts/],
    [
      "dependencies missing",
      { [`${DIR}/node_modules/next/package.json`]: null },
      {},
      /pnpm install/,
    ],
  ];
  it.each(cases)("rejects %s", async (_name, files, override, pattern) => {
    const h = makeHarness({ fs: makeFs(files) });
    const result = await h.manager.start({ ...baseConfig, ...override });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(pattern);
    expect(h.spawned).toHaveLength(0);
  });

  it("reports not configured when no directory is set", async () => {
    const h = makeHarness();
    const status = await h.manager.status({ ...baseConfig, consoleDirectory: "" });
    expect(status.state).toBe("not_configured");
    expect(status.configured).toBe(false);
  });

  it("surfaces a config error in the status of a configured but invalid directory", async () => {
    const h = makeHarness({ fs: makeFs({ [`${DIR}/next.config.ts`]: null }) });
    const status = await h.manager.status(baseConfig);
    expect(status.state).toBe("stopped");
    expect(status.configError).toMatch(/next\.config\.ts/);
  });

  it("rejects invalid settings before spawning", async () => {
    const h = makeHarness();
    const result = await h.manager.start({ ...baseConfig, port: 80 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/port/i);
    expect(h.spawned).toHaveLength(0);
  });
});

describe("environment", () => {
  const base = { PATH: "/usr/bin", HOME: "/h", SECRET_TOKEN: "x" };

  it("adds only the allowed keys", () => {
    const env = buildChildEnv(base, { mode: "dev", allowedDevOrigins: " a.ts.net " });
    const added = Object.keys(env).filter((key) => !(key in base));
    expect(added.sort()).toEqual(["ALLOWED_DEV_ORIGINS", "NODE_ENV"]);
    expect(env.ALLOWED_DEV_ORIGINS).toBe("a.ts.net");
    expect(env.SECRET_TOKEN).toBe("x");
    for (const key of added) expect(MANAGED_ENV_KEYS).toContain(key);
  });

  it("sets NODE_ENV by mode and never sets an auth bypass", () => {
    const dev = buildChildEnv(base, { mode: "dev", allowedDevOrigins: "" });
    expect(dev.NODE_ENV).toBe("development");
    expect("DEV_BYPASS_AUTH" in dev).toBe(false);
    const start = buildChildEnv(base, { mode: "start", allowedDevOrigins: "" });
    expect(start.NODE_ENV).toBe("production");
    expect("DEV_BYPASS_AUTH" in start).toBe(false);
  });

  it("removes an inherited NODE_ENV and ELECTRON_RUN_AS_NODE", () => {
    const inherited = {
      ...base,
      NODE_ENV: "test",
      ALLOWED_DEV_ORIGINS: "old",
      ELECTRON_RUN_AS_NODE: "1",
    };
    const env = buildChildEnv(inherited, { mode: "start", allowedDevOrigins: "" });
    expect("ALLOWED_DEV_ORIGINS" in env).toBe(false);
    expect("ELECTRON_RUN_AS_NODE" in env).toBe(false);
    expect(env.NODE_ENV).toBe("production");
  });

  it("passes that env through spawn and never writes it to the logs", async () => {
    const h = makeHarness({ env: { PATH: "/usr/bin", SECRET_TOKEN: "hunter2" } });
    await h.manager.start({ ...baseConfig, allowedDevOrigins: "x.ts.net" });
    const env = h.spawned[0].options.env;
    expect(env.ALLOWED_DEV_ORIGINS).toBe("x.ts.net");
    expect(h.manager.readLogs().lines.join("\n")).not.toContain("hunter2");
  });

  it("builds the command with a trimmed bind host", () => {
    expect(buildCommand("dev", 7002, " 127.0.0.1 ").args.slice(-2)).toEqual(["-H", "127.0.0.1"]);
  });
});

describe("stop", () => {
  it("sends SIGTERM to the process group and finishes without SIGKILL", async () => {
    const h = makeHarness();
    const started = await h.manager.start(baseConfig);
    const pid = started.status.pid as number;
    const stopped = await h.manager.stop(baseConfig);
    expect(stopped.ok).toBe(true);
    expect(h.signals.filter((item) => item.signal === "SIGTERM")).toEqual([{ pid, signal: "SIGTERM" }]);
    expect(h.signals.some((item) => item.signal === "SIGKILL")).toBe(false);
    expect(h.manager.isOwnedRunning()).toBe(false);
    expect(stopped.status.state).toBe("stopped");
  });

  it("falls back to SIGKILL after 5 seconds, using the fake clock", async () => {
    const h = makeHarness();
    h.ignoreTerm = true;
    await h.manager.start(baseConfig);
    const before = h.clock.now;
    const stopped = await h.manager.stop(baseConfig);
    expect(stopped.ok).toBe(true);
    const kinds = h.signals.filter((item) => item.signal !== 0).map((item) => item.signal);
    expect(kinds).toEqual(["SIGTERM", "SIGKILL"]);
    expect(h.clock.now - before).toBeGreaterThanOrEqual(STOP_GRACE_MS);
    expect(h.clock.now - before).toBeLessThan(STOP_GRACE_MS + KILL_WAIT_MS);
  });

  it("is a no-op when nothing runs", async () => {
    const h = makeHarness();
    const stopped = await h.manager.stop(baseConfig);
    expect(stopped.ok).toBe(true);
    expect(h.signals).toHaveLength(0);
  });

  it("restart stops then starts a fresh child", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    const result = await h.manager.restart(baseConfig);
    expect(result.ok).toBe(true);
    expect(h.spawned).toHaveLength(2);
    expect(result.status.pid).toBe(h.spawned[1].child.pid);
  });

  it("dispose stops the owned child", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    await h.manager.dispose();
    expect(h.groups.size).toBe(0);
    expect(h.manager.isOwnedRunning()).toBe(false);
  });
});

describe("crash handling", () => {
  it("reports the exit code and last log lines and does not restart", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    const child = h.spawned[0].child;
    child.stdout.emit("data", Buffer.from("compiling\n"));
    child.stderr.emit("data", Buffer.from("Error: EADDRINUSE\n"));
    h.exit(child, 1);
    const status = await h.manager.status(baseConfig);
    expect(status.state).toBe("crashed");
    expect(status.lastExit).toMatchObject({ code: 1, signal: null });
    expect(status.crashLines.join("\n")).toContain("[err] Error: EADDRINUSE");
    expect(status.crashLines.join("\n")).toContain("compiling");
    expect(h.spawned).toHaveLength(1);
  });

  it("clears the crash state on the next start", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    h.exit(h.spawned[0].child, 137, null);
    const again = await h.manager.start(baseConfig);
    expect(again.ok).toBe(true);
    expect(again.status.state).toBe("starting");
    expect(again.status.lastExit).toBeNull();
  });

  it("does not call a requested stop a crash", async () => {
    const h = makeHarness();
    await h.manager.start(baseConfig);
    await h.manager.stop(baseConfig);
    const status = await h.manager.status(baseConfig);
    expect(status.state).toBe("stopped");
    expect(status.lastExit).not.toBeNull();
  });
});
