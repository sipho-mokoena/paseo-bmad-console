import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

// This file names the removed packages to look for them, so it is excluded.
const SELF = ":!src/lib/__tests__/no-auth.test.ts";

const root = path.resolve(__dirname, "../../..");

function gitGrep(pattern: string, ...paths: string[]): string[] {
  try {
    const out = execFileSync("git", ["grep", "-liE", pattern, "--", ...paths, SELF], {
      cwd: root,
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean);
  } catch (error) {
    // git grep exits with status 1 when nothing matches.
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
}

describe("authentication stays removed", () => {
  it("no source file imports better-auth", () => {
    expect(gitGrep("better-auth|betterAuth", "src")).toEqual([]);
  });

  it("the auth runtime and routes are gone", () => {
    expect(gitGrep("lib/auth/|DEV_BYPASS_AUTH|getAuthenticated", "src", "next.config.ts")).toEqual([]);
  });

  it("better-auth is not a dependency", () => {
    expect(gitGrep("better-auth", "package.json")).toEqual([]);
  });
});
