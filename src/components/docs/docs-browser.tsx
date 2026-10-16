"use client";

import { useState, useCallback } from "react";
import { FileTree } from "./file-tree";
import { DocumentPane } from "./document-pane";
import { PillToggle, StateMessage } from "@/components/shared/list-kit";
import {
  FolderOpen,
  FileOutput,
  Settings,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/bmad/types";

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{title}</span>
      </button>
      <div className="mt-0.5" style={{ display: open ? "block" : "none" }}>
        {children}
      </div>
    </div>
  );
}

function treeContainsPath(nodes: FileTreeNode[], path: string): boolean {
  for (const node of nodes) {
    if (node.path === path) return true;
    if (node.children && treeContainsPath(node.children, path)) return true;
  }
  return false;
}

function FilePanel({
  fileTree,
  secondaryTree,
  extraTrees = [],
  owner,
  repo,
  initialSelectedFile,
  sources,
}: {
  fileTree: FileTreeNode[];
  secondaryTree?: FileTreeNode[];
  /** Layout-declared roots outside the output folder (e.g. ".agentic"). */
  extraTrees?: { root: string; tree: FileTreeNode[] }[];
  owner: string;
  repo: string;
  initialSelectedFile?: string;
  /** When both BMAD and docs trees exist, switch between them in the panel header. */
  sources?: { value: string; label: string; active: string; onChange: (v: string) => void };
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    initialSelectedFile ?? null,
  );
  // Phone: the tree is a collapsible section that closes once a file is picked.
  const [treeOpen, setTreeOpen] = useState(!initialSelectedFile);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
    setTreeOpen(false);
  }, []);

  const hasSecondary = secondaryTree && secondaryTree.length > 0;
  const initialInSecondary =
    hasSecondary && initialSelectedFile
      ? treeContainsPath(secondaryTree, initialSelectedFile)
      : false;
  const hasExtra = extraTrees.length > 0;
  const isEmpty = fileTree.length === 0 && !hasSecondary && !hasExtra;

  if (isEmpty) {
    return (
      <StateMessage>
        <span className="flex flex-col items-center gap-2">
          <FolderOpen className="size-5 opacity-60" aria-hidden="true" />
          No files found
        </span>
      </StateMessage>
    );
  }

  const tree = hasSecondary || hasExtra ? (
    <div className="space-y-2">
      <CollapsibleSection title="Project artifacts" icon={FileOutput} defaultOpen>
        <FileTree
          nodes={fileTree}
          selectedPath={selectedPath || undefined}
          onSelect={handleSelect}
        />
      </CollapsibleSection>
      {hasSecondary && (
        <>
          <div className="border-t" />
          <CollapsibleSection
            title="BMAD configuration"
            icon={Settings}
            defaultOpen={initialInSecondary}
          >
            <FileTree
              nodes={secondaryTree}
              selectedPath={selectedPath || undefined}
              onSelect={handleSelect}
            />
          </CollapsibleSection>
        </>
      )}
      {extraTrees.map((extra) => (
        <div key={extra.root} className="space-y-2">
          <div className="border-t" />
          <CollapsibleSection
            title={extra.root}
            icon={FolderOpen}
            defaultOpen={
              !!initialSelectedFile && treeContainsPath(extra.tree, initialSelectedFile)
            }
          >
            <FileTree
              nodes={extra.tree}
              selectedPath={selectedPath || undefined}
              onSelect={handleSelect}
            />
          </CollapsibleSection>
        </div>
      ))}
    </div>
  ) : (
    <FileTree
      nodes={fileTree}
      selectedPath={selectedPath || undefined}
      onSelect={handleSelect}
    />
  );

  return (
    <div className="-mx-2 -mb-4 -mt-2 flex min-w-0 flex-col md:-m-6 lg:h-[calc(100dvh-var(--app-header-h)-2.5rem-env(safe-area-inset-top))] lg:flex-row">
      {/* Content column */}
      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <DocumentPane
          key={selectedPath ?? "none"}
          owner={owner}
          repo={repo}
          path={selectedPath}
        />
      </div>

      {/* Files panel: on the right on desktop, a collapsible "Files" row on phones */}
      <aside
        aria-label="Files"
        className="order-first flex min-w-0 shrink-0 flex-col border-b lg:order-none lg:h-full lg:w-72 lg:border-b-0 lg:border-l"
      >
        <button
          type="button"
          onClick={() => setTreeOpen((o) => !o)}
          aria-expanded={treeOpen}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {selectedPath ? selectedPath.split("/").pop() : "Files"}
          </span>
          {treeOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        <div className="hidden h-10 shrink-0 items-center gap-1 border-b px-2 lg:flex">
          {sources ? (
            <PillToggle
              label="Source tree"
              value={sources.active}
              onChange={sources.onChange}
              options={[
                { value: "bmad", label: "BMAD" },
                { value: "docs", label: "Docs" },
              ]}
            />
          ) : (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2 text-xs">
              <FolderOpen className="size-3.5" aria-hidden="true" />
              Files
            </span>
          )}
        </div>
        <div
          className={`${treeOpen ? "" : "hidden lg:block"} max-h-[55dvh] overflow-y-auto border-t p-1.5 lg:max-h-none lg:min-h-0 lg:flex-1 lg:border-t-0`}
        >
          {sources && (
            <div className="mb-1 lg:hidden">
              <PillToggle
                label="Source tree"
                value={sources.active}
                onChange={sources.onChange}
                options={[
                  { value: "bmad", label: "BMAD" },
                  { value: "docs", label: "Docs" },
                ]}
              />
            </div>
          )}
          {tree}
        </div>
      </aside>
    </div>
  );
}

