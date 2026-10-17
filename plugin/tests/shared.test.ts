import { describe, expect, it } from "vitest";
import {
  buildUrlCandidates,
  consoleSettings,
  formatUptime,
  isAbsolutePath,
  logsRpc,
  NO_LOGIN_WARNING,
  statusRpc,
  validateSettings,
  type ConsoleSettingsValues,
} from "../shared/console";

const defaults = consoleSettings.schema.parse({}) as ConsoleSettingsValues;

describe("settings defaults", () => {
  it("parses an empty document into the documented defaults", () => {
    expect(defaults).toEqual({
      consoleDirectory: "",
      port: 3002,
      mode: "dev",
      bindHost: "127.0.0.1",
      publicUrl: "",
      allowedDevOrigins: "",
      autoStart: false,
      noLoginMode: false,
    });
    expect(validateSettings(defaults)).toEqual({});
  });
});

describe("settings validation", () => {
  const errorsFor = (patch: Partial<ConsoleSettingsValues>) => validateSettings({ ...defaults, ...patch });

  it("requires an absolute console directory, but allows empty", () => {
    expect(errorsFor({ consoleDirectory: "" }).consoleDirectory).toBeUndefined();
    expect(errorsFor({ consoleDirectory: "relative/dir" }).consoleDirectory).toMatch(/absolute/);
    expect(errorsFor({ consoleDirectory: "/home/me/console" }).consoleDirectory).toBeUndefined();
    expect(errorsFor({ consoleDirectory: "C:\\console" }).consoleDirectory).toBeUndefined();
    expect(isAbsolutePath("~/console")).toBe(false);
  });

  it("limits the port to 1024-65535 integers", () => {
    expect(errorsFor({ port: 1023 }).port).toBeDefined();
    expect(errorsFor({ port: 1024 }).port).toBeUndefined();
    expect(errorsFor({ port: 65535 }).port).toBeUndefined();
    expect(errorsFor({ port: 65536 }).port).toBeDefined();
    expect(errorsFor({ port: 3002.5 }).port).toBeDefined();
    expect(errorsFor({ port: Number.NaN }).port).toBeDefined();
  });

  it("validates bind host, public URL and allowed origins", () => {
    expect(errorsFor({ bindHost: "" }).bindHost).toBeDefined();
    expect(errorsFor({ bindHost: "a b" }).bindHost).toBeDefined();
    expect(errorsFor({ bindHost: "$(id)" }).bindHost).toBeDefined();
    expect(errorsFor({ bindHost: "0.0.0.0" }).bindHost).toBeUndefined();
    expect(errorsFor({ publicUrl: "ftp://x" }).publicUrl).toBeDefined();
    expect(errorsFor({ publicUrl: "not a url" }).publicUrl).toBeDefined();
    expect(errorsFor({ publicUrl: " https://box.tail.ts.net/ " }).publicUrl).toBeUndefined();
    expect(errorsFor({ allowedDevOrigins: "a.ts.net, 100.64.0.1" }).allowedDevOrigins).toBeUndefined();
    expect(errorsFor({ allowedDevOrigins: "a;rm -rf /" }).allowedDevOrigins).toBeDefined();
  });

  it("only allows no-login mode on a loopback bind host", () => {
    expect(errorsFor({ noLoginMode: true }).noLoginMode).toBeUndefined();
    expect(errorsFor({ noLoginMode: true, bindHost: "localhost" }).noLoginMode).toBeUndefined();
    expect(errorsFor({ noLoginMode: true, bindHost: "0.0.0.0" }).noLoginMode).toMatch(/127\.0\.0\.1/);
    expect(errorsFor({ noLoginMode: false, bindHost: "0.0.0.0" }).noLoginMode).toBeUndefined();
  });

  it("makes the schema reject invalid documents with the same messages", () => {
    const parsed = consoleSettings.schema.safeParse({ port: 80, consoleDirectory: "rel" });
    expect(parsed.success).toBe(false);
    const messages = parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
    expect(messages.join(" ")).toMatch(/port/i);
    expect(messages.join(" ")).toMatch(/absolute/);
  });

  it("has the documented warning text", () => {
    expect(NO_LOGIN_WARNING).toBe(
      "Disables login. Only use on a trusted machine and only with the local address.",
    );
  });
});

describe("URL candidates", () => {
  it("returns just the local URL when nothing else is set", () => {
    const urls = buildUrlCandidates({ port: 3002, bindHost: "127.0.0.1", publicUrl: "" });
    expect(urls.local).toBe("http://127.0.0.1:3002");
    expect(urls.public).toBeNull();
    expect(urls.preferred).toBe("http://127.0.0.1:3002");
    expect(urls.all.map((item) => item.kind)).toEqual(["local"]);
  });

  it("trims the public URL and its trailing slashes and prefers it", () => {
    const urls = buildUrlCandidates({
      port: 3002,
      bindHost: "0.0.0.0",
      publicUrl: "  https://box.tail.ts.net:3002//  ",
    });
    expect(urls.public).toBe("https://box.tail.ts.net:3002");
    expect(urls.preferred).toBe("https://box.tail.ts.net:3002");
    expect(urls.all.map((item) => item.url)).toEqual([
      "http://127.0.0.1:3002",
      "https://box.tail.ts.net:3002",
    ]);
  });

  it("treats a whitespace-only public URL as unset", () => {
    expect(buildUrlCandidates({ port: 3002, bindHost: "127.0.0.1", publicUrl: "   " }).public).toBeNull();
  });

  it("adds a bind-address URL for a specific non-loopback host, including IPv6", () => {
    const v4 = buildUrlCandidates({ port: 3003, bindHost: "100.64.0.10", publicUrl: "" });
    expect(v4.all.map((item) => item.url)).toContain("http://100.64.0.10:3003");
    const v6 = buildUrlCandidates({ port: 3003, bindHost: "fd7a::1", publicUrl: "" });
    expect(v6.all.map((item) => item.url)).toContain("http://[fd7a::1]:3003");
  });

  it("does not repeat the local URL when the public URL equals it", () => {
    const urls = buildUrlCandidates({ port: 3002, bindHost: "127.0.0.1", publicUrl: "http://127.0.0.1:3002/" });
    expect(urls.all).toHaveLength(1);
  });
});

describe("RPC contracts", () => {
  it("uses names Paseo accepts", () => {
    expect(statusRpc.name).toBe("bmad-console.status");
  });

  it("bounds the number of log lines", () => {
    expect(logsRpc.input.safeParse({ lines: 300 }).success).toBe(true);
    expect(logsRpc.input.safeParse({ lines: 301 }).success).toBe(false);
    expect(logsRpc.input.safeParse({ lines: 0 }).success).toBe(false);
    expect(logsRpc.input.safeParse({}).success).toBe(true);
  });
});

describe("formatUptime", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatUptime(5)).toBe("5s");
    expect(formatUptime(65)).toBe("1m 5s");
    expect(formatUptime(3700)).toBe("1h 1m");
  });
});
