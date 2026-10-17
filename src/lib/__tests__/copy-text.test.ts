import { describe, expect, it, vi } from "vitest";
import { copyText } from "@/lib/copy-text";

describe("copyText", () => {
  it("uses the clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const exec = vi.fn();
    expect(await copyText("a/b.md", { clipboard: { writeText }, exec })).toBe(true);
    expect(writeText).toHaveBeenCalledWith("a/b.md");
    expect(exec).not.toHaveBeenCalled();
  });

  it("falls back to exec when the clipboard API is missing", async () => {
    const exec = vi.fn().mockReturnValue(true);
    expect(await copyText("x", { clipboard: undefined, exec })).toBe(true);
    expect(exec).toHaveBeenCalledWith("x");
  });

  it("falls back to exec when the clipboard API rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const exec = vi.fn().mockReturnValue(true);
    expect(await copyText("x", { clipboard: { writeText }, exec })).toBe(true);
  });

  it("returns false when both fail", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    expect(await copyText("x", { clipboard: { writeText }, exec: () => false })).toBe(false);
    expect(await copyText("x", { clipboard: null, exec: () => { throw new Error("no"); } })).toBe(false);
    expect(await copyText("x", { clipboard: null })).toBe(false);
  });
});
