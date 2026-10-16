"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, FileText, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", segment: "", icon: Eye },
  { label: "Epics", segment: "epics", icon: Map },
  { label: "Library", segment: "docs", icon: FileText },
];

export function ProjectTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Project sections"
      className="sticky top-[calc(var(--app-header-h)+env(safe-area-inset-top))] z-20 flex h-12 shrink-0 md:h-9 items-center gap-1 overflow-x-auto border-b bg-background px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const href = tab.segment ? `${basePath}/${tab.segment}` : basePath;
        const active = tab.segment
          ? pathname.startsWith(href)
          : pathname === basePath || pathname === `${basePath}/`;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (active) window.dispatchEvent(new CustomEvent("section-reset"));
            }}
            className={cn(
              "inline-flex h-10 shrink-0 md:h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5 [&_svg]:stroke-[1.5]",
              active && "bg-accent font-medium text-foreground",
            )}
          >
            <tab.icon aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
