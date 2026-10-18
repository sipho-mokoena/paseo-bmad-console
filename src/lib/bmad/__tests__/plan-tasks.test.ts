import { describe, it, expect } from "vitest";
import { extractPlanTasks } from "../plan-tasks";

const plan = (tasks: string) =>
  `## Intent\n\n- [ ] not a task\n\n## Tasks & Acceptance\n\n<!-- c -->\n\n**Execution:**\n${tasks}\n\n**Acceptance Criteria:**\n- [ ] Given a, when b, then c\n\n## Review Triage Log\n\n- [x] \`x.ts\` -- review item -- not a task\n`;

describe("extractPlanTasks", () => {
  it("reads the template format, checked and unchecked", () => {
    const t = extractPlanTasks(
      plan("- [ ] `src/a.ts` -- add **thing** -- because it _matters_\n- [x] `src/b.ts` -- fix -- done"),
    );
    expect(t).toEqual([
      { description: "src/a.ts -- add thing -- because it matters", completed: false },
      { description: "src/b.ts -- fix -- done", completed: true },
    ]);
  });

  it("handles CRLF line endings", () => {
    const t = extractPlanTasks(plan("- [x] `a.ts` -- one -- r\n- [ ] `b.ts` -- two -- r").replace(/\n/g, "\r\n"));
    expect(t.map((x) => x.description)).toEqual(["a.ts -- one -- r", "b.ts -- two -- r"]);
    expect(t.map((x) => x.completed)).toEqual([true, false]);
  });

  it("accepts a little indentation and capital X, and skips nested sub-bullets", () => {
    const t = extractPlanTasks(
      plan("  - [X] `a.ts` -- one -- r\n    - [ ] `sub.ts` -- nested -- r\n    - plain note\n- [ ] `b.ts` -- two -- r"),
    );
    expect(t.map((x) => x.description)).toEqual(["a.ts -- one -- r", "b.ts -- two -- r"]);
    expect(t[0].completed).toBe(true);
  });

  it("ignores checkboxes outside the Execution block", () => {
    const t = extractPlanTasks(plan("- [ ] `a.ts` -- one -- r"));
    expect(t).toHaveLength(1);
  });

  it("ignores the unfilled template placeholder", () => {
    expect(extractPlanTasks(plan("- [ ] `FILE` -- ACTION -- RATIONALE"))).toEqual([]);
    expect(extractPlanTasks(plan("- [ ] `FILE` -- ACTION -- RATIONALE\n- [ ] `a.ts` -- one -- r"))).toHaveLength(1);
  });

  it("returns nothing without the section or without a body", () => {
    expect(extractPlanTasks("")).toEqual([]);
    expect(extractPlanTasks("## Intent\n\n- [ ] a\n")).toEqual([]);
  });

  it("works with a different bold label before Acceptance Criteria", () => {
    const body = "## Tasks & Acceptance\n\n**Steps:**\n- [ ] `a.ts` -- one -- r\n- [x] `b.ts` -- two -- r\n**Acceptance Criteria:**\n- [ ] ac\n";
    expect(extractPlanTasks(body)).toHaveLength(2);
  });

  it("stops at the next heading when there are no acceptance criteria", () => {
    const body = "## Tasks & Acceptance\n- [ ] `a.ts` -- one -- r\n## Notes\n- [ ] `b.ts` -- two -- r\n";
    expect(extractPlanTasks(body)).toHaveLength(1);
  });
});
