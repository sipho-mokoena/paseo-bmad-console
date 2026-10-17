"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { FileTree } from "./file-tree";
import { DocumentPane } from "./document-pane";
import { PillToggle, SearchField, StateMessage } from "@/components/shared/list-kit";
import {
  FolderOpen,
  FileOutput,
  Settings,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/bmad/types";
import { filterFileTree, parseFilterTerms } from "@/lib/file-tree-filter";

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen,
  forceOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen: boolean;
  /** Open regardless of the saved state (used while a filter is active). */
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [savedOpen, setOpen] = useState(defaultOpen);
  const open = forceOpen || savedOpen;

  return (
    <div>
      <button
        onClick={() => setOpen(!savedOpen)}
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
  const [filter, setFilter] = useState("");
  const treeRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
    setTreeOpen(false);
  }, []);

  const hasSecondary = !!secondaryTree && secondaryTree.length > 0;
  const initialInSecondary =
    hasSecondary && initialSelectedFile
      ? treeContainsPath(secondaryTree, initialSelectedFile)
      : false;
  const hasExtra = extraTrees.length > 0;
  const isEmpty = fileTree.length === 0 && !hasSecondary && !hasExtra;

  // Filter state is local: it never touches the URL, so typing never re-renders the page server-side.
  const terms = useMemo(() => parseFilterTerms(filter), [filter]);
  const filtering = terms.length > 0;
  const main = useMemo(() => filterFileTree(fileTree, terms), [fileTree, terms]);
  const secondary = useMemo(
    () => filterFileTree(secondaryTree ?? [], terms),
    [secondaryTree, terms],
  );
  const extras = useMemo(
    () => extraTrees.map((e) => filterFileTree(e.tree, terms)),
    [extraTrees, terms],
  );
  const matched =
    main.matched + secondary.matched + extras.reduce((n, e) => n + e.matched, 0);
  const total = main.total + secondary.total + extras.reduce((n, e) => n + e.total, 0);

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

  const nodesFor = (t: { nodes: FileTreeNode[] }) => t.nodes;
  const renderTree = (nodes: FileTreeNode[]) => (
    <FileTree
      nodes={nodes}
      selectedPath={selectedPath || undefined}
      onSelect={handleSelect}
      terms={terms}
    />
  );

  const multi = hasSecondary || hasExtra;
  const tree = filtering && matched === 0 ? (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-sm text-muted-foreground">
      <span className="break-all">No files match &ldquo;{filter.trim()}&rdquo;</span>
      <button
        type="button"
        onClick={() => setFilter("")}
        className="rounded-md border px-2.5 py-1 text-xs text-foreground outline-hidden hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        Clear filter
      </button>
    </div>
  ) : multi ? (
    <div className="space-y-2">
      {(!filtering || main.matched > 0) && (
        <CollapsibleSection title="Project artifacts" icon={FileOutput} defaultOpen forceOpen={filtering}>
          {renderTree(nodesFor(main))}
        </CollapsibleSection>
      )}
      {hasSecondary && (!filtering || secondary.matched > 0) && (
        <>
          <div className="border-t" />
          <CollapsibleSection
            title="BMAD configuration"
            icon={Settings}
            defaultOpen={initialInSecondary}
            forceOpen={filtering}
          >
            {renderTree(nodesFor(secondary))}
          </CollapsibleSection>
        </>
      )}
      {extraTrees.map((extra, i) =>
        !filtering || extras[i].matched > 0 ? (
          <div key={extra.root} className="space-y-2">
            <div className="border-t" />
            <CollapsibleSection
              title={extra.root}
              icon={FolderOpen}
              defaultOpen={
                !!initialSelectedFile && treeContainsPath(extra.tree, initialSelectedFile)
              }
              forceOpen={filtering}
            >
              {renderTree(nodesFor(extras[i]))}
            </CollapsibleSection>
          </div>
        ) : null,
      )}
    </div>
  ) : (
    renderTree(nodesFor(main))
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
          <div
            className="mb-1.5"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown") return;
              const first = treeRef.current?.querySelector<HTMLElement>("[data-tree-file]");
              if (first) {
                e.preventDefault();
                first.focus();
              }
            }}
          >
            <SearchField
              value={filter}
              onChange={setFilter}
              placeholder="Filter files"
              ariaLabel="Filter files"
              clearable
            />
          </div>
          {filtering && (
            <p className="mb-1.5 px-1 text-xs text-muted-foreground" aria-live="polite">
              {matched} of {total} files
            </p>
          )}
          <div ref={treeRef}>{tree}</div>
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
