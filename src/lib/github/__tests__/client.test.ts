import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const constructed: Record<string, unknown>[] = [];

vi.mock("@octokit/rest", () => {
  class FakeOctokit {
    constructor(options: Record<string, unknown>) {
      constructed.push(options);
    }
  }
  return { Octokit: { plugin: () => FakeOctokit } };
});
vi.mock("@octokit/plugin-throttling", () => ({ throttling: {} }));
vi.mock("@octokit/plugin-retry", () => ({ retry: {} }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { createOctokit, getGitHubPat, isRateLimitError, rateLimitMessage } from "../client";

const ORIGINAL_PAT = process.env.GITHUB_PAT;

beforeEach(() => {
  constructed.length = 0;
  delete process.env.GITHUB_PAT;
});

afterEach(() => {
  if (ORIGINAL_PAT === undefined) delete process.env.GITHUB_PAT;
  else process.env.GITHUB_PAT = ORIGINAL_PAT;
});

describe("createOctokit", () => {
  it("authenticates with GITHUB_PAT when it is set", () => {
    process.env.GITHUB_PAT = "ghp_example";
    createOctokit();
    expect(constructed).toHaveLength(1);
    expect(constructed[0].auth).toBe("ghp_example");
    expect(constructed[0].throttle).toBeDefined();
  });

  it("trims the token", () => {
    process.env.GITHUB_PAT = "  ghp_example \n";
    createOctokit();
    expect(constructed[0].auth).toBe("ghp_example");
  });

  it("is unauthenticated when GITHUB_PAT is unset", () => {
    createOctokit();
    expect(constructed).toHaveLength(1);
    expect("auth" in constructed[0]).toBe(false);
  });

  it("treats a blank GITHUB_PAT as unset", () => {
    process.env.GITHUB_PAT = "   ";
    expect(getGitHubPat()).toBeUndefined();
    createOctokit();
    expect("auth" in constructed[0]).toBe(false);
  });
});

describe("rateLimitMessage", () => {
  it("tells an unauthenticated user how to raise the limit", () => {
    const message = rateLimitMessage();
    expect(message).toContain("60 requests per hour");
    expect(message).toContain("GITHUB_PAT");
  });

  it("does not suggest a token when one is already configured", () => {
    process.env.GITHUB_PAT = "ghp_example";
    expect(rateLimitMessage()).not.toContain("GITHUB_PAT");
  });
});

describe("isRateLimitError", () => {
  it("recognises 403 and 429 only", () => {
    expect(isRateLimitError({ status: 403 })).toBe(true);
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ status: 404 })).toBe(false);
    expect(isRateLimitError(new Error("x"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
