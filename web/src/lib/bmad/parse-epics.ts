import { Epic, EpicStatus } from "./types";
import { capBody, plainSummary } from "./body";

export function parseEpics(content: string): { epics: Epic[]; error?: string } {
  try {
    const epics: Epic[] = [];
    const lines = content.split("\n");

    let currentEpic: Partial<Epic> | null = null;
    let bodyLines: string[] = [];
    let storyIds: string[] = [];

    for (const line of lines) {
      const epicMatch = line.match(
        /^##\s+(?:Epic\s+)?(\d+)[\s:.—-]+(.+)/i
      );
      if (epicMatch) {
        if (currentEpic && currentEpic.id) {
          epics.push(finalizeEpic(currentEpic, bodyLines, storyIds));
        }
        currentEpic = {
          id: epicMatch[1],
          title: epicMatch[2].trim(),
        };
        bodyLines = [];
        storyIds = [];
        continue;
      }

      if (currentEpic) {
        bodyLines.push(line);
        const storyRef = line.match(/(?:story|S)[\s-]*(\d+(?:\.\d+)?)/gi);
        if (storyRef) {
          for (const ref of storyRef) {
            const id = ref.replace(/(?:story|S)[\s-]*/i, "").trim();
            if (id && !storyIds.includes(id)) {
              storyIds.push(id);
            }
          }
        }

      }
    }

    if (currentEpic && currentEpic.id) {
      epics.push(finalizeEpic(currentEpic, bodyLines, storyIds));
    }

    return { epics };
  } catch (e) {
    console.error("[BMAD Parse] parseEpics failed:", e);
    return { epics: [], error: e instanceof Error ? e.message : "Unknown error parsing epics" };
  }
}

function finalizeEpic(
  partial: Partial<Epic>,
  bodyLines: string[],
  storyIds: string[]
): Epic {
  const body = capBody(bodyLines.join("\n"));
  return {
    id: partial.id || "0",
    title: partial.title || "Untitled Epic",
    description: plainSummary(bodyLines.join("\n")),
    ...(body ? { body } : {}),
    status: "not-started" as EpicStatus,
    stories: storyIds,
    totalStories: storyIds.length,
    completedStories: 0,
    progressPercent: 0,
  };
}
