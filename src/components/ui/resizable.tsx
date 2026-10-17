"use client"

import * as React from "react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group data-slot="resizable-panel-group" className={cn("min-w-0", className)} {...props} />
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />
}

/**
 * A 1px hairline inside an 12px gutter; the gutter is the (wide) hit area. The line highlights on
 * hover, drag and keyboard focus. Arrow keys, Home and End resize through the library.
 */
function ResizableHandle({
  className,
  "aria-label": ariaLabel = "Resize panels",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="resizable-handle"
      aria-label={ariaLabel}
      className={cn(
        "group/handle relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center outline-hidden",
        // invisible hit area, about 8px wide, centred on the line
        "before:absolute before:inset-y-0 before:left-1/2 before:w-2 before:-translate-x-1/2 before:content-['']",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="w-px bg-border transition-colors group-hover/handle:bg-ring group-focus-visible/handle:w-0.5 group-focus-visible/handle:bg-ring group-data-[separator=active]/handle:w-0.5 group-data-[separator=active]/handle:bg-ring"
      />
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
