"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import {
  IconPlus,
  IconMinus,
  IconMaximize,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Zoom and fit controls, replacing React Flow's `<Controls>`.
 *
 * Two reasons it is not the built-in one:
 *
 *  1. **Animation.** The library's buttons snap the viewport in a single frame,
 *     and its `onZoomIn` / `onZoomOut` props fire *in addition to* that default
 *     rather than replacing it — hooking them would zoom twice. The only way to
 *     get an eased transition is to own the buttons and call `zoomIn({duration})`
 *     directly.
 *  2. **Styling.** Restyling the built-in cluster took a stack of `!important`
 *     overrides fighting its own stylesheet, which is a sign the component was
 *     the wrong one rather than that the CSS needed to be louder.
 *
 * Why animate at all: a viewport that jumps loses the reader's place. Easing the
 * change lets the eye track a node from where it was to where it is, which is
 * the difference between "the canvas zoomed" and "the canvas is now different".
 */

/** Long enough to follow, short enough not to feel like waiting. */
const ZOOM_MS = 180;
/** Fit travels further — position and scale both change — so it gets longer. */
const FIT_MS = 320;

export function CanvasControls() {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  const [reducedMotion, setReducedMotion] = useState(false);

  // Read once and then follow the setting: someone who turns motion off mid-
  // session should not have to reload to be taken seriously.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // A duration of 0 is React Flow's instant path, so reduced motion needs no
  // separate branch at the call sites.
  const duration = useCallback(
    (ms: number) => ({ duration: reducedMotion ? 0 : ms }),
    [reducedMotion],
  );

  const percent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
      <ControlButton
        label="Zoom out"
        onClick={() => zoomOut(duration(ZOOM_MS))}
        icon={<IconMinus className="h-4 w-4" />}
      />

      {/*
        The zoom level is a button, not a readout.

        It is the only place that answers "how far out am I?", and once it is on
        screen the cheapest possible way back to 1:1 is clicking the number that
        told you. A label here would make the user hunt for a reset that does
        not exist.
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => zoomTo(1, duration(ZOOM_MS))}
            className="min-w-[3.25rem] rounded px-1.5 py-1 text-center font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {percent}%
          </button>
        </TooltipTrigger>
        <TooltipContent>Reset to 100%</TooltipContent>
      </Tooltip>

      <ControlButton
        label="Zoom in"
        onClick={() => zoomIn(duration(ZOOM_MS))}
        icon={<IconPlus className="h-4 w-4" />}
      />

      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />

      <ControlButton
        label="Fit to screen"
        onClick={() => fitView({ padding: 0.35, maxZoom: 1, ...duration(FIT_MS) })}
        icon={<IconMaximize className="h-4 w-4" />}
      />
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
