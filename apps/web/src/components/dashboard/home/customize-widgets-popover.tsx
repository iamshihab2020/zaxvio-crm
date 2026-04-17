"use client";

import { IconLayoutGrid, IconRotateClockwise } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ALL_WIDGETS, useDashboardWidgetPrefs } from "@/hooks/use-dashboard-widget-prefs";

interface CustomizeWidgetsPopoverProps {
  prefs: ReturnType<typeof useDashboardWidgetPrefs>;
}

export function CustomizeWidgetsPopover({ prefs }: CustomizeWidgetsPopoverProps) {
  const { visible, toggle, reset } = prefs;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-full">
          <IconLayoutGrid className="h-4 w-4" />
          Customize Widget
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between">
          <span className="font-heading text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visible widgets
          </span>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <IconRotateClockwise className="h-3 w-3" />
            Reset
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {ALL_WIDGETS.map((w) => (
            <li
              key={w.key}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <label
                htmlFor={`widget-${w.key}`}
                className="font-body text-foreground cursor-pointer"
              >
                {w.label}
              </label>
              <Switch
                id={`widget-${w.key}`}
                checked={visible[w.key]}
                onCheckedChange={() => toggle(w.key)}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
