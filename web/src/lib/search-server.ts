import { getCachedBmadProject } from "@/lib/bmad/cached-project";
import { createContentProvider } from "@/lib/content-provider";
import { createUserOctokit, getGitHubToken } from "@/lib/github/client";
import type { FileTreeNode, Epic, StoryDetail } from "@/lib/bmad/types";
import type { RepoConfig } from "@/lib/types";
import {
  MAX_RESULTS_PER_GROUP,
  normalizeQuery,
  queryTerms,
  rankAndCap,
  docFileName,
  scoreDoc,
  scoreEpic,
  scoreStory,
  type DocHit,
  type EpicHit,
  type Scored,
  type SearchResponse,
  type StoryHit,
} from "@/lib/search";

const MAX_FILES_PER_REPO = 300;
const MAX_FILE_BYTES = 512 * 1024;
const READ_CONCURRENCY = 8;
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 24;

interface RepoSnapshot {
  epics: Epic[];
  stories: StoryDetail[];
  docs: { path: string; text: string }[];
}

const snapshotCache = new Map<string, { at: number; value: Promise<RepoSnapshot> }>();

function flattenFiles(nodes: FileTreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n.path);
    else if (n.children) flattenFiles(n.children, out);
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function loadSnapshot(
  config: RepoConfig,
  token: string | undefined,
  userId: string,
): Promise<RepoSnapshot> {
  const project = await getCachedBmadProject(config, token, userId);
  if (!project) return { epics: [], stories: [], docs: [] };
  const octokit =
    config.sourceType === "github" && token ? createUserOctokit(token) : undefined;
  const provider = createContentProvider(config, octokit, userId);

  const seen = new Set<string>();
  const paths: string[] = [];
  for (const p of [...project.bmadFiles, ...flattenFiles(project.docsTree)]) {
    if (!p.toLowerCase().endsWith(".md") || seen.has(p)) continue;
    seen.add(p);
    paths.push(p);
    if (paths.length >= MAX_FILES_PER_REPO) break;
  }
  const read = await mapLimit(paths, READ_CONCURRENCY, async (path) => {
    try {
      const text = await provider.getFileContent(path);
      if (text.length > MAX_FILE_BYTES) return { path, text: "" };
      return { path, text };
    } catch {
      return { path, text: "" };
    }
  });
  return { epics: project.epics, stories: project.stories, docs: read };
}

function getSnapshot(
  config: RepoConfig,
  token: string | undefined,
  userId: string,
): Promise<RepoSnapshot> {
  const key = `${userId}:${config.owner}/${config.name}@${config.branch}:${config.lastSyncedAt?.getTime() ?? 0}`;
  const now = Date.now();
  const hit = snapshotCache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  snapshotCache.delete(key);
  const value = loadSnapshot(config, token, userId);
  snapshotCache.set(key, { at: now, value });
  value.catch(() => snapshotCache.delete(key));
  // Bounded: drop expired, then the oldest, entries.
  if (snapshotCache.size > CACHE_MAX_ENTRIES) {
    for (const [k, v] of snapshotCache) {
      if (now - v.at >= CACHE_TTL_MS) snapshotCache.delete(k);
    }
    while (snapshotCache.size > CACHE_MAX_ENTRIES) {
      const oldest = snapshotCache.keys().next().value;
      if (oldest === undefined) break;
      snapshotCache.delete(oldest);
    }
  }
  return value;
}

/** Searches every repo the user owns. Returns null when the query is too short. */
export async function searchAllRepos(
  rawQuery: string,
  userId: string,
  repos: RepoConfig[],
): Promise<SearchResponse | null> {
  const query = normalizeQuery(rawQuery);
  if (!query) return null;
  const terms = queryTerms(query);

  const needsToken = repos.some((r) => r.sourceType !== "local");
  const token = needsToken ? ((await getGitHubToken(userId)) ?? undefined) : undefined;

  const epics: Scored<EpicHit>[] = [];
  const stories: Scored<StoryHit>[] = [];
  const docs: Scored<DocHit>[] = [];
  const notes: string[] = [];

  const snapshots = await Promise.allSettled(
    repos.map((r) => getSnapshot(r, r.sourceType === "local" ? undefined : token, userId)),
  );

  repos.forEach((repo, i) => {
    const project = { owner: repo.owner, name: repo.name, displayName: repo.displayName };
    const res = snapshots[i];
    if (res.status === "rejected") {
      console.error("[search] repo failed", repo.owner, repo.name, res.reason);
      notes.push(`${repo.displayName}: could not be searched`);
      return;
    }
    for (const epic of res.value.epics) {
      const score = scoreEpic(epic, query, terms);
      if (score > 0) epics.push({ score, item: { project, epic } });
    }
    for (const story of res.value.stories) {
      const score = scoreStory(story, query, terms);
      if (score > 0) {
        stories.push({ score, item: { project, story: { ...story, tasks: [] } } });
      }
    }
    for (const doc of res.value.docs) {
      const { score, snippet } = scoreDoc(doc, query, terms);
      if (score > 0) {
        docs.push({
          score,
          item: { project, path: doc.path, name: docFileName(doc.path), snippet },
        });
      }
    }
  });

  return {
    query,
    terms,
    epics: rankAndCap(epics, MAX_RESULTS_PER_GROUP),
    stories: rankAndCap(stories, MAX_RESULTS_PER_GROUP),
    docs: rankAndCap(docs, MAX_RESULTS_PER_GROUP),
    notes,
  };
}
