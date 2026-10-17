"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, MoreHorizontal, RefreshCw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { epicName } from "@/lib/bmad/ids";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRefreshRepo } from "@/components/shared/refresh-repo-button";
import { projectFromPathname } from "@/lib/project-route";
import type { RepoConfig } from "@/lib/types";

const routeLabels: Record<string, string> = {
  overview: "Overview",
  epics: "Epics",
  docs: "Library",
  search: "Search",
};

function getRouteLabel(segment: string): string {
  return routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const iconButton =
  "inline-flex size-10 md:size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden [&_svg]:size-4";

/** Same action as "Refresh data" in the sidebar project menu, reusing its hook and result dialog. */
function HeaderRefreshButton({ owner, name }: { owner: string; name: string }) {
  const { refreshing, refresh, dialog } = useRefreshRepo({ owner, name });
  return (
    <>
      <button
        type="button"
        aria-label="Refresh data"
        title="Refresh data"
        aria-busy={refreshing || undefined}
        disabled={refreshing}
        onClick={() => void refresh()}
        className={`${iconButton} disabled:pointer-events-none disabled:opacity-60`}
      >
        <RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
      </button>
      {dialog}
    </>
  );
}

export function AppHeader({ repos = [] }: { repos?: RepoConfig[] }) {
  const pathname = usePathname();
  const { title: pageTitle } = useBreadcrumb();
  const segments = pathname.split("/").filter(Boolean);
  const project = projectFromPathname(pathname);

  let parents: { label: string; href: string }[] = [];
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
    } else if (segments[3] === "epics" && segments[4]) {
      // /epics/<epic>[/<story>]: muted parents link back up the drill-down.
      const epicId = safeDecode(segments[4]);
      parents = [{ label: "Epics", href: `${base}/epics` }];
      if (segments[5]) {
        parents.push({ label: epicName(epicId), href: `${base}/epics/${segments[4]}` });
        title = pageTitle ?? safeDecode(segments[5]);
      } else {
        title = epicName(epicId);
      }
    } else {
      title = getRouteLabel(segments[3]);
    }
  } else if (segments.length >= 1) {
    title = getRouteLabel(segments[0]);
  }

  return (
    <header className="sticky top-0 z-30 flex h-[calc(var(--app-header-h)+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b bg-background pt-[env(safe-area-inset-top)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))] md:px-2">
      <SidebarTrigger className="size-10 md:size-8 shrink-0 text-muted-foreground" />
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1.5 pl-1 text-sm md:text-sm"
      >
        {parents.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className="hidden items-center gap-1.5 sm:flex">
            <Link
              href={crumb.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
        ))}
        <span aria-current="page" className="truncate text-base font-medium">
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
              {parents.map((crumb) => (
                <DropdownMenuItem key={crumb.href} asChild>
                  <Link href={crumb.href}>Back to {crumb.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
      {project && <HeaderRefreshButton owner={project.owner} name={project.name} />}
    </header>
  );
}
