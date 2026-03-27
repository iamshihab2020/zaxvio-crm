"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { IconFileDescription } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardQuoteSummary } from "@hvac-saas/types";

interface QuoteConversionProps {
  data: DashboardQuoteSummary;
}

const SEGMENT_CONFIG = [
  {
    key: "accepted" as const,
    label: "Accepted",
    color: "hsl(142 71% 45%)",
    dot: "bg-green-500",
    text: "text-green-600 dark:text-green-400",
  },
  {
    key: "declined" as const,
    label: "Declined",
    color: "hsl(0 84% 60%)",
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
  {
    key: "pending" as const,
    label: "Pending",
    color: "hsl(43 96% 56%)",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
];

export function QuoteConversion({ data }: QuoteConversionProps) {
  const chartData = SEGMENT_CONFIG.map((s) => ({
    name: s.label,
    value: data[s.key],
    color: s.color,
  })).filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-semibold">
          Quote Conversion
        </CardTitle>
        <p className="text-xs text-muted-foreground font-body">
          {data.totalQuotes} quotes in period
        </p>
      </CardHeader>
      <CardContent>
        {data.totalQuotes === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <div className="text-center">
              <IconFileDescription className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1.5 text-xs text-muted-foreground font-body">
                No quotes yet
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Donut chart */}
            <div className="relative mx-auto h-[140px] w-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={62}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-xl font-bold text-foreground">
                  {data.conversionRate}%
                </span>
                <span className="text-[10px] text-muted-foreground font-body">
                  conversion
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4">
              {SEGMENT_CONFIG.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 text-xs font-body">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={cn("font-medium", s.text)}>{data[s.key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
