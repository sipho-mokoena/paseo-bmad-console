import { notFound } from "next/navigation";
import { DocsBrowser } from "@/components/docs/docs-browser";
import { fetchBmadFiles } from "@/actions/repo-actions";
import { getRepoConfig } from "@/lib/db/helpers";
import { localRootOf } from "@/lib/copy-path";

interface DocsPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ file?: string }>;
}

export default async function DocsPage({
  params,
  searchParams,
}: DocsPageProps) {
  const { owner, repo: repoName } = await params;
  const { file: initialFile } = await searchParams;
  const repoConfig = await getRepoConfig(owner, repoName);
  if (!repoConfig) return notFound();

  const result = await fetchBmadFiles({ owner, name: repoName });

  if (!result.success) {
    return (
      <div
        className="flex min-h-40 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground"
        role="alert"
      >
        <p>{result.error}</p>
      </div>
    );
  }

  return (
    <DocsBrowser
      fileTree={result.data.fileTree}
      docsTree={result.data.docsTree}
      bmadCoreTree={result.data.bmadCoreTree}
      extraTrees={result.data.extraTrees}
      owner={owner}
      repo={repoName}
      localRoot={localRootOf(repoConfig)}
      initialSelectedFile={initialFile}
    />
  );
}
