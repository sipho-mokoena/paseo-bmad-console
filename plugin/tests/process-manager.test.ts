import { describe, expect, it } from "vitest";
import {
  buildChildEnv,
  buildCommand,
  KILL_WAIT_MS,
  MANAGED_ENV_KEYS,
  STOP_GRACE_MS,
} from "../server/process-manager";
import { baseConfig, APP, DIR, makeFs, makeHarness } from "./fakes";

describe("start", () => {
  it("runs node server.js without a shell, detached, in the installed app folder", async () => {
    const h = makeHarness();
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(true);
    expect(result.alreadyRunning).toBe(false);
    expect(h.spawned).toHaveLength(1);
    const call = h.spawned[0];
    expect(call.command).toBe("node");
    expect(call.args).toEqual(["server.js"]);
    expect(call.options.shell).toBe(false);
    expect(call.options.detached).toBe(true);
    expect(call.options.cwd).toBe(APP);
    expect(result.status.pid).toBe(call.child.pid);
    expect(result.status.state).toBe("starting");
  });

  it("passes the port, bind host and the .env file to the server", async () => {
    const h = makeHarness();
    await h.manager.start({ ...baseConfig, bindHost: "0.0.0.0" });
    const env = h.spawned[0].options.env;
    expect(env.PORT).toBe("3011");
    expect(env.HOSTNAME).toBe("0.0.0.0");
    expect(env.NODE_ENV).toBe("production");
    expect(env.DATABASE_URL).toBe("postgresql://bmad@127.0.0.1:7433/bmad");
  });

  it("uses NODE_BIN from the daemon environment when set", async () => {
    const h = makeHarness({ env: { PATH: "/usr/bin", NODE_BIN: "/opt/node/bin/node" } });
    await h.manager.start(baseConfig);
    expect(h.spawned[0].command).toBe("/opt/node/bin/node");
  });

  it("still starts without a .env file and says so in the log", async () => {
    const h = makeHarness({ fs: makeFs({ [`${DIR}/.env`]: null }) });
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(true);
    expect(h.manager.readLogs().lines.join("\n")).toMatch(/DATABASE_URL/);
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

  it("returns a clear error when the build is incomplete", async () => {
    const h = makeHarness({ fs: makeFs({ [`${APP}/.next/BUILD_ID`]: null }) });
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pnpm deploy:local/);
    expect(h.spawned).toHaveLength(0);
  });

  it("reports a spawn failure such as a missing node and leaves nothing running", async () => {
    const h = makeHarness({ failSpawn: true });
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/node/);
    expect(result.status.pid).toBeNull();
    expect(h.manager.isOwnedRunning()).toBe(false);
  });
});

describe("directory validation", () => {
  const cases: Array<[string, Record<string, string | null>, Partial<typeof baseConfig>, RegExp]> = [
    ["empty directory", {}, { consoleDirectory: "" }, /not installed/],
    ["relative path", {}, { consoleDirectory: "paseo-bmad-console" }, /absolute/],
    ["missing directory", {}, { consoleDirectory: "/nope" }, /not installed in \/nope/],
    ["no server.js", { [`${APP}/server.js`]: null }, {}, /pnpm deploy:local/],
    ["invalid package.json", { [`${APP}/package.json`]: "{" }, {}, /not valid JSON/],
    [
      "wrong package name",
      { [`${APP}/package.json`]: JSON.stringify({ name: "other" }) },
      {},
      /not the Paseo BMAD Console/,
    ],
  ];
  it.each(cases)("rejects %s", async (_name, files, override, pattern) => {
    const h = makeHarness({ fs: makeFs(files) });
    const result = await h.manager.start({ ...baseConfig, ...override });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(pattern);
    expect(h.spawned).toHaveLength(0);
  });

  it("accepts a folder that holds server.js directly", async () => {
    const files = {
      [`${APP}/server.js`]: null,
      [`${APP}/.next/BUILD_ID`]: null,
      [`${APP}/package.json`]: null,
      [`${DIR}/server.js`]: "x",
      [`${DIR}/.next/BUILD_ID`]: "abc",
    };
    const h = makeHarness({ fs: makeFs(files) });
    const result = await h.manager.start(baseConfig);
    expect(result.ok).toBe(true);
    expect(h.spawned[0].options.cwd).toBe(DIR);
  });

  it("reports not configured when no directory is set", async () => {
    const h = makeHarness();
    const status = await h.manager.status({ ...baseConfig, consoleDirectory: "" });
    expect(status.state).toBe("not_configured");
    expect(status.configured).toBe(false);
  });

  it("surfaces a config error in the status of a configured but invalid directory", async () => {
    const h = makeHarness({ fs: makeFs({ [`${APP}/server.js`]: null }) });
    const status = await h.manager.status(baseConfig);
    expect(status.state).toBe("stopped");
    expect(status.configError).toMatch(/pnpm deploy:local/);
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

  it("adds only the keys the plugin owns", () => {
    const env = buildChildEnv(base, { port: 7002, bindHost: " 127.0.0.1 " });
    const added = Object.keys(env).filter((key) => !(key in base));
    expect(added.sort()).toEqual(["HOSTNAME", "NODE_ENV", "PORT"]);
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.SECRET_TOKEN).toBe("x");
    for (const key of added) expect(MANAGED_ENV_KEYS).toContain(key);
  });

  it("lets the .env file add variables but not override the owned keys", () => {
    const env = buildChildEnv(base, {
      port: 7002,
      bindHost: "127.0.0.1",
      fileEnv: { DATABASE_URL: "postgresql://x", PORT: "1", HOSTNAME: "other", NODE_ENV: "development" },
    });
    expect(env.DATABASE_URL).toBe("postgresql://x");
    expect(env.PORT).toBe("7002");
    expect(env.HOSTNAME).toBe("127.0.0.1");
    expect(env.NODE_ENV).toBe("production");
  });

  it("removes an inherited ELECTRON_RUN_AS_NODE and never sets an auth bypass", () => {
    const env = buildChildEnv({ ...base, NODE_ENV: "test", ELECTRON_RUN_AS_NODE: "1" }, { port: 7002, bindHost: "127.0.0.1" });
    expect("ELECTRON_RUN_AS_NODE" in env).toBe(false);
    expect("DEV_BYPASS_AUTH" in env).toBe(false);
    expect(env.NODE_ENV).toBe("production");
  });

  it("never writes the environment to the logs", async () => {
    const h = makeHarness({ env: { PATH: "/usr/bin", SECRET_TOKEN: "hunter2" } });
    await h.manager.start(baseConfig);
    expect(h.manager.readLogs().lines.join("\n")).not.toContain("hunter2");
    expect(h.manager.readLogs().lines.join("\n")).not.toContain("postgresql://");
  });

  it("builds the command from the node binary", () => {
    expect(buildCommand()).toEqual({ command: "node", args: ["server.js"] });
    expect(buildCommand("/opt/node").command).toBe("/opt/node");
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
