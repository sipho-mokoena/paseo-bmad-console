export interface CopyPathTarget {
  /** What the button copies. */
  text: string;
  /** Tooltip: says where the path points. */
  title: string;
}

/** Drops leading "./" and "/" and turns backslashes into "/", collapsing "." and empty parts. */
function cleanRelative(relative: string): string[] {
  return relative
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part !== "" && part !== ".");
}

/** Joins `relative` under `root`, using the root's own separator (backslash roots stay Windows style). */
export function joinRootPath(root: string, relative: string): string {
  const windows = root.includes("\\") && !root.includes("/");
  const sep = windows ? "\\" : "/";
  const base = root.split(/[\\/]+/).filter(Boolean);
  const lead = windows ? (root.startsWith("\\\\") ? "\\\\" : "") : root.startsWith("/") ? "/" : "";
  const parts = [...base, ...cleanRelative(relative)];
  return lead + parts.join(sep);
}

/**
 * The path "Copy path" puts on the clipboard. Local projects: the absolute path on the
 * machine running the server. GitHub projects (no `localRoot`): `<owner>/<repo>/<path>`,
 * never a made-up filesystem path.
 */
export function copyPathTarget(opts: {
  relativePath: string;
  owner: string;
  repo: string;
  localRoot?: string | null;
}): CopyPathTarget {
  const { relativePath, owner, repo, localRoot } = opts;
  if (localRoot && localRoot.trim() !== "") {
    const full = joinRootPath(localRoot.trim(), relativePath);
    return { text: full, title: full };
  }
  const text = [owner, repo, ...cleanRelative(relativePath)].join("/");
  return { text, title: `Path in the repository: ${text}` };
}

/** The folder to show in "Copy path": only local projects have one. */
export function localRootOf(
  config: { sourceType: string; localPath: string | null } | null | undefined,
): string | undefined {
  return config && config.sourceType === "local" && config.localPath ? config.localPath : undefined;
}
