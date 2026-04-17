"use client";

import Link from "next/link";
import type { TablerIcon } from "@tabler/icons-react";
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { DashboardSparklinePoint } from "@hvac-saas/types";
import { cn } from "@/lib/utils";

interface KpiPillProps {
  label: string;
  value: string;
  icon?: TablerIcon;
  currentValue?: number;
  previousValue?: number;
  comparisonLabel?: string;
  trendInverted?: boolean;
  sparklineData?: DashboardSparklinePoint[];
  href?: string;
  accent?: "brand" | "indigo" | "emerald";
}

function computeTrend(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "neutral" as const };
    return { pct: 100, direction: "up" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { pct: 0, direction: "neutral" as const };
  return { pct: Math.abs(pct), direction: pct > 0 ? ("up" as const) : ("down" as const) };
}

const ACCENT_STYLES: Record<
  NonNullable<KpiPillProps["accent"]>,
  { iconBg: string; iconColor: string; stroke: string; id: string }
> = {
  brand: {
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    stroke: "hsl(var(--brand))",
    id: "brand",
  },
  indigo: {
    iconBg: "bg-indigo-500/10",
    iconColor: "text-indigo-500",
    stroke: "rgb(99 102 241)",
    id: "indigo",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    stroke: "rgb(16 185 129)",
    id: "emerald",
  },
};

export function KpiPill({
  label,
  value,
  icon: Icon,
  currentValue,
  previousValue,
  comparisonLabel = "vs last period",
  trendInverted = false,
  sparklineData,
  href,
  accent = "brand",
}: KpiPillProps) {
  const trend =
    currentValue !== undefined && previousValue !== undefined
      ? computeTrend(currentValue, previousValue)
      : null;

  const isPositive = trend
    ? trendInverted
      ? trend.direction === "down"
      : trend.direction === "up"
    : null;

  const accentStyle = ACCENT_STYLES[accent];
  const gradientId = `kpi-spark-${accentStyle.id}-${label.replace(/\s+/g, "")}`;

  const content = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
        href && "cursor-pointer hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg",
      )}
    >
      {/* Subtle brand glow on hover */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ background: accentStyle.stroke }}
        aria-hidden
      />

      {/* Sparkline background */}
      {sparklineData && sparklineData.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentStyle.stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={accentStyle.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentStyle.stroke}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                accentStyle.iconBg,
              )}
            >
              <Icon className={cn("h-4 w-4", accentStyle.iconColor)} />
            </div>
          )}
          <span className="text-xs font-body text-muted-foreground">{label}</span>
        </div>
        {trend && trend.direction !== "neutral" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium font-body",
              isPositive
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
            )}
          >
            {trend.direction === "up" ? (
              <IconTrendingUp className="h-3 w-3" />
            ) : (
              <IconTrendingDown className="h-3 w-3" />
            )}
            {trend.pct}%
          </span>
        )}
      </div>

      <div className="relative mt-4 flex items-baseline gap-2">
        <span className="font-heading text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </span>
        {trend && trend.direction !== "neutral" && (
          <span className="text-[11px] font-body text-muted-foreground">
            {comparisonLabel}
          </span>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
