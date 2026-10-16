/**
 * Pure matching, ranking and snippet helpers for the global Search screen.
 * No I/O here: the server gathers the data, this module scores it.
 */
import { epicLabel } from "@/lib/bmad/ids";
import type { Epic, StoryDetail } from "@/lib/bmad/types";
import { markdownToPlainText } from "@/lib/markdown-text";

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 200;
export const MAX_RESULTS_PER_GROUP = 50;
const SNIPPET_RADIUS = 70;

/** Trims, collapses whitespace and caps the length. Returns null when too short to search. */
export function normalizeQuery(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const q = raw.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH).trim();
  return q.length >= MIN_QUERY_LENGTH ? q : null;
}

/** Lower-cased unique terms of a normalized query. */
export function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}

export function includesAll(haystack: string, terms: string[]): boolean {
  const h = haystack.toLowerCase();
  return terms.every((t) => h.includes(t));
}

export interface Scored<T> {
  item: T;
  score: number;
}

export interface Ranked<T> {
  total: number;
  items: T[];
}

/** Sorts by score desc, keeping the input order for ties, and caps the list. */
export function rankAndCap<T>(
  scored: Scored<T>[],
  cap = MAX_RESULTS_PER_GROUP,
): Ranked<T> {
  const items = scored
    .map((s, index) => ({ ...s, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, cap)
    .map((s) => s.item);
  return { total: scored.length, items };
}

// Score tiers: exact id/title, title contains, id contains, other fields.
const S_EXACT = 100;
const S_TITLE = 60;
const S_ID = 50;
const S_COVER = 45;
const S_BODY = 20;

function norm(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

/** Score for an epic, or 0 when it does not match every term. */
export function scoreEpic(epic: Epic, query: string, terms: string[]): number {
  const q = query.toLowerCase();
  const id = norm(epic.id);
  const title = norm(epic.title);
  const all = `${epicLabel(epic.id)} ${epic.id} ${epic.title} ${epic.description}`;
  if (!includesAll(all, terms)) return 0;
  if (q === id || q === `e${id}` || q === `epic ${id}` || q === title) return S_EXACT;
  if (includesAll(epic.title, terms)) return S_TITLE;
  if (terms.length === 1 && (id === terms[0] || `e${id}` === terms[0])) return S_EXACT;
  return S_BODY;
}

/** Score for a story, or 0 when it does not match every term. */
export function scoreStory(story: StoryDetail, query: string, terms: string[]): number {
  const t = story.ticket;
  const covers = t?.covers ?? [];
  const all = [
    story.id,
    story.title,
    story.description,
    ...story.acceptanceCriteria,
    ...covers,
    t?.type ?? "",
    t?.risk ?? "",
  ].join("\n");
  if (!includesAll(all, terms)) return 0;
  const q = query.toLowerCase();
  const id = norm(story.id);
  if (q === id || q === norm(story.title)) return S_EXACT;
  if (terms.length === 1 && id === terms[0]) return S_EXACT;
  if (includesAll(story.title, terms)) return S_TITLE;
  if (includesAll(`${story.id} ${story.title}`, terms)) return S_ID;
  if (terms.length === 1 && covers.some((c) => norm(c) === terms[0])) return S_COVER + 5;
  if (includesAll(covers.join(" "), terms)) return S_COVER;
  return S_BODY;
}

export interface DocCandidate {
  /** Repo-relative path. */
  path: string;
  text: string;
}

export interface DocScore {
  score: number;
  snippet: string | null;
}

export function docFileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

/** Score a document by file name / path first, then by content. Score 0 means no match. */
export function scoreDoc(doc: DocCandidate, query: string, terms: string[]): DocScore {
  const name = docFileName(doc.path);
  const stem = name.replace(/\.[^.]+$/, "");
  const q = query.toLowerCase();
  const nameHit = includesAll(name, terms);
  const pathHit = includesAll(doc.path, terms);
  const contentHit = includesAll(doc.text, terms);
  // Terms may split between path and content ("registry design").
  const combined = includesAll(`${doc.path}\n${doc.text}`, terms);
  if (!nameHit && !pathHit && !contentHit && !combined) return { score: 0, snippet: null };
  const snippet = doc.text ? makeSnippet(markdownToPlainText(doc.text), terms) : null;
  if (stem.toLowerCase() === q || name.toLowerCase() === q) return { score: S_EXACT, snippet };
  if (nameHit) return { score: S_TITLE, snippet };
  if (pathHit) return { score: S_ID - 10, snippet };
  return { score: contentHit ? S_BODY : S_BODY - 10, snippet };
}

/** Index of the earliest occurrence of any term, with the length of that term. */
function firstMatch(text: string, terms: string[]): { index: number; length: number } | null {
  const lower = text.toLowerCase();
  let best: { index: number; length: number } | null = null;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (best === null || i < best.index)) best = { index: i, length: t.length };
  }
  return best;
}

/**
 * Short single-line snippet around the first match, with "…" where text was cut.
 * Returns null when no term occurs in the text.
 */
export function makeSnippet(
  text: string,
  terms: string[],
  radius = SNIPPET_RADIUS,
): string | null {
  const m = firstMatch(text, terms);
  if (!m) return null;
  let start = Math.max(0, m.index - radius);
  let end = Math.min(text.length, m.index + m.length + radius);
  // Avoid cutting words in half where there is whitespace nearby.
  if (start > 0) {
    const ws = text.indexOf(" ", start);
    if (ws >= 0 && ws < m.index) start = ws + 1;
  }
  if (end < text.length) {
    const ws = text.lastIndexOf(" ", end);
    if (ws > m.index + m.length) end = ws;
  }
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "… " : ""}${body}${end < text.length ? " …" : ""}`;
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Splits text into segments, flagging the parts that match a term (case-insensitive). */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const usable = terms.filter(Boolean);
  if (!text || usable.length === 0) return text ? [{ text, match: false }] : [];
  const lower = text.toLowerCase();
  const mask = new Array<boolean>(text.length).fill(false);
  for (const t of usable) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(t, from);
      if (i < 0) break;
      for (let k = i; k < i + t.length; k++) mask[k] = true;
      from = i + Math.max(1, t.length);
    }
  }
  const out: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || mask[i] !== mask[start]) {
      out.push({ text: text.slice(start, i), match: mask[start] });
      start = i;
    }
  }
  return out;
}

// ---- Result shapes shared by the API route and the page -------------------

export interface SearchProjectRef {
  owner: string;
  name: string;
  displayName: string;
}

export interface EpicHit {
  project: SearchProjectRef;
  epic: Epic;
}

export interface StoryHit {
  project: SearchProjectRef;
  /** Tasks are dropped to keep the payload small. */
  story: StoryDetail;
}

export interface DocHit {
  project: SearchProjectRef;
  path: string;
  name: string;
  snippet: string | null;
}

export interface SearchResponse {
  query: string;
  terms: string[];
  epics: Ranked<EpicHit>;
  stories: Ranked<StoryHit>;
  docs: Ranked<DocHit>;
  /** Muted per-project notes, never containing filesystem paths. */
  notes: string[];
}
