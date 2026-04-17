"use client";

import { useEffect, useState } from "react";
import { IconSparkles, IconCheck } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { openChatbot } from "@/lib/chatbot/bus";
import { CustomizeWidgetsPopover } from "./customize-widgets-popover";
import type { useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";

interface DashboardToolbarProps {
  updatedAt: number | undefined;
  prefs: ReturnType<typeof useDashboardWidgetPrefs>;
  rightSlot?: React.ReactNode;
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
  updatedAt,
  prefs,
  rightSlot,
}: DashboardToolbarProps) {
  const relLabel = useRelativeTime(updatedAt);
  const isFresh = updatedAt ? Date.now() - updatedAt < 10_000 : false;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="gap-2 rounded-full bg-foreground text-background hover:bg-foreground/90"
          onClick={openChatbot}
        >
          <IconSparkles className="h-4 w-4" />
          Ask AI
        </Button>
        <CustomizeWidgetsPopover prefs={prefs} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {updatedAt && (
          <span className="inline-flex items-center gap-1.5 text-xs font-body text-muted-foreground">
            <span
              className={
                isFresh
                  ? "h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"
                  : "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
              }
              aria-hidden
            />
            {isFresh ? (
              <>
                <IconCheck className="h-3 w-3 text-emerald-600" />
                {relLabel}
              </>
            ) : (
              relLabel
            )}
          </span>
        )}
        {rightSlot}
      </div>
    </div>
  );
}
