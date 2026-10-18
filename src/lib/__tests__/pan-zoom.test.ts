import { describe, it, expect } from "vitest";
import {
  clampScale,
  distance,
  fitTransform,
  midpoint,
  normalizeWheelDelta,
  panBy,
  pinchFactor,
  wheelFactor,
  zoomAt,
} from "../pan-zoom";

describe("pan-zoom", () => {
  it("clamps the scale to 0.25 .. 8", () => {
    expect(clampScale(0.01)).toBe(0.25);
    expect(clampScale(100)).toBe(8);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(NaN)).toBe(1);
  });

  it("zooms about a point and keeps it fixed", () => {
    const s = { x: 30, y: -20, scale: 1.5 };
    const cx = 200;
    const cy = 120;
    const wx = (cx - s.x) / s.scale;
    const wy = (cy - s.y) / s.scale;
    const z = zoomAt(s, 2, cx, cy);
    expect(z.scale).toBe(3);
    expect(z.x + wx * z.scale).toBeCloseTo(cx, 6);
    expect(z.y + wy * z.scale).toBeCloseTo(cy, 6);
  });

  it("does not move when the scale is already clamped", () => {
    const s = { x: 10, y: 10, scale: 8 };
    expect(zoomAt(s, 2, 50, 50)).toEqual(s);
  });

  it("pans by a delta", () => {
    expect(panBy({ x: 1, y: 2, scale: 3 }, 10, -4)).toEqual({ x: 11, y: -2, scale: 3 });
  });

  it("fits and centres the content", () => {
    const f = fitTransform(400, 200, 832, 432, 16);
    expect(f.scale).toBeCloseTo(2, 6);
    expect(f.x).toBeCloseTo((832 - 800) / 2, 6);
    expect(f.y).toBeCloseTo((432 - 400) / 2, 6);
    const tall = fitTransform(100, 1000, 500, 500, 0);
    expect(tall.scale).toBeCloseTo(0.5, 6);
    expect(tall.x).toBeCloseTo(225, 6);
    expect(tall.y).toBeCloseTo(0, 6);
  });

  it("falls back to identity for empty sizes", () => {
    expect(fitTransform(0, 0, 100, 100)).toEqual({ x: 0, y: 0, scale: 1 });
  });

  it("computes pinch helpers", () => {
    expect(pinchFactor(100, 150)).toBe(1.5);
    expect(pinchFactor(0, 150)).toBe(1);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 10 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 15 });
  });

  it("normalises the wheel delta by deltaMode", () => {
    expect(normalizeWheelDelta(10, 0)).toBe(10);
    expect(normalizeWheelDelta(3, 1)).toBe(48);
    expect(normalizeWheelDelta(1, 2, 600)).toBe(600);
  });

  it("zooms in for negative deltas and out for positive ones", () => {
    expect(wheelFactor(-300, 0)).toBeCloseTo(Math.exp(0.45), 6);
    expect(wheelFactor(300, 0)).toBeLessThan(1);
    expect(wheelFactor(-5, 0, true)).toBeGreaterThan(wheelFactor(-5, 0, false));
    expect(wheelFactor(0, 0)).toBe(1);
  });
});
