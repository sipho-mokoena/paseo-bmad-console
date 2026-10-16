import { Epic, EpicStatus } from "./types";
import matter from "gray-matter";
import { capBody, plainSummary, stripLeadingTitle } from "./body";
import { frontmatterEpicId, frontmatterTitle, parseEpicId } from "./ids";

/**
 * Parse a single epic from an individual markdown file.
 * Supports two formats:
 *
 * 1. Frontmatter-based:
 *    ---
 *    id: 1
 *    title: Project Setup
 *    ---
 *    Description and story references...
 *
 * 2. Heading-based (same as epics.md format but for a single epic):
 *    ## Epic 1: Project Setup
 *    Description and story references...
 *
 * Falls back to extracting id from filename (e.g., epic-1.md → id "1").
 */
export function parseEpicFile(
  content: string,
  filename: string,
): Epic | null {
  try {
    const { data: fm, content: body } = matter(content);

    const id = extractId(fm, body, filename);
    if (!id) return null;

    const title = extractTitle(fm, body, id);
    const storyIds = extractStoryReferences(body);
    const description = plainSummary(body);
    const fullBody = capBody(stripLeadingTitle(body));

    return {
      id,
      title,
      description,
      ...(fullBody ? { body: fullBody } : {}),
      status: "not-started" as EpicStatus,
      stories: storyIds,
      totalStories: storyIds.length,
      completedStories: 0,
      progressPercent: 0,
    };
  } catch {
    return null;
  }
}

function extractId(
  fm: Record<string, unknown>,
  body: string,
  filename: string,
): string | null {
  // 1. From frontmatter: epic_id, epicId, epic, id (numeric or project style, "E1")
  if (fm.id !== undefined && fm.id !== null && frontmatterEpicId(fm) === null) {
    // Unrecognised shape: keep the legacy behaviour of taking `id` verbatim
    if (fm.epic_id === undefined && fm.epicId === undefined && fm.epic === undefined) {
      return String(fm.id);
    }
  }
  const fmId = frontmatterEpicId(fm);
  if (fmId) return fmId;

  // 2. From heading: ## Epic 1: Title  or  ## 1 - Title
  const headingMatch = body.match(/^##\s+(?:Epic\s+)?(\d+)[\s:.—-]/im);
  if (headingMatch) return headingMatch[1];

  // 3. From filename: epic-1.md, epic_1.md, 1-title.md, 1.md
  const nameWithoutExt = filename.replace(/\.md$/i, "");
  const fileMatch = nameWithoutExt.match(/^(?:epic[_-]?)?(\d+)(?:[_-]|$)/i);
  if (fileMatch) return fileMatch[1];

  // 4. Project-style filename: E1-foundations.md, DEFERRED-E10-slug.md
  const projectMatch = nameWithoutExt.match(/^((?:[A-Za-z]+-)*[Ee]\d+)(?:[_-]|$)/);
  if (projectMatch) return parseEpicId(projectMatch[1]);

  return null;
}

function extractTitle(
  fm: Record<string, unknown>,
  body: string,
  id: string,
): string {
  // 1. From frontmatter: title, name
  const fmTitle = frontmatterTitle(fm);
  if (fmTitle) return fmTitle;

  // 2. From heading
  const headingMatch = body.match(
    /^##\s+(?:Epic\s+)?\d+[\s:.—-]+(.+)/im,
  );
  if (headingMatch) return headingMatch[1].trim();

  // 3. From H1 heading: # Title
  const h1Match = body.match(/^#\s+(.+)/m);
  if (h1Match) {
    const h1 = h1Match[1].trim();
    // Strip "Epic N:" prefix if present
    const stripped = h1.replace(/^(?:Epic\s+)?\d+[\s:.—-]+/i, "").trim();
    return stripped || h1;
  }

  return `Epic ${id}`;
}

function extractStoryReferences(body: string): string[] {
  const ids: string[] = [];
  const matches = body.matchAll(/(?:story|S)[\s-]*(\d+(?:\.\d+)?)/gi);
  for (const m of matches) {
    const id = m[1];
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}
