"use client";

import {
  IconSearch,
  IconPlus,
  IconFilter,
  IconColumns3,
  IconLayoutCards,
  IconLayoutList,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";
import { cn } from "@/lib/utils";

interface JobFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  priority: JobPriority | null;
  onPriorityChange: (value: JobPriority | null) => void;
  serviceType: ServiceType | null;
  onServiceTypeChange: (value: ServiceType | null) => void;
  onCreateClick: () => void;
  onManagePipeline?: () => void;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  isTableView?: boolean;
}

export function JobFilters({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  serviceType,
  onServiceTypeChange,
  onCreateClick,
  onManagePipeline,
  compact,
  onCompactChange,
  isTableView,
}: JobFiltersProps) {
  const hasFilters = priority !== null || serviceType !== null;
  const activeFilterCount = (priority ? 1 : 0) + (serviceType ? 1 : 0);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {/* Search + Filters group */}
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Priority filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-body cursor-pointer transition-colors",
                priority
                  ? "border-brand/40 bg-brand-light/20 text-brand"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <IconFilter className="h-3.5 w-3.5" />
              {priority ? JOB_PRIORITY_LABELS[priority] : "Priority"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <button
              onClick={() => onPriorityChange(null)}
              className={cn(
                "w-full px-2 py-1.5 text-sm rounded-md text-left font-body cursor-pointer",
                priority === null
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              All
            </button>
            {JOB_PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => onPriorityChange(p)}
                className={cn(
                  "w-full px-2 py-1.5 text-sm rounded-md text-left font-body cursor-pointer",
                  priority === p
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted text-muted-foreground",
                )}
              >
                {JOB_PRIORITY_LABELS[p]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Service type filter */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-body cursor-pointer transition-colors",
                serviceType
                  ? "border-brand/40 bg-brand-light/20 text-brand"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {serviceType ? SERVICE_TYPE_LABELS[serviceType] : "Service Type"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <button
              onClick={() => onServiceTypeChange(null)}
              className={cn(
                "w-full px-2 py-1.5 text-sm rounded-md text-left font-body cursor-pointer",
                serviceType === null
                  ? "bg-muted text-foreground"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              All
            </button>
            {SERVICE_TYPES.map((st) => (
              <button
                key={st}
                onClick={() => onServiceTypeChange(st)}
                className={cn(
                  "w-full px-2 py-1.5 text-sm rounded-md text-left font-body cursor-pointer",
                  serviceType === st
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted text-muted-foreground",
                )}
              >
                {SERVICE_TYPE_LABELS[st]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <button
            onClick={() => {
              onPriorityChange(null);
              onServiceTypeChange(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-body cursor-pointer"
          >
            Clear filters
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-brand-foreground font-medium">
              {activeFilterCount}
            </span>
          </button>
        )}
      </div>

      {/* Action buttons group — right-aligned */}
      <div className="flex items-center gap-2">
        {/* Density toggle (default / compact) */}
        <div className="flex items-center rounded-md border border-border p-0.5 gap-0.5">
          <button
            onClick={() => onCompactChange(false)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded transition-colors cursor-pointer",
              !compact
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Default density"
          >
            <IconLayoutCards className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onCompactChange(true)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded transition-colors cursor-pointer",
              compact
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Compact density"
          >
            <IconLayoutList className="h-3.5 w-3.5" />
          </button>
        </div>

        {onManagePipeline && !isTableView && (
          <Button
            variant="outline"
            onClick={onManagePipeline}
            className="cursor-pointer"
          >
            <IconColumns3 className="mr-2 h-4 w-4" />
            Manage Pipeline
          </Button>
        )}
        <Button
          onClick={onCreateClick}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          New Job
        </Button>
      </div>
    </div>
  );
}
