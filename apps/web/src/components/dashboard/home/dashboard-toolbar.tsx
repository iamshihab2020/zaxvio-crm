"use client";

import { useEffect, useState } from "react";
import { IconArrowsMove, IconSparkles, IconCheck } from "@tabler/icons-react";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { openChatbot } from "@/lib/chatbot/bus";
import { cn } from "@/lib/utils";
import { CustomizeWidgetsPopover } from "./customize-widgets-popover";
import type { useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";

interface DashboardToolbarProps {
  /**
   * yyyy-MM-dd: the agenda window's first day, which the API resolves in the
   * tenant's timezone. The date line reads this and never the browser clock, so
   * the toolbar and "Up next" can't disagree about what today is.
   */
  today: string;
  updatedAt: number | undefined;
  /** True while a refetch is in flight, so the freshness dot can say so. */
  isFetching?: boolean;
  prefs: ReturnType<typeof useDashboardWidgetPrefs>;
  /** Whether the cards are showing as tiles to rearrange. */
  arranging: boolean;
  onArrangingChange: (arranging: boolean) => void;
}

function useRelativeTime(ts: number | undefined) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    if (!ts) return;
    const update = () => {
      const ageSec = (Date.now() - ts) / 1000;
      if (ageSec < 10) {
        setLabel("Last updated now");
      } else {
        setLabel(`Updated ${formatDistanceToNow(ts, { addSuffix: true })}`);
      }
    };
    update();
    const id = setInterval(update, 15_000);
    return () => clearInterval(id);
  }, [ts]);

  return label;
}

export function DashboardToolbar({
  today,
  updatedAt,
  isFetching = false,
  prefs,
  arranging,
  onArrangingChange,
}: DashboardToolbarProps) {
  const relLabel = useRelativeTime(updatedAt);
  const isFresh = updatedAt ? Date.now() - updatedAt < 10_000 : false;

  // `parseISO` on a bare date is local midnight of that same date, so formatting
  // it back never shifts the day whatever the browser's timezone is.
  const todayDate = parseISO(today);
  const dateLabel = isValid(todayDate) ? format(todayDate, "EEEE d MMMM") : null;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* The page's date is the toolbar's heading: what day it is, and how fresh
          the numbers under it are. The controls used to sit here, so the first
          thing on the page was a black "Ask AI" pill.
          `flex-1 min-w-0` rather than letting the row wrap: the buttons are fixed
          at 136px on a phone, and it is the date and freshness line that should
          give way (stacking under each other), not the controls dropping to a
          second line of their own. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {dateLabel && (
          <p className="font-heading text-sm font-semibold text-foreground">
            {dateLabel}
          </p>
        )}
        {updatedAt && (
          <span
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs font-body text-muted-foreground"
          >
            {/* Only "Refreshing" pulses: that is a change in progress. A fresh
                result is a resting state, and it used to pulse forever. The dot
                changes colour between the three states rather than snapping. */}
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                isFetching
                  ? "motion-safe:animate-pulse bg-brand"
                  : isFresh
                    ? "bg-status-good"
                    : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {isFetching ? (
              "Refreshing…"
            ) : isFresh ? (
              <>
                <IconCheck className="h-3 w-3 text-status-good-ink" aria-hidden />
                {relLabel}
              </>
            ) : (
              relLabel
            )}
          </span>
        )}
      </div>

      {/* Both controls are outline rectangles: they are actions, and DESIGN.md
          keeps full-round shapes for state. Icon-only below `sm` (40px square, a
          thumb target) with the word restored from `sm` up. */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Pressed while the tiles are out. Done in the arrange bar closes it
            too; this is the same switch, where it was opened. */}
        <Button
          variant="outline"
          size="sm"
          aria-label="Arrange cards"
          aria-pressed={arranging}
          onClick={() => onArrangingChange(!arranging)}
          className={cn(
            "h-10 w-10 p-0 sm:h-8 sm:w-auto sm:px-3",
            arranging &&
              "border-brand/50 bg-brand-light/40 text-brand-ink hover:bg-brand-light/60 dark:bg-brand/15 dark:text-brand",
          )}
        >
          <IconArrowsMove className="h-4 w-4" />
          <span className="hidden sm:inline">Arrange</span>
        </Button>
        <CustomizeWidgetsPopover prefs={prefs} />
        <Button
          variant="outline"
          size="sm"
          aria-label="Ask AI"
          className="h-10 w-10 p-0 sm:h-8 sm:w-auto sm:px-3"
          onClick={openChatbot}
        >
          <IconSparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>
      </div>
    </div>
  );
}
