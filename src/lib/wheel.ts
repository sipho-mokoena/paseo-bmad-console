import { useEffect, type RefObject } from "react";

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  /** 0 pixels, 1 lines, 2 pages. */
  deltaMode?: number;
  shiftKey?: boolean;
  ctrlKey?: boolean;
}

export interface ScrollBox {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

const LINE_PX = 16;

/**
 * What a wheel event over a horizontally scrolling chart should do.
 * - a number: the event is ours; scroll sideways by that many pixels (0 = swallow it, for ctrl / pinch zoom)
 * - null: leave it to the browser (no sideways room in that direction, so the page is never trapped)
 */
export function wheelScrollDelta(e: WheelLike, box: ScrollBox): number | null {
  if (e.ctrlKey) return 0;
  const max = box.scrollWidth - box.clientWidth;
  if (max <= 0) return null;
  // Vertical gestures scroll sideways; shift+wheel is already horizontal on most browsers, but not all.
  let raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (e.shiftKey && e.deltaX === 0) raw = e.deltaY;
  if (raw === 0) return null;
  if (raw < 0 && box.scrollLeft <= 0) return null;
  if (raw > 0 && box.scrollLeft >= max - 1) return null;
  const scale = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? box.clientWidth : 1;
  return raw * scale;
}

/** Makes the wheel scroll the element sideways only and stops ctrl+wheel / pinch from zooming the page over it. */
export function useHorizontalWheel(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const d = wheelScrollDelta(e, el);
      if (d === null) return;
      e.preventDefault();
      if (d !== 0) el.scrollLeft += d;
    };
    // Passive listeners cannot preventDefault, so this is attached by hand (React's onWheel is passive).
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}
