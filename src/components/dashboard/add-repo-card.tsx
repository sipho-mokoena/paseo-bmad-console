"use client";

import { Plus } from "lucide-react";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";
import { ROW_CLASS } from "@/components/shared/list-kit";
import { cn } from "@/lib/utils";

interface AddRepoCardProps {
  localFsEnabled?: boolean;
  githubEnabled?: boolean;
}

export function AddRepoCard({ localFsEnabled, githubEnabled }: AddRepoCardProps) {
  return (
    <AddRepoDialog
      localFsEnabled={localFsEnabled}
      githubEnabled={githubEnabled}
      trigger={
        <button type="button" className={cn(ROW_CLASS, "text-muted-foreground hover:text-foreground")}>
          <Plus className="size-4 shrink-0" />
          <span>Add project</span>
        </button>
      }
    />
  );
}
