import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { LocalProvider } from "../local-provider";
import { getBmadProject } from "@/lib/bmad/parser";
import type { RepoConfig } from "@/lib/types";

let tmp: string;
let outside: string;

async function w(rel: string, content = "x") {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
}

beforeEach(async () => {
  process.env.ENABLE_LOCAL_FS = "true";
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dr-test-"));
  outside = await fs.mkdtemp(path.join(os.tmpdir(), "dr-out-"));
  await fs.writeFile(path.join(outside, "secret.md"), "secret");
});
afterEach(async () => {
  delete process.env.ENABLE_LOCAL_FS;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(outside, { recursive: true, force: true });
});

describe("declared extra roots", () => {
  it("allows a declared .agentic and docs, rejects other dot dirs and traversal", async () => {
    await w(".agentic/a.md", "A");
    await w(".secret/b.md", "B");
    await w(".git/config", "C");
    await w("docs/d.md", "D");
    const p = new LocalProvider(tmp);
    await expect(p.getFileContent(".agentic/a.md")).rejects.toThrow(/Access denied/);
    p.extendBmadDirs(".agentic");
    p.extendBmadDirs("docs");
    expect(await p.getFileContent(".agentic/a.md")).toBe("A");
    expect(await p.getFileContent("docs/d.md")).toBe("D");
    for (const bad of [".secret", ".git", ".", "..", "a/b", ".agentic/x", ".env", "a\0b"]) {
      expect(() => p.extendBmadDirs(bad)).toThrow();
    }
    await expect(p.getFileContent(".secret/b.md")).rejects.toThrow(/Access denied/);
    await expect(p.getFileContent(".agentic/../.secret/b.md")).rejects.toThrow(/Access denied/);
    await expect(p.getFileContent(".agentic/../../x")).rejects.toThrow();
    await expect(p.getFileContent(".agentic/a\0.md")).rejects.toThrow(/null bytes/);
  });

  it("rejects symlinks, including a symlinked directory inside a declared root", async () => {
    await w(".agentic/a.md", "A");
    await fs.symlink(path.join(outside, "secret.md"), path.join(tmp, ".agentic/link.md"));
    await fs.symlink(outside, path.join(tmp, ".agentic/dir"));
    const p = new LocalProvider(tmp);
    p.extendBmadDirs(".agentic");
    await expect(p.getFileContent(".agentic/link.md")).rejects.toThrow(/Symlinks/);
    await expect(p.getFileContent(".agentic/dir/secret.md")).rejects.toThrow(/traversal/);
    const tree = await p.getTree();
    expect(tree.paths).toEqual([".agentic/a.md"]);
  });

  it("does not list a dot dir until it is declared", async () => {
    await w(".agentic/a.md", "A");
    await w("_bmad-output/epics/E1-x.md", "---\nepic_id: E1\n---\n# E1: X\n");
    const p = new LocalProvider(tmp);
    expect((await p.getTree()).paths).toEqual(["_bmad-output/epics/E1-x.md"]);
  });
});

describe("getBmadProject on a real LocalProvider", () => {
  const cfg = { owner: "local", name: "t", branch: "", displayName: "t", sourceType: "local" } as RepoConfig;

  it("opens .agentic through the detected layout", async () => {
    await w("_bmad-output/epics/E1-x.md", "---\nepic_id: E1\nname: X\n---\n# E1: X\n");
    await w(".agentic/epics/E1-x/E1-S1-one/spec.md", "---\nstatus: done\n---\n# E1-S1: One\n\nHello.\n");
    await w(".other/epics/E1-x/E1-S2-two/spec.md", "---\nstatus: done\n---\n# nope\n");
    const p = (await getBmadProject(cfg, new LocalProvider(tmp)))!;
    expect(p.layout.id).toBe("v6-project");
    expect(p.stories.map((s) => s.id)).toEqual(["E1-S1"]);
    expect(p.completedStories).toBe(1);
  });

  it("reports an odd project (only _bmad and a README) as not recognised", async () => {
    await w("_bmad/core/config.yaml", "output_folder: _bmad-output\n");
    await w("README.md", "hi");
    const p = (await getBmadProject(cfg, new LocalProvider(tmp)))!;
    expect(p.layout.recognised).toBe(false);
    expect(p.layout.lookedFor.length).toBeGreaterThan(0);
  });
});
