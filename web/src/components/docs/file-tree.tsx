"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { renderFileIcon } from "@/lib/bmad/file-icons";
import type { FileTreeNode } from "@/lib/bmad/types";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

export function FileTree({ nodes, selectedPath, onSelect }: FileTreeProps) {
  return (
    <div className="overflow-hidden text-[13px]">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          depth={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selectedPath,
  onSelect,
  depth,
}: {
  node: FileTreeNode;
  selectedPath?: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const didScrollRef = useRef(false);
  const isSelected = selectedPath === node.path;

  useEffect(() => {
    if (isSelected && !didScrollRef.current && buttonRef.current) {
      buttonRef.current.scrollIntoView({ block: "nearest" });
      didScrollRef.current = true;
    }
  }, [isSelected]);
  const isDirectory = node.type === "directory";

  function isTextClipped() {
    const span = spanRef.current;
    if (!span) return false;
    return span.scrollWidth > span.clientWidth;
  }

  return (
    <div>
      <button
        ref={buttonRef}
        onClick={() => {
          if (isDirectory) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "flex h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-left outline-hidden transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:h-7",
          isSelected && "bg-accent text-foreground",
        )}
      >
        {isDirectory ? (
          <>
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-90",
              )}
            />
            {expanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </>
        ) : (
          <>
            <span className="inline-block h-3.5 w-3.5 shrink-0" />
            {renderFileIcon(node.name, "h-4 w-4 shrink-0 text-muted-foreground")}
          </>
        )}
        <Tooltip
          open={tooltipOpen}
          onOpenChange={(open) => setTooltipOpen(open && isTextClipped())}
        >
          <TooltipTrigger asChild>
            <span ref={spanRef} className="truncate">{node.name}</span>
          </TooltipTrigger>
          <TooltipContent side="right">{node.name}</TooltipContent>
        </Tooltip>
      </button>
      {isDirectory && expanded && node.children && (
        <div className="ml-[13px] border-l pl-1">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
