import { describe, it, expect } from "vitest";
import { copyPathTarget, joinRootPath, localRootOf } from "../copy-path";

const REL = "_bmad-output/initiative-sovren/brief-sovren/brief-sovren.md";

describe("joinRootPath", () => {
  it("joins a posix root", () => {
    expect(joinRootPath("/home/u/proj", REL)).toBe(`/home/u/proj/${REL}`);
  });
  it("handles a trailing slash on the root", () => {
    expect(joinRootPath("/home/u/proj/", "a/b.md")).toBe("/home/u/proj/a/b.md");
    expect(joinRootPath("/home/u/proj//", "a.md")).toBe("/home/u/proj/a.md");
  });
  it("ignores leading ./ and / on the relative path", () => {
    expect(joinRootPath("/r", "./a/b.md")).toBe("/r/a/b.md");
    expect(joinRootPath("/r", "/a/b.md")).toBe("/r/a/b.md");
    expect(joinRootPath("/r", "a/./b.md")).toBe("/r/a/b.md");
  });
  it("uses backslashes for a Windows root", () => {
    expect(joinRootPath("C:\\Users\\me\\proj", "a/b.md")).toBe("C:\\Users\\me\\proj\\a\\b.md");
    expect(joinRootPath("C:\\Users\\me\\proj\\", "./a/b.md")).toBe("C:\\Users\\me\\proj\\a\\b.md");
  });
  it("keeps a mixed-separator root on forward slashes", () => {
    expect(joinRootPath("C:/Users/me", "a.md")).toBe("C:/Users/me/a.md");
  });
});

describe("copyPathTarget", () => {
  it("local project: absolute path, same title", () => {
    const t = copyPathTarget({ relativePath: REL, owner: "local", repo: "sovren", localRoot: "/home/u/sovren" });
    expect(t.text).toBe(`/home/u/sovren/${REL}`);
    expect(t.title).toBe(t.text);
  });
  it("GitHub project: owner/repo/path, never a filesystem path", () => {
    const t = copyPathTarget({ relativePath: "/docs/a.md", owner: "acme", repo: "app" });
    expect(t.text).toBe("acme/app/docs/a.md");
    expect(t.title).toContain("Path in the repository");
  });
  it("blank root counts as no root", () => {
    expect(copyPathTarget({ relativePath: "a.md", owner: "o", repo: "r", localRoot: "  " }).text).toBe("o/r/a.md");
  });
});

describe("localRootOf", () => {
  it("only local projects with a path have a root", () => {
    expect(localRootOf({ sourceType: "local", localPath: "/p" })).toBe("/p");
    expect(localRootOf({ sourceType: "local", localPath: null })).toBeUndefined();
    expect(localRootOf({ sourceType: "github", localPath: null })).toBeUndefined();
    expect(localRootOf(null)).toBeUndefined();
  });
});
