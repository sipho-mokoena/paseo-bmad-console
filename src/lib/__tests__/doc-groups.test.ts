import { describe, expect, it } from "vitest";
import { classifyDocs, flattenDocs, pickDoc } from "../doc-groups";

const O = "_bmad-output/initiative-sovren";
const sovren = [
  `${O}/initiative-sovren.md`,
  `${O}/tickets.toml`,
  `${O}/epic-dashboard/epic-dashboard.md`,
  `${O}/brief-sovren/addendum.md`,
  `${O}/brief-sovren/brief-sovren.md`,
  `${O}/brief-sovren/.memlog.md`,
  `${O}/prd-sovren/addendum.md`,
  `${O}/prd-sovren/.memlog.md`,
  `${O}/prd-sovren/prd-sovren.md`,
  `${O}/prd-sovren/reconcile-inputs.md`,
  `${O}/prd-sovren/review-rubric.md`,
  `${O}/spec-sovren/architecture-diagrams.md`,
  `${O}/spec-sovren/glossary.md`,
  `${O}/spec-sovren/spec-sovren.md`,
  `${O}/architecture-sovren/architecture-sovren.md`,
  `${O}/architecture-sovren/walkthrough.html`,
  `${O}/architecture-sovren/reviews/review-versions.md`,
  `${O}/architecture-sovren/reviews/review-adversarial.md`,
  `${O}/ux-sovren/review-ux.md`,
  `${O}/ux-sovren/ux-sovren.md`,
  `${O}/ux-sovren/EXPERIENCE.md`,
  `${O}/ux-sovren/DESIGN.md`,
  `${O}/ux-sovren/.memlog.md`,
  `${O}/ux-sovren/wireframes/10-late.md`,
  `${O}/ux-sovren/wireframes/02-organisation.md`,
  `${O}/ux-sovren/wireframes/00-machine-console.md`,
  `${O}/ux-sovren/wireframes/svg/00a.svg`,
  `${O}/ux-sovren/wireframes/source/00a.wireloom`,
];

const names = (g: { docs: { name: string }[] }) => g.docs.map((d) => d.name);

describe("classifyDocs - sovren", () => {
  const { specs, design } = classifyDocs(sovren);

  it("orders spec groups Brief, PRD, Spec, Architecture", () => {
    expect(specs.map((g) => g.label)).toEqual(["Brief", "PRD", "Spec", "Architecture"]);
  });

  it("puts the main file first, the rest alphabetical, addenda and reviews last", () => {
    expect(names(specs[0])).toEqual(["brief-sovren", "addendum"]);
    expect(names(specs[1])).toEqual(["prd-sovren", "reconcile-inputs", "addendum", "review-rubric"]);
    expect(names(specs[2])).toEqual(["spec-sovren", "architecture-diagrams", "glossary"]);
    expect(names(specs[3])).toEqual(["architecture-sovren", "review-adversarial", "review-versions"]);
  });

  it("excludes dotfiles, html, svg, tickets and epic files", () => {
    const all = [...flattenDocs(specs), ...flattenDocs(design)].map((d) => d.path);
    expect(all.some((p) => p.includes(".memlog"))).toBe(false);
    expect(all.some((p) => /\.(html|svg|wireloom|toml)$/.test(p))).toBe(false);
    expect(all.some((p) => p.includes("epic-dashboard"))).toBe(false);
    expect(all).not.toContain(`${O}/initiative-sovren.md`);
  });

  it("orders design: DESIGN, EXPERIENCE, folder doc, wireframes numerically, reviews last", () => {
    expect(design.map((g) => g.label)).toEqual(["Design", "Wireframes", "Reviews"]);
    expect(names(design[0])).toEqual(["DESIGN", "EXPERIENCE", "ux-sovren"]);
    expect(names(design[1])).toEqual(["00-machine-console", "02-organisation", "10-late"]);
    expect(names(design[2])).toEqual(["review-ux"]);
  });
});

describe("classifyDocs - BMad v6 layout", () => {
  const P = "_bmad-output/planning-artifacts";
  const v6 = [
    `${P}/product-brief-app.md`,
    `${P}/prd.md`,
    `${P}/prd-validation-report.md`,
    `${P}/architecture.md`,
    `${P}/project-context.md`,
    `${P}/research-market.md`,
    `${P}/spec-extra.md`,
    `${P}/ux-design-specification.md`,
    `${P}/epics.md`,
    `${P}/architecture/index.md`,
    `${P}/architecture/decisions/adr.md`,
    `${P}/notes.html`,
    `_bmad-output/implementation-artifacts/sprint-status.yaml`,
  ];
  const { specs, design } = classifyDocs(v6);

  it("classifies planning artifacts by file name", () => {
    expect(specs.map((g) => g.id)).toEqual(["brief", "prd", "spec", "architecture"]);
    expect(names(specs[0])).toEqual(["product-brief-app"]);
    expect(names(specs[1])).toEqual(["prd", "prd-validation-report"]);
    expect(names(specs[2])).toEqual(["project-context", "research-market", "spec-extra"]);
    expect(names(design[0])).toEqual(["ux-design-specification"]);
  });

  it("includes sharded folders and ignores unrelated files", () => {
    expect(specs[3].docs.map((d) => d.path)).toContain(`${P}/architecture/index.md`);
    expect(specs[3].docs.map((d) => d.path)).toContain(`${P}/architecture/decisions/adr.md`);
    const all = flattenDocs(specs).map((d) => d.path);
    expect(all).not.toContain(`${P}/epics.md`);
  });

  it("matches *ux*spec* files", () => {
    expect(flattenDocs(classifyDocs([`${P}/my-ux-spec-v2.md`]).design)).toHaveLength(1);
  });
});

describe("empty projects", () => {
  it("yields no groups, so both tabs are hidden", () => {
    const r = classifyDocs(["_bmad-output/implementation-artifacts/sprint-status.yaml", "_bmad-output/epics.md"]);
    expect(r.specs).toEqual([]);
    expect(r.design).toEqual([]);
    expect(classifyDocs([])).toEqual({ specs: [], design: [] });
  });

  it("shows only the tab that has documents", () => {
    const r = classifyDocs([`${O}/prd-x/prd-x.md`]);
    expect(r.specs).toHaveLength(1);
    expect(r.design).toHaveLength(0);
  });
});

describe("pickDoc", () => {
  const { specs } = classifyDocs(sovren);
  it("defaults to the first document and falls back when invalid", () => {
    expect(pickDoc(specs, undefined)?.name).toBe("brief-sovren");
    expect(pickDoc(specs, "nope.md")?.name).toBe("brief-sovren");
    expect(pickDoc(specs, `${O}/spec-sovren/glossary.md`)?.name).toBe("glossary");
    expect(pickDoc([], "x")).toBeNull();
  });
});
