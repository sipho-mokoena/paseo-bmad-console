export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/** Source type for a repo: GitHub remote or local filesystem. */
export type SourceType = "github" | "local";

/** Shared repo config shape used across layout, pages, sidebar, and parser. */
export interface RepoConfig {
  owner: string;
  name: string;
  branch: string;
  displayName: string;
  description: string | null;
  sourceType: SourceType;
  localPath: string | null;
  lastSyncedAt: Date | null;
}
