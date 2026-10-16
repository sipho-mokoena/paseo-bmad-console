import { describe, expect, it } from "vitest";
import { classifyDocs, flattenDocs, pickDoc } from "../doc-groups";

const O = "_bmad-output/initiative-acme";
const acme = [
  `${O}/initiative-acme.md`,
  `${O}/tickets.toml`,
  `${O}/epic-dashboard/epic-dashboard.md`,
  `${O}/brief-acme/addendum.md`,
  `${O}/brief-acme/brief-acme.md`,
  `${O}/brief-acme/.memlog.md`,
  `${O}/prd-acme/addendum.md`,
  `${O}/prd-acme/.memlog.md`,
  `${O}/prd-acme/prd-acme.md`,
  `${O}/prd-acme/reconcile-inputs.md`,
  `${O}/prd-acme/review-rubric.md`,
  `${O}/spec-acme/architecture-diagrams.md`,
  `${O}/spec-acme/glossary.md`,
  `${O}/spec-acme/spec-acme.md`,
  `${O}/architecture-acme/architecture-acme.md`,
  `${O}/architecture-acme/walkthrough.html`,
  `${O}/architecture-acme/reviews/review-versions.md`,
  `${O}/architecture-acme/reviews/review-adversarial.md`,
  `${O}/ux-acme/review-ux.md`,
  `${O}/ux-acme/ux-acme.md`,
  `${O}/ux-acme/EXPERIENCE.md`,
  `${O}/ux-acme/DESIGN.md`,
  `${O}/ux-acme/.memlog.md`,
  `${O}/ux-acme/wireframes/10-late.md`,
  `${O}/ux-acme/wireframes/02-organisation.md`,
  `${O}/ux-acme/wireframes/00-machine-console.md`,
  `${O}/ux-acme/wireframes/svg/00a.svg`,
  `${O}/ux-acme/wireframes/source/00a.wireloom`,
];

const names = (g: { docs: { name: string }[] }) => g.docs.map((d) => d.name);

describe("classifyDocs - acme", () => {
  const { specs, design } = classifyDocs(acme);

  it("orders spec groups Brief, PRD, Spec, Architecture", () => {
    expect(specs.map((g) => g.label)).toEqual(["Brief", "PRD", "Spec", "Architecture"]);
  });

  it("puts the main file first, the rest alphabetical, addenda and reviews last", () => {
    expect(names(specs[0])).toEqual(["brief-acme", "addendum"]);
    expect(names(specs[1])).toEqual(["prd-acme", "reconcile-inputs", "addendum", "review-rubric"]);
    expect(names(specs[2])).toEqual(["spec-acme", "architecture-diagrams", "glossary"]);
    expect(names(specs[3])).toEqual(["architecture-acme", "review-adversarial", "review-versions"]);
  });

  it("excludes dotfiles, html, svg, tickets and epic files", () => {
    const all = [...flattenDocs(specs), ...flattenDocs(design)].map((d) => d.path);
    expect(all.some((p) => p.includes(".memlog"))).toBe(false);
    expect(all.some((p) => /\.(html|svg|wireloom|toml)$/.test(p))).toBe(false);
    expect(all.some((p) => p.includes("epic-dashboard"))).toBe(false);
    expect(all).not.toContain(`${O}/initiative-acme.md`);
  });

  it("orders design: DESIGN, EXPERIENCE, folder doc, wireframes numerically, reviews last", () => {
    expect(design.map((g) => g.label)).toEqual(["Design", "Wireframes", "Reviews"]);
    expect(names(design[0])).toEqual(["DESIGN", "EXPERIENCE", "ux-acme"]);
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
  const { specs } = classifyDocs(acme);
  it("defaults to the first document and falls back when invalid", () => {
    expect(pickDoc(specs, undefined)?.name).toBe("brief-acme");
    expect(pickDoc(specs, "nope.md")?.name).toBe("brief-acme");
    expect(pickDoc(specs, `${O}/spec-acme/glossary.md`)?.name).toBe("glossary");
    expect(pickDoc([], "x")).toBeNull();
  });
});
