"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Icon } from "@tabler/icons-react";

export interface StatItem {
  label: string;
  count: number;
  icon: Icon;
  color: string;
  bg: string;
  filterValue?: string;
}

interface StatsCardsProps {
  stats: StatItem[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  className?: string;
}

function StatContent({ stat }: { stat: StatItem }) {
  return (
    <>
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
    </>
  );
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
        const value = stat.filterValue ?? stat.label.toLowerCase();
        const isActive = activeFilter === value;
        const cardStyles = cn(
          "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-all",
          isClickable && "hover:border-brand/40 cursor-pointer",
          isActive && "border-brand ring-1 ring-brand/20",
        );

        if (isClickable) {
          return (
            <Button
              key={stat.label}
              variant="ghost"
              onClick={() => onFilterChange!(isActive ? "" : value)}
              className={cn(cardStyles, "h-auto w-full justify-start")}
            >
              <StatContent stat={stat} />
            </Button>
          );
        }

        return (
          <div key={stat.label} className={cardStyles}>
            <StatContent stat={stat} />
          </div>
        );
      })}
    </div>
  );
}
