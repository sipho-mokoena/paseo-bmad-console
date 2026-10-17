import matter from "gray-matter";
import { StoryDetail, StoryTask } from "./types";
import { normalizeStoryStatus } from "./utils";
import { MAX_STORY_BODY_CHARS, capBody, plainSummary, removeSection, stripLeadingTitle } from "./body";
import { frontmatterStoryId, parseStoryId } from "./ids";
import { frontmatterDependencies } from "./deps";

export function parseStory(
  content: string,
  filename: string
): StoryDetail | null {
  try {
    // Try to extract ID from filename first
    // Pattern: "N-N-title.md" (e.g., "1-1-project-initialization.md")
    const numericMatch = filename.match(/^(\d+)-(\d+)-/);
    // Legacy pattern: "story-N.md" or "story_N.md"
    const legacyMatch = filename.match(/story[_-]?(\d+(?:[._-]\d+)?)/i);

    // Project-style names: "E1-S1-slug.md"
    const projectMatch = parseStoryId(filename)?.id.includes("-S") ? parseStoryId(filename) : null;

    let id: string;
    let epicId: string;

    if (numericMatch) {
      id = `${numericMatch[1]}.${numericMatch[2]}`;
      epicId = numericMatch[1];
    } else if (projectMatch) {
      id = projectMatch.id;
      epicId = projectMatch.epicId;
    } else if (legacyMatch) {
      id = legacyMatch[1].replace(/[._-]/, ".");
      epicId = id.includes(".") ? id.split(".")[0] : "";
    } else {
      id = filename.replace(/\.md$/i, "");
      epicId = "";
    }

    // Check if content has frontmatter
    const hasFrontmatter = content.trimStart().startsWith("---");
    let body: string;
    let frontmatterStatus: string | undefined;
    let frontmatterTitle: string | undefined;
    let frontmatterEpicId: string | undefined;
    let dependsOn: string[] = [];

    if (hasFrontmatter) {
      const parsed = matter(content);
      body = parsed.content;
      dependsOn = frontmatterDependencies(parsed.data);
      frontmatterStatus = parsed.data.status || parsed.data.state;
      frontmatterTitle = parsed.data.title;
      frontmatterEpicId = parsed.data.epic_id
        ? String(parsed.data.epic_id)
        : parsed.data.epic
          ? String(parsed.data.epic)
          : parsed.data.epicId
            ? String(parsed.data.epicId)
            : undefined;
      if (parsed.data.id) id = String(parsed.data.id);
      else {
        const fmStory = frontmatterStoryId(parsed.data);
        if (fmStory) id = fmStory.id;
      }
      if (frontmatterEpicId) epicId = frontmatterEpicId;
    } else {
      body = content;
    }

    // Extract title from heading: "# Story 1.1: Title" or "# Title"
    const titleMatch = body.match(/^#\s+(?:Story\s+[\d.]+[:\s]+)?(.+)/m);
    const title = frontmatterTitle || titleMatch?.[1]?.trim() || `Story ${id}`;

    // Extract status from "Status: done" line (plain text, not frontmatter)
    const statusLineMatch = body.match(/^Status:\s*(.+)/im);
    const rawStatus = frontmatterStatus || statusLineMatch?.[1]?.trim();
    const statusExplicit = Boolean(rawStatus);
    const status = normalizeStoryStatus(rawStatus);

    // Extract acceptance criteria (markdown; deeper-indented lines stay inside their criterion)
    const acceptanceCriteria: string[] = [];
    const acSection = body.match(
      /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|\n$|$)/i
    );
    if (acSection) {
      acceptanceCriteria.push(...extractCriteria(acSection[1]));
    }

    // Extract tasks from checkboxes
    const tasks: StoryTask[] = [];
    const taskMatches = body.matchAll(/- \[([ xX])\]\s+(.+)/g);
    for (const m of taskMatches) {
      tasks.push({
        completed: m[1].toLowerCase() === "x",
        description: m[2].trim(),
      });
    }

    // Description body: drop the title/status lines and the sections rendered on their own.
    let descBody = stripLeadingTitle(body, "1");
    descBody = descBody.replace(/^Status:.*$/im, "");
    if (acceptanceCriteria.length > 0) descBody = removeSection(descBody, /^Acceptance Criteria\s*$/i);
    if (tasks.length > 0) descBody = removeSection(descBody, /^(?:Tasks?|Subtasks?|Tasks?\s*\/\s*Subtasks?)\b/i);
    const fullBody = capBody(descBody, MAX_STORY_BODY_CHARS);

    return {
      id,
      title: String(title),
      status,
      statusExplicit,
      epicId,
      description: plainSummary(descBody),
      ...(fullBody ? { body: fullBody } : {}),
      acceptanceCriteria,
      tasks,
      completedTasks: tasks.filter((t) => t.completed).length,
      totalTasks: tasks.length,
      ...(dependsOn.length ? { dependsOn } : {}),
    };
  } catch (e) {
    console.error(`Failed to parse story ${filename}:`, e);
    return null;
  }
}

const CRITERION_START = /^(\s*)(?:\d+[.)]\s+|[-*+]\s+)(.+)$|^(\s*)(\*\*(?:Given|And|Then)\*\*.*)$/;

/** Splits an Acceptance Criteria section into criteria; indented sub-bullets stay nested in their parent. */
export function extractCriteria(section: string): string[] {
  const items: string[] = [];
  let baseIndent = -1;
  for (const line of section.replace(/\t/g, "    ").split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(CRITERION_START);
    const indent = m ? (m[1] ?? m[3]).length : line.length - line.trimStart().length;
    if (m && (baseIndent < 0 || indent <= baseIndent)) {
      if (baseIndent < 0) baseIndent = indent;
      items.push((m[2] ?? m[4]).trim());
    } else if (items.length > 0 && baseIndent >= 0 && indent > baseIndent) {
      items[items.length - 1] += "\n" + line.slice(baseIndent);
    }
  }
  return items;
}
