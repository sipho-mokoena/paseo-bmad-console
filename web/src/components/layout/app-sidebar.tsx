"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { CircleHelp, Moon, Plus, Search, Shield, Sun } from "lucide-react";
import { Sidebar, SidebarContent, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import { UserMenu } from "@/components/layout/user-menu";
import { cn } from "@/lib/utils";
import type { RepoConfig } from "@/lib/types";

const SUPER_ADMIN_EMAIL = "dev@dahmani.fr";

interface AppSidebarProps {
  repos: RepoConfig[];
  userEmail?: string;
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

const AVATAR_COLORS = ["#5179b0", "#b05174", "#b08f3a", "#7a5aa8", "#3f8f7a", "#b0663a"];

function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const rowBase =
  "flex h-10 md:h-[30px] w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground outline-hidden transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]";

const footerButton =
  "inline-flex size-8 md:size-7 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-4 [&_svg]:stroke-[1.5]";

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      className={footerButton}
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </button>
  );
}

export function AppSidebar({ repos, userEmail, localFsEnabled, githubEnabled }: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const addTrigger = (
    <button type="button" className={rowBase}>
      <Plus aria-hidden="true" />
      <span>Add project</span>
    </button>
  );

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent className="gap-0">
        <nav aria-label="Primary" className="flex flex-col gap-0.5 p-2">
          <AddRepoDialog
            importedRepos={repos}
            localFsEnabled={localFsEnabled}
            githubEnabled={githubEnabled}
            trigger={addTrigger}
          />
          <Link
            href="/search"
            onClick={closeOnMobile}
            aria-current={pathname.startsWith("/search") ? "page" : undefined}
            className={cn(rowBase, pathname.startsWith("/search") && "bg-sidebar-accent text-foreground")}
          >
            <Search aria-hidden="true" />
            <span>Search</span>
          </Link>
          {userEmail === SUPER_ADMIN_EMAIL && (
            <Link
              href="/admin"
              onClick={closeOnMobile}
              aria-current={pathname.startsWith("/admin") ? "page" : undefined}
              className={cn(rowBase, pathname.startsWith("/admin") && "bg-sidebar-accent text-foreground")}
            >
              <Shield aria-hidden="true" />
              <span>Admin</span>
            </Link>
          )}
        </nav>
        <div className="border-t border-sidebar-border" />
        <div className="flex h-10 md:h-9 items-center justify-between pr-2 pl-4">
          <Link
            href="/"
            onClick={closeOnMobile}
            aria-current={pathname === "/" ? "page" : undefined}
            className="rounded-sm text-xs text-muted-foreground outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            Projects
          </Link>
          <AddRepoDialog
            importedRepos={repos}
            localFsEnabled={localFsEnabled}
            githubEnabled={githubEnabled}
            trigger={
              <button type="button" className={footerButton} aria-label="Add project">
                <Plus />
              </button>
            }
          />
        </div>
        <nav aria-label="Projects" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {repos.map((repo) => {
            const basePath = `/repo/${repo.owner}/${repo.name}`;
            const active = pathname.startsWith(basePath);
            const subtitle =
              repo.sourceType === "local"
                ? (repo.localPath?.split("/").filter(Boolean).pop() ?? repo.name)
                : `${repo.owner}/${repo.name}`;
            return (
              <Link
                key={`${repo.owner}/${repo.name}`}
                href={basePath}
                onClick={closeOnMobile}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 outline-hidden transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active && "bg-sidebar-accent",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex size-4 shrink-0 items-center justify-center rounded-[4px] text-[10px] leading-none font-semibold text-white"
                  style={{ backgroundColor: avatarColor(repo.displayName) }}
                >
                  {repo.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px]">{repo.displayName}</span>
                  <span className="block truncate text-xs leading-4 text-muted-foreground">
                    {subtitle} · {repo.branch}
                  </span>
                </span>
              </Link>
            );
          })}
          {repos.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet.</p>
          )}
        </nav>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between gap-1 border-t border-sidebar-border px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ThemeButton />
          <UserMenu />
        </div>
        <a
          href="https://github.com/bmad-code-org/BMAD-METHOD"
          target="_blank"
          rel="noreferrer"
          className={footerButton}
          aria-label="Documentation"
        >
          <CircleHelp />
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
