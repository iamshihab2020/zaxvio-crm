"use client";

import { useCallback, useMemo, useState } from "react";
import { PageActions } from "@/components/dashboard/page-actions";
import { format, parseISO, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  IconCash,
  IconBriefcase,
  IconUsers,
  IconFileDescription,
  IconCalendarPlus,
} from "@tabler/icons-react";
import type { ReportSection, ReportSectionResponse } from "@hvac-saas/types";
import { useReportStats } from "@/hooks/queries";
import type { ReportStatsParams, ReportStatsResult } from "@/actions/reports";
import {
  DateRangePicker,
  type DatePreset,
} from "@/components/ui/date-range-picker";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ReportsSkeleton,
  ReportsTabSkeleton,
} from "@/components/dashboard/reports/reports-skeleton";
import { ExportCsvButton } from "@/components/dashboard/reports/export-csv-button";
import { RevenueTab } from "@/components/dashboard/reports/revenue-tab";
import { JobsTab } from "@/components/dashboard/reports/jobs-tab";
import { CustomersTab } from "@/components/dashboard/reports/customers-tab";
import { QuotesInvoicesTab } from "@/components/dashboard/reports/quotes-invoices-tab";
import { BookingsTab } from "@/components/dashboard/reports/bookings-tab";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const TABS: { value: ReportSection; label: string; icon: typeof IconCash }[] = [
  { value: "revenue", label: "Revenue", icon: IconCash },
  { value: "jobs", label: "Jobs", icon: IconBriefcase },
  { value: "customers", label: "Customers", icon: IconUsers },
  { value: "quotes-invoices", label: "Quotes & Invoices", icon: IconFileDescription },
  { value: "bookings", label: "Bookings", icon: IconCalendarPlus },
];

const EXTRA_PRESETS: DatePreset[] = [
  {
    label: "Last 12 months",
    getValue: () => ({ from: subYears(new Date(), 1), to: new Date() }),
  },
  {
    label: "All time",
    getValue: () => ({ from: new Date(2020, 0, 1), to: new Date() }),
  },
];

interface ReportsPageClientProps {
  initialReport?: ReportStatsResult;
  initialParams?: ReportStatsParams;
  initialFetchedAt?: number;
}

export function ReportsPageClient({
  initialReport,
  initialParams,
  initialFetchedAt,
}: ReportsPageClientProps) {
  const [activeTab, setActiveTab] = useState<ReportSection>(
    initialParams?.section ?? "revenue",
  );
  // No explicit range until the user picks one. The browser cannot reproduce
  // "month to date in the tenant's timezone", so the API resolves it and echoes
  // the window back — the picker renders what was queried, not a guess.
  const [picked, setPicked] = useState<DateRange | undefined>(undefined);

  const params: ReportStatsParams = useMemo(
    () => ({
      section: activeTab,
      from: picked?.from ? format(picked.from, "yyyy-MM-dd") : undefined,
      to: picked?.to ? format(picked.to, "yyyy-MM-dd") : undefined,
    }),
    [activeTab, picked],
  );

  const { data: result, isLoading, isFetching, isError, refetch } = useReportStats(
    params,
    { initialData: initialReport, initialParams, initialFetchedAt },
  );

  const report = result?.data ?? null;
  // `getReportStats` catches its own failures and resolves with an envelope, so
  // `result.error` is the normal path. `isError` only fires if the server action
  // itself rejects — covered so that case cannot leave the page on a skeleton.
  const errorMessage =
    result?.error ?? (isError ? "Failed to load report data" : null);

  // Only render a payload that belongs to the tab on screen. `placeholderData`
  // keeps the previous response during a refetch, which is what makes changing
  // the date range feel instant — but across a tab switch that payload has the
  // wrong shape, and the discriminant is how we know.
  const current: ReportSectionResponse | null =
    report && report.section === activeTab ? report : null;

  // Show the range the server actually used until the user overrides it.
  const displayRange = useMemo<DateRange | undefined>(() => {
    if (picked) return picked;
    if (!report?.range) return undefined;
    return { from: parseISO(report.range.from), to: parseISO(report.range.to) };
  }, [picked, report?.range]);

  const handleRangeChange = useCallback((range: DateRange | undefined) => {
    // A half-finished selection would send `from` without `to`; wait for both.
    setPicked(range?.from && range?.to ? range : undefined);
  }, []);

  if (isLoading && !report) {
    return (
      <section className="p-6">
        <ReportsSkeleton />
      </section>
    );
  }

  // A failed request is not an empty period. Before this, a 500 or an expired
  // session rendered as "No data available for this period" — a confident wrong
  // answer on a page about money.
  if (!current && errorMessage) {
    return (
      <section className="p-6">
        <LoadErrorState
          title="Couldn't load your reports"
          message={errorMessage}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      </section>
    );
  }

  return (
    <section className="p-6">
      <Fade inView inViewOnce delay={0}>
        {/* The range governs every tab, so it stays with the page title.
            Export produces the *current* tab's CSV, so it sits with the tabs. */}
        <PageActions>
          <DateRangePicker
            dateRange={displayRange}
            onDateRangeChange={handleRangeChange}
            extraPresets={EXTRA_PRESETS}
          />
        </PageActions>
      </Fade>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportSection)}
      >
        <Fade inView inViewOnce delay={80}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <TabsList>
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    <tab.icon className="h-3.5 w-3.5" aria-hidden />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="shrink-0 pb-1">
              <ExportCsvButton report={current} />
            </div>
          </div>
        </Fade>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {!current ? (
              <ReportsTabSkeleton />
            ) : (
              <Fade
                inView
                inViewOnce
                key={`${current.section}-${current.range.from}-${current.range.to}`}
                delay={0}
              >
                <ReportSectionView report={current} />
              </Fade>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

/**
 * One switch over the response's own discriminant. The previous version built a
 * five-key map in which four keys were `null` by construction, then switched
 * over *that* — pure indirection that also hid five `as` casts over an `any`.
 */
function ReportSectionView({ report }: { report: ReportSectionResponse }) {
  switch (report.section) {
    case "revenue":
      return <RevenueTab data={report.data} granularity={report.granularity} />;
    case "jobs":
      return <JobsTab data={report.data} granularity={report.granularity} />;
    case "customers":
      return <CustomersTab data={report.data} granularity={report.granularity} />;
    case "quotes-invoices":
      return (
        <QuotesInvoicesTab data={report.data} granularity={report.granularity} />
      );
    case "bookings":
      return <BookingsTab data={report.data} granularity={report.granularity} />;
    default: {
      const exhaustive: never = report;
      throw new Error(`Unhandled report section: ${String(exhaustive)}`);
    }
  }
}
