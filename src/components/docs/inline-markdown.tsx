import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Components } from "react-markdown";
import { bmadSanitizeSchema } from "@/lib/bmad/sanitize-schema";
import { cn } from "@/lib/utils";

/**
 * Lightweight markdown for single list items (acceptance criteria, tasks, Verify):
 * bold, italics, code, links, strikethrough and nested lists, with paragraphs
 * flattened to blocks of text so the surrounding row keeps its layout.
 * Server-safe: no hooks, no client-only dependencies.
 */
const components: Components = {
  p: ({ children }) => <span className="block [&:not(:last-child)]:mb-1">{children}</span>,
  a: ({ href, children }) => {
    const external = !!href && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="text-foreground underline underline-offset-2 hover:text-primary"
      >
        {children}
      </a>
    );
  },
  code: ({ children, className }) => (
    <code className={cn("rounded-sm bg-muted px-1 py-px font-mono text-[max(0.9em,13px)]", className)}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-1 max-w-full overflow-x-auto rounded-md border bg-muted/50 p-2 text-xs">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul className="mt-1 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mt-1 list-decimal space-y-1 pl-4">{children}</ol>,
  h1: ({ children }) => <strong className="block font-medium">{children}</strong>,
  h2: ({ children }) => <strong className="block font-medium">{children}</strong>,
  h3: ({ children }) => <strong className="block font-medium">{children}</strong>,
  h4: ({ children }) => <strong className="block font-medium">{children}</strong>,
  h5: ({ children }) => <strong className="block font-medium">{children}</strong>,
  h6: ({ children }) => <strong className="block font-medium">{children}</strong>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  img: ({ alt }) => <span>{alt}</span>,
};

export function InlineMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, bmadSanitizeSchema]]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
