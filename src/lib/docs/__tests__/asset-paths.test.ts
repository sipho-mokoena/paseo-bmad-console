import { describe, it, expect } from "vitest";
import {
  resolveRepoRelativePath,
  buildRepoAssetUrl,
  resolveImageSrc,
  validateAssetPath,
  isRelativeImageHref,
} from "@/lib/docs/asset-paths";

const DOC = "_bmad-output/initiative-sovren/ux-sovren/wireframes/index.md";
const CTX = { owner: "local", repo: "sovren-1d3b23df", docPath: DOC };

describe("resolveRepoRelativePath", () => {
  it("resolves against the document directory", () => {
    expect(resolveRepoRelativePath(DOC, "svg/a.svg")).toBe(
      "_bmad-output/initiative-sovren/ux-sovren/wireframes/svg/a.svg",
    );
  });

  it("handles ./ and ../ inside the repo", () => {
    expect(resolveRepoRelativePath(DOC, "./svg/../img/b.png")).toBe(
      "_bmad-output/initiative-sovren/ux-sovren/wireframes/img/b.png",
    );
  });

  it("returns null when the href climbs above the repo root", () => {
    expect(resolveRepoRelativePath("a.md", "../../etc/passwd")).toBeNull();
  });

  it("returns null for absolute, scheme and fragment hrefs", () => {
    expect(resolveRepoRelativePath(DOC, "/etc/passwd")).toBeNull();
    expect(resolveRepoRelativePath(DOC, "https://example.com/a.svg")).toBeNull();
    expect(resolveRepoRelativePath(DOC, "data:image/png;base64,AAAA")).toBeNull();
    expect(resolveRepoRelativePath(DOC, "#top")).toBeNull();
  });

  it("decodes percent-encoded segments once and strips query strings", () => {
    expect(resolveRepoRelativePath(DOC, "svg/a%20b.svg?v=2")).toBe(
      "_bmad-output/initiative-sovren/ux-sovren/wireframes/svg/a b.svg",
    );
  });
});

describe("resolveImageSrc", () => {
  it("leaves absolute and data URLs unchanged", () => {
    expect(resolveImageSrc("https://example.com/a.png", CTX)).toBe("https://example.com/a.png");
    expect(resolveImageSrc("data:image/png;base64,AAAA", CTX)).toBe("data:image/png;base64,AAAA");
  });

  it("rewrites relative images to the repo-asset route", () => {
    const src = resolveImageSrc("svg/00a-console-preflight-failed.svg", CTX);
    expect(src).toBe(
      "/api/repo-asset?owner=local&repo=sovren-1d3b23df&path=_bmad-output%2Finitiative-sovren%2Fux-sovren%2Fwireframes%2Fsvg%2F00a-console-preflight-failed.svg",
    );
  });

  it("leaves src untouched when no document context is given", () => {
    expect(resolveImageSrc("svg/a.svg", null)).toBe("svg/a.svg");
  });

  it("drops images that escape the repo root", () => {
    expect(resolveImageSrc("../../../../x.svg", { ...CTX, docPath: "a.md" })).toBeUndefined();
  });
});

describe("buildRepoAssetUrl / isRelativeImageHref", () => {
  it("detects relative image links only", () => {
    expect(isRelativeImageHref(CTX, "svg/a.svg")).toBe(true);
    expect(isRelativeImageHref(CTX, "other.md")).toBe(false);
    expect(buildRepoAssetUrl(CTX, "other.md")).toContain("/api/repo-asset?");
  });
});

describe("validateAssetPath", () => {
  it("accepts allowed image extensions case-insensitively with fixed content types", () => {
    expect(validateAssetPath("_bmad-output/a.SVG")).toEqual({
      ok: true,
      path: "_bmad-output/a.SVG",
      contentType: "image/svg+xml",
    });
    expect(validateAssetPath("_bmad-output/a.jpeg")).toMatchObject({ ok: true, contentType: "image/jpeg" });
    expect(validateAssetPath("_bmad-output/a.webp")).toMatchObject({ ok: true, contentType: "image/webp" });
  });

  it.each([
    [null],
    [""],
    ["_bmad-output/../secret.svg"],
    ["../secret.svg"],
    ["_bmad-output/./a.svg"],
    ["_bmad-output//a.svg"],
    ["/etc/passwd.svg"],
    ["C:/x.svg"],
    ["_bmad-output\\a.svg"],
    ["_bmad-output/a\0.svg"],
    ["_bmad-output/a.md"],
    ["_bmad-output/a.html"],
    ["_bmad-output/a.constructor"],
    ["_bmad-output/a"],
  ])("rejects %s", (raw) => {
    const result = validateAssetPath(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).not.toMatch(/\//);
    }
  });
});
