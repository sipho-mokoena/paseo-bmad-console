/** Width of one wave column in the Gantt chart, in px. */
export const COL_W = 104;

/**
 * Space kept free on the left and right of every bar, in px. Bars in neighbouring waves
 * are separated by twice this, which leaves room for a connector and its arrowhead.
 */
export const BAR_PAD = 12;

/** Smallest bar width, in px. */
export const MIN_BAR_W = 12;

/** Left offset and width of a bar that spans `start` to `end` (in waves). */
export function barBox(start: number, end: number): { left: number; width: number } {
  return {
    left: start * COL_W + BAR_PAD,
    width: Math.max((end - start) * COL_W - 2 * BAR_PAD, MIN_BAR_W),
  };
}

/**
 * Elbow connector from the right edge of the prerequisite bar (ends at wave `fromEnd`) to the
 * left edge of the dependent bar (starts at wave `toStart`). Because bars are inset by BAR_PAD,
 * the last segment always has room to run left to right, so the arrowhead points at the bar
 * instead of flipping when the two bars sit in adjacent waves.
 */
export function connectorPath(fromEnd: number, toStart: number, y1: number, y2: number): string {
  const x1 = fromEnd * COL_W - BAR_PAD;
  const x2 = toStart * COL_W + BAR_PAD;
  const xm = x2 - x1 >= 2 * BAR_PAD ? (x1 + x2) / 2 : x1 + BAR_PAD / 2;
  return `M${x1} ${y1} H${xm} V${y2} H${x2}`;
}
