"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RepoConfig } from "@/lib/types";

const routeLabels: Record<string, string> = {
  profile: "Profile",
  overview: "Overview",
  epics: "Epics",
  docs: "Library",
  search: "Search",
  admin: "Admin",
};

function getRouteLabel(segment: string): string {
  return routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

const iconButton =
  "inline-flex size-9 md:size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden [&_svg]:size-4";

export function AppHeader({ repos = [] }: { repos?: RepoConfig[] }) {
  const pathname = usePathname();
  const { extraSegments } = useBreadcrumb();
  const segments = pathname.split("/").filter(Boolean);

  let parents: { label: string; href?: string; onClick?: () => void }[] = [];
  let title = "Projects";
  let projectName: string | null = null;

  if (segments[0] === "repo" && segments.length >= 3) {
    const owner = segments[1];
    const name = segments[2];
    const repo = repos.find((r) => r.owner === owner && r.name === name);
    projectName = repo?.displayName ?? name;
    const base = `/repo/${owner}/${name}`;
    if (!segments[3]) {
      title = "Overview";
    } else if (extraSegments.length > 0) {
      title = extraSegments[extraSegments.length - 1].label;
      parents = extraSegments.slice(0, -1).map((seg) => ({
        label: seg.label,
        onClick: seg.onClick,
        href: seg.onClick ? undefined : `${base}/${segments[3]}`,
      }));
    } else {
      title = getRouteLabel(segments[3]);
    }
  } else if (segments.length >= 1) {
    title = getRouteLabel(segments[0]);
  }

  return (
    <header className="sticky top-0 z-30 flex h-[calc(var(--app-header-h)+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b bg-background pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] md:px-2">
      <SidebarTrigger className="size-9 md:size-7 shrink-0 text-muted-foreground" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1.5 pl-1 text-[13px] md:text-sm"
      >
        {parents.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className="hidden items-center gap-1.5 sm:flex">
            {crumb.onClick ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </button>
            ) : (
              <Link
                href={crumb.href!}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
        ))}
        <span aria-current="page" className="truncate font-medium">
          {title}
        </span>
        {projectName && (
          <span className="truncate text-muted-foreground">{projectName}</span>
        )}
        {parents.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More" className={`${iconButton} sm:hidden`}>
                <MoreHorizontal />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {parents.map((crumb, i) =>
                crumb.onClick ? (
                  <DropdownMenuItem key={i} onClick={crumb.onClick}>
                    Back to {crumb.label}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={i} asChild>
                    <Link href={crumb.href!}>Back to {crumb.label}</Link>
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
      <ScrollProgress />
    </header>
  );
}
