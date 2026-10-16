import yaml from "js-yaml";
import { SprintStatus, SprintStoryEntry, EpicStatus } from "./types";
import { normalizeStoryStatus } from "./utils";
import { parseEpicId, parseStoryId } from "./ids";

export function normalizeEpicStatus(raw: string | undefined): EpicStatus {
  if (!raw) return "not-started";
  const s = raw.toLowerCase().trim();
  if (s === "done" || s === "complete" || s === "completed") return "done";
  if (s.includes("progress") || s === "started") return "in-progress";
  return "not-started";
}

export interface SprintEpicEntry {
  id: string;
  status: EpicStatus;
}

export interface ParsedSprintData {
  sprintStatus: SprintStatus;
  epicStatuses: SprintEpicEntry[];
}

export function parseSprintStatus(content: string): ParsedSprintData | null {
  try {
    const data = yaml.load(content) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;

    const stories: SprintStoryEntry[] = [];
    const epicStatuses: SprintEpicEntry[] = [];

    // Handle "development_status" map format (costingo style):
    // development_status:
    //   epic-1: done
    //   1-1-project-initialization: done
    const devStatus = data.development_status as Record<string, string> | undefined;
    if (devStatus && typeof devStatus === "object") {
      for (const [key, value] of Object.entries(devStatus)) {
        const statusStr = String(value);

        // Retrospective entries: skip ("epic-1-retrospective", "E1-retrospective")
        if (key.includes("retrospective")) continue;

        // Epic entries: "epic-N: status" (v6 default) or "E1: status" / "DEFERRED-E10: status"
        const epicId = parseEpicId(key);
        if (epicId) {
          epicStatuses.push({ id: epicId, status: normalizeEpicStatus(statusStr) });
          continue;
        }

        // Story entries: "N-N-title: status" (e.g. "1-1-project-initialization")
        // or "E1-S1-title: status" (project-specific ids)
        const story = parseStoryId(key);
        if (story) {
          stories.push({
            id: story.id,
            title: key,
            status: normalizeStoryStatus(statusStr),
            epicId: story.epicId,
          });
          continue;
        }
      }
    }

    // Also handle legacy array format
    const rawStories = (data.stories || data.story_status || data.items) as
      | Record<string, unknown>[]
      | undefined;
    if (Array.isArray(rawStories)) {
      for (const s of rawStories) {
        if (typeof s === "object" && s !== null) {
          stories.push({
            id: String(s.id || s.story_id || s.name || ""),
            title: String(s.title || s.name || s.id || ""),
            status: normalizeStoryStatus(String(s.status || "")),
            epicId: s.epic_id ? String(s.epic_id) : s.epic ? String(s.epic) : undefined,
          });
        }
      }
    }

    const sprintStatus: SprintStatus = {
      sprint: data.sprint ? String(data.sprint) : data.project ? String(data.project) : undefined,
      status: data.status ? String(data.status) : undefined,
      startDate: data.start_date ? String(data.start_date) : data.generated ? String(data.generated) : undefined,
      endDate: data.end_date ? String(data.end_date) : undefined,
      stories,
    };

    return { sprintStatus, epicStatuses };
  } catch (e) {
    console.error("Failed to parse sprint status YAML:", e);
    return null;
  }
}

/**
 * Raw status words of the `development_status` map, keyed by canonical story id.
 * Lets layouts tell "retired" from "backlog", which normalizeStoryStatus folds together.
 */
export function sprintRawStatuses(content: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const data = yaml.load(content) as Record<string, unknown> | undefined;
    const dev = data?.development_status;
    if (!dev || typeof dev !== "object") return out;
    for (const [key, value] of Object.entries(dev as Record<string, unknown>)) {
      if (key.includes("retrospective") || parseEpicId(key)) continue;
      const story = parseStoryId(key);
      if (story) out.set(story.id, String(value));
    }
  } catch {
    // parseSprintStatus reports the syntax error
  }
  return out;
}
