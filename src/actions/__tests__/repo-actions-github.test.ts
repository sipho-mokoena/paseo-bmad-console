import { describe, it, expect, vi, beforeEach } from "vitest";

const { create, repoGet, getBranch } = vi.hoisted(() => ({
  create: vi.fn(),
  repoGet: vi.fn(),
  getBranch: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock("@/lib/db/client", () => ({ prisma: { repo: { create } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/github/client", () => ({
  createOctokit: () => ({ rest: { repos: { get: repoGet, getBranch } } }),
  getCachedRepoTree: vi.fn(),
  getCachedRawContent: vi.fn(),
  isRateLimitError: (e: { status?: number }) => e?.status === 403 || e?.status === 429,
  rateLimitMessage: () => "rate limit message",
}));

import { addGitHubRepo } from "../repo-actions";

beforeEach(() => {
  vi.clearAllMocks();
  create.mockImplementation(async ({ data }) => ({
    id: "id1",
    owner: data.owner,
    name: data.name,
    displayName: data.displayName,
  }));
});

describe("addGitHubRepo", () => {
  it("registers a repo with the default branch and no user", async () => {
    repoGet.mockResolvedValue({ data: { description: "d", default_branch: "trunk" } });

    const result = await addGitHubRepo({ owner: "acme", name: "widgets" });

    expect(result.success).toBe(true);
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      owner: "acme",
      name: "widgets",
      branch: "trunk",
      description: "d",
      sourceType: "github",
    });
    expect("userId" in data).toBe(false);
    expect(getBranch).not.toHaveBeenCalled();
  });

  it("verifies an explicit branch", async () => {
    repoGet.mockResolvedValue({ data: { description: null, default_branch: "main" } });
    getBranch.mockResolvedValue({});

    await addGitHubRepo({ owner: "acme", name: "widgets", branch: "dev" });

    expect(getBranch).toHaveBeenCalledWith({ owner: "acme", repo: "widgets", branch: "dev" });
    expect(create.mock.calls[0][0].data.branch).toBe("dev");
  });

  it("rejects malformed owner or name without calling GitHub", async () => {
    const result = await addGitHubRepo({ owner: "ac me", name: "widgets" });
    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(repoGet).not.toHaveBeenCalled();
  });

  it("surfaces the rate-limit message", async () => {
    repoGet.mockRejectedValue({ status: 403 });
    const result = await addGitHubRepo({ owner: "acme", name: "widgets" });
    expect(result).toEqual({ success: false, error: "rate limit message", code: "RATE_LIMITED" });
    expect(create).not.toHaveBeenCalled();
  });

  it("explains a 404 as possibly private", async () => {
    repoGet.mockRejectedValue({ status: 404 });
    const result = await addGitHubRepo({ owner: "acme", name: "widgets" });
    expect(result).toMatchObject({ success: false, code: "NOT_FOUND" });
    expect(result.success === false && result.error).toContain("GITHUB_PAT");
  });
});
