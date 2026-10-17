"use client";

import { Button } from "@/components/ui/button";
import {
  IconLayoutSidebar,
  IconMaximize,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/hooks/use-view-preference";

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

const OPTIONS: { mode: ViewMode; icon: typeof IconLayoutSidebar; label: string }[] = [
  { mode: "sidebar", icon: IconLayoutSidebar, label: "Sidebar view" },
  { mode: "dialog", icon: IconMaximize, label: "Dialog view" },
  { mode: "page", icon: IconExternalLink, label: "Full page view" },
];

export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 rounded-md border border-border p-0.5",
          className,
        )}
      >
        {OPTIONS.map(({ mode, icon: Icon, label }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(mode)}
                className={cn(
                  // 40px on a phone (the whole control is ~130px, which a
                  // 311px toolbar row holds), 28px from `sm`.
                  "h-10 w-10 rounded-sm sm:h-7 sm:w-7",
                  value === mode
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="sr-only">{label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
