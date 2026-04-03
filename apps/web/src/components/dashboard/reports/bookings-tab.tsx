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
import type { BookingReportData } from "@hvac-saas/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { ReportKpiRow } from "./report-kpi-row";
import { ReportChartCard } from "./report-chart-card";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const volumeConfig = {
  count: { label: "Bookings", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const serviceConfig = {
  count: { label: "Count", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const dayConfig = {
  count: { label: "Bookings", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

interface BookingsTabProps {
  data: BookingReportData;
}

export function BookingsTab({ data }: BookingsTabProps) {
  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Total Bookings",
            value: String(data.kpis.totalBookings),
            icon: IconCalendarPlus,
            currentValue: data.kpis.totalBookings,
            previousValue: data.kpis.previousBookings,
          },
          {
            label: "Pending",
            value: String(data.kpis.pendingBookings),
            icon: IconCalendarStats,
          },
          {
            label: "Conversion Rate",
            value: `${data.kpis.conversionRate}%`,
            icon: IconPercentage,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Booking Volume Trend */}
        <Fade className="h-full" inView inViewOnce delay={0}>
          <ReportChartCard title="Booking Volume by Month">
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

        {/* Bookings by Service Type */}
        <Fade className="h-full" inView inViewOnce delay={100}>
          <ReportChartCard title="Bookings by Service Type">
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

        {/* Bookings by Day of Week */}
        <Fade className="h-full" inView inViewOnce delay={200}>
          <ReportChartCard title="Popular Booking Days">
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

        {/* Booking Conversion Rate */}
        <Fade className="h-full" inView inViewOnce delay={300}>
          <ReportChartCard title="Booking → Job Conversion">
            <div className="space-y-4 py-4">
              <div className="flex items-end justify-between">
                <span className="font-heading text-3xl font-bold text-foreground">
                  {data.bookingConversionRate.rate}%
                </span>
                <span className="text-xs text-muted-foreground font-body">
                  {data.bookingConversionRate.converted} of{" "}
                  {data.bookingConversionRate.totalBookings} bookings
                </span>
              </div>
              <Progress
                value={data.bookingConversionRate.rate}
                className="h-2"
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
        </Fade>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center">
      <p className="text-sm text-muted-foreground font-body">
        No data for this period
      </p>
    </div>
  );
}
