"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { StateMessage } from "@/components/shared/list-kit";

/** Unknown epic or story: a flat message with a way back. */
export default function EpicsNotFound() {
  const { owner, repo, epicId } = useParams<{ owner: string; repo: string; epicId?: string }>();
  const base = `/repo/${owner}/${repo}`;
  const back = epicId
    ? { href: `${base}/epics/${epicId}`, label: "Back to the epic" }
    : { href: `${base}/epics`, label: "Back to epics" };
  return (
    <StateMessage role="status" className="flex-col gap-3">
      <p>{epicId ? "This story or epic does not exist in this project." : "Not found."}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4">
        {epicId && (
          <Link
            href={`${base}/epics`}
            className="inline-flex h-10 items-center rounded-md px-1 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-7"
          >
            All epics
          </Link>
        )}
        <Link
          href={back.href}
          className="inline-flex h-10 items-center rounded-md px-1 text-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden md:h-7"
        >
          {back.label}
        </Link>
      </div>
    </StateMessage>
  );
}
