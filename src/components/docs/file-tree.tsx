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
import { highlightRanges } from "@/lib/file-tree-filter";
import type { FileTreeNode } from "@/lib/bmad/types";

interface FileTreeProps {
  nodes: FileTreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  /** Active filter terms (lowercase). While non-empty every folder shows expanded and matches are highlighted. */
  terms?: string[];
}

const NO_TERMS: string[] = [];

/** File name with the filter matches wrapped in <mark>. */
export function HighlightedName({ name, terms }: { name: string; terms: string[] }) {
  const ranges = highlightRanges(name, terms);
  if (ranges.length === 0) return <>{name}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(name.slice(at, start));
    parts.push(
      <mark key={i} className="rounded-sm bg-primary/25 text-inherit">
        {name.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < name.length) parts.push(name.slice(at));
  return <>{parts}</>;
}

export function FileTree({ nodes, selectedPath, onSelect, terms = NO_TERMS }: FileTreeProps) {
  return (
    <div className="overflow-hidden text-sm">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelect}
          terms={terms}
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
  terms,
  depth,
}: {
  node: FileTreeNode;
  selectedPath?: string;
  onSelect: (path: string) => void;
  terms: string[];
  depth: number;
}) {
  const [savedExpanded, setExpanded] = useState(depth < 2);
  // While filtering, show every folder open without touching the saved state.
  const filtering = terms.length > 0;
  const expanded = filtering || savedExpanded;
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
            if (!filtering) setExpanded(!savedExpanded);
          } else {
            onSelect(node.path);
          }
        }}
        data-tree-file={isDirectory ? undefined : ""}
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
            <span ref={spanRef} className="truncate">
              {isDirectory ? node.name : <HighlightedName name={node.name} terms={terms} />}
            </span>
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
              terms={terms}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
