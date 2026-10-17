import { describe, expect, it } from "vitest";
import { FileText } from "lucide-react";
import { groupIcon } from "./doc-icons";

describe("group icons", () => {
  it("gives every Specs and Design group its own icon", () => {
    const ids = ["brief", "prd", "spec", "architecture", "design", "wireframes", "reviews"];
    expect(new Set(ids.map(groupIcon)).size).toBe(ids.length);
  });

  it("falls back to a document icon for unknown groups", () => {
    expect(groupIcon("unknown-group")).toBe(FileText);
  });
});
