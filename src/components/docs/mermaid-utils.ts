/** Pure helpers for the Mermaid diagram block (kept free of React and mermaid itself). */

export function isMermaidLanguage(className: string | undefined | null): boolean {
  if (!className) return false;
  return /(?:^|\s)language-mermaid(?:\s|$)/i.test(className);
}

const DIAGRAM_NAMES: Record<string, string> = {
  flowchart: "Flowchart",
  graph: "Flowchart",
  sequencediagram: "Sequence diagram",
  statediagram: "State diagram",
  "statediagram-v2": "State diagram",
  erdiagram: "Entity relationship diagram",
  classdiagram: "Class diagram",
  gantt: "Gantt chart",
  pie: "Pie chart",
  journey: "User journey",
  mindmap: "Mind map",
  timeline: "Timeline",
  gitgraph: "Git graph",
};

/** Accessible label from an optional `title:` line, else from the diagram type on the first line. */
export function getDiagramLabel(source: string): string {
  const lines = source.split(/\r?\n/);
  const title = lines.find((l) => /^\s*title\s*[:\s]/i.test(l));
  if (title) {
    const t = title.replace(/^\s*title\s*:?\s*/i, "").trim();
    if (t) return `Diagram: ${t}`;
  }
  const first = lines.find((l) => l.trim() && !l.trim().startsWith("%%") && l.trim() !== "---");
  const word = first?.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return DIAGRAM_NAMES[word] ? `Diagram: ${DIAGRAM_NAMES[word]}` : "Diagram";
}

/** Natural width of a rendered SVG from its viewBox, or null. */
export function getSvgNaturalWidth(svg: string): number | null {
  const m = svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+[\d.]+"/);
  if (!m) return null;
  const w = parseFloat(m[1]);
  return Number.isFinite(w) && w > 0 ? w : null;
}

export type MermaidMode = "dark" | "light";

export function getMermaidConfig(mode: MermaidMode) {
  const dark = mode === "dark";
  const text = dark ? "#fafafa" : "#18181b";
  const line = dark ? "#a1a1aa" : "#52525b";
  const bg = dark ? "#181b1a" : "#ffffff";
  const raised = dark ? "#1e2120" : "#f4f4f5";
  const hairline = dark ? "#252b2a" : "#e4e4e7";
  const primary = "#20744a";
  return {
    startOnLoad: false,
    securityLevel: "strict" as const,
    theme: dark ? ("dark" as const) : ("default" as const),
    // Plain SVG text, never HTML labels (foreignObject).
    flowchart: { htmlLabels: false },
    themeVariables: {
      darkMode: dark,
      background: bg,
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      primaryColor: dark ? "#1b3a2b" : "#dcf1e4",
      primaryTextColor: text,
      primaryBorderColor: primary,
      secondaryColor: raised,
      secondaryTextColor: text,
      secondaryBorderColor: hairline,
      tertiaryColor: raised,
      tertiaryTextColor: text,
      tertiaryBorderColor: hairline,
      lineColor: line,
      textColor: text,
      mainBkg: dark ? "#1b3a2b" : "#dcf1e4",
      nodeBorder: primary,
      nodeTextColor: text,
      clusterBkg: raised,
      clusterBorder: hairline,
      titleColor: text,
      edgeLabelBackground: bg,
      noteBkgColor: raised,
      noteTextColor: text,
      noteBorderColor: hairline,
      actorBkg: raised,
      actorBorder: primary,
      actorTextColor: text,
      actorLineColor: line,
      signalColor: line,
      signalTextColor: text,
      labelBoxBkgColor: raised,
      labelBoxBorderColor: hairline,
      labelTextColor: text,
      loopTextColor: text,
      attributeBackgroundColorOdd: raised,
      attributeBackgroundColorEven: bg,
    },
  };
}
