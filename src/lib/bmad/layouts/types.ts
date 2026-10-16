import type {
  Epic,
  EpicStatus,
  LayoutId,
  ParseErrorEntry,
  SprintStatus,
  StoryDetail,
} from "../types";

/** What an adapter sees: the tree known so far and a way to read files. */
export interface LayoutContext {
  /** Repo-relative file paths known so far (the local provider only walks whitelisted roots). */
  paths: string[];
  /** Top-level directory names (dot-directories included). */
  rootDirectories: string[];
  /** Resolved BMAD output folder, e.g. "_bmad-output". */
  outputDir: string;
  readFile(path: string): Promise<string>;
}

export interface LayoutResult {
  epics: Epic[];
  stories: StoryDetail[];
  sprintStatus: SprintStatus | null;
  epicStatuses: { id: string; status: EpicStatus }[];
  /** Paths that are stories, so the Library does not list them as documents. */
  storyPaths: string[];
  notes: string[];
  parseErrors: ParseErrorEntry[];
  /** Files the adapter attempted to parse (for parseHealth). */
  totalFiles: number;
}

export interface LayoutAdapter {
  id: Exclude<LayoutId, "unknown">;
  label: string;
  /**
   * Roots outside the output folder this layout reads from. The local provider
   * only walks/serves these after the adapter has been detected; dot-directories
   * must also be in DECLARABLE_DOT_DIRS (content-provider/types.ts).
   */
  extraRoots: readonly string[];
  /** Human-readable places the adapter looks for epics (shown when nothing is found). */
  lookedFor(outputDir: string): string[];
  /** 0 = no match; higher = more confident. Runs on the initial tree, must be cheap and pure. */
  detect(ctx: LayoutContext): number;
  load(ctx: LayoutContext): Promise<LayoutResult>;
}

export function emptyResult(): LayoutResult {
  return {
    epics: [],
    stories: [],
    sprintStatus: null,
    epicStatuses: [],
    storyPaths: [],
    notes: [],
    parseErrors: [],
    totalFiles: 0,
  };
}

/** True when the path is inside `<outputDir>/`. */
export function inOutput(ctx: LayoutContext, path: string): boolean {
  return path.startsWith(ctx.outputDir + "/");
}

/** True when `name` is a top-level directory or any known path lives under it. */
export function hasRoot(ctx: LayoutContext, name: string): boolean {
  return ctx.rootDirectories.includes(name) || ctx.paths.some((p) => p.startsWith(name + "/"));
}
