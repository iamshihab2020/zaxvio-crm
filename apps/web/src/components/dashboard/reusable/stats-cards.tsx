"use client";

import { cn } from "@/lib/utils";
import type { Icon } from "@tabler/icons-react";

export interface StatItem {
  label: string;
  count: number;
  icon: Icon;
  color: string;
  bg: string;
}

interface StatsCardsProps {
  stats: StatItem[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  className?: string;
}

export function StatsCards({
  stats,
  activeFilter,
  onFilterChange,
  className,
}: StatsCardsProps) {
  const isClickable = !!onFilterChange;

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat) => {
        const isActive = activeFilter === stat.label.toLowerCase();
        const Wrapper = isClickable ? "button" : "div";

        return (
          <Wrapper
            key={stat.label}
            {...(isClickable && {
              onClick: () =>
                onFilterChange!(isActive ? "" : stat.label.toLowerCase()),
            })}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-all",
              isClickable && "hover:border-brand/40 cursor-pointer",
              isActive && "border-brand ring-1 ring-brand/20",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                stat.bg,
              )}
            >
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <div>
              <p className="text-lg font-bold font-heading text-foreground">
                {stat.count}
              </p>
              <p className="text-xs text-muted-foreground font-body">
                {stat.label}
              </p>
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
