import { getRepoConfig } from "@/lib/db/helpers";
import { LocalProvider, LocalFileError } from "@/lib/content-provider/local-provider";
import { DEFAULT_OUTPUT_DIR, isPathOutsideNestedOutput } from "@/lib/bmad/parse-config";
import { openProject } from "@/lib/bmad/scope";
import {
  REPO_ASSET_MAX_BYTES,
  assetResponseHeaders,
  validateAssetPath,
} from "@/lib/docs/asset-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDENTIFIER_LENGTH = 200;

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function errorResponse(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: BASE_HEADERS });
}

/**
 * GET /api/repo-asset?owner=&repo=&path=
 *
 * Serves an image that lives inside a BMAD directory of one of the registered
 * local repos, so markdown documents can reference it with a relative URL.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  if (
    !owner ||
    !repo ||
    owner.length > MAX_IDENTIFIER_LENGTH ||
    repo.length > MAX_IDENTIFIER_LENGTH
  ) {
    return errorResponse(400, "Invalid repository");
  }

  const validation = validateAssetPath(url.searchParams.get("path"));
  if (!validation.ok) return errorResponse(validation.status, validation.error);

  // Only registered local repos resolve; the path never comes from the request.
  const config = await getRepoConfig(owner, repo);
  if (!config || config.sourceType !== "local" || !config.localPath) {
    return errorResponse(404, "Not found");
  }

  try {
    const provider = new LocalProvider(config.localPath);

    // Opens the output folder (nested ones are top-segment based, so the extra
    // check below applies) and the roots the detected layout declares.
    const { outputDir } = await openProject(provider);
    if (outputDir !== DEFAULT_OUTPUT_DIR && isPathOutsideNestedOutput(validation.path, outputDir)) {
      return errorResponse(403, "Access denied");
    }

    const buffer = await provider.getFileBuffer(validation.path, REPO_ASSET_MAX_BYTES);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: { ...BASE_HEADERS, ...assetResponseHeaders(validation.contentType, buffer.byteLength) },
    });
  } catch (err) {
    if (err instanceof LocalFileError) {
      switch (err.code) {
        case "INVALID_PATH":
          return errorResponse(400, "Invalid path");
        case "FORBIDDEN":
          return errorResponse(403, "Access denied");
        case "NOT_FOUND":
          return errorResponse(404, "Not found");
        case "TOO_LARGE":
          return errorResponse(413, "File too large");
      }
    }
    if (err instanceof Error && err.message === "LOCAL_DISABLED") {
      return errorResponse(503, "Local file access is disabled");
    }
    // Do not log the error object: messages may contain filesystem paths.
    console.error("[repo-asset] unexpected failure");
    return errorResponse(500, "Internal error");
  }
}
