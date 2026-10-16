import type { Epic, StoryDetail } from "./types";

/**
 * Project data is serialised into client components. Detail pages need the full
 * markdown `body`; list pages must not ship it. Returns copies without `body`.
 */
export function withoutEpicBody(epic: Epic): Epic {
  if (epic.body === undefined) return epic;
  const { body, ...rest } = epic;
  void body;
  return rest;
}

export function withoutStoryBody(story: StoryDetail): StoryDetail {
  if (story.body === undefined) return story;
  const { body, ...rest } = story;
  void body;
  return rest;
}

export const epicsForList = (epics: Epic[]): Epic[] => epics.map(withoutEpicBody);
export const storiesForList = (stories: StoryDetail[]): StoryDetail[] => stories.map(withoutStoryBody);
