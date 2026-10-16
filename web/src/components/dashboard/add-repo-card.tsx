"use client";

import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { AddRepoDialog } from "@/components/layout/add-repo-dialog";

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
        <Card className="glass-card hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer md:aspect-square flex items-center justify-center border-dashed border-2 border-border/50 hover:border-primary/30 p-4 md:p-8 min-h-14">
          <div className="flex flex-row md:flex-col items-center gap-2 md:gap-3 text-muted-foreground">
            <Plus className="h-8 w-8" />
            <span className="text-sm font-medium">Add a project</span>
          </div>
        </Card>
      }
    />
  );
}
