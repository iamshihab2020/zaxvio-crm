"use client";

import Link from "next/link";
import {
  IconCash,
  IconReceipt2,
  IconChartPie,
  IconBriefcase,
  IconAlertTriangle,
} from "@tabler/icons-react";
import type { ProfitabilityRow, ProfitabilitySection } from "@hvac-saas/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { ReportKpiRow } from "./report-kpi-row";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

interface ProfitabilityTabProps {
  data: ProfitabilitySection;
}

/** A margin percentage, or an honest dash when there is no revenue to divide by. */
function marginLabel(pct: number | null): string {
  return pct === null ? "—" : `${Math.round(pct * 100)}%`;
}

function marginTone(margin: string): string {
  return Number(margin) < 0
    ? "text-red-600 dark:text-red-400"
    : "text-foreground";
}

export function ProfitabilityTab({ data }: ProfitabilityTabProps) {
  const { totals } = data;

  // Nobody has entered a cost anywhere. Showing a 100%-margin report to this
  // person would be the most confidently wrong screen in the product.
  if (!totals.costingConfigured) {
    return <SetUpCosting />;
  }

  return (
    <div className="space-y-4">
      <ReportKpiRow
        kpis={[
          {
            label: "Revenue",
            value: formatMoney(totals.revenue),
            icon: IconCash,
            hint: "Costed jobs completed in this period",
          },
          {
            label: "Cost",
            value: formatMoney(totals.cost),
            icon: IconReceipt2,
            hint: "Parts, labour and expenses",
          },
          {
            label: "Margin",
            value: formatMoney(totals.margin),
            icon: IconChartPie,
            suffix: ` · ${marginLabel(totals.marginPct)}`,
          },
          {
            label: "Jobs counted",
            value: String(totals.jobCount),
            icon: IconBriefcase,
            hint:
              totals.excludedJobCount > 0
                ? `${totals.excludedJobCount} left out — costs incomplete`
                : "Every completed job is fully costed",
          },
        ]}
      />

      {totals.excludedJobCount > 0 && (
        <Fade inView inViewOnce>
          <div className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-3.5">
            <IconAlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div>
              <p className="font-body text-sm font-medium text-foreground">
                {totals.excludedJobCount}{" "}
                {totals.excludedJobCount === 1 ? "job is" : "jobs are"} not in
                these figures
              </p>
              <p className="mt-0.5 font-body text-xs leading-snug text-muted-foreground">
                Their costs are only partly entered. Counting them would treat
                the missing half as free and pull every margin here upwards, so
                they sit out until they are complete. Open a job&rsquo;s Costs
                tab to see what it is missing.
              </p>
            </div>
          </div>
        </Fade>
      )}

      {totals.truncated && (
        <p className="font-body text-xs text-muted-foreground">
          This period holds more completed jobs than one report covers. The
          figures above are the most recently completed 2,000. Narrow the date
          range for a complete picture.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Fade className="h-full" inView inViewOnce delay={0}>
          <GroupTable
            title="Thinnest margins"
            description="Jobs where the least of what you charged stayed with you."
            rows={data.byJob}
            firstColumn="Job"
            emptyMessage="No fully costed jobs completed in this period."
            hrefFor={(row) => `/jobs/${row.key}`}
          />
        </Fade>

        <Fade className="h-full" inView inViewOnce delay={100}>
          <GroupTable
            title="By service type"
            description="Which kinds of work pay."
            rows={data.byServiceType}
            firstColumn="Service type"
            emptyMessage="No costed work in this period."
          />
        </Fade>

        <Fade className="h-full" inView inViewOnce delay={200}>
          <GroupTable
            title="By customer"
            description="Your biggest accounts, and what they leave behind."
            rows={data.byCustomer}
            firstColumn="Customer"
            emptyMessage="No costed work in this period."
            hrefFor={(row) =>
              row.key === "unknown" ? undefined : `/customers/${row.key}`
            }
          />
        </Fade>

        <Fade className="h-full" inView inViewOnce delay={300}>
          <GroupTable
            title="By assignee"
            description="What each person's work returns, after their time is costed."
            rows={data.byAssignee}
            firstColumn="Assignee"
            emptyMessage="No costed work in this period."
          />
        </Fade>
      </div>
    </div>
  );
}

// ── Group table ──────────────────────────────────────────────

interface GroupTableProps {
  title: string;
  description: string;
  rows: ProfitabilityRow[];
  firstColumn: string;
  emptyMessage: string;
  hrefFor?: (row: ProfitabilityRow) => string | undefined;
}

/**
 * One table shape for all four groupings.
 *
 * Money is set in tabular monospace figures so the columns align on the decimal
 * and a reader can compare rows by eye — the entire point of grouping is
 * comparison, and proportional digits make that a reading exercise.
 */
function GroupTable({
  title,
  description,
  rows,
  firstColumn,
  emptyMessage,
  hrefFor,
}: GroupTableProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm font-semibold">
          {title}
        </CardTitle>
        <p className="font-body text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <WidgetErrorBoundary name={title}>
          {rows.length === 0 ? (
            <div className="flex h-24 items-center justify-center px-6 pb-4">
              <p className="font-body text-sm text-muted-foreground">
                {emptyMessage}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  {title}: {description}
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th
                      scope="col"
                      className="px-4 py-2 text-left font-body text-xs font-medium text-muted-foreground"
                    >
                      {firstColumn}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-right font-body text-xs font-medium text-muted-foreground"
                    >
                      Revenue
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-right font-body text-xs font-medium text-muted-foreground"
                    >
                      Cost
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right font-body text-xs font-medium text-muted-foreground"
                    >
                      Margin
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const href = hrefFor?.(row);
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-border last:border-0"
                      >
                        <th
                          scope="row"
                          className="max-w-[16rem] truncate px-4 py-2 text-left font-body font-normal text-foreground"
                        >
                          {href ? (
                            <Link href={href} className="hover:underline">
                              {row.label}
                            </Link>
                          ) : (
                            row.label
                          )}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {row.jobCount === 1
                              ? "1 job"
                              : `${row.jobCount} jobs`}
                            {row.excludedJobCount > 0 &&
                              ` · ${row.excludedJobCount} not costed`}
                          </span>
                        </th>
                        <td className="tnum px-2 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(row.revenue)}
                        </td>
                        <td className="tnum px-2 py-2 text-right font-mono text-muted-foreground">
                          {formatMoney(row.cost)}
                        </td>
                        <td
                          className={cn(
                            "tnum px-4 py-2 text-right font-mono font-medium",
                            marginTone(row.margin),
                          )}
                        >
                          {formatMoney(row.margin)}
                          <span className="ml-1.5 font-body text-xs font-normal text-muted-foreground">
                            {marginLabel(row.marginPct)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </WidgetErrorBoundary>
      </CardContent>
    </Card>
  );
}

// ── Empty state ──────────────────────────────────────────────

/**
 * An empty screen is an invitation to act. Two links, in the order the work has
 * to be done: what things cost you, then what an hour of your time costs.
 */
function SetUpCosting() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-light">
          <IconChartPie className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Set up costing to see your margins
        </h2>
        <p className="mt-2 max-w-md font-body text-sm leading-relaxed text-muted-foreground">
          This report compares what you charged against what the work cost. It
          needs two things from you: what your catalog items cost to buy, and
          what an hour of labour costs to provide. Until then there is nothing
          honest to put here.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Link href="/settings/catalog">Add costs to your catalog</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/business">Set your labour cost rate</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
