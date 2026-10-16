"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteRepo } from "@/actions/repo-actions";

interface RemoveRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  name: string;
  displayName: string;
}

export function RemoveRepoDialog({ open, onOpenChange, owner, name, displayName }: RemoveRepoDialogProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteRepo({ owner, name });
      if (result.success) {
        onOpenChange(false);
        router.push("/");
        router.refresh();
        return;
      }
      setError(result.error);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (deleting) return; onOpenChange(value); if (!value) setError(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove project</DialogTitle>
          <DialogDescription>
            Do you want to remove <strong>{displayName}</strong> from the dashboard? The GitHub repository will not be deleted.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive px-1">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing..." : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
