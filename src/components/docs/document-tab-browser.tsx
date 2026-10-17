"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { DocumentPane } from "./document-pane";
import { docIcon, groupIcon } from "./doc-icons";
import { GroupLabel } from "@/components/shared/list-kit";
import { cn } from "@/lib/utils";
import { flattenDocs, type DocGroup } from "@/lib/doc-groups";

interface DocumentTabBrowserProps {
  tab: "specs" | "design";
  groups: DocGroup[];
  /** Repo-relative path of the selected document (always one of the groups' documents). */
  selectedPath: string;
  owner: string;
  repo: string;
  /** `/repo/<owner>/<repo>` */
  basePath: string;
}

/** Reading layout: document list rail on the left, the selected document in the centred column. */
export function DocumentTabBrowser({
  tab,
  groups,
  selectedPath,
  owner,
  repo,
  basePath,
}: DocumentTabBrowserProps) {
  // Phone: the list is a collapsible "Documents" row that closes once a document is picked.
  const [listOpen, setListOpen] = useState(false);
  const tabPaths = useMemo(() => new Set(flattenDocs(groups).map((d) => d.path)), [groups]);

  const hrefFor = useCallback(
    (section: string, path: string) => `${basePath}/${section}?file=${encodeURIComponent(path)}`,
    [basePath],
  );

  // Same tab -> navigate within the tab; anything else opens in the Library.
  const linkResolver = useCallback(
    (path: string) => hrefFor(tabPaths.has(path) ? tab : "docs", path),
    [hrefFor, tab, tabPaths],
  );

  const selected = flattenDocs(groups).find((d) => d.path === selectedPath);
  const label = tab === "specs" ? "Specs documents" : "Design documents";

  return (
    <div className="-mx-2 -mb-4 -mt-2 flex min-w-0 flex-col md:-m-6 lg:h-[calc(100dvh-var(--app-header-h)-2.5rem-env(safe-area-inset-top))] lg:flex-row">
      <aside
        aria-label={label}
        className="flex min-w-0 shrink-0 flex-col border-b lg:h-full lg:w-[280px] lg:border-b-0 lg:border-r"
      >
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-expanded={listOpen}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{selected?.name ?? "Documents"}</span>
          {listOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
        </button>
        <nav
          aria-label="Documents"
          className={cn(
            listOpen ? "" : "hidden lg:block",
            "max-h-[55dvh] overflow-y-auto border-t px-1.5 pb-3 lg:max-h-none lg:min-h-0 lg:flex-1 lg:border-t-0",
          )}
        >
          {groups.map((group, i) => {
            const GroupIcon = groupIcon(group.id);
            return (
            <section key={group.id}>
              <GroupLabel className={cn("flex items-center gap-1.5", i === 0 && "pt-2")}>
                <GroupIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {group.label}
              </GroupLabel>
              <ul>
                {group.docs.map((doc) => {
                  const active = doc.path === selectedPath;
                  const DocIcon = docIcon(group.id, doc.name);
                  return (
                    <li key={doc.path}>
                      <Link
                        href={hrefFor(tab, doc.path)}
                        scroll={false}
                        title={doc.path}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setListOpen(false)}
                        className={cn(
                          "flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[30px]",
                          active && "bg-accent font-medium text-foreground",
                        )}
                      >
                        <DocIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 truncate">{doc.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 lg:overflow-y-auto">
        <DocumentPane
          key={selectedPath}
          owner={owner}
          repo={repo}
          path={selectedPath}
          linkResolver={linkResolver}
        />
      </div>
    </div>
  );
}
