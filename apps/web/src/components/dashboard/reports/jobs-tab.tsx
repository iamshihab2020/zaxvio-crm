"use client";

import { useMemo } from "react";
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
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { staggerDelay } from "@/lib/motion";
import {
  chartAnimation,
  enterDelay,
} from "@/components/dashboard/home/chart-motion";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";
import { BRAND_SERIES, barBackground } from "@/lib/constants/chart-palette";
import {
  ChartLegendList,
  barFill,
  useFillId,
} from "@/components/dashboard/reusable/chart-fills";
import {
  JOB_STATUS_FILL,
  JOB_STATUS_ORDER,
  UNKNOWN_FILL,
  sortByOrder,
} from "./report-palette";

// One series each, so one colour each: the brand. Priority and service type
// were teal and orange, which read as two more meanings that were not there.
const volumeConfig = {
  count: { label: "Jobs", color: BRAND_SERIES },
} satisfies ChartConfig;

const priorityConfig = {
  count: { label: "Count", color: BRAND_SERIES },
} satisfies ChartConfig;

const serviceConfig = {
  count: { label: "Count", color: BRAND_SERIES },
} satisfies ChartConfig;

// Stable for the pie below: see CURRENCY_TOOLTIP in revenue-tab.tsx for why a
// pie's tooltip element must not be rebuilt on every render.
const PIE_TOOLTIP = <ChartTooltipContent />;

// The bars fill with a gradient, whose `url(#…)` the tooltip would otherwise
// take for their colour.
const BAR_TOOLTIP = <ChartTooltipContent color={BRAND_SERIES} />;

const formatCount = (n: number) => String(n);
const formatPercent = (n: number) => `${n}%`;
/** One decimal at most, and none when the figure is whole: "3", "3.5", never "3.0". */
const formatDays = (n: number) => String(Math.round(n * 10) / 10);

/** The pipeline bars draw in one after another, 40ms apart, capped at eight. */
const BAR_STEP = 40;
const BAR_MAX_STEPS = 8;

interface JobsTabProps {
  data: JobReportData;
  granularity: ReportGranularity;
}

export function JobsTab({ data, granularity }: JobsTabProps) {
  // The API still sends a colour per status (green, amber, red); the shade is
  // chosen here instead, from the brand ramp. Lifecycle order, memoised:
  // Recharts restarts a ring's draw-in whenever its data changes identity.
  const statusRows = useMemo(
    () =>
      sortByOrder(data.jobsByStatus, (s) => s.status, JOB_STATUS_ORDER).map(
        (s) => ({ ...s, fill: JOB_STATUS_FILL[s.status] ?? UNKNOWN_FILL }),
      ),
    [data.jobsByStatus],
  );
  const statusConfig: ChartConfig = {};
  statusRows.forEach((s) => {
    statusConfig[s.status] = { label: s.label, color: s.fill };
  });

  const volumeFill = useFillId();
  const priorityFill = useFillId();
  const serviceFill = useFillId();

  const anim = chartAnimation();

  return (
    <div data-stagger className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Jobs",
            value: String(data.kpis.totalJobs),
            numericValue: data.kpis.totalJobs,
            format: formatCount,
            icon: IconBriefcase,
            currentValue: data.kpis.totalJobs,
            previousValue: data.kpis.previousJobs,
          },
          {
            label: "Completed",
            value: String(data.kpis.completedJobs),
            numericValue: data.kpis.completedJobs,
            format: formatCount,
            icon: IconCircleCheck,
          },
          {
            label: "Cancelled",
            value: String(data.kpis.cancelledJobs),
            numericValue: data.kpis.cancelledJobs,
            format: formatCount,
            icon: IconCircleX,
          },
          {
            label: "Completion Rate",
            value: `${data.kpis.completionRate}%`,
            numericValue: data.kpis.completionRate,
            format: formatPercent,
            icon: IconPercentage,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Job Volume Trend */}
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
                {barFill(volumeFill, BRAND_SERIES, "up")}
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
                <ChartTooltip content={BAR_TOOLTIP} />
                <Bar
                  dataKey="count"
                  fill={`url(#${volumeFill})`}
                  radius={[4, 4, 0, 0]}
                  {...anim}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Jobs by Status */}
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
            <>
              <ChartContainer
                config={statusConfig}
                className="mx-auto h-[240px] w-full"
              >
                <PieChart>
                  <ChartTooltip content={PIE_TOOLTIP} />
                  <Pie
                    data={statusRows}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    {...anim}
                  >
                    {statusRows.map((s) => (
                      <Cell key={s.status} fill={s.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <ChartLegendList
                items={statusRows.map((s) => ({
                  key: s.status,
                  label: s.label,
                  color: s.fill,
                  value: String(s.count),
                }))}
              />
            </>
          )}
        </ReportChartCard>

        {/* Jobs by Priority */}
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
                {barFill(priorityFill, BRAND_SERIES, "right")}
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
                <ChartTooltip content={BAR_TOOLTIP} />
                <Bar
                  dataKey="count"
                  fill={`url(#${priorityFill})`}
                  radius={[0, 4, 4, 0]}
                  {...anim}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Jobs by Service Type */}
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
                {barFill(serviceFill, BRAND_SERIES, "right")}
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
                <ChartTooltip content={BAR_TOOLTIP} />
                <Bar
                  dataKey="count"
                  fill={`url(#${serviceFill})`}
                  radius={[0, 4, 4, 0]}
                  {...anim}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>
      </div>

      {/* Pipeline + Avg Completion */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ReportChartCard title="Avg Completion Time">
          <div className="flex h-32 flex-col items-center justify-center">
            <span className="font-heading text-4xl font-bold text-foreground">
              <AnimatedNumber
                value={data.avgCompletionDays}
                format={formatDays}
              />
            </span>
            <span className="mt-1 text-sm text-muted-foreground font-body">
              days average
            </span>
          </div>
        </ReportChartCard>

        <ReportChartCard
          title="Pipeline Distribution"
          className="md:col-span-2"
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
              {data.pipelineDistribution.map((stage, index) => {
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
                      {/* Full width, scaled to the share: it draws in and
                          re-sizes on `transform` alone. */}
                      <div
                        className="motion-grow-x h-full w-full rounded-full motion-safe:transition-transform motion-safe:[transition-duration:var(--dur-focal)] motion-safe:[transition-timing-function:var(--ease-out)]"
                        style={{
                          ...enterDelay(staggerDelay(index, BAR_STEP, BAR_MAX_STEPS)),
                          transform: `scaleX(${Math.max(pct, 2) / 100})`,
                          // One measure across the stages, so one colour. This
                          // was `stage.stageColor`, a preset NAME ("blue",
                          // "green"), which CSS drew as the keyword colours.
                          backgroundImage: barBackground(BRAND_SERIES),
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
      </div>
    </div>
  );
}
