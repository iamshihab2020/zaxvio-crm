"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageActions } from "@/components/dashboard/page-actions";
import { format, parseISO, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  IconCash,
  IconBriefcase,
  IconUsers,
  IconFileDescription,
  IconCalendarPlus,
  IconChartPie,
} from "@tabler/icons-react";
import type { ReportSection, ReportSectionResponse } from "@hvac-saas/types";
import { useReportStats } from "@/hooks/queries";
import type { ReportStatsParams, ReportStatsResult } from "@/actions/reports";
import {
  DateRangePicker,
  type DatePreset,
} from "@/components/ui/date-range-picker";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import {
  DATE_RANGE_KEYS,
  useStoredDateRange,
} from "@/hooks/use-stored-date-range";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ReportsSkeleton,
  ReportsTabSkeleton,
} from "@/components/dashboard/reports/reports-skeleton";
import { ExportCsvButton } from "@/components/dashboard/reports/export-csv-button";
import { prefersReducedMotion } from "@/lib/motion";
import { RevenueTab } from "@/components/dashboard/reports/revenue-tab";
import { JobsTab } from "@/components/dashboard/reports/jobs-tab";
import { CustomersTab } from "@/components/dashboard/reports/customers-tab";
import { QuotesInvoicesTab } from "@/components/dashboard/reports/quotes-invoices-tab";
import { BookingsTab } from "@/components/dashboard/reports/bookings-tab";
import { ProfitabilityTab } from "@/components/dashboard/reports/profitability-tab";

const TABS: { value: ReportSection; label: string; icon: typeof IconCash }[] = [
  { value: "revenue", label: "Revenue", icon: IconCash },
  // Next to Revenue, not last: "what came in" and "what stayed" are the same
  // question asked twice, and they are read together.
  { value: "profitability", label: "Profitability", icon: IconChartPie },
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

  // Six tabs do not fit a phone, so the list scrolls sideways. Bring the
  // selected one fully into view: after a tap on a half-visible tab, and when
  // the page opens on a tab past the edge.
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsScrollerRef.current
      ?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
      ?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
  }, [activeTab]);
  // No explicit range until the user picks one. The browser cannot reproduce
  // "month to date in the tenant's timezone", so the API resolves it and echoes
  // the window back: the picker renders what was queried, not a guess.
  const [picked, setPicked] = useState<DateRange | undefined>(undefined);

  const { stored: storedRange, save: saveRange } = useStoredDateRange(
    DATE_RANGE_KEYS.reports,
  );

  // Replay the saved range once localStorage is readable. Stored dates are
  // absolute and are used verbatim — a shortcut like "Last 12 months" is a way
  // of entering a range, not a standing instruction to re-derive one against
  // today. This page keeps its own key: /reports and /dashboard are the same
  // control with the same expectation, but not the same selection.
  useEffect(() => {
    if (!storedRange) return;
    setPicked({
      from: parseISO(storedRange.from),
      to: parseISO(storedRange.to),
    });
  }, [storedRange]);

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

  const handleRangeChange = useCallback(
    (range: DateRange | undefined) => {
      // The picker no longer emits half-finished selections, so a missing end
      // means the range was genuinely cleared: fall back to the tenant-resolved
      // default and forget the saved one.
      if (!range?.from || !range?.to) {
        setPicked(undefined);
        saveRange(null);
        return;
      }
      setPicked(range);
      saveRange({
        from: format(range.from, "yyyy-MM-dd"),
        to: format(range.to, "yyyy-MM-dd"),
      });
    },
    [saveRange],
  );

  // Content that replaces a skeleton fades in (`motion-appear`). Content that
  // was already there does not: not the server's HTML on a full page load (it
  // would fade in what the reader is looking at), and not a tab whose data was
  // cached (the tab panel's own arrival covers that). So the fade is for the
  // one render where this commit has content and the last one did not.
  const hadContent = useRef(current !== null);
  const replacedSkeleton = current !== null && !hadContent.current;
  useEffect(() => {
    hadContent.current = current !== null;
  });

  if (isLoading && !report) {
    return (
      <section className="p-4 sm:p-6">
        <ReportsSkeleton />
      </section>
    );
  }

  // A failed request is not an empty period. Before this, a 500 or an expired
  // session rendered as "No data available for this period" — a confident wrong
  // answer on a page about money.
  if (!current && errorMessage) {
    return (
      <section className="p-4 sm:p-6">
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
    <section className="p-4 sm:p-6">
      {/* `max-md:mb-4`: below `md` PageActions renders the picker here instead
          of in the navbar, and it needs the same gap the tab row keeps. From
          `md` this wrapper is empty, so it must not add space. */}
      <div className="max-md:mb-4">
        {/* The range governs every tab, so it stays with the page title.
            Export produces the *current* tab's CSV, so it sits with the tabs. */}
        <PageActions>
          <DateRangePicker
            dateRange={displayRange}
            onDateRangeChange={handleRangeChange}
            extraPresets={EXTRA_PRESETS}
          />
        </PageActions>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportSection)}
      >
        <div className="mb-4 flex items-center justify-between gap-2 sm:gap-4">
          {/* The list scrolls itself (ui/tabs). It used to sit in a second
              `overflow-x-auto` box as well, which showed its own scrollbar
              under the first tabs on a phone and cut the list off square at
              the export button. Full width so its bottom rule runs to the
              button; below `sm` the last visible tab fades out to say the row
              continues. */}
          <div ref={tabsScrollerRef} className="min-w-0 flex-1">
            <TabsList className="flex w-full max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%_-_1.25rem),transparent)]">
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

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {!current ? (
              <ReportsTabSkeleton />
            ) : (
              // The tab stays mounted across a date-range change, so what moves
              // is its content: figures count, charts redraw, table rows re-lay.
              // (It used to be re-keyed on the range, which remounted the lot
              // and faded it in.)
              <div className={replacedSkeleton ? "motion-appear" : undefined}>
                <ReportSectionView
                  report={current}
                  viewKey={`${current.section}:${current.range.from}:${current.range.to}`}
                />
              </div>
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
function ReportSectionView({
  report,
  viewKey,
}: {
  report: ReportSectionResponse;
  /** Which section and range these rows belong to, for the tables to re-lay on. */
  viewKey: string;
}) {
  switch (report.section) {
    case "revenue":
      return (
        <RevenueTab
          data={report.data}
          granularity={report.granularity}
          viewKey={viewKey}
        />
      );
    case "jobs":
      return <JobsTab data={report.data} granularity={report.granularity} />;
    case "customers":
      return (
        <CustomersTab
          data={report.data}
          granularity={report.granularity}
          viewKey={viewKey}
        />
      );
    case "quotes-invoices":
      return (
        <QuotesInvoicesTab data={report.data} granularity={report.granularity} />
      );
    case "bookings":
      return <BookingsTab data={report.data} granularity={report.granularity} />;
    // No granularity: this section has no trend to bucket. It answers "over the
    // whole window", not "week by week".
    case "profitability":
      return <ProfitabilityTab data={report.data} viewKey={viewKey} />;
    default: {
      const exhaustive: never = report;
      throw new Error(`Unhandled report section: ${String(exhaustive)}`);
    }
  }
}
