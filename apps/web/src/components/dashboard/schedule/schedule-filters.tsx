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
import {
  IconAlertTriangle,
  IconTool,
  IconX,
  IconCalendarEvent,
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

  const hasActiveFilters = priorityFilter !== null || serviceTypeFilter !== null;

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      {/* Priority filter */}
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 cursor-pointer gap-1.5 text-xs",
              priorityFilter && "border-brand/40 bg-brand-light/20 text-brand",
            )}
          >
            <IconAlertTriangle className="h-3.5 w-3.5" />
            {priorityFilter ? JOB_PRIORITY_LABELS[priorityFilter] : "Priority"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start">
          {JOB_PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => {
                onPriorityChange(priorityFilter === p ? null : p);
                setPriorityOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer transition-colors",
                priorityFilter === p && "bg-brand-light/30 text-brand font-medium",
              )}
            >
              {JOB_PRIORITY_LABELS[p]}
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
              serviceTypeFilter && "border-brand/40 bg-brand-light/20 text-brand",
            )}
          >
            <IconTool className="h-3.5 w-3.5" />
            {serviceTypeFilter
              ? SERVICE_TYPE_LABELS[serviceTypeFilter]
              : "Service Type"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1" align="start">
          {SERVICE_TYPES.map((st) => (
            <button
              key={st}
              onClick={() => {
                onServiceTypeChange(serviceTypeFilter === st ? null : st);
                setServiceTypeOpen(false);
              }}
              className={cn(
                "w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted cursor-pointer transition-colors",
                serviceTypeFilter === st && "bg-brand-light/30 text-brand font-medium",
              )}
            >
              {SERVICE_TYPE_LABELS[st]}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Bookings toggle */}
      <div className="flex items-center gap-2 ml-2">
        <Switch
          id="show-bookings"
          checked={showBookings}
          onCheckedChange={onShowBookingsChange}
        />
        <Label
          htmlFor="show-bookings"
          className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
        >
          <IconCalendarEvent className="h-3.5 w-3.5" />
          Bookings
        </Label>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1 ml-auto">
          {priorityFilter && (
            <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => onPriorityChange(null)}>
              {JOB_PRIORITY_LABELS[priorityFilter]}
              <IconX className="h-3 w-3" />
            </Badge>
          )}
          {serviceTypeFilter && (
            <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => onServiceTypeChange(null)}>
              {SERVICE_TYPE_LABELS[serviceTypeFilter]}
              <IconX className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
