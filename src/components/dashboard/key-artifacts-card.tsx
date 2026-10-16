import Link from "next/link";
import { GroupLabel, ROW_CLASS } from "@/components/shared/list-kit";
import { renderFileIcon } from "@/lib/bmad/file-icons";
import type { FileTreeNode } from "@/lib/bmad/types";

function flattenFiles(nodes: FileTreeNode[]): FileTreeNode[] {
  const files: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") {
      files.push(node);
    }
    if (node.children) {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

interface KeyArtifactsCardProps {
  planningArtifacts: FileTreeNode[];
  owner: string;
  repo: string;
}

export function KeyArtifactsCard({
  planningArtifacts,
  owner,
  repo,
}: KeyArtifactsCardProps) {
  const files = flattenFiles(planningArtifacts);

  if (files.length === 0) return null;

  return (
    <section aria-label="Key files">
      <GroupLabel count={files.length}>Key files</GroupLabel>
      <div>
        {files.map((file) => (
          <Link
            key={file.path}
            href={`/repo/${owner}/${repo}/docs?file=${encodeURIComponent(file.path)}`}
            className={ROW_CLASS}
          >
            {renderFileIcon(file.name, "h-4 w-4 shrink-0 text-muted-foreground")}
            <span className="truncate">{file.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
