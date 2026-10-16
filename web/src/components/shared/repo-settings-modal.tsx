"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listRepoBranches, updateRepoBranch } from "@/actions/repo-actions";

interface RepoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: string;
  name: string;
  currentBranch: string;
}

/** Controlled settings dialog; the form state is mounted only while open so it starts fresh each time. */
export function RepoSettingsModal(props: RepoSettingsModalProps) {
  if (!props.open) return null;
  return <RepoSettingsForm {...props} />;
}

function RepoSettingsForm({
  open,
  onOpenChange,
  owner,
  name,
  currentBranch,
}: RepoSettingsModalProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(currentBranch);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRepoBranches({ owner, name }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) setBranches(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [owner, name]);

  function handleOpenChange(nextOpen: boolean) {
    if (saving) return;
    setError(null);
    onOpenChange(nextOpen);
  }

  async function handleSave() {
    if (selectedBranch === currentBranch) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await updateRepoBranch({
      owner,
      name,
      branch: selectedBranch,
    });
    setSaving(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const hasChanges = selectedBranch !== currentBranch;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Configure the tracked branch for{" "}
            <strong>
              {owner}/{name}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="text-sm font-medium">Branch</label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading branches...
            </div>
          ) : (
            <Select
              value={selectedBranch}
              onValueChange={setSelectedBranch}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !hasChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
