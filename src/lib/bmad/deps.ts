import { parseEpicId, parseStoryId } from "./ids";
import type { EpicDependency, StoryDetail } from "./types";

/**
 * Normalises a dependency declaration from frontmatter into canonical ids.
 * Tolerates arrays, comma / semicolon separated strings, numbers, `none` / `n/a` / `null`,
 * and entries that carry a trailing note ("E1-S4 (partial)"). Each entry resolves to a story id
 * ("E1-S4", "1.2") or an epic id ("E2", "3"); anything else (prose, slugs) is dropped.
 * The result is de-duplicated and keeps the declared order.
 */
export function parseDependencyRefs(raw: unknown): string[] {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v === undefined || v === null || v === false) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === "number") return void parts.push(String(v));
    if (typeof v === "string") return void v.split(/[,;]/).forEach((p) => parts.push(p));
  };
  walk(raw);
  const out: string[] = [];
  for (const part of parts) {
    const token = part.trim().replace(/^["'`]+|["'`]+$/g, "").split(/[\s(]/)[0]?.replace(/[`*_:.]+$/, "") ?? "";
    if (!token || /^(none|n\/a|na|null|-)$/i.test(token)) continue;
    const ref = parseStoryId(token)?.id ?? parseEpicId(token);
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** First of the given frontmatter keys that is present (the dependency key spellings seen in the wild). */
export function frontmatterDependencies(fm: Record<string, unknown> | null | undefined): string[] {
  if (!fm) return [];
  for (const key of ["depends_on", "dependsOn", "depends-on", "after"]) {
    if (fm[key] !== undefined) return parseDependencyRefs(fm[key]);
  }
  return [];
}

/**
 * The one accessor for a story's prerequisites: ticket-tree stories keep theirs in
 * `ticket.after`, stories of the other layouts in `dependsOn`. Refs are story ids,
 * or epic ids (meaning "that whole epic").
 */
export function storyDeps(story: Pick<StoryDetail, "ticket" | "dependsOn">): string[] {
  return story.ticket?.after ?? story.dependsOn ?? [];
}

/**
 * Epic-level dependencies from frontmatter. A story ref ("E1-S1") becomes a dependency on its
 * epic, with the story id kept as the `needs` text. Self references are dropped.
 */
export function frontmatterEpicDependencies(
  fm: Record<string, unknown> | null | undefined,
  self?: string,
): EpicDependency[] {
  const out: EpicDependency[] = [];
  for (const ref of frontmatterDependencies(fm)) {
    const story = parseStoryId(ref);
    const id = story ? story.epicId : ref;
    if (id === self) continue;
    const have = out.find((d) => d.id === id);
    if (have) {
      if (story && !have.needs?.includes(ref)) have.needs = have.needs ? `${have.needs}, ${ref}` : ref;
    } else out.push({ id, ...(story ? { needs: ref } : {}) });
  }
  return out;
}
