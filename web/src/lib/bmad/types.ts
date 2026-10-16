export type StoryStatus =
  | "done"
  | "in-progress"
  | "review"
  | "blocked"
  | "ready-for-dev"
  | "backlog"
  | "unknown";

export type EpicStatus = "done" | "in-progress" | "not-started";

export interface SprintStatus {
  sprint?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  stories: SprintStoryEntry[];
}

export interface SprintStoryEntry {
  id: string;
  title: string;
  status: StoryStatus;
  epicId?: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  status: EpicStatus;
  stories: string[];
  totalStories: number;
  completedStories: number;
  progressPercent: number;
}

export interface StoryDetail {
  id: string;
  title: string;
  status: StoryStatus;
  /**
   * True when the story markdown declared a status explicitly (frontmatter
   * `status:` or a `Status:` line in the body). When false, `status` came
   * from the default fallback and sprint-status.yaml may override it.
   */
  statusExplicit?: boolean;
  epicId: string;
  epicTitle?: string;
  description: string;
  acceptanceCriteria: string[];
  tasks: StoryTask[];
  completedTasks: number;
  totalTasks: number;
  /** Ticket-tree metadata (bmad-ticket); absent for BMad v6 stories. */
  ticket?: StoryTicketMeta;
}

export interface StoryTicketMeta {
  type?: string;
  risk?: string;
  /** Human in the loop */
  hitl?: boolean;
  covers: string[];
  /** Prerequisite ticket refs, e.g. "4.1" or "1.10" */
  after: string[];
  assignee?: string;
  blockedReason?: string;
}

export interface StoryTask {
  description: string;
  completed: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export type BmadFileMetadata = {
  status?: string;
  stepsCompleted?: string[];
  lastStep?: string | number;
  title?: string;
  completedAt?: string;
  workflowType?: string;
};

export type ParsedBmadFile = {
  contentType: "markdown" | "yaml" | "json" | "text";
  frontmatter: Record<string, unknown> | null;
  metadata: BmadFileMetadata | null;
  body: string;
  rawContent: string;
  parseError: string | null;
};

export interface ParseErrorEntry {
  file: string;
  error: string;
  contentType: string;
}

export interface ParseHealthReport {
  errors: ParseErrorEntry[];
  totalFiles: number;
  successfulFiles: number;
}

export type LayoutId = "v6-default" | "v6-project" | "ticket-tree" | "v4" | "unknown";

/** Which project layout the parser detected, and whether it found anything in it. */
export interface LayoutInfo {
  id: LayoutId;
  /** Short human label, e.g. "BMad v6 · project layout". */
  label: string;
  /** Observations worth showing: exclusions, status disagreements, skipped files. */
  notes: string[];
  /** False when no layout matched or the matching layout produced no epics. */
  recognised: boolean;
  /** Where epics were looked for (output-dir relative or repo-relative patterns). */
  lookedFor: string[];
}

export interface BmadProject {
  owner: string;
  repo: string;
  branch: string;
  displayName: string;
  sprintStatus: SprintStatus | null;
  epics: Epic[];
  stories: StoryDetail[];
  fileTree: FileTreeNode[];
  bmadFiles: string[];
  docsTree: FileTreeNode[];
  docsFolderName: string | null;
  parseHealth?: ParseHealthReport;
  layout: LayoutInfo;
  /**
   * Adapter-declared roots outside the output folder (e.g. ".agentic"), with their
   * file trees, for the Library. Empty for most layouts.
   */
  extraTrees?: { root: string; tree: FileTreeNode[] }[];
  totalStories: number;
  completedStories: number;
  inProgressStories: number;
  progressPercent: number;
}
