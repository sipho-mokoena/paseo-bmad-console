import { notFound } from "next/navigation";
import { DocumentTabBrowser } from "@/components/docs/document-tab-browser";
import { classifyDocs, pickDoc } from "@/lib/doc-groups";
import { loadProject } from "@/lib/load-project";

interface SpecsPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ file?: string | string[] }>;
}

export default async function SpecsPage({ params, searchParams }: SpecsPageProps) {
  const { owner, repo } = await params;
  const { file } = await searchParams;
  const project = await loadProject(owner, repo);

  const groups = classifyDocs(project.bmadFiles).specs;
  const selected = pickDoc(groups, Array.isArray(file) ? file[0] : file);
  if (!selected) notFound();

  return (
    <DocumentTabBrowser
      tab="specs"
      groups={groups}
      selectedPath={selected.path}
      owner={owner}
      repo={repo}
      basePath={`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
    />
  );
}
