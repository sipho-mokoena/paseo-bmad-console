"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Copy, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText } from "@/lib/copy-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePanZoom } from "./use-pan-zoom";
import {
  getDiagramLabel,
  getMermaidConfig,
  getSvgNaturalSize,
  getSvgNaturalWidth,
  type MermaidMode,
} from "./mermaid-utils";

type RenderState =
  | { status: "loading" }
  | { status: "ready"; svg: string }
  | { status: "error"; message: string };

let renderQueue: Promise<unknown> = Promise.resolve();
let counter = 0;

/**
 * Renders one diagram. Mermaid keeps global config, so renders are serialised and
 * initialised with the requested theme each time. Loaded lazily, client-side only.
 */
function renderMermaid(source: string, mode: MermaidMode, idBase: string): Promise<string> {
  const run = async () => {
    const mod = await import("mermaid");
    const mermaid = mod.default;
    mermaid.initialize(getMermaidConfig(mode));
    const { svg } = await mermaid.render(`${idBase}-${counter++}`, source);
    return svg;
  };
  const p = renderQueue.then(run, run);
  renderQueue = p.catch(() => undefined);
  return p;
}

function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "The diagram could not be rendered.";
}

export function MermaidError({ message, source }: { message: string; source: string }) {
  return (
    <div
      role="alert"
      className="not-prose rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
    >
      <p className="font-medium text-foreground">Diagram could not be rendered</p>
      <p className="mt-1 break-words whitespace-pre-wrap">{message}</p>
      <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
        <code>{source}</code>
      </pre>
    </div>
  );
}

const VIEWER_LABEL = "Diagram viewer. Scroll to zoom, drag to pan, double-click to reset.";

/** Pan and zoom surface for the full size dialog. Mounted only while the dialog is open. */
export function DiagramViewer({ svg }: { svg: string; label?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const size = getSvgNaturalSize(svg) ?? { width: getSvgNaturalWidth(svg) ?? 800, height: 600 };
  const { style, dragging } = usePanZoom(viewportRef, size);
  return (
    <div
      ref={viewportRef}
      data-slot="dialog-viewer"
      role="application"
      tabIndex={0}
      aria-label={VIEWER_LABEL}
      className={`relative min-h-0 touch-none overflow-hidden border-t border-border bg-card outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <div
        style={{ ...style, width: size.width, height: size.height }}
        className="[&_svg]:!block [&_svg]:!h-full [&_svg]:!max-w-none [&_svg]:!w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground">
        Scroll to zoom, drag to pan, double-click to reset
      </p>
    </div>
  );
}

export function MermaidDiagram({ source }: { source: string }) {
  const { resolvedTheme } = useTheme();
  const mode: MermaidMode = resolvedTheme === "light" ? "light" : "dark";
  const rawId = useId();
  const idBase = "mmd" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const [state, setState] = useState<RenderState>({ status: "loading" });
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderMermaid(source, mode, idBase).then(
      (svg) => {
        if (!cancelled) setState({ status: "ready", svg });
      },
      (err) => {
        if (!cancelled) setState({ status: "error", message: messageOf(err) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, mode, idBase]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copySource = useCallback(async () => {
    if (!(await copyText(source))) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [source]);

  if (state.status === "error") {
    return <MermaidError message={state.message} source={source} />;
  }

  const label = getDiagramLabel(source);
  const naturalWidth = state.status === "ready" ? getSvgNaturalWidth(state.svg) : null;
  const toolbarBtn = "size-10 sm:size-8 text-muted-foreground hover:text-foreground";

  return (
    <div className="not-prose relative my-4 rounded-lg border border-border bg-card">
      <div className="absolute top-1 right-1 z-10 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolbarBtn}
          onClick={copySource}
          aria-label="Copy source"
          title="Copy source"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolbarBtn}
          onClick={() => setOpen(true)}
          disabled={state.status !== "ready"}
          aria-label="Open full size"
          title="Open full size"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>

      {state.status === "loading" ? (
        <div className="p-4 pt-12" aria-busy="true" aria-label="Rendering diagram">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto p-4 pt-12">
          <div
            role="img"
            aria-label={label}
            className="mx-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            style={naturalWidth ? { minWidth: Math.min(naturalWidth, 560) } : undefined}
            // SVG produced by mermaid with securityLevel "strict" (sanitised, no scripts).
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        </div>
      )}

      {state.status === "ready" && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="inset-0 top-0 left-0 h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] overflow-hidden rounded-none border-0 sm:top-1/2 sm:left-1/2 sm:h-[80vh] sm:max-h-[80vh] sm:w-[90vw] sm:max-w-[90vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border">
            <DialogHeader className="p-4 pr-12">
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription className="sr-only">
                Full size diagram. Scroll to zoom, drag to pan, double-click to reset.
              </DialogDescription>
            </DialogHeader>
            <DiagramViewer svg={state.svg} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
