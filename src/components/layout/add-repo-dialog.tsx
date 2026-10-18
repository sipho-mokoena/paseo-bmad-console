"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen, Loader2 } from "lucide-react";
import { importLocalFolder } from "@/actions/repo-actions";

interface AddRepoDialogProps {
  trigger?: React.ReactNode;
  localFsEnabled?: boolean;
}

export function AddRepoDialog({
  trigger,
  localFsEnabled = false,
}: AddRepoDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Local folder state
  const [localPath, setLocalPath] = useState("");
  const [localImporting, setLocalImporting] = useState(false);
  const [localError, setLocalError] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setLocalPath("");
      setLocalError("");
      setLocalImporting(false);
    }
  }

  async function handleImportLocal(e: React.FormEvent) {
    e.preventDefault();
    if (!localPath.trim()) return;

    setLocalImporting(true);
    setLocalError("");

    const result = await importLocalFolder({ localPath: localPath.trim() });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setLocalError(result.error);
    }
    setLocalImporting(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a project</DialogTitle>
        </DialogHeader>

        {localFsEnabled ? (
          <LocalFolderForm
            localPath={localPath}
            setLocalPath={setLocalPath}
            localImporting={localImporting}
            localError={localError}
            onSubmit={handleImportLocal}
          />
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Adding projects is turned off on this server. Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ENABLE_LOCAL_FS=true</code> to enable it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LocalFolderForm({
  localPath,
  setLocalPath,
  localImporting,
  localError,
  onSubmit,
}: {
  localPath: string;
  setLocalPath: (v: string) => void;
  localImporting: boolean;
  localError: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter the absolute path to a local folder containing{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">_bmad/</code>{" "}
          or{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            _bmad-output/
          </code>
          .
        </p>
        <Input
          placeholder="/home/user/my-project"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          disabled={localImporting}
          autoComplete="off"
        />
      </div>

      {localError && (
        <p className="text-destructive text-sm">{localError}</p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={localImporting || !localPath.trim()}
      >
        {localImporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FolderOpen className="mr-2 h-4 w-4" />
        )}
        Import local folder
      </Button>
    </form>
  );
}
