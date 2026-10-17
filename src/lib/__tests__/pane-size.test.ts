import { describe, expect, it } from "vitest";
import {
  DETAILS_DEFAULT,
  DETAILS_MAX,
  DETAILS_MIN,
  PANE_SIZE_KEY,
  clampDetailsSize,
  parseDetailsSize,
  readDetailsSize,
  writeDetailsSize,
  type SizeStorage,
} from "../pane-size";

const memory = (init: Record<string, string> = {}): SizeStorage & { data: Record<string, string> } => ({
  data: init,
  getItem(k) {
    return k in this.data ? this.data[k] : null;
  },
  setItem(k, v) {
    this.data[k] = v;
  },
});

describe("pane size", () => {
  it("clamps to the limits and falls back to the default for non-numbers", () => {
    expect(clampDetailsSize(5)).toBe(DETAILS_MIN);
    expect(clampDetailsSize(90)).toBe(DETAILS_MAX);
    expect(clampDetailsSize(35)).toBe(35);
    expect(clampDetailsSize(NaN)).toBe(DETAILS_DEFAULT);
    expect(clampDetailsSize("40")).toBe(DETAILS_DEFAULT);
  });

  it("parses stored values and rejects invalid ones", () => {
    expect(parseDetailsSize("42")).toBe(42);
    expect(parseDetailsSize("99")).toBe(DETAILS_MAX);
    for (const bad of [null, undefined, "", "  ", "abc", "NaN", "Infinity"]) expect(parseDetailsSize(bad)).toBe(DETAILS_DEFAULT);
  });

  it("round-trips through an injected storage", () => {
    const st = memory();
    expect(readDetailsSize(st)).toBe(DETAILS_DEFAULT);
    writeDetailsSize(37.26, st);
    expect(st.data[PANE_SIZE_KEY]).toBe("37.3");
    expect(readDetailsSize(st)).toBe(37.3);
    writeDetailsSize(200, st);
    expect(readDetailsSize(st)).toBe(DETAILS_MAX);
  });

  it("is safe without storage or with a throwing one", () => {
    const boom: SizeStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    };
    expect(readDetailsSize(null)).toBe(DETAILS_DEFAULT);
    expect(readDetailsSize(boom)).toBe(DETAILS_DEFAULT);
    expect(() => writeDetailsSize(30, boom)).not.toThrow();
    expect(() => writeDetailsSize(30, null)).not.toThrow();
  });

  it("ignores garbage in storage", () => {
    expect(readDetailsSize(memory({ [PANE_SIZE_KEY]: "wide" }))).toBe(DETAILS_DEFAULT);
  });
});
