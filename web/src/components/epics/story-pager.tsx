"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PagerTarget {
  id: string;
  title: string;
  href: string;
}

const LINK =
  "flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** Previous / next story footer, with `j`/`k` and arrow keys when no field has focus. */
export function StoryPager({ prev, next }: { prev: PagerTarget | null; next: PagerTarget | null }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      if ((e.key === "k" || e.key === "ArrowLeft") && prev) router.push(prev.href);
      else if ((e.key === "j" || e.key === "ArrowRight") && next) router.push(next.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Story navigation"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3"
    >
      {prev ? (
        <Link href={prev.href} rel="prev" className={cn(LINK)} title="Previous story (k)">
          <ArrowLeft className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="shrink-0 font-mono text-xs">{prev.id}</span>
          <span className="min-w-0 truncate">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} rel="next" className={cn(LINK, "ml-auto")} title="Next story (j)">
          <span className="shrink-0 font-mono text-xs">{next.id}</span>
          <span className="min-w-0 truncate">{next.title}</span>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}
