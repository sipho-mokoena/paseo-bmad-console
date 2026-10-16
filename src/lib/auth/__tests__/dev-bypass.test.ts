// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertNoDevAuthBypassInProduction,
  isDevAuthBypassEnabled,
  resetDevAuthBypassWarning,
  warnIfDevAuthBypassActive,
} from "../dev-bypass";

describe("isDevAuthBypassEnabled", () => {
  it("is on only for DEV_BYPASS_AUTH=true outside production", () => {
    expect(isDevAuthBypassEnabled({ NODE_ENV: "development", DEV_BYPASS_AUTH: "true" })).toBe(true);
    expect(isDevAuthBypassEnabled({ NODE_ENV: "test", DEV_BYPASS_AUTH: "true" })).toBe(true);
    expect(isDevAuthBypassEnabled({ DEV_BYPASS_AUTH: "true" })).toBe(true);
  });

  it("is never on in production", () => {
    expect(isDevAuthBypassEnabled({ NODE_ENV: "production", DEV_BYPASS_AUTH: "true" })).toBe(false);
  });

  it("requires the exact value true", () => {
    for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
      expect(isDevAuthBypassEnabled({ NODE_ENV: "development", DEV_BYPASS_AUTH: value })).toBe(false);
    }
  });
});

describe("assertNoDevAuthBypassInProduction", () => {
  it("throws when the flag is set in production, whatever its value", () => {
    for (const value of ["true", "false", "1"]) {
      expect(() =>
        assertNoDevAuthBypassInProduction({ NODE_ENV: "production", DEV_BYPASS_AUTH: value })
      ).toThrow(/DEV_BYPASS_AUTH/);
    }
  });

  it("passes in production when the flag is unset or empty", () => {
    expect(() => assertNoDevAuthBypassInProduction({ NODE_ENV: "production" })).not.toThrow();
    expect(() =>
      assertNoDevAuthBypassInProduction({ NODE_ENV: "production", DEV_BYPASS_AUTH: "" })
    ).not.toThrow();
  });

  it("passes outside production", () => {
    expect(() =>
      assertNoDevAuthBypassInProduction({ NODE_ENV: "development", DEV_BYPASS_AUTH: "true" })
    ).not.toThrow();
  });
});

describe("warnIfDevAuthBypassActive", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetDevAuthBypassWarning();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("warns once when active", () => {
    const env = { NODE_ENV: "development", DEV_BYPASS_AUTH: "true" };
    warnIfDevAuthBypassActive(env);
    warnIfDevAuthBypassActive(env);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("DEV_BYPASS_AUTH");
  });

  it("stays silent when inactive", () => {
    warnIfDevAuthBypassActive({ NODE_ENV: "development" });
    warnIfDevAuthBypassActive({ NODE_ENV: "production", DEV_BYPASS_AUTH: "true" });
    expect(warn).not.toHaveBeenCalled();
  });
});
