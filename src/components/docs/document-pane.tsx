"use client";

import { useState, useEffect, useMemo } from "react";
import { MarkdownRenderer, type MarkdownLinkResolver } from "./markdown-renderer";
import { TableOfContents } from "./table-of-contents";
import { FileMetadataBar } from "./file-metadata-bar";
import { PillToggle, StateMessage } from "@/components/shared/list-kit";
import { DefinitionTable, type DefinitionRow } from "@/components/shared/definition-table";
import { Pill } from "@/components/shared/pill";
import { AlertTriangle } from "lucide-react";
import { fetchParsedFileContent } from "@/actions/repo-actions";
import hljs from "highlight.js/lib/core";
import yamlLang from "highlight.js/lib/languages/yaml";
import jsonLang from "highlight.js/lib/languages/json";
import type { ParsedBmadFile } from "@/lib/bmad/types";

hljs.registerLanguage("yaml", yamlLang);
hljs.registerLanguage("json", jsonLang);

function CodeRenderer({
  content,
  language,
}: {
  content: string;
  language: string;
}) {
  const html = useMemo(() => {
    if (!hljs.getLanguage(language)) {
      return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    try {
      return hljs.highlight(content, { language }).value;
    } catch {
      return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  }, [content, language]);

  return (
    <pre className="hljs overflow-x-auto rounded-lg border p-3 text-sm leading-relaxed max-w-full">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function frontmatterValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(frontmatterValue).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function frontmatterRows(fm: Record<string, unknown>): DefinitionRow[] {
  return Object.entries(fm).map(([label, value]) => ({
    label,
    value: frontmatterValue(value),
  }));
}

type ViewMode = "preview" | "source";

/**
 * Header (size/lines + Preview|Source toggle) and the rendered document.
 * Render inside a scrolling column; give it `key={path}` so state resets per file.
 */
export function DocumentPane({
  owner,
  repo,
  path,
  linkResolver,
  emptyMessage = "Select a file from the tree to view its content",
}: {
  owner: string;
  repo: string;
  path: string | null;
  linkResolver?: MarkdownLinkResolver;
  emptyMessage?: string;
}) {
  const [parsedFile, setParsedFile] = useState<ParsedBmadFile | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("preview");

  useEffect(() => {
    if (!path) return;

    let cancelled = false;

    fetchParsedFileContent({ owner, name: repo, path })
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setParsedFile(result.data);
          setError(null);
        } else {
          setParsedFile(null);
          setError(result.error);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setParsedFile(null);
        setError("Failed to load file content.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path, owner, repo]);

  const stats = useMemo(() => {
    if (!parsedFile) return null;
    const raw = parsedFile.rawContent ?? parsedFile.body;
    const bytes = new TextEncoder().encode(raw).length;
    const lines = raw.length === 0 ? 0 : raw.replace(/\n$/, "").split("\n").length;
    return `${formatSize(bytes)} · ${lines} ${lines === 1 ? "line" : "lines"}`;
  }, [parsedFile]);

  const fm =
    parsedFile?.frontmatter && Object.keys(parsedFile.frontmatter).length > 0
      ? parsedFile.frontmatter
      : null;
  const codeLanguage =
    parsedFile?.contentType === "yaml"
      ? "yaml"
      : parsedFile?.contentType === "json"
        ? "json"
        : "plaintext";

  return (
    <>
      <div className="z-10 flex min-h-10 items-center justify-between gap-2 border-b bg-background px-3 lg:sticky lg:top-0">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {path && stats ? stats : ""}
        </span>
        {path && parsedFile && (
          <PillToggle
            label="File view"
            value={mode}
            onChange={setMode}
            options={[
              { value: "preview", label: "Preview" },
              { value: "source", label: "Source" },
            ]}
          />
        )}
      </div>

      <div aria-live="polite" className="mx-auto w-full max-w-[800px] px-3 py-5 md:px-6">
        {loading ? (
          <StateMessage>Loading...</StateMessage>
        ) : error ? (
          <StateMessage role="alert">
            {error.includes("Limite") ? (
              <Pill className="gap-1.5 border-warning/30 text-warning-foreground">
                <AlertTriangle aria-hidden="true" />
                GitHub rate limit reached. Cached data is displayed.
              </Pill>
            ) : (
              <span className="text-destructive-foreground">{error}</span>
            )}
          </StateMessage>
        ) : path && parsedFile ? (
          mode === "source" ? (
            <pre className="whitespace-pre-wrap break-words rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed">
              {parsedFile.rawContent ?? parsedFile.body}
            </pre>
          ) : (
            <>
              {fm ? (
                <DefinitionTable rows={frontmatterRows(fm)} className="mb-6" />
              ) : (
                parsedFile.metadata && <FileMetadataBar metadata={parsedFile.metadata} />
              )}
              {parsedFile.parseError ? (
                <>
                  <div
                    className="mb-4 rounded-lg border border-warning/30 px-3 py-2 text-sm"
                    role="alert"
                  >
                    <div className="flex items-center gap-2 font-medium text-warning-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      This file contains syntax errors. Raw content is displayed below.
                    </div>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      {parsedFile.parseError}
                    </p>
                  </div>
                  <CodeRenderer content={parsedFile.body} language={codeLanguage} />
                </>
              ) : parsedFile.contentType === "markdown" ? (
                <>
                  <TableOfContents content={parsedFile.body} />
                  <MarkdownRenderer
                    content={parsedFile.body}
                    owner={owner}
                    repo={repo}
                    docPath={path}
                    linkResolver={linkResolver}
                  />
                </>
              ) : parsedFile.contentType === "yaml" ? (
                <CodeRenderer content={parsedFile.body} language="yaml" />
              ) : parsedFile.contentType === "json" ? (
                <CodeRenderer content={parsedFile.body} language="json" />
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm">
                  {parsedFile.body}
                </pre>
              )}
            </>
          )
        ) : (
          <StateMessage>{emptyMessage}</StateMessage>
        )}
      </div>
    </>
  );
}
