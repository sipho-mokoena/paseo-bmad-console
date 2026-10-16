import { ProjectTabs } from "@/components/layout/project-tabs";

interface RepoLayoutProps {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { owner, repo } = await params;
  return (
    <>
      <ProjectTabs basePath={`/repo/${owner}/${repo}`} />
      <div className="mesh-gradient min-h-full">{children}</div>
    </>
  );
}
