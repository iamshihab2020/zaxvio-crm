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
        {/* Icon-only below `sm`, where the toolbar shares a line with the date and
            the label would wrap it. 40px square there is a thumb target; from `sm`
            it is the same 32px outline button as every other toolbar control. */}
        <Button
          variant="outline"
          size="sm"
          aria-label="Customize widgets"
          className="h-10 w-10 p-0 sm:h-8 sm:w-auto sm:px-3"
        >
          <IconLayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </PopoverTrigger>
      {/* `max-w` keeps the 256px panel inside a 320px phone with its 16px gutters.
          Twelve 40px rows are taller than a short phone's free space, so the
          panel scrolls inside the height Radix reports as available. */}
      <PopoverContent
        align="end"
        className="max-h-[var(--radix-popover-content-available-height)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Visible widgets
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-10 gap-1 px-2 text-[11px] text-muted-foreground sm:h-7"
          >
            <IconRotateClockwise className="h-3 w-3" />
            Reset
          </Button>
        </div>
        {/* The label fills the row, so the whole 40px strip toggles the switch on a
            phone rather than only the words. */}
        <ul className="mt-2 space-y-1">
          {ALL_WIDGETS.map((w) => (
            <li
              key={w.key}
              className="flex items-center justify-between gap-3 rounded-md px-2 text-sm hover:bg-muted"
            >
              <label
                htmlFor={`widget-${w.key}`}
                className="flex min-h-10 flex-1 cursor-pointer items-center font-body text-foreground sm:min-h-8"
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
