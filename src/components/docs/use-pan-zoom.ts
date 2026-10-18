"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  clampScale,
  distance,
  fitTransform,
  midpoint,
  panBy,
  pinchFactor,
  wheelFactor,
  zoomAt,
  type PanZoomState,
} from "@/lib/pan-zoom";

const MARGIN = 24;
const DRAG_THRESHOLD = 4;
const DOUBLE_TAP_MS = 320;

type Pt = { x: number; y: number };

/**
 * Pan and zoom for a viewport element: wheel (native, non-passive), pointer drag, two-finger pinch,
 * double-click or double-tap to fit, and keyboard. Returns the style for the content element.
 */
export function usePanZoom(
  viewportRef: RefObject<HTMLElement | null>,
  content: { width: number; height: number },
) {
  const { width: cw, height: ch } = content;
  const [state, setState] = useState<PanZoomState>({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const stateRef = useRef(state);
  const interacted = useRef(false);

  const commit = useCallback((next: PanZoomState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    commit(fitTransform(cw, ch, el.clientWidth, el.clientHeight, MARGIN));
  }, [viewportRef, cw, ch, commit]);

  const reset = useCallback(() => {
    interacted.current = false;
    fit();
  }, [fit]);

  // Initial fit, and refit on resize until the user has interacted.
  useLayoutEffect(() => {
    fit();
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!interacted.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const pointers = new Map<number, Pt>();
    let start: Pt | null = null;
    let moved = 0;
    let lastTap: { t: number; x: number; y: number } | null = null;
    let lastPinch: { dist: number; mid: Pt } | null = null;

    const local = (clientX: number, clientY: number): Pt => {
      const r = el.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };
    const centre = (): Pt => ({ x: el.clientWidth / 2, y: el.clientHeight / 2 });
    const touched = () => {
      interacted.current = true;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched();
      const p = local(e.clientX, e.clientY);
      const factor = wheelFactor(e.deltaY, e.deltaMode, e.ctrlKey, el.clientHeight || 800);
      commit(zoomAt(stateRef.current, factor, p.x, p.y));
    };

    const pinchState = () => {
      const [a, b] = [...pointers.values()];
      return { dist: distance(a, b), mid: midpoint(a, b) };
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.set(e.pointerId, local(e.clientX, e.clientY));
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // synthetic or already released pointer
      }
      if (pointers.size === 1) {
        start = local(e.clientX, e.clientY);
        moved = 0;
      } else if (pointers.size === 2) {
        lastPinch = pinchState();
        moved = DRAG_THRESHOLD + 1;
      }
      setDragging(true);
    };

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e.clientX, e.clientY);
      pointers.set(e.pointerId, p);
      if (pointers.size >= 2 && lastPinch) {
        const next = pinchState();
        touched();
        let s = zoomAt(stateRef.current, pinchFactor(lastPinch.dist, next.dist), next.mid.x, next.mid.y);
        s = panBy(s, next.mid.x - lastPinch.mid.x, next.mid.y - lastPinch.mid.y);
        lastPinch = next;
        commit(s);
        return;
      }
      if (pointers.size === 1) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        if (start) moved = Math.max(moved, Math.hypot(p.x - start.x, p.y - start.y));
        if (moved >= DRAG_THRESHOLD) {
          touched();
          commit(panBy(stateRef.current, dx, dy));
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      lastPinch = null;
      if (pointers.size === 0) {
        setDragging(false);
        if (e.pointerType === "touch" && e.type === "pointerup" && moved < DRAG_THRESHOLD) {
          const now = Date.now();
          const p = local(e.clientX, e.clientY);
          if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
            lastTap = null;
            interacted.current = false;
            fit();
          } else {
            lastTap = { t: now, x: p.x, y: p.y };
          }
        }
      } else if (pointers.size === 1) {
        // Continue as a pan from the remaining finger without a jump.
        start = [...pointers.values()][0];
        moved = DRAG_THRESHOLD + 1;
      }
    };

    const onDbl = (e: MouseEvent) => {
      e.preventDefault();
      interacted.current = false;
      fit();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 160 : 40;
      const c = centre();
      let next: PanZoomState | null = null;
      const s = stateRef.current;
      switch (e.key) {
        case "+":
        case "=":
          next = zoomAt(s, 1.25, c.x, c.y);
          break;
        case "-":
        case "_":
          next = zoomAt(s, 1 / 1.25, c.x, c.y);
          break;
        case "ArrowLeft":
          next = panBy(s, step, 0);
          break;
        case "ArrowRight":
          next = panBy(s, -step, 0);
          break;
        case "ArrowUp":
          next = panBy(s, 0, step);
          break;
        case "ArrowDown":
          next = panBy(s, 0, -step);
          break;
        case "0":
        case "Home":
          e.preventDefault();
          interacted.current = false;
          fit();
          return;
        default:
          return;
      }
      e.preventDefault();
      touched();
      commit(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("keydown", onKey);
    };
  }, [viewportRef, commit, fit]);

  const style: CSSProperties = {
    transform: `translate(${state.x}px, ${state.y}px) scale(${clampScale(state.scale)})`,
    transformOrigin: "0 0",
    willChange: "transform",
  };
  return { style, reset, dragging, scale: state.scale };
}
