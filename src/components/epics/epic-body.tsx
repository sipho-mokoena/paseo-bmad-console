"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { cn } from "@/lib/utils";

/** Collapsed height; bodies that fit in it render fully with no toggle. */
const COLLAPSED_PX = 320;

interface EpicBodyProps {
  markdown: string;
  owner?: string;
  repo?: string;
  /** Repo-relative path of the epic file, when known (resolves relative images and links). */
  docPath?: string;
}

/** A markdown description (epic or story): first ~320px, with Show more / Show less when it is longer. */
export function EpicBody({ markdown, owner, repo, docPath }: EpicBodyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > COLLAPSED_PX + 24);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [markdown]);

  const collapsed = overflows && !expanded;

  return (
    <div className="space-y-1">
      <div className="relative">
        <div
          ref={ref}
          id={id}
          style={collapsed ? { maxHeight: COLLAPSED_PX } : undefined}
          className={cn("min-w-0 text-foreground/90", collapsed && "overflow-hidden")}
        >
          <MarkdownRenderer
            content={markdown}
            owner={owner}
            repo={repo}
            docPath={docPath}
            variant="compact"
          />
        </div>
        {collapsed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-10 items-center gap-1 rounded-md px-1 text-xs text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:min-h-7"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
            aria-hidden="true"
          />
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
