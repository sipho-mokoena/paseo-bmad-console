import type { ContentProvider } from "@/lib/content-provider";
import { resolveBmadOutputDir } from "./parse-config";
import { detectLayouts, type LayoutCandidate, type LayoutContext } from "./layouts";

export interface ProjectScope {
  outputDir: string;
  /** Every file path the provider can list after the layout's extra roots were opened. */
  paths: string[];
  rootDirectories: string[];
  ctx: LayoutContext;
  /** Adapters that match, best first. */
  candidates: LayoutCandidate[];
  /** Extra roots that were opened on the provider. */
  openedRoots: string[];
  /** Problems while opening extra roots (shown as layout notes). */
  notes: string[];
}

/**
 * Resolves the output folder, detects the layout on the initial tree, then opens the
 * extra roots the matching adapters declare (e.g. ".agentic") and re-reads the tree.
 *
 * Both the project parser and every code path that reads project files for the UI
 * (file viewer, asset route, search) go through this, so a fresh LocalProvider ends up
 * with the same access list. The provider re-validates every root name itself, and only
 * a fixed set of dot-directories can ever be opened (see DECLARABLE_DOT_DIRS).
 */
export async function openProject(provider: ContentProvider): Promise<ProjectScope> {
  const initialTree = await provider.getTree();
  const { outputDir, paths: resolvedPaths } = await resolveBmadOutputDir(provider, initialTree.paths);
  const ctx: LayoutContext = {
    paths: resolvedPaths,
    rootDirectories: initialTree.rootDirectories,
    outputDir,
    readFile: (p) => provider.getFileContent(p),
  };
  const candidates = detectLayouts(ctx);

  const notes: string[] = [];
  const openedRoots: string[] = [];
  if (provider.extendBmadDirs) {
    const wanted = new Set(candidates.flatMap((c) => c.adapter.extraRoots));
    for (const root of wanted) {
      if (!initialTree.rootDirectories.includes(root)) continue;
      try {
        provider.extendBmadDirs(root);
        openedRoots.push(root);
      } catch (e) {
        notes.push(`Could not open "${root}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (openedRoots.length > 0) {
    try {
      const refreshed = await provider.getTree();
      ctx.paths = refreshed.paths;
    } catch (e) {
      notes.push(`Could not scan ${openedRoots.join(", ")}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    outputDir,
    paths: ctx.paths,
    rootDirectories: initialTree.rootDirectories,
    ctx,
    candidates,
    openedRoots,
    notes,
  };
}
