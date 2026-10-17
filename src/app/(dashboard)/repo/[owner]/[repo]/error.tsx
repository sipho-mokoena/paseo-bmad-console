"use client";

import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function RepoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ owner: string }>();
  const isLocal = params?.owner === "local";

  const is404 = error.message?.includes("404");
  const isAccessError = error.message?.includes("401") || error.message?.includes("403");
  const isPathStale =
    error.message?.includes("PATH_STALE") ||
    error.message?.includes("PATH_NOT_FOUND");

  return (
    <div role="alert" className="flex min-h-60 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <AlertCircle className="size-5 text-destructive-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-sm font-medium">
          {isPathStale
            ? "Local folder not found"
            : is404
              ? "Repository not found"
              : isAccessError
                ? "GitHub refused the request"
                : "Failed to load project"}
        </h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {isPathStale || isLocal
            ? "This local folder no longer exists or has been moved. You can remove it from your dashboard."
            : is404
              ? "The repository does not exist, or it is private and no GITHUB_PAT with access to it is configured on the server."
              : isAccessError
                ? "GitHub rate limit reached, or the repository is private. Set GITHUB_PAT in the server environment (a token with access to the repository) and restart the server."
                : error.message || "An unexpected error occurred while loading the project data."}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button size="sm" onClick={() => reset()}>
          <RefreshCw className="mr-1 h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  );
}
