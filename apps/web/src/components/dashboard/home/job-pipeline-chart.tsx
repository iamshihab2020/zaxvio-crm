"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardPipelineItem } from "@hvac-saas/types";

// Map stage color keys to actual HSL values for recharts
const STAGE_COLOR_MAP: Record<string, string> = {
  blue: "hsl(217 91% 60%)",
  brand: "hsl(24 95% 53%)",
  green: "hsl(142 71% 45%)",
  red: "hsl(0 84% 60%)",
  purple: "hsl(271 91% 65%)",
  amber: "hsl(43 96% 56%)",
  gray: "hsl(215 14% 50%)",
  teal: "hsl(173 58% 39%)",
};

const STAGE_DOT_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  brand: "bg-brand",
  green: "bg-green-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  gray: "bg-gray-500",
  teal: "bg-teal-500",
};

function getStageHslColor(colorKey: string): string {
  return STAGE_COLOR_MAP[colorKey] ?? STAGE_COLOR_MAP.gray;
}

function getStageDotClass(colorKey: string): string {
  return STAGE_DOT_MAP[colorKey] ?? "bg-gray-500";
}

interface JobPipelineChartProps {
  data: DashboardPipelineItem[];
}

export function JobPipelineChart({ data }: JobPipelineChartProps) {
  const totalJobs = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data
    .filter((d) => d.count > 0)
    .map((stage) => ({
      name: stage.stageLabel,
      value: stage.count,
      fill: getStageHslColor(stage.stageColor),
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base font-semibold">
          Job Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center">
            <p className="text-sm text-muted-foreground font-body">
              No pipeline stages configured
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            {/* Donut chart */}
            <div className="relative h-[250px] w-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-3xl font-bold text-foreground">
                  {totalJobs}
                </span>
                <span className="text-[10px] text-muted-foreground font-body">
                  total jobs
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {data.map((stage) => (
                <div
                  key={stage.stageName}
                  className="flex items-center gap-1.5 text-xs font-body"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      getStageDotClass(stage.stageColor),
                    )}
                  />
                  <span className="text-muted-foreground">{stage.stageLabel}</span>
                  <span className="font-medium text-foreground">{stage.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
