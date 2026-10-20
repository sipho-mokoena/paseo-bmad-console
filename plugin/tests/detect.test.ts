import { describe, expect, it } from "vitest";
import { defaultInstallDirectory, pickNetworkAddress } from "../server/detect";
import { parseEnvFile } from "../server/env-file";
import { createService } from "../server/service";
import { baseConfig, DIR, makeHarness } from "./fakes";

describe("defaultInstallDirectory", () => {
  it("is a folder under the Paseo home folder, outside any checkout", () => {
    expect(defaultInstallDirectory("/home/acme")).toBe("/home/acme/.paseo/bmad-console");
  });
});

describe("pickNetworkAddress", () => {
  const info = (address: string, internal = false) =>
    ({ address, family: "IPv4", internal, netmask: "", mac: "", cidr: null }) as const;
  it("prefers a Tailscale address over a LAN address", () => {
    expect(pickNetworkAddress({ lo: [info("127.0.0.1", true)], eth0: [info("192.168.1.5")], tailscale0: [info("100.101.1.2")] })).toBe("100.101.1.2");
  });
  it("falls back to a private LAN address and ignores loopback", () => {
    expect(pickNetworkAddress({ lo: [info("127.0.0.1", true)], eth0: [info("10.0.0.7")] })).toBe("10.0.0.7");
    expect(pickNetworkAddress({ lo: [info("127.0.0.1", true)] })).toBeNull();
  });
});

describe("parseEnvFile", () => {
  it("reads keys, quotes, export and comments", () => {
    const text = [
      "# comment",
      "DATABASE_URL=postgresql://bmad:pw@127.0.0.1:7433/bmad",
      'QUOTED="a b"',
      "SINGLE='c d'",
      "export EXPORTED=1",
      "TRAILING=value # note",
      "",
      "not a pair",
    ].join("\n");
    expect(parseEnvFile(text)).toEqual({
      DATABASE_URL: "postgresql://bmad:pw@127.0.0.1:7433/bmad",
      QUOTED: "a b",
      SINGLE: "c d",
      EXPORTED: "1",
      TRAILING: "value",
    });
  });
});

describe("service with detection", () => {
  const ready = (values: typeof baseConfig) => ({ read: async () => ({ status: "ready" as const, values }) });
  it("uses the default install folder when none is saved, and the saved one when set", async () => {
    const h = makeHarness();
    const detect = { directory: () => DIR, networkAddress: () => null };
    const auto = createService(h.manager, ready({ ...baseConfig, consoleDirectory: "" }), detect);
    expect((await auto.status()).directory).toBe(DIR);
    const saved = createService(h.manager, ready({ ...baseConfig, consoleDirectory: "/saved/x" }), detect);
    expect((await saved.status()).directory).toBe("/saved/x");
  });
  it("derives the address for other devices only when listening on all interfaces", async () => {
    const h = makeHarness();
    const detect = { directory: () => DIR, networkAddress: () => "100.64.0.9" };
    const open = createService(h.manager, ready({ ...baseConfig, bindHost: "0.0.0.0", port: 7002 }), detect);
    expect((await open.status()).urls.public).toBe("http://100.64.0.9:7002");
    const local = createService(h.manager, ready(baseConfig), detect);
    expect((await local.status()).urls.public).toBeNull();
    const own = createService(h.manager, ready({ ...baseConfig, bindHost: "0.0.0.0", publicUrl: "https://x.example" }), detect);
    expect((await own.status()).urls.public).toBe("https://x.example");
  });
});
