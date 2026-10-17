/** Size of the Timeline details pane, as a percentage of the split, remembered in localStorage. */
export const DETAILS_DEFAULT = 30;
export const DETAILS_MIN = 20;
export const DETAILS_MAX = 50;
export const CHART_MIN = 40;
export const PANE_SIZE_KEY = "bmad-console:timeline-details-size";

export interface SizeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Clamp a details size to its limits; anything that is not a finite number becomes the default. */
export function clampDetailsSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DETAILS_DEFAULT;
  return Math.min(DETAILS_MAX, Math.max(DETAILS_MIN, value));
}

/** The details size parsed from a stored string; null or invalid values give the default. */
export function parseDetailsSize(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === "") return DETAILS_DEFAULT;
  return clampDetailsSize(Number(raw));
}

/** The browser's localStorage, or null on the server or when storage is blocked. */
export function browserStorage(): SizeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDetailsSize(storage: SizeStorage | null = browserStorage()): number {
  try {
    return parseDetailsSize(storage?.getItem(PANE_SIZE_KEY));
  } catch {
    return DETAILS_DEFAULT;
  }
}

export function writeDetailsSize(size: number, storage: SizeStorage | null = browserStorage()): void {
  try {
    storage?.setItem(PANE_SIZE_KEY, String(Math.round(clampDetailsSize(size) * 10) / 10));
  } catch {
    // Storage full or unavailable: the size just is not remembered.
  }
}
