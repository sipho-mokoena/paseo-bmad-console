/** Pure maths for a pan and zoom surface. Coordinates are relative to the viewport's top-left. */

export type PanZoomState = { x: number; y: number; scale: number };

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;

export function clampScale(scale: number, min = MIN_SCALE, max = MAX_SCALE): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(max, Math.max(min, scale));
}

/** Scale by `factor` while keeping the content point under (cx, cy) fixed on screen. */
export function zoomAt(state: PanZoomState, factor: number, cx: number, cy: number): PanZoomState {
  const scale = clampScale(state.scale * factor);
  const f = scale / state.scale;
  return { scale, x: cx - (cx - state.x) * f, y: cy - (cy - state.y) * f };
}

export function panBy(state: PanZoomState, dx: number, dy: number): PanZoomState {
  return { ...state, x: state.x + dx, y: state.y + dy };
}

/** Scale the content to fit the viewport inside `margin` on every side, centred. */
export function fitTransform(
  contentW: number,
  contentH: number,
  viewW: number,
  viewH: number,
  margin = 16,
): PanZoomState {
  if (!(contentW > 0) || !(contentH > 0) || !(viewW > 0) || !(viewH > 0)) {
    return { x: 0, y: 0, scale: 1 };
  }
  const availW = Math.max(1, viewW - margin * 2);
  const availH = Math.max(1, viewH - margin * 2);
  const scale = clampScale(Math.min(availW / contentW, availH / contentH));
  return { scale, x: (viewW - contentW * scale) / 2, y: (viewH - contentH * scale) / 2 };
}

export function pinchFactor(prevDist: number, nextDist: number): number {
  if (!(prevDist > 0) || !(nextDist > 0)) return 1;
  return nextDist / prevDist;
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Wheel delta in pixels. deltaMode 0 = pixels, 1 = lines, 2 = pages. */
export function normalizeWheelDelta(deltaY: number, deltaMode: number, pageSize = 800): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * pageSize;
  return deltaY;
}

/** Zoom factor for a wheel event. Pinch gestures (ctrlKey) send small deltas, so they get a larger gain. */
export function wheelFactor(deltaY: number, deltaMode: number, ctrlKey = false, pageSize = 800): number {
  const px = normalizeWheelDelta(deltaY, deltaMode, pageSize);
  const px2 = Math.max(-600, Math.min(600, px));
  return Math.exp(-px2 * (ctrlKey ? 0.01 : 0.0015));
}
