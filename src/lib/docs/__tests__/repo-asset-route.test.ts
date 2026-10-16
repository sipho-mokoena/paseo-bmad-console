import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

vi.mock("@/lib/db/helpers", () => ({
  getAuthenticatedSession: vi.fn(),
  getAuthenticatedRepoConfig: vi.fn(),
}));

import { getAuthenticatedSession, getAuthenticatedRepoConfig } from "@/lib/db/helpers";
import { GET } from "@/app/api/repo-asset/route";

const OWNER = "local";
const REPO = "acme-1d3b23df";
const SVG_BODY = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';

let repoRoot: string;
let outsideRoot: string;

beforeAll(async () => {
  process.env.ENABLE_LOCAL_FS = "true";
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "repo-asset-"));
  repoRoot = path.join(base, "repo");
  outsideRoot = path.join(base, "outside");
  const wire = path.join(repoRoot, "_bmad-output/initiative-acme/ux-acme/wireframes");
  await fs.mkdir(path.join(wire, "svg"), { recursive: true });
  await fs.writeFile(path.join(wire, "svg/00a-console-preflight-failed.svg"), SVG_BODY);
  await fs.writeFile(path.join(wire, "tiny.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await fs.writeFile(path.join(wire, "notes.md"), "# notes");
  await fs.writeFile(path.join(repoRoot, "secret.svg"), SVG_BODY);
  await fs.mkdir(outsideRoot, { recursive: true });
  await fs.writeFile(path.join(outsideRoot, "x.svg"), SVG_BODY);
  await fs.writeFile(path.join(repoRoot, "_bmad-output/huge.png"), Buffer.alloc(5 * 1024 * 1024 + 1));
  // Intermediate symlink inside a BMAD dir that points outside the repo.
  await fs.symlink(outsideRoot, path.join(repoRoot, "_bmad-output/escape"));
});

afterAll(async () => {
  delete process.env.ENABLE_LOCAL_FS;
  await fs.rm(path.dirname(repoRoot), { recursive: true, force: true });
});

beforeEach(() => {
  vi.mocked(getAuthenticatedSession).mockResolvedValue({
    userId: "user-1",
    role: "user",
    email: "u@example.com",
  });
  vi.mocked(getAuthenticatedRepoConfig).mockImplementation(async (_userId, owner, name) =>
    owner === OWNER && name === REPO
      ? ({ owner, name, sourceType: "local", localPath: repoRoot } as never)
      : null,
  );
});

function request(params: Record<string, string | undefined>, raw = ""): Request {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, v);
  const query = raw || qs.toString();
  return new Request(`http://localhost:3002/api/repo-asset?${query}`);
}

const SVG_PATH =
  "_bmad-output/initiative-acme/ux-acme/wireframes/svg/00a-console-preflight-failed.svg";

describe("GET /api/repo-asset", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(getAuthenticatedSession).mockResolvedValueOnce(null);
    const res = await GET(request({ owner: OWNER, repo: REPO, path: SVG_PATH }));
    expect(res.status).toBe(401);
  });

  it("serves a valid svg with the expected headers", async () => {
    const res = await GET(request({ owner: OWNER, repo: REPO, path: SVG_PATH }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(res.headers.get("content-security-policy")).toBe(
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    );
    expect(await res.text()).toBe(SVG_BODY);
  });

  it("serves png without the svg CSP", async () => {
    const res = await GET(
      request({
        owner: OWNER,
        repo: REPO,
        path: "_bmad-output/initiative-acme/ux-acme/wireframes/tiny.png",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("rejects a raw traversal segment", async () => {
    const res = await GET(
      request({ owner: OWNER, repo: REPO, path: "_bmad-output/../secret.svg" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an encoded traversal (%2e%2e%2f)", async () => {
    const res = await GET(
      request({}, `owner=${OWNER}&repo=${REPO}&path=%2e%2e%2f%2e%2e%2fsecret.svg`),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an absolute path", async () => {
    const res = await GET(request({ owner: OWNER, repo: REPO, path: "/etc/passwd.svg" }));
    expect(res.status).toBe(400);
  });

  it("rejects NUL bytes", async () => {
    const res = await GET(
      request({ owner: OWNER, repo: REPO, path: "_bmad-output/a\0.svg" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a non-image extension", async () => {
    const res = await GET(
      request({
        owner: OWNER,
        repo: REPO,
        path: "_bmad-output/initiative-acme/ux-acme/wireframes/notes.md",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a file outside the BMAD directories with 403", async () => {
    const res = await GET(request({ owner: OWNER, repo: REPO, path: "secret.svg" }));
    expect(res.status).toBe(403);
  });

  it("rejects a symlinked intermediate directory that escapes the repo", async () => {
    const res = await GET(
      request({ owner: OWNER, repo: REPO, path: "_bmad-output/escape/x.svg" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing file", async () => {
    const res = await GET(
      request({ owner: OWNER, repo: REPO, path: "_bmad-output/nope/missing.svg" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a repo the user does not own", async () => {
    const res = await GET(request({ owner: "someone", repo: REPO, path: SVG_PATH }));
    expect(res.status).toBe(404);
  });

  it("returns 413 for files over the size cap", async () => {
    const res = await GET(
      request({ owner: OWNER, repo: REPO, path: "_bmad-output/huge.png" }),
    );
    expect(res.status).toBe(413);
  });

  it("never leaks filesystem paths in error bodies", async () => {
    const res = await GET(request({ owner: OWNER, repo: REPO, path: "secret.svg" }));
    const body = await res.text();
    expect(body).not.toContain(repoRoot);
    expect(body).not.toContain(path.dirname(repoRoot));
  });
});
