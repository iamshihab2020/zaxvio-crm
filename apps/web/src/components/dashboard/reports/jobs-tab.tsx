"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconBriefcase,
  IconCircleCheck,
  IconCircleX,
  IconPercentage,
} from "@tabler/icons-react";
import type { JobReportData, ReportGranularity } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const volumeConfig = {
  count: { label: "Jobs", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const priorityConfig = {
  count: { label: "Count", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const serviceConfig = {
  count: { label: "Count", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

interface JobsTabProps {
  data: JobReportData;
  granularity: ReportGranularity;
}

export function JobsTab({ data, granularity }: JobsTabProps) {
  const statusConfig: ChartConfig = {};
  data.jobsByStatus.forEach((s) => {
    statusConfig[s.status] = { label: s.label, color: s.color };
  });

  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Jobs",
            value: String(data.kpis.totalJobs),
            icon: IconBriefcase,
            currentValue: data.kpis.totalJobs,
            previousValue: data.kpis.previousJobs,
          },
          {
            label: "Completed",
            value: String(data.kpis.completedJobs),
            icon: IconCircleCheck,
          },
          {
            label: "Cancelled",
            value: String(data.kpis.cancelledJobs),
            icon: IconCircleX,
          },
          {
            label: "Completion Rate",
            value: `${data.kpis.completionRate}%`,
            icon: IconPercentage,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Job Volume Trend */}
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard
            title="Job Volume"
            description={`Scheduled jobs, ${granularityLabel(granularity)}`}
            dataTable={{
              caption: "Job volume by period",
              columns: ["Period", "Jobs"],
              rows: data.jobVolumeTrend.map((p) => [p.monthLabel, String(p.count)]),
            }}
          >
            {data.jobVolumeTrend.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={volumeConfig}
                className="h-[280px] w-full"
              >
                <BarChart
                  data={data.jobVolumeTrend}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="text-xs font-body"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={30}
                    className="text-xs font-body"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Jobs by Status */}
        <Fade className="h-full" inView inViewOnce delay={100}>
          <ReportChartCard
            title="Jobs by Status"
            dataTable={{
              caption: "Jobs by status",
              columns: ["Status", "Jobs"],
              rows: data.jobsByStatus.map((s) => [s.label, String(s.count)]),
            }}
          >
            {data.jobsByStatus.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={statusConfig}
                className="mx-auto h-[280px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={data.jobsByStatus}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {data.jobsByStatus.map((s) => (
                      <Cell key={s.status} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Jobs by Priority */}
        <Fade className="h-full" inView inViewOnce delay={200}>
          <ReportChartCard
            title="Jobs by Priority"
            dataTable={{
              caption: "Jobs by priority",
              columns: ["Priority", "Jobs"],
              rows: data.jobsByPriority.map((s) => [s.label, String(s.count)]),
            }}
          >
            {data.jobsByPriority.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={priorityConfig}
                className="h-[280px] w-full"
              >
                <BarChart
                  data={data.jobsByPriority}
                  layout="vertical"
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs font-body"
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={80}
                    className="text-xs font-body"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>

        {/* Jobs by Service Type */}
        <Fade className="h-full" inView inViewOnce delay={300}>
          <ReportChartCard
            title="Jobs by Service Type"
            dataTable={{
              caption: "Jobs by service type",
              columns: ["Service Type", "Jobs"],
              rows: data.jobsByServiceType.map((s) => [s.label, String(s.count)]),
            }}
          >
            {data.jobsByServiceType.length === 0 ? (
              <EmptyChart />
            ) : (
              <ChartContainer
                config={serviceConfig}
                className="h-[280px] w-full"
              >
                <BarChart
                  data={data.jobsByServiceType}
                  layout="vertical"
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs font-body"
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={90}
                    className="text-xs font-body"
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </ReportChartCard>
        </Fade>
      </div>

      {/* Pipeline + Avg Completion */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard title="Avg Completion Time">
            <div className="flex h-32 flex-col items-center justify-center">
              <span className="font-heading text-4xl font-bold text-foreground">
                {data.avgCompletionDays}
              </span>
              <span className="mt-1 text-sm text-muted-foreground font-body">
                days average
              </span>
            </div>
          </ReportChartCard>
        </Fade>

        <Fade className="h-full md:col-span-2" inView inViewOnce delay={100}>
          <ReportChartCard
            title="Pipeline Distribution"
            dataTable={{
              caption: "Jobs by pipeline stage",
              columns: ["Stage", "Jobs"],
              rows: data.pipelineDistribution.map((s) => [
                s.stageLabel,
                String(s.count),
              ]),
            }}
          >
            {data.pipelineDistribution.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="space-y-2 py-2">
                {data.pipelineDistribution.map((stage) => {
                  const total = data.pipelineDistribution.reduce(
                    (s, st) => s + st.count,
                    0,
                  );
                  const pct = total > 0 ? (stage.count / total) * 100 : 0;
                  return (
                    <div key={stage.stageLabel} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-body text-muted-foreground truncate">
                        {stage.stageLabel}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: stage.stageColor || "hsl(var(--chart-1))",
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-body font-medium">
                        {stage.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ReportChartCard>
        </Fade>
      </div>
    </div>
  );
}
