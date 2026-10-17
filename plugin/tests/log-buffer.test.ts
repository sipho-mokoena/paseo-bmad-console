import { describe, expect, it } from "vitest";
import { LogBuffer } from "../server/log-buffer";

describe("LogBuffer", () => {
  it("keeps only the newest lines up to its capacity", () => {
    const buffer = new LogBuffer({ maxLines: 3 });
    buffer.push("a\nb\nc\nd\ne\n");
    expect(buffer.tail()).toEqual(["c", "d", "e"]);
    expect(buffer.total).toBe(5);
    expect(buffer.capacity).toBe(3);
  });

  it("joins a line split across chunks per stream", () => {
    const buffer = new LogBuffer();
    buffer.push("hel", "stdout");
    buffer.push("oops", "stderr");
    buffer.push("lo\n", "stdout");
    buffer.push("!\n", "stderr");
    expect(buffer.tail()).toEqual(["hello", "[err] oops!"]);
  });

  it("includes an unfinished line in the tail and flushes it on request", () => {
    const buffer = new LogBuffer();
    buffer.push("ready\nlistening");
    expect(buffer.tail()).toEqual(["ready", "listening"]);
    expect(buffer.total).toBe(1);
    buffer.flush();
    expect(buffer.total).toBe(2);
    expect(buffer.tail()).toEqual(["ready", "listening"]);
  });

  it("returns at most the requested number of lines and never more than capacity", () => {
    const buffer = new LogBuffer({ maxLines: 5 });
    buffer.push("1\n2\n3\n4\n5\n6\n");
    expect(buffer.tail(2)).toEqual(["5", "6"]);
    expect(buffer.tail(100)).toHaveLength(5);
    expect(buffer.tail(0)).toEqual([]);
  });

  it("truncates very long lines and bounds an unterminated line", () => {
    const buffer = new LogBuffer({ maxLines: 10, maxLineLength: 20 });
    buffer.push(`${"x".repeat(50)}\n`);
    expect(buffer.tail()[0]).toBe(`${"x".repeat(20)}...`);
    buffer.push("y".repeat(500));
    expect(buffer.tail().at(-1)?.length).toBeLessThanOrEqual(23);
  });

  it("strips ANSI colour codes and normalises CRLF", () => {
    const buffer = new LogBuffer();
    buffer.push("\u001b[32m ready\u001b[0m\r\nnext\r\n");
    expect(buffer.tail()).toEqual([" ready", "next"]);
  });

  it("clears everything", () => {
    const buffer = new LogBuffer();
    buffer.push("a\nb");
    buffer.clear();
    expect(buffer.tail()).toEqual([]);
  });
});
