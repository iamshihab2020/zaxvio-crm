"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconCalendarPlus,
  IconCalendarStats,
  IconPercentage,
} from "@tabler/icons-react";
import type { BookingReportData, ReportGranularity } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { chartAnimation } from "@/components/dashboard/home/chart-motion";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { EmptyChart } from "./empty-chart";
import { granularityLabel } from "./report-format";
import { BRAND_SERIES } from "@/lib/constants/chart-palette";
import { barFill, useFillId } from "@/components/dashboard/reusable/chart-fills";

// One series each, so the brand each time. Service type and day of week were
// teal and rust, which read as meanings that were not there.
const volumeConfig = {
  count: { label: "Bookings", color: BRAND_SERIES },
} satisfies ChartConfig;

const serviceConfig = {
  count: { label: "Count", color: BRAND_SERIES },
} satisfies ChartConfig;

const dayConfig = {
  count: { label: "Bookings", color: BRAND_SERIES },
} satisfies ChartConfig;

// The bars fill with a gradient, whose `url(#…)` the tooltip would otherwise
// take for their colour.
const BAR_TOOLTIP = <ChartTooltipContent color={BRAND_SERIES} />;

const formatCount = (n: number) => String(n);
const formatPercent = (n: number) => `${n}%`;

interface BookingsTabProps {
  data: BookingReportData;
  granularity: ReportGranularity;
}

export function BookingsTab({ data, granularity }: BookingsTabProps) {
  const volumeFill = useFillId();
  const serviceFill = useFillId();
  const dayFill = useFillId();

  const anim = chartAnimation();

  return (
    <div data-stagger className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Bookings",
            value: String(data.kpis.totalBookings),
            numericValue: data.kpis.totalBookings,
            format: formatCount,
            icon: IconCalendarPlus,
            currentValue: data.kpis.totalBookings,
            previousValue: data.kpis.previousBookings,
          },
          {
            label: "Pending",
            value: String(data.kpis.pendingBookings),
            numericValue: data.kpis.pendingBookings,
            format: formatCount,
            icon: IconCalendarStats,
          },
          {
            label: "Conversion Rate",
            value: `${data.kpis.conversionRate}%`,
            numericValue: data.kpis.conversionRate,
            format: formatPercent,
            icon: IconPercentage,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Booking Volume Trend */}
        <ReportChartCard
          title="Booking Volume"
          description={`Requested bookings, ${granularityLabel(granularity)}`}
          dataTable={{
            caption: "Booking volume by period",
            columns: ["Period", "Bookings"],
            rows: data.bookingVolumeTrend.map((p) => [
              p.monthLabel,
              String(p.count),
            ]),
          }}
        >
          {data.bookingVolumeTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={volumeConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.bookingVolumeTrend}
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

        {/* Bookings by Service Type */}
        <ReportChartCard
          title="Bookings by Service Type"
          dataTable={{
            caption: "Bookings by service type",
            columns: ["Service Type", "Bookings"],
            rows: data.bookingsByServiceType.map((s) => [
              s.label,
              String(s.count),
            ]),
          }}
        >
          {data.bookingsByServiceType.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={serviceConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.bookingsByServiceType}
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

        {/* Bookings by Day of Week */}
        <ReportChartCard
          title="Popular Booking Days"
          dataTable={{
            caption: "Bookings by day of week",
            columns: ["Day", "Bookings"],
            rows: data.bookingsByDayOfWeek.map((s) => [s.day, String(s.count)]),
          }}
        >
          {data.bookingsByDayOfWeek.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={dayConfig}
              className="h-[280px] w-full"
            >
              <BarChart
                data={data.bookingsByDayOfWeek}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                {barFill(dayFill, BRAND_SERIES, "up")}
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
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
                  fill={`url(#${dayFill})`}
                  radius={[4, 4, 0, 0]}
                  {...anim}
                />
              </BarChart>
            </ChartContainer>
          )}
        </ReportChartCard>

        {/* Booking Conversion Rate */}
        <ReportChartCard title="Booking → Job Conversion">
          <div className="space-y-4 py-4">
            <div className="flex items-end justify-between">
              <span className="font-heading text-3xl font-bold text-foreground">
                <AnimatedNumber
                  value={data.bookingConversionRate.rate}
                  format={formatPercent}
                />
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {data.bookingConversionRate.converted} of{" "}
                {data.bookingConversionRate.totalBookings} bookings
              </span>
            </div>
            <Progress
              value={data.bookingConversionRate.rate}
              className="h-2"
              aria-label={`Booking to job conversion ${data.bookingConversionRate.rate} percent`}
            />
            <div className="flex justify-between text-xs text-muted-foreground font-body">
              <span>Converted to jobs</span>
              <span>
                {data.bookingConversionRate.totalBookings -
                  data.bookingConversionRate.converted}{" "}
                not converted
              </span>
            </div>
          </div>
        </ReportChartCard>
      </div>
    </div>
  );
}
