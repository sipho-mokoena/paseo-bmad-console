/** URL state of the Timeline page: `view`, `scope`, `status`, `q`, `critical`, `all`, `focus`, `ready`, `risk`, `level`. */

export const VIEWS = ["gantt", "graph", "list"] as const;
export type TimelineViewId = (typeof VIEWS)[number];
export const LEVELS = ["stories", "epics"] as const;
export type GraphLevel = (typeof LEVELS)[number];

export const TIMELINE_STATUSES = ["done", "review", "in-progress", "blocked", "ready-for-dev", "backlog"] as const;

export interface TimelineState {
  view: TimelineViewId;
  /** Epic id, or "" for all epics. */
  scope: string;
  status: string[];
  q: string;
  critical: boolean;
  /** Draw every dependency connector, not only the selected item's. */
  all: boolean;
  /** Selected item (story id, epic id at epic level). */
  focus: string;
  ready: boolean;
  risk: boolean;
  level: GraphLevel;
}

export const DEFAULT_TIMELINE_STATE: TimelineState = {
  view: "gantt",
  scope: "",
  status: [],
  q: "",
  critical: false,
  all: false,
  focus: "",
  ready: false,
  risk: false,
  level: "stories",
};

const flag = (v: string | null) => v === "1" || v === "true";

export function parseTimelineState(params: { get(name: string): string | null }): TimelineState {
  const view = params.get("view");
  const level = params.get("level");
  const status = (params.get("status") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (TIMELINE_STATUSES as readonly string[]).includes(s));
  return {
    view: (VIEWS as readonly string[]).includes(view ?? "") ? (view as TimelineViewId) : "gantt",
    scope: (params.get("scope") ?? "").trim(),
    status: [...new Set(status)],
    q: params.get("q") ?? "",
    critical: flag(params.get("critical")),
    all: flag(params.get("all")),
    focus: (params.get("focus") ?? "").trim(),
    ready: flag(params.get("ready")),
    risk: flag(params.get("risk")),
    level: level === "epics" ? "epics" : "stories",
  };
}

/** Writes the state onto a copy of `base`; defaults are omitted and unrelated params are kept. */
export function serializeTimelineState(base: URLSearchParams | string, s: TimelineState): URLSearchParams {
  const out = new URLSearchParams(typeof base === "string" ? base : base.toString());
  for (const k of ["view", "scope", "status", "q", "critical", "all", "focus", "ready", "risk", "level"]) out.delete(k);
  if (s.view !== "gantt") out.set("view", s.view);
  if (s.scope) out.set("scope", s.scope);
  if (s.status.length) out.set("status", s.status.join(","));
  if (s.q.trim()) out.set("q", s.q);
  if (s.critical) out.set("critical", "1");
  if (s.all) out.set("all", "1");
  if (s.focus) out.set("focus", s.focus);
  if (s.ready) out.set("ready", "1");
  if (s.risk) out.set("risk", "1");
  if (s.level !== "stories") out.set("level", s.level);
  return out;
}

/** `<base>/timeline` with optional `focus` / `scope` (entry points on story and epic pages). */
export function timelineHref(base: string, opts: { focus?: string; scope?: string } = {}): string {
  const params = new URLSearchParams();
  if (opts.scope) params.set("scope", opts.scope);
  if (opts.focus) params.set("focus", opts.focus);
  const qs = params.toString();
  return `${base}/timeline${qs ? `?${qs}` : ""}`;
}
