import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe("type scale", () => {
  it("defines the theme text sizes", () => {
    expect(css).toMatch(/--text-2xs:\s*0\.75rem/);
    expect(css).toMatch(/--text-xs:\s*0\.84375rem/);
    expect(css).toMatch(/--text-sm:\s*0\.9375rem/);
    expect(css).toMatch(/--text-base:\s*1rem/);
    expect(css).toMatch(/--text-lg:\s*1\.125rem/);
  });

  it("uses plain text-sm on the body", () => {
    expect(css).toMatch(/body\s*{\s*@apply[^;]*\btext-sm;/);
  });

  it("keeps form controls at 16px on phones and 15px from md", () => {
    expect(css).toMatch(/textarea,\s*select\s*{\s*font-size:\s*16px/);
    expect(css).toMatch(/textarea,\s*select\s*{\s*font-size:\s*15px/);
  });

  it("has no arbitrary font size below 12px in the source tree", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/text-\[([0-9.]+)(px|rem|em)\]/g)) {
        const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
        if (px < 12) offenders.push(`${path.relative(SRC, file)}: ${m[0]}`);
      }
      if (file.endsWith(".css")) {
        for (const m of text.matchAll(/font-size:\s*([0-9.]+)(px|rem)\b/g)) {
          const px = m[2] === "px" ? Number(m[1]) : Number(m[1]) * 16;
          if (px < 12) offenders.push(`${path.relative(SRC, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
