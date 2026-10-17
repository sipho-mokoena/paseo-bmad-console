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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen, Loader2, Github } from "lucide-react";
import { addGitHubRepo, importLocalFolder } from "@/actions/repo-actions";

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

  // GitHub state
  const [ghRepo, setGhRepo] = useState("");
  const [ghBranch, setGhBranch] = useState("");
  const [ghImporting, setGhImporting] = useState(false);
  const [ghError, setGhError] = useState("");

  // Local folder state
  const [localPath, setLocalPath] = useState("");
  const [localImporting, setLocalImporting] = useState(false);
  const [localError, setLocalError] = useState("");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setGhRepo("");
      setGhBranch("");
      setGhError("");
      setGhImporting(false);
      setLocalPath("");
      setLocalError("");
      setLocalImporting(false);
    }
  }

  async function handleAddGitHub(e: React.FormEvent) {
    e.preventDefault();
    const parts = ghRepo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "")
      .split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setGhError("Enter the repository as owner/name.");
      return;
    }

    setGhImporting(true);
    setGhError("");

    const result = await addGitHubRepo({
      owner: parts[0],
      name: parts[1],
      branch: ghBranch.trim() || undefined,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setGhError(result.error);
    }
    setGhImporting(false);
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

  const githubForm = (
    <GitHubRepoForm
      repo={ghRepo}
      setRepo={setGhRepo}
      branch={ghBranch}
      setBranch={setGhBranch}
      importing={ghImporting}
      error={ghError}
      onSubmit={handleAddGitHub}
    />
  );

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
          <Tabs defaultValue="local">
            <TabsList className="w-full">
              <TabsTrigger value="local" className="flex-1">
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Local Folder
              </TabsTrigger>
              <TabsTrigger value="github" className="flex-1">
                <Github className="mr-1.5 h-4 w-4" />
                GitHub
              </TabsTrigger>
            </TabsList>
            <TabsContent value="local">
              <LocalFolderForm
                localPath={localPath}
                setLocalPath={setLocalPath}
                localImporting={localImporting}
                localError={localError}
                onSubmit={handleImportLocal}
              />
            </TabsContent>
            <TabsContent value="github">{githubForm}</TabsContent>
          </Tabs>
        ) : (
          githubForm
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function GitHubRepoForm({
  repo,
  setRepo,
  branch,
  setBranch,
  importing,
  error,
  onSubmit,
}: {
  repo: string;
  setRepo: (v: string) => void;
  branch: string;
  setBranch: (v: string) => void;
  importing: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Enter a GitHub repository as{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">owner/name</code>.
          Private repositories need a{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GITHUB_PAT</code>{" "}
          configured on the server.
        </p>
        <Input
          placeholder="owner/name"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          disabled={importing}
          autoComplete="off"
        />
        <Input
          placeholder="Branch (optional, defaults to the repository default)"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={importing}
          autoComplete="off"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" className="w-full" disabled={importing || !repo.trim()}>
        {importing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Github className="mr-2 h-4 w-4" />
        )}
        Add repository
      </Button>
    </form>
  );
}

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
