"use client";

import type { TablerIcon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { DashboardSparklinePoint } from "@hvac-saas/types";

interface KpiCardProps {
  icon: TablerIcon;
  label: string;
  value: string;
  currentValue?: number;
  previousValue?: number;
  trendInverted?: boolean;
  sparklineData?: DashboardSparklinePoint[];
  badge?: { text: string; variant: "warning" | "destructive" };
  href?: string;
}

function computeTrend(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? { pct: 100, direction: "up" as const } : { pct: 0, direction: "neutral" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { pct: 0, direction: "neutral" as const };
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" as const : "down" as const };
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  currentValue,
  previousValue,
  trendInverted = false,
  sparklineData,
  badge,
  href,
}: KpiCardProps) {
  const trend =
    currentValue !== undefined && previousValue !== undefined
      ? computeTrend(currentValue, previousValue)
      : null;

  // For inverted metrics (costs), "up" is bad
  const trendIsPositive = trend
    ? trendInverted
      ? trend.direction === "down"
      : trend.direction === "up"
    : null;

  const content = (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow relative overflow-hidden",
        href && "cursor-pointer hover:shadow-md",
      )}
    >
      {/* Sparkline background */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="absolute right-0 bottom-0 w-24 h-10 opacity-30">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--brand))"
                fill={`url(#spark-${label.replace(/\s/g, "")})`}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-light">
          <Icon className="h-4 w-4 text-brand" />
        </div>
        <span className="text-xs font-body text-muted-foreground">{label}</span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <span className="font-heading text-2xl font-bold text-foreground">
            {value}
          </span>
          {trend && trend.direction !== "neutral" && (
            <div className="mt-0.5 flex items-center gap-1">
              {trend.direction === "up" ? (
                <IconTrendingUp
                  className={cn(
                    "h-3 w-3",
                    trendIsPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                />
              ) : (
                <IconTrendingDown
                  className={cn(
                    "h-3 w-3",
                    trendIsPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                />
              )}
              <span
                className={cn(
                  "text-xs font-medium font-body",
                  trendIsPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {trend.pct}%
              </span>
              <span className="text-xs text-muted-foreground font-body">
                vs prev
              </span>
            </div>
          )}
        </div>
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              badge.variant === "destructive" &&
                "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
              badge.variant === "warning" &&
                "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