interface DocsBrowserProps {
  fileTree: FileTreeNode[];
  docsTree: FileTreeNode[];
  bmadCoreTree: FileTreeNode[];
  extraTrees?: { root: string; tree: FileTreeNode[] }[];
  owner: string;
  repo: string;
  initialSelectedFile?: string;
}

export function DocsBrowser({
  fileTree,
  docsTree,
  bmadCoreTree,
  extraTrees = [],
  owner,
  repo,
  initialSelectedFile,
}: DocsBrowserProps) {
  const hasDocs = docsTree.length > 0;
  const hasBmad = fileTree.length > 0 || bmadCoreTree.length > 0 || extraTrees.length > 0;
  const initialInDocs =
    !!initialSelectedFile && treeContainsPath(docsTree, initialSelectedFile);
  const [source, setSource] = useState<"bmad" | "docs">(
    initialInDocs ? "docs" : "bmad",
  );

  // If only one source exists, no switch needed
  if (!hasDocs) {
    return (
      <FilePanel
        fileTree={fileTree}
        secondaryTree={bmadCoreTree.length > 0 ? bmadCoreTree : undefined}
        extraTrees={extraTrees}
        owner={owner}
        repo={repo}
        initialSelectedFile={initialSelectedFile}
      />
    );
  }

  if (!hasBmad) {
    return (
      <FilePanel
        fileTree={docsTree}
        owner={owner}
        repo={repo}
        initialSelectedFile={initialSelectedFile}
      />
    );
  }

  const sources = {
    value: "bmad",
    label: "Source tree",
    active: source,
    onChange: (v: string) => setSource(v as "bmad" | "docs"),
  };

  return source === "docs" ? (
    <FilePanel
      key="docs"
      fileTree={docsTree}
      owner={owner}
      repo={repo}
      initialSelectedFile={initialInDocs ? initialSelectedFile : undefined}
      sources={sources}
    />
  ) : (
    <FilePanel
      key="bmad"
      fileTree={fileTree}
      secondaryTree={bmadCoreTree.length > 0 ? bmadCoreTree : undefined}
      extraTrees={extraTrees}
      owner={owner}
      repo={repo}
      initialSelectedFile={initialInDocs ? undefined : initialSelectedFile}
      sources={sources}
    />
  );
}
