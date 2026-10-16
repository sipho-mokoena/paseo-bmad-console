/**
 * Pure helpers for serving images referenced from BMAD markdown documents.
 *
 * Client-safe (no Node imports): used by the markdown renderer to rewrite
 * relative image URLs, and by the /api/repo-asset route to validate requests.
 */

export const REPO_ASSET_ROUTE = "/api/repo-asset";
export const REPO_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const SVG_CONTENT_SECURITY_POLICY =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

const IMAGE_CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ["svg", "image/svg+xml"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
]);

const MAX_PATH_LENGTH = 1024;

export interface DocAssetContext {
  owner: string;
  repo: string;
  /** Repo-relative path of the markdown document being rendered. */
  docPath: string;
}

/** Fixed Content-Type for an image path, or null when the extension is not an allowed image type. */
export function imageContentTypeFor(filePath: string): string | null {
  const lastSegment = filePath.split("/").pop() ?? "";
  const dot = lastSegment.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = lastSegment.slice(dot + 1).toLowerCase();
  return IMAGE_CONTENT_TYPES.get(ext) ?? null;
}

/** True for hrefs that are not relative to the document (absolute URLs, data:, site-absolute, fragments). */
export function isNonRelativeHref(href: string): boolean {
  return (
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("?") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  );
}

/**
 * Resolve a relative href against the directory of the document, returning a
 * normalized repo-relative path, or null when it cannot be resolved inside the repo.
 */
export function resolveRepoRelativePath(docPath: string, href: string): string | null {
  if (!href || isNonRelativeHref(href)) return null;
  const withoutQuery = href.split(/[?#]/)[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }
  const stack = docPath.split("/").slice(0, -1).filter((s) => s !== "");
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return stack.length > 0 ? stack.join("/") : null;
}

/** URL for the repo-asset route, or null when the href cannot be resolved. */
export function buildRepoAssetUrl(ctx: DocAssetContext, href: string): string | null {
  const repoPath = resolveRepoRelativePath(ctx.docPath, href);
  if (!repoPath) return null;
  const params = new URLSearchParams({
    owner: ctx.owner,
    repo: ctx.repo,
    path: repoPath,
  });
  return `${REPO_ASSET_ROUTE}?${params.toString()}`;
}

/**
 * Rewrite an <img src>: absolute, data: and site-absolute URLs are returned
 * unchanged; relative ones are routed through the repo-asset route.
 */
export function resolveImageSrc(
  src: string | undefined,
  ctx: DocAssetContext | null,
): string | undefined {
  if (!src || !ctx || isNonRelativeHref(src)) return src;
  return buildRepoAssetUrl(ctx, src) ?? undefined;
}

/** True when a relative href points at an image file inside the repo. */
export function isRelativeImageHref(ctx: DocAssetContext, href: string): boolean {
  const repoPath = resolveRepoRelativePath(ctx.docPath, href);
  return repoPath !== null && imageContentTypeFor(repoPath) !== null;
}

export type AssetPathValidation =
  | { ok: true; path: string; contentType: string }
  | { ok: false; status: 400; error: string };

/**
 * Syntactic validation of the `path` query parameter. Path-jail checks against
 * the filesystem (BMAD whitelist, symlinks, containment) happen in LocalProvider.
 */
export function validateAssetPath(raw: string | null): AssetPathValidation {
  if (!raw) return { ok: false, status: 400, error: "Missing path" };
  if (raw.length > MAX_PATH_LENGTH) return { ok: false, status: 400, error: "Path too long" };
  if (raw.includes("\0")) return { ok: false, status: 400, error: "Invalid path" };
  if (raw.includes("\\")) return { ok: false, status: 400, error: "Invalid path" };
  if (raw.startsWith("/") || /^[a-zA-Z]:/.test(raw)) {
    return { ok: false, status: 400, error: "Absolute paths are not allowed" };
  }
  const segments = raw.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    return { ok: false, status: 400, error: "Invalid path" };
  }
  const contentType = imageContentTypeFor(raw);
  if (!contentType) return { ok: false, status: 400, error: "Unsupported file type" };
  return { ok: true, path: raw, contentType };
}

/** Response headers for a served image. */
export function assetResponseHeaders(contentType: string, size: number): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(size),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=60",
  };
  if (contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] = SVG_CONTENT_SECURITY_POLICY;
  }
  return headers;
}
