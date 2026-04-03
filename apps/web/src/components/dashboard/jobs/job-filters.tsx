"use client";

import {
  IconSearch,
  IconFilter,
  IconX,
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
}

export function JobFilters({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  serviceType,
  onServiceTypeChange,
}: JobFiltersProps) {
  const activeFilterCount = (priority ? 1 : 0) + (serviceType ? 1 : 0);

  return (
    <div className="flex items-center gap-1.5">
      {/* Compact search */}
      <div className="relative">
        <IconSearch className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 w-[180px] pl-7 pr-2 text-xs font-body bg-transparent border-border/40 rounded-md placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Combined filter popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-md relative",
              activeFilterCount > 0
                ? "text-brand"
                : "text-muted-foreground hover:text-foreground",
            )}
            title="Filters"
          >
            <IconFilter className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-brand-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          {/* Priority section */}
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-heading mb-1 px-1">
              Priority
            </p>
            <div className="space-y-0.5">
              {[null, ...JOB_PRIORITIES].map((p) => (
                <button
                  key={p ?? "all"}
                  onClick={() => onPriorityChange(p)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1 text-xs font-body transition-colors",
                    priority === p
                      ? "bg-brand-light/20 text-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {p ? JOB_PRIORITY_LABELS[p] : "All priorities"}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border/60 my-2" />

          {/* Service Type section */}
          <div className="mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-heading mb-1 px-1">
              Service Type
            </p>
            <div className="space-y-0.5">
              {[null, ...SERVICE_TYPES].map((st) => (
                <button
                  key={st ?? "all"}
                  onClick={() => onServiceTypeChange(st)}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1 text-xs font-body transition-colors",
                    serviceType === st
                      ? "bg-brand-light/20 text-brand"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {st ? SERVICE_TYPE_LABELS[st] : "All types"}
                </button>
              ))}
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <>
              <div className="h-px bg-border/60 my-2" />
              <button
                onClick={() => {
                  onPriorityChange(null);
                  onServiceTypeChange(null);
                }}
                className="flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <IconX className="h-3 w-3" />
                Clear all filters
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
