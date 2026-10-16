import { ProjectTabs } from "@/components/layout/project-tabs";
import { classifyDocs } from "@/lib/doc-groups";
import { loadProject } from "@/lib/load-project";

interface RepoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}

/** Next control-flow errors (redirect, not-found) must keep propagating. */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { owner, repo } = await params;

  // Specs / Design tabs only show when the project has such documents. The project
  // load is deduplicated with the page's own; on other failures the page reports it.
  let hasSpecs = false;
  let hasDesign = false;
  try {
    const project = await loadProject(owner, repo);
    const docs = classifyDocs(project.bmadFiles);
    hasSpecs = docs.specs.length > 0;
    hasDesign = docs.design.length > 0;
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
  }

  return (
    <>
      <ProjectTabs basePath={`/repo/${owner}/${repo}`} hasSpecs={hasSpecs} hasDesign={hasDesign} />
      <div className="page-pad">{children}</div>
    </>
  );
}
