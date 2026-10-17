import Link from "next/link";
import { StateMessage } from "@/components/shared/list-kit";

/** Shown when a project has no dependency data at all (or no epics). */
export function TimelineEmpty({ base, hasEpics }: { base: string; hasEpics: boolean }) {
  return (
    <div className="min-w-0 pb-4" role="region" aria-label="Timeline">
      <StateMessage className="flex-col gap-2">
        <p className="text-foreground">{hasEpics ? "No dependencies found in this project" : "No epics found in this project"}</p>
        <p className="max-w-prose">
          {hasEpics
            ? "The timeline is drawn from dependencies: epic `after` rows and story `after` lists in a ticket tree, or `depends_on` in epic and story frontmatter. Add some and refresh the project."
            : "Epics and their dependencies will show here once they are defined in the planning artifacts."}
        </p>
        <Link
          href={`${base}/epics`}
          className="inline-flex h-10 items-center rounded-md px-2 text-sm text-foreground underline underline-offset-2 outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:h-8"
        >
          Back to epics
        </Link>
      </StateMessage>
    </div>
  );
}
