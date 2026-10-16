// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { isMermaidLanguage, getDiagramLabel, getMermaidConfig, getSvgNaturalWidth } from "./mermaid-utils";

describe("mermaid-utils", () => {
  it("detects the mermaid language from a code className", () => {
    expect(isMermaidLanguage("hljs language-mermaid")).toBe(true);
    expect(isMermaidLanguage("language-mermaid")).toBe(true);
    expect(isMermaidLanguage("language-mermaidx")).toBe(false);
    expect(isMermaidLanguage("language-ts")).toBe(false);
    expect(isMermaidLanguage(undefined)).toBe(false);
  });

  it("builds an aria label from title or diagram type", () => {
    expect(getDiagramLabel("flowchart LR\n a-->b")).toBe("Diagram: Flowchart");
    expect(getDiagramLabel("erDiagram\n A ||--o{ B : has")).toBe("Diagram: Entity relationship diagram");
    expect(getDiagramLabel("---\ntitle: My thing\n---\nflowchart TD")).toBe("Diagram: My thing");
    expect(getDiagramLabel("weird")).toBe("Diagram");
  });

  it("always uses strict security and no auto start", () => {
    for (const m of ["dark", "light"] as const) {
      const c = getMermaidConfig(m);
      expect(c.securityLevel).toBe("strict");
      expect(c.startOnLoad).toBe(false);
    }
    expect(getMermaidConfig("dark").theme).toBe("dark");
    expect(getMermaidConfig("light").theme).toBe("default");
  });

  it("reads the natural width from the viewBox", () => {
    expect(getSvgNaturalWidth('<svg viewBox="0 0 320.5 100">')).toBe(320.5);
    expect(getSvgNaturalWidth("<svg>")).toBeNull();
  });
});

describe("MermaidDiagram", () => {
  it("shows a muted error with the source when mermaid throws, without crashing", async () => {
    vi.resetModules();
    vi.doMock("mermaid", () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn().mockRejectedValue(new Error("Parse error on line 2")),
      },
    }));
    vi.doMock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
    const React = await import("react");
    const { createRoot } = await import("react-dom/client");
    const { act } = await import("react");
    const { MermaidDiagram } = await import("./mermaid-diagram");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const el = document.createElement("div");
    document.body.appendChild(el);
    await act(async () => {
      createRoot(el).render(React.createElement(MermaidDiagram, { source: "flowchart LR\n a -->" }));
    });
    for (let i = 0; i < 50 && !el.querySelector('[role="alert"]'); i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
    }
    const alert = el.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain("Parse error on line 2");
    expect(alert?.querySelector("code")?.textContent).toBe("flowchart LR\n a -->");
    expect(el.querySelector("svg")).toBeNull();
  });
});
