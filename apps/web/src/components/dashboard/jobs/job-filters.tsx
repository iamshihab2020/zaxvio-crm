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
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "relative gap-1.5 font-body",
                priority
                  ? "border-brand/40 bg-brand-light/20 text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <IconFilter className="h-3.5 w-3.5" />
              {priority ? JOB_PRIORITY_LABELS[priority] : "Priority"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPriorityChange(null)}
              className={cn(
                "w-full justify-start font-body",
                priority === null
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              All
            </Button>
            {JOB_PRIORITIES.map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                onClick={() => onPriorityChange(p)}
                className={cn(
                  "w-full justify-start font-body",
                  priority === p
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {JOB_PRIORITY_LABELS[p]}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Service type filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-1.5 font-body",
                serviceType
                  ? "border-brand/40 bg-brand-light/20 text-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              {serviceType ? SERVICE_TYPE_LABELS[serviceType] : "Service Type"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onServiceTypeChange(null)}
              className={cn(
                "w-full justify-start font-body",
                serviceType === null
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              All
            </Button>
            {SERVICE_TYPES.map((st) => (
              <Button
                key={st}
                variant="ghost"
                size="sm"
                onClick={() => onServiceTypeChange(st)}
                className={cn(
                  "w-full justify-start font-body",
                  serviceType === st
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {SERVICE_TYPE_LABELS[st]}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPriorityChange(null);
              onServiceTypeChange(null);
            }}
            className="text-xs text-muted-foreground hover:text-foreground font-body"
          >
            Clear filters
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-brand-foreground font-medium">
              {activeFilterCount}
            </span>
          </Button>
        )}
      </div>

      {/* Action buttons group — right-aligned */}
      <div className="flex items-center gap-2">
        {/* Density toggle (default / compact) */}
        <div className="flex items-center rounded-md border border-border p-0.5 gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCompactChange(false)}
            className={cn(
              "h-7 w-7 rounded",
              !compact
                ? "bg-brand text-brand-foreground hover:bg-brand/90"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Default density"
          >
            <IconLayoutCards className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCompactChange(true)}
            className={cn(
              "h-7 w-7 rounded",
              compact
                ? "bg-brand text-brand-foreground hover:bg-brand/90"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Compact density"
          >
            <IconLayoutList className="h-3.5 w-3.5" />
          </Button>
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
