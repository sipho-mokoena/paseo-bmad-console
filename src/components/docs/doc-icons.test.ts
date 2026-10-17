import { describe, expect, it } from "vitest";
import { Book, ClipboardCheck, Network, Palette, Route, LayoutDashboard, LayoutTemplate } from "lucide-react";
import { docIcon, groupIcon } from "./doc-icons";

describe("doc icons", () => {
  it("gives every Specs and Design group its own icon", () => {
    const ids = ["brief", "prd", "spec", "architecture", "design", "wireframes", "reviews"];
    expect(new Set(ids.map(groupIcon)).size).toBe(ids.length);
  });

  it("uses well-known document names before the group icon", () => {
    expect(docIcon("design", "DESIGN")).toBe(Palette);
    expect(docIcon("design", "EXPERIENCE")).toBe(Route);
    expect(docIcon("design", "ux-acme")).toBe(LayoutDashboard);
    expect(docIcon("spec", "glossary")).toBe(Book);
    expect(docIcon("spec", "architecture-diagrams")).toBe(Network);
    expect(docIcon("architecture", "review-versions")).toBe(ClipboardCheck);
  });

  it("falls back to the group icon", () => {
    expect(docIcon("wireframes", "03-projects")).toBe(LayoutTemplate);
    expect(docIcon("unknown-group", "x")).toBe(groupIcon("unknown-group"));
  });
});
