import { createContentProvider } from "@/lib/content-provider";
import { openProject } from "@/lib/bmad/scope";
import { extractDocTitle } from "@/lib/doc-titles";
import type { RepoConfig } from "@/lib/types";

const MAX_DOCS = 120;
const READ_CONCURRENCY = 8;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { at: number; value: Promise<Record<string, string>> }>();

async function load(config: RepoConfig, paths: string[]): Promise<Record<string, string>> {
  const provider = createContentProvider(config);
  if (config.sourceType === "local") await openProject(provider).catch(() => undefined);
  const out: Record<string, string> = {};
  let next = 0;
  const workers = Array.from({ length: Math.min(READ_CONCURRENCY, paths.length) }, async () => {
    while (next < paths.length) {
      const path = paths[next++];
      try {
        const title = extractDocTitle(await provider.getFileContent(path));
        if (title) out[path] = title;
      } catch {
        // Unreadable: the list keeps the file name.
      }
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Titles of the given documents, keyed by path. Local projects only: GitHub sources would need one
 * API call per document, so they keep file names. Documents past the cap keep theirs too.
 */
export async function loadDocTitles(config: RepoConfig, paths: readonly string[]): Promise<Record<string, string>> {
  if (config.sourceType !== "local") return {};
  const list = [...new Set(paths)].slice(0, MAX_DOCS);
  const key = `${config.owner}/${config.name}:${config.lastSyncedAt?.getTime() ?? 0}:${list.join("|")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  for (const [k, v] of cache) if (Date.now() - v.at >= CACHE_TTL_MS) cache.delete(k);
  const value = load(config, list);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}
