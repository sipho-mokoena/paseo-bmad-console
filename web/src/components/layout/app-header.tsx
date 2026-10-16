"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useBreadcrumb } from "@/contexts/breadcrumb-context";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";

const routeLabels: Record<string, string> = {
  profile: "Profile",
  overview: "Overview",
  epics: "Epics",
  stories: "Stories",
  docs: "Library",
};

function getRouteLabel(segment: string): string {
  return routeLabels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function AppHeader() {
  const pathname = usePathname();
  const { extraSegments } = useBreadcrumb();
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbs: { label: string; href?: string; onClick?: () => void }[] = [
    { label: "Dashboard", href: "/" },
  ];

  if (segments[0] === "repo" && segments.length >= 3) {
    const owner = segments[1];
    const repo = segments[2];
    if (segments[3]) {
      // When extraSegments exist, they already include the section context,
      // so only add the route segment when there are no extra segments.
      if (extraSegments.length > 0) {
        for (const seg of extraSegments) {
          breadcrumbs.push({ label: seg.label, onClick: seg.onClick });
        }
      } else {
        breadcrumbs.push({
          label: getRouteLabel(segments[3]),
          href: `/repo/${owner}/${repo}/${segments[3]}`,
        });
      }
    }
  } else if (segments.length === 1 && segments[0] !== "") {
    breadcrumbs.push({
      label: getRouteLabel(segments[0]),
    });
  }

  return (
    <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] md:top-3.75 z-30 flex h-12 md:h-14 items-center gap-2 md:gap-4 bg-sidebar border border-sidebar-border rounded-lg mt-[max(0.5rem,env(safe-area-inset-top))] mx-2 md:mx-0 md:mt-3.75 md:mr-3.75 px-2 md:px-6 overflow-hidden">
      <SidebarTrigger className="md:-ml-2 size-10 md:size-7 shrink-0" />
      <Separator orientation="vertical" className="h-6 hidden md:block" />
      <nav className="flex items-center gap-1.5 text-base md:text-lg min-w-0 flex-1 md:flex-none overflow-hidden">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`} className={`flex items-center gap-1.5 min-w-0 ${i < breadcrumbs.length - 2 ? "hidden sm:flex" : ""} ${i === breadcrumbs.length - 1 ? "shrink-0 max-w-[60%] sm:max-w-none sm:shrink" : ""}`}>
            {i > 0 && (
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 ${i === breadcrumbs.length - 2 ? "hidden sm:block" : ""}`} />
            )}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium truncate">{crumb.label}</span>
            ) : crumb.onClick ? (
              <button
                onClick={crumb.onClick}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </button>
            ) : (
              <Link
                href={crumb.href!}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
      <Link
        href="/search"
        aria-label="Search"
        className="md:ml-auto ml-0 inline-flex size-10 md:size-auto md:h-8 shrink-0 items-center justify-center gap-2 rounded-lg md:border border-border md:px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search</span>
      </Link>
      <AnimatedThemeToggler className="rounded-full p-2.5 md:p-2 hover:bg-accent shrink-0" />
      <ScrollProgress />
    </header>
  );
}
