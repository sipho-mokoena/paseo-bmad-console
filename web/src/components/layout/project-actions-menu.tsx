"use client";

import { useState } from "react";
import { Loader2, MoreHorizontal, RefreshCw, Settings, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RemoveRepoDialog } from "@/components/shared/delete-repo-button";
import { useRefreshRepo } from "@/components/shared/refresh-repo-button";
import { RepoSettingsModal } from "@/components/shared/repo-settings-modal";
import { shouldShowSettings } from "@/lib/project-actions";
import { cn } from "@/lib/utils";
import type { RepoConfig } from "@/lib/types";

interface ProjectActionsMenuProps {
  repo: Pick<RepoConfig, "owner" | "name" | "displayName" | "branch" | "sourceType">;
  /** Keep the trigger visible (selected project, phones). */
  alwaysVisible?: boolean;
}

const itemClass =
  "min-h-9 gap-2 px-2 py-0 text-[13px] md:min-h-[30px] [&_svg:not([class*='size-'])]:size-4 [&_svg]:stroke-[1.5]";

/**
 * Trailing "..." actions for a sidebar project row. The dialogs are rendered
 * outside the menu content and controlled by state here, so they open reliably
 * while the menu is closing.
 */
export function ProjectActionsMenu({ repo, alwaysVisible }: ProjectActionsMenuProps) {
  const { owner, name, displayName } = repo;
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const { refreshing, refresh, dialog: refreshDialog } = useRefreshRepo({ owner, name });

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${displayName}`}
            aria-busy={refreshing || undefined}
            className={cn(
              "absolute top-1/2 right-1 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-opacity hover:bg-sidebar-border hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-border data-[state=open]:opacity-100 md:size-7 [&_svg]:size-4 [&_svg]:stroke-[1.5]",
              alwaysVisible || refreshing
                ? "opacity-100"
                : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 max-md:opacity-100",
            )}
          >
            {refreshing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" collisionPadding={8} className="z-[70] w-44 p-1">
          <DropdownMenuItem className={itemClass} disabled={refreshing} onSelect={() => void refresh()}>
            <RefreshCw aria-hidden="true" />
            Refresh data
          </DropdownMenuItem>
          {shouldShowSettings(repo) && (
            <DropdownMenuItem className={itemClass} onSelect={() => setSettingsOpen(true)}>
              <Settings aria-hidden="true" />
              Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClass} variant="destructive" onSelect={() => setRemoveOpen(true)}>
            <Trash2 aria-hidden="true" />
            Remove project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {refreshDialog}
      {shouldShowSettings(repo) && (
        <RepoSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          owner={owner}
          name={name}
          currentBranch={repo.branch}
        />
      )}
      <RemoveRepoDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        owner={owner}
        name={name}
        displayName={displayName}
      />
    </>
  );
}
