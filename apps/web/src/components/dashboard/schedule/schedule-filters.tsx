"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  IconAlertTriangle,
  IconTool,
  IconX,
  IconCalendarEvent,
  IconFilter,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";
import { useState } from "react";

interface ScheduleFiltersProps {
  priorityFilter: JobPriority | null;
  serviceTypeFilter: ServiceType | null;
  showBookings: boolean;
  onPriorityChange: (priority: JobPriority | null) => void;
  onServiceTypeChange: (serviceType: ServiceType | null) => void;
  onShowBookingsChange: (show: boolean) => void;
}

/** The value a toggle group uses for "no filter"; Radix needs a string. */
const ANY = "any";

/**
 * The filter row under the toolbar. It needs a card of 42rem or more (the card
 * is a container, see the page); below that it is hidden and the same filters
 * sit behind one button in the toolbar, `ScheduleFilterMenu`. The row's controls
 * are therefore always on a screen of at least `sm`, so they keep their dense
 * size and need no phone sizing.
 */
export function ScheduleFilters({
  priorityFilter,
  serviceTypeFilter,
  showBookings,
  onPriorityChange,
  onServiceTypeChange,
  onShowBookingsChange,
}: ScheduleFiltersProps) {
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);

  // No `hasActiveFilters` here any more: it was computed and never read, so the
  // "Clear filters" affordance it was plainly written for does not exist. Each
  // filter clears from its chip, or from "Any …" at the top of its popover.

  return (
    <div className="hidden flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2 [@container(min-width:42rem)]:flex">
      {/* Priority filter */}
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 cursor-pointer gap-1.5 text-xs",
              priorityFilter && "border-brand/40 bg-brand-light/20 text-brand-ink",
            )}
          >
            <IconAlertTriangle className="h-3.5 w-3.5" />
            {priorityFilter ? JOB_PRIORITY_LABELS[priorityFilter] : "Priority"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start">
          {[null, ...JOB_PRIORITIES].map((p) => (
            <button
              key={p ?? ANY}
              onClick={() => {
                onPriorityChange(p);
                setPriorityOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer transition-colors",
                priorityFilter === p && "bg-brand-light/30 text-brand-ink font-medium",
              )}
            >
              {p ? JOB_PRIORITY_LABELS[p] : "Any priority"}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Service type filter */}
      <Popover open={serviceTypeOpen} onOpenChange={setServiceTypeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 cursor-pointer gap-1.5 text-xs",
              serviceTypeFilter && "border-brand/40 bg-brand-light/20 text-brand-ink",
            )}
          >
            <IconTool className="h-3.5 w-3.5" />
            {serviceTypeFilter
              ? SERVICE_TYPE_LABELS[serviceTypeFilter]
              : "Service type"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-1" align="start">
          {[null, ...SERVICE_TYPES].map((st) => (
            <button
              key={st ?? ANY}
              onClick={() => {
                onServiceTypeChange(st);
                setServiceTypeOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer transition-colors",
                serviceTypeFilter === st && "bg-brand-light/30 text-brand-ink font-medium",
              )}
            >
              {st ? SERVICE_TYPE_LABELS[st] : "Any service type"}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Bookings toggle */}
      <div className="ml-2 flex items-center gap-2">
        <Switch
          id="show-bookings"
          checked={showBookings}
          onCheckedChange={onShowBookingsChange}
        />
        <Label
          htmlFor="show-bookings"
          className="flex cursor-pointer items-center gap-1 self-stretch text-xs text-muted-foreground"
        >
          <IconCalendarEvent className="h-3.5 w-3.5" />
          Bookings
        </Label>
      </div>

      {/* Active filter chips pop in when a filter is chosen and leave at once when
          it is cleared; a chip is not worth an exit animation. */}
      <div className="flex items-center gap-1 ml-auto">
        {priorityFilter && (
          <Badge
            key="priority-badge"
            variant="secondary"
            className="motion-pop cursor-pointer gap-1 text-xs"
            onClick={() => onPriorityChange(null)}
          >
            {JOB_PRIORITY_LABELS[priorityFilter]}
            <IconX className="h-3 w-3" />
          </Badge>
        )}
        {serviceTypeFilter && (
          <Badge
            key="service-badge"
            variant="secondary"
            className="motion-pop cursor-pointer gap-1 text-xs"
            onClick={() => onServiceTypeChange(null)}
          >
            {SERVICE_TYPE_LABELS[serviceTypeFilter]}
            <IconX className="h-3 w-3" />
          </Badge>
        )}
      </div>
    </div>
  );
}

/** A filter toggle in the menu: 40px for a finger below `sm`, dense above. */
const MENU_ITEM =
  "h-10 px-3 text-xs sm:h-8 data-[state=on]:border-brand/40 data-[state=on]:bg-brand-light/20 data-[state=on]:text-brand-ink";

/**
 * The same filters as the row, behind one toolbar button, for a card narrower
 * than 42rem (a phone, or a tablet with the task column open). One more row of
 * controls would cost a phone about 50px of calendar, on a screen where the
 * calendar is the point. A dot on the button says a filter is on.
 */
export function ScheduleFilterMenu({
  priorityFilter,
  serviceTypeFilter,
  showBookings,
  onPriorityChange,
  onServiceTypeChange,
  onShowBookingsChange,
}: ScheduleFiltersProps) {
  const [open, setOpen] = useState(false);
  const activeCount =
    (priorityFilter ? 1 : 0) + (serviceTypeFilter ? 1 : 0) + (showBookings ? 0 : 1);

  function clearAll() {
    onPriorityChange(null);
    onServiceTypeChange(null);
    onShowBookingsChange(true);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={activeCount > 0 ? `Filters, ${activeCount} on` : "Filters"}
          className={cn(
            "relative h-10 w-10 cursor-pointer sm:h-8 sm:w-8",
            activeCount > 0 && "text-brand-ink",
          )}
        >
          <IconFilter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="motion-pop absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(18rem,calc(100vw-2rem))] space-y-3 p-3">
        <div className="space-y-1.5">
          <p id="schedule-filter-priority" className="text-xs font-medium text-muted-foreground">
            Priority
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-labelledby="schedule-filter-priority"
            value={priorityFilter ?? ANY}
            // An empty value is Radix deselecting the pressed item; "Any" is
            // how a filter clears here, so that tap changes nothing.
            onValueChange={(value) => {
              if (!value) return;
              onPriorityChange(JOB_PRIORITIES.find((p) => p === value) ?? null);
            }}
            className="flex-wrap justify-start gap-1.5"
          >
            <ToggleGroupItem value={ANY} className={MENU_ITEM}>
              Any
            </ToggleGroupItem>
            {JOB_PRIORITIES.map((p) => (
              <ToggleGroupItem key={p} value={p} className={MENU_ITEM}>
                {JOB_PRIORITY_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <p id="schedule-filter-service" className="text-xs font-medium text-muted-foreground">
            Service type
          </p>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-labelledby="schedule-filter-service"
            value={serviceTypeFilter ?? ANY}
            onValueChange={(value) => {
              if (!value) return;
              onServiceTypeChange(SERVICE_TYPES.find((st) => st === value) ?? null);
            }}
            className="flex-wrap justify-start gap-1.5"
          >
            <ToggleGroupItem value={ANY} className={MENU_ITEM}>
              Any
            </ToggleGroupItem>
            {SERVICE_TYPES.map((st) => (
              <ToggleGroupItem key={st} value={st} className={MENU_ITEM}>
                {SERVICE_TYPE_LABELS[st]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border pt-3">
          <Label htmlFor="show-bookings-menu" className="cursor-pointer text-sm">
            Show bookings
          </Label>
          <Switch
            id="show-bookings-menu"
            checked={showBookings}
            onCheckedChange={onShowBookingsChange}
          />
        </div>

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="h-10 w-full cursor-pointer sm:h-8"
          >
            Clear filters
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
