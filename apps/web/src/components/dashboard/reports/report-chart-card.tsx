"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartDataTable } from "@/components/reusable/chart-data-table";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { cn } from "@/lib/utils";

interface ChartTableProps {
  caption: string;
  columns: string[];
  rows: string[][];
}

interface ReportChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Accessible equivalent of the chart. When provided, the visual children are
   * marked `aria-hidden` and this table is exposed to screen readers instead —
   * Recharts emits SVG with no accessible structure, and several legends here
   * distinguish series by colour alone (WCAG 1.4.1).
   */
  dataTable?: ChartTableProps;
}

/**
 * Every chart on /reports goes through this card, so the error boundary lives
 * here rather than being repeated in five tab files. One malformed row used to
 * unmount the whole page; now it costs exactly one card.
 */
export function ReportChartCard({
  title,
  description,
  children,
  className,
  dataTable,
}: ReportChartCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm font-semibold">
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="font-body text-xs">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <WidgetErrorBoundary name={title}>
          {dataTable ? (
            <>
              <div aria-hidden>{children}</div>
              <ChartDataTable {...dataTable} />
            </>
          ) : (
            children
          )}
        </WidgetErrorBoundary>
      </CardContent>
    </Card>
  );
}
