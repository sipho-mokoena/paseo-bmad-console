import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, findFirst } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: { repo: { findMany, findFirst } },
}));
// React's cache() is only available inside a render; make it a pass-through.
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));

import { getRepos, getRepoConfig } from "../helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRepos", () => {
  it("lists every repo, newest first, without any user scoping", async () => {
    findMany.mockResolvedValue([{ owner: "local", name: "a" }]);

    const repos = await getRepos();

    expect(repos).toEqual([{ owner: "local", name: "a" }]);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toBeUndefined();
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(JSON.stringify(args)).not.toMatch(/userId/);
  });
});

describe("getRepoConfig", () => {
  it("looks a repo up by owner and name only", async () => {
    findFirst.mockResolvedValue({ owner: "o", name: "n" });

    const repo = await getRepoConfig("o", "n");

    expect(repo).toEqual({ owner: "o", name: "n" });
    expect(findFirst.mock.calls[0][0].where).toEqual({ owner: "o", name: "n" });
  });

  it("returns null when the repo is not registered", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getRepoConfig("o", "missing")).toBeNull();
  });
});
