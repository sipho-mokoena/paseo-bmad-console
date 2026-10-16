import { FileTreeNode, StoryStatus } from "./types";

/**
 * Statuses that take a story out of the project: it is neither counted nor part of any
 * progress figure. Adapters filter these out and report the count in `layout.notes`.
 */
export function isExcludedStatus(raw: string | undefined): boolean {
  if (!raw) return false;
  const s = raw.toLowerCase().trim();
  return s === "retired" || s === "superseded" || s === "dropped" || s === "deferred";
}

/**
 * Canonical normalizeStoryStatus used across all BMAD parsers.
 * Default fallback is "backlog". Excluded words (see isExcludedStatus) also map to
 * "backlog" here; callers that care check isExcludedStatus first.
 *
 *   done, complete(d)                              -> done
 *   in-progress, started, partially-implemented    -> in-progress
 *   review, in-review, reviewed, built             -> review
 *   blocked                                        -> blocked
 *   ready, ready-for-dev                           -> ready-for-dev
 *   backlog, planned, draft, todo, pending, optional, anything else -> backlog
 */
export function normalizeStoryStatus(raw: string | undefined): StoryStatus {
  if (!raw) return "backlog";
  const s = raw.toLowerCase().trim();
  if (s === "done" || s === "complete" || s === "completed") return "done";
  if (s.includes("progress") || s === "started" || s.startsWith("partially")) return "in-progress";
  if (s === "review" || s === "built" || s.includes("review")) return "review";
  if (s === "blocked") return "blocked";
  if (s === "ready-for-dev" || s === "ready") return "ready-for-dev";
  return "backlog";
}

export function buildFileTree(paths: string[], basePath: string): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  const filtered = paths
    .filter((p) => p.startsWith(basePath))
    .map((p) => p.slice(basePath.length).replace(/^\//, ""));

  for (const relativePath of filtered) {
    const parts = relativePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const fullPath = basePath + "/" + parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: fullPath,
          type: isFile ? "file" : "directory",
          children: isFile ? undefined : [],
        };
        currentLevel.push(existing);
      }

      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  return sortTree(root);
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((n) => ({
      ...n,
      children: n.children ? sortTree(n.children) : undefined,
    }));
}

export function normalizeStoryId(raw: string): string {
  return raw
    .replace(/^(?:story|S)[_-]?/i, "")
    .replace(/[._]/, ".")
    .trim();
}
