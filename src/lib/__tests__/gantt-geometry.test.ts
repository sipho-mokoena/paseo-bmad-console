import { describe, expect, it } from "vitest";
import { BAR_PAD, COL_W, MIN_BAR_W, barBox, connectorPath } from "../gantt-geometry";

/** Parse `M x1 y1 H xm V y2 H x2` into its numbers. */
function parse(d: string) {
  const m = d.match(/^M(-?[\d.]+) (-?[\d.]+) H(-?[\d.]+) V(-?[\d.]+) H(-?[\d.]+)$/);
  if (!m) throw new Error(`unexpected path: ${d}`);
  const [x1, y1, xm, y2, x2] = m.slice(1).map(Number);
  return { x1, y1, xm, y2, x2 };
}

describe("gantt geometry", () => {
  it("insets bars from both wave edges", () => {
    const box = barBox(2, 3);
    expect(box.left).toBe(2 * COL_W + BAR_PAD);
    expect(box.left + box.width).toBe(3 * COL_W - BAR_PAD);
  });

  it("never makes a bar narrower than the minimum", () => {
    expect(barBox(1, 1).width).toBe(MIN_BAR_W);
  });

  it("leaves a gap of two paddings between bars in adjacent waves", () => {
    const a = barBox(0, 1);
    const b = barBox(1, 2);
    expect(b.left - (a.left + a.width)).toBe(2 * BAR_PAD);
  });

  it("runs the last segment left to right when the bars are in adjacent waves", () => {
    const { x1, xm, x2 } = parse(connectorPath(1, 1, 18, 54));
    expect(x1).toBeLessThan(xm);
    expect(xm).toBeLessThan(x2);
    // room for the arrowhead on the last segment
    expect(x2 - xm).toBeGreaterThanOrEqual(BAR_PAD / 2);
  });

  it("starts at the right edge of the prerequisite bar and ends at the left edge of the dependent", () => {
    const from = barBox(0, 2);
    const to = barBox(3, 4);
    const { x1, x2 } = parse(connectorPath(2, 3, 0, 36));
    expect(x1).toBe(from.left + from.width);
    expect(x2).toBe(to.left);
  });

  it("keeps the bend inside the gap for any distance", () => {
    for (const gap of [0, 1, 2, 5, 12]) {
      const { x1, xm, x2 } = parse(connectorPath(3, 3 + gap, 0, 72));
      expect(xm).toBeGreaterThan(x1);
      expect(xm).toBeLessThan(x2);
    }
  });
});
