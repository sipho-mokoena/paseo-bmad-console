import { INITIATIVE_TICKETS, parseTicketTree } from "../parse-tickets";
import { emptyResult, inOutput, type LayoutAdapter, type LayoutResult } from "./types";

/** bmad-ticket layout: `<out>/initiative-*\/tickets.toml` + `<epic>/tickets.toml` + `*-plan.md`. */
export const ticketTreeAdapter: LayoutAdapter = {
  id: "ticket-tree",
  label: "Ticket tree",
  extraRoots: [],

  lookedFor(outputDir) {
    return [
      `${outputDir}/initiative-*/tickets.toml`,
      `${outputDir}/initiative-*/<epic>/tickets.toml`,
    ];
  },

  detect(ctx) {
    return ctx.paths.some((p) => inOutput(ctx, p) && INITIATIVE_TICKETS.test(p)) ? 60 : 0;
  },

  async load(ctx): Promise<LayoutResult> {
    const result = emptyResult();
    const bmadPaths = ctx.paths.filter((p) => inOutput(ctx, p));
    try {
      const tree = await parseTicketTree({ getFileContent: ctx.readFile }, bmadPaths);
      return { ...result, epics: tree.epics, stories: tree.stories, totalFiles: tree.files };
    } catch (e) {
      result.parseErrors.push({
        file: ctx.outputDir,
        error: e instanceof Error ? e.message : "Failed to parse ticket tree.",
        contentType: "epic",
      });
      return result;
    }
  },
};
