import { notFound } from "next/navigation";
import { DocumentTabBrowser } from "@/components/docs/document-tab-browser";
import { classifyDocs, flattenDocs, pickDoc, withTitles } from "@/lib/doc-groups";
import { loadDocTitles } from "@/lib/doc-titles-server";
import { getRepoConfig } from "@/lib/db/helpers";
import { localRootOf } from "@/lib/copy-path";
import { loadProject } from "@/lib/load-project";

interface DesignPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ file?: string | string[] }>;
}

export default async function DesignPage({ params, searchParams }: DesignPageProps) {
  const { owner, repo } = await params;
  const { file } = await searchParams;
  const project = await loadProject(owner, repo);
  const config = await getRepoConfig(owner, repo);
  const localRoot = localRootOf(config);

  const classified = classifyDocs(project.bmadFiles).design;
  const groups = withTitles(classified, config ? await loadDocTitles(config, flattenDocs(classified).map((d) => d.path)) : {});
  const selected = pickDoc(groups, Array.isArray(file) ? file[0] : file);
  if (!selected) notFound();

  return (
    <DocumentTabBrowser
      tab="design"
      groups={groups}
      selectedPath={selected.path}
      owner={owner}
      repo={repo}
      localRoot={localRoot}
      basePath={`/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
    />
  );
}
