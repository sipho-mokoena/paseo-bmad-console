import { describe, expect, it } from "vitest";
import { createService, type SettingsReader } from "../server/service";
import { baseConfig, makeHarness } from "./fakes";

function reader(state: Awaited<ReturnType<SettingsReader["read"]>>): SettingsReader {
  return { read: async () => state };
}

describe("service", () => {
  it("starts with the saved settings", async () => {
    const h = makeHarness();
    const service = createService(h.manager, reader({ status: "ready", values: baseConfig }));
    const result = await service.start();
    expect(result.ok).toBe(true);
    expect(h.spawned[0].args).toContain("3011");
  });

  it("reports unreadable settings instead of spawning", async () => {
    const h = makeHarness();
    const service = createService(h.manager, reader({ status: "invalid", error: "bad port" }));
    const result = await service.start();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/bad port/);
    expect(result.status.settingsError).toMatch(/bad port/);
    expect(h.spawned).toHaveLength(0);
    expect((await service.status()).state).toBe("not_configured");
  });

  it("can still stop a running child when settings become unreadable", async () => {
    const h = makeHarness();
    await createService(h.manager, reader({ status: "ready", values: baseConfig })).start();
    const stopped = await createService(h.manager, reader({ status: "error", error: "io" })).stop();
    expect(stopped.ok).toBe(true);
    expect(h.manager.isOwnedRunning()).toBe(false);
  });

  it("returns the bounded log tail", async () => {
    const h = makeHarness();
    const service = createService(h.manager, reader({ status: "ready", values: baseConfig }));
    await service.start();
    h.spawned[0].child.stdout.emit("data", "line one\nline two\n");
    expect(service.logs(2).lines.at(-1)).toBe("line two");
    expect(service.logs().capacity).toBe(300);
  });
});
