import type { FileTreeNode } from "@/lib/bmad/types";

export type HighlightRange = [start: number, end: number];

/** Split a query into lowercase terms (whitespace separated, empties dropped). */
export function parseFilterTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every file path in the tree (directories excluded), in tree order. */
export function flattenFilePaths(nodes: FileTreeNode[]): string[] {
  const out: string[] = [];
  const walk = (list: FileTreeNode[]) => {
    for (const node of list) {
      if (node.type === "directory") {
        if (node.children) walk(node.children);
      } else {
        out.push(node.path);
      }
    }
  };
  walk(nodes);
  return out;
}

/** True when every term appears (case-insensitive) in the path. Plain substring search, no regex. */
export function pathMatchesTerms(path: string, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const lower = path.toLowerCase();
  return terms.every((t) => lower.includes(t));
}

export interface FilteredTree {
  nodes: FileTreeNode[];
  matched: number;
  total: number;
}

/**
 * Keep only files whose full path matches every term, plus their ancestor folders.
 * With no terms the original array is returned untouched.
 */
export function filterFileTree(nodes: FileTreeNode[], terms: string[]): FilteredTree {
  const total = flattenFilePaths(nodes).length;
  if (terms.length === 0) return { nodes, matched: total, total };
  let matched = 0;
  const walk = (list: FileTreeNode[]): FileTreeNode[] => {
    const kept: FileTreeNode[] = [];
    for (const node of list) {
      if (node.type === "directory") {
        const children = walk(node.children ?? []);
        if (children.length > 0) kept.push({ ...node, children });
      } else if (pathMatchesTerms(node.path, terms)) {
        matched++;
        kept.push(node);
      }
    }
    return kept;
  };
  const result = walk(nodes);
  return { nodes: result, matched, total };
}

/** Merged, sorted [start, end) ranges of every term occurrence in `text`. */
export function highlightRanges(text: string, terms: string[]): HighlightRange[] {
  if (terms.length === 0) return [];
  const lower = text.toLowerCase();
  const ranges: HighlightRange[] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(term, from);
      if (i === -1) break;
      ranges.push([i, i + term.length]);
      from = i + term.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: HighlightRange[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
