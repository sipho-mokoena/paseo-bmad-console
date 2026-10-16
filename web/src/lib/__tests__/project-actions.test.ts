import { describe, expect, it } from "vitest";
import { shouldShowSettings } from "@/lib/project-actions";

describe("shouldShowSettings", () => {
  it("hides settings for local projects", () => {
    expect(shouldShowSettings({ sourceType: "local" })).toBe(false);
  });
  it("shows settings for GitHub projects", () => {
    expect(shouldShowSettings({ sourceType: "github" })).toBe(true);
  });
});
