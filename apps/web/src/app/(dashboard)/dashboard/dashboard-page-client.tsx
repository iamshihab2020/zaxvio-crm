"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PageActions } from "@/components/dashboard/page-actions";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  IconBriefcase,
  IconCashBanknote,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import type {
  DashboardRevenueGranularity,
  DashboardStats,
} from "@hvac-saas/types";
import { useDashboardStats } from "@/hooks/queries";
import type { DashboardStatsParams } from "@/actions/dashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { formatCurrency } from "@/lib/format";
import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { OverdueAlertBanner } from "@/components/dashboard/home/overdue-alert-banner";
import { RecentActivityFeed } from "@/components/dashboard/home/recent-activity-feed";
import { KpiPill } from "@/components/dashboard/home/kpi-pill";
import { DashboardToolbar } from "@/components/dashboard/home/dashboard-toolbar";
import { RevenueRangeChart, type RevenueRange } from "@/components/dashboard/home/revenue-range-chart";
import { JobsManagementPanel } from "@/components/dashboard/home/jobs-management-panel";
import { RetentionChart } from "@/components/dashboard/home/retention-chart";
import { AgendaTimeline } from "@/components/dashboard/home/agenda-timeline";
import { WeekAhead } from "@/components/dashboard/home/week-ahead";
import { InvoiceAging } from "@/components/dashboard/home/invoice-aging";
import { QuoteConversion } from "@/components/dashboard/home/quote-conversion";
import { RevenueByServiceChart } from "@/components/dashboard/home/revenue-by-service-chart";
import { TopCustomersCard } from "@/components/dashboard/home/top-customers-card";
import {
  ALL_WIDGETS,
  useDashboardWidgetPrefs,
  type WidgetKey,
} from "@/hooks/use-dashboard-widget-prefs";
import {
  DATE_RANGE_KEYS,
  useStoredDateRange,
} from "@/hooks/use-stored-date-range";
import { useStagger } from "@/hooks/use-stagger";
import { STAGGER_STEP, replayMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The same isomorphic pattern `use-route-arrival.ts` uses. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** How a KPI figure reads while it counts. Module-level so the tiles share them. */
const formatCount = (n: number) => String(n);
const formatPercent = (n: number) => `${n}%`;

function rangeFromPreset(preset: RevenueRange): {
  range: DateRange;
  granularity: DashboardRevenueGranularity;
} {
  const today = new Date();
  switch (preset) {
    case "1D":
      return { range: { from: today, to: today }, granularity: "day" };
    case "1W":
      return { range: { from: subDays(today, 6), to: today }, granularity: "day" };
    case "1M":
      return { range: { from: subDays(today, 29), to: today }, granularity: "day" };
    case "6M":
      return { range: { from: subMonths(today, 6), to: today }, granularity: "week" };
    case "1Y":
      return { range: { from: subYears(today, 1), to: today }, granularity: "month" };
    case "ALL":
      return { range: { from: subYears(today, 3), to: today }, granularity: "month" };
  }
}

function inferPreset(range: DateRange | undefined): RevenueRange | null {
  if (!range?.from || !range?.to) return null;
  const span = differenceInCalendarDays(range.to, range.from);
  if (span === 0) return "1D";
  if (span === 6) return "1W";
  if (span === 29) return "1M";
  return null;
}

/** Pick a bucket size that yields a readable number of points for the span. */
function granularityForSpan(spanDays: number): DashboardRevenueGranularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 120) return "week";
  return "month";
}

/** The widgets that flow in the full-width grid under the top band, in order. */
const GRID_WIDGETS: readonly WidgetKey[] = [
  "weekAhead",
  "invoiceAging",
  "jobsManagement",
  "quoteFunnel",
  "retention",
  "revenueByService",
  "topCustomers",
  "activity",
];

/**
 * Stretch the grid's last widget across whatever its row has left, so the grid
 * never ends on a hole whichever widgets are hidden: two columns from `md`,
 * three from `xl`. The `xl` value always restates the span, because an odd
 * count's `md` span would otherwise carry into a three-column row that is
 * already full. Literal strings, so Tailwind's scanner sees every class.
 */
function fillLastRow(count: number): string {
  const md = count % 2 === 1 ? "md:[&>*:last-child]:col-span-2" : "";
  const rest = count % 3;
  const xl =
    rest === 1
      ? "xl:[&>*:last-child]:col-span-3"
      : rest === 2
        ? "xl:[&>*:last-child]:col-span-2"
        : "xl:[&>*:last-child]:col-span-1";
  return cn(md, xl);
}

interface DashboardPageClientProps {
  initialStats?: DashboardStats | null;
  initialError?: string | null;
  initialParams?: DashboardStatsParams;
  initialFetchedAt?: number;
}

export function DashboardPageClient({
  initialStats = null,
  initialError = null,
  initialParams,
  initialFetchedAt,
}: DashboardPageClientProps) {
  // No explicit range until the user picks one: the backend defaults to
  // month-to-date *in the tenant's timezone*, which the browser clock cannot
  // reliably reproduce. `stats.range` reports back what was actually used.
  const [dateParams, setDateParams] = useState<DashboardStatsParams>(
    initialParams ?? {},
  );
  const [revenueRange, setRevenueRange] = useState<RevenueRange | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);

  const prefs = useDashboardWidgetPrefs();
  const { stored: storedRange, save: saveRange } = useStoredDateRange(
    DATE_RANGE_KEYS.dashboard,
  );

  // Restore the saved range once localStorage is readable. The stored dates are
  // replayed exactly — a shortcut like "Last 7 days" or the 1W tab is a way of
  // entering a range, not a standing instruction to re-derive one against
  // today, so nothing here recomputes.
  useEffect(() => {
    const stored = storedRange;
    if (!stored) return;
    setRevenueRange(stored.preset ?? null);
    setDateParams({
      from: stored.from,
      to: stored.to,
      granularity:
        stored.granularity ??
        granularityForSpan(
          differenceInCalendarDays(parseISO(stored.to), parseISO(stored.from)),
        ),
    });
  }, [storedRange]);

  const { data: result, isLoading, isFetching, dataUpdatedAt, refetch } =
    useDashboardStats(dateParams, {
      initialData: initialStats
        ? { data: initialStats, error: initialError }
        : undefined,
      initialParams,
      initialFetchedAt,
    });

  const stats = result?.data ?? null;

  // Show the user's own selection whenever there is one. Only when nothing has
  // been chosen does the control fall back to the backend-resolved range, which
  // is the tenant-timezone month-to-date default the browser cannot reproduce.
  //
  // Reading `stats.range` unconditionally used to make the control flicker back
  // to that default: a refetch empties `stats`, and the SSR payload always
  // carries the default range regardless of what was restored from storage. On
  // the 2nd of a month, month-to-date renders as "Aug 1 – Aug 2", so a saved
  // range appeared to reset itself on every visit.
  const dateRange = useMemo<DateRange | undefined>(() => {
    if (dateParams.from && dateParams.to) {
      return { from: parseISO(dateParams.from), to: parseISO(dateParams.to) };
    }
    if (!stats?.range) return undefined;
    return { from: parseISO(stats.range.from), to: parseISO(stats.range.to) };
  }, [dateParams.from, dateParams.to, stats?.range]);

  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      // The picker no longer emits half-finished selections, so a missing end
      // means the range was genuinely cleared: fall back to the tenant-resolved
      // default and forget the saved one.
      if (!range?.from || !range?.to) {
        setDateParams({});
        setRevenueRange(null);
        saveRange(null);
        return;
      }
      const span = differenceInCalendarDays(range.to, range.from);
      const from = format(range.from, "yyyy-MM-dd");
      const to = format(range.to, "yyyy-MM-dd");
      const granularity = granularityForSpan(span);
      // Highlight a preset tab when the span happens to match one. This is
      // cosmetic: the dates below are what gets stored and replayed either way.
      // Storing the inferred preset *instead of* the dates is what used to make
      // a hand-picked range move — a 7-day selection was saved as "1W" and came
      // back as the seven days ending today, so any deliberate choice of an
      // earlier week silently jumped forward.
      const preset = inferPreset(range);
      setRevenueRange(preset);
      setDateParams({ from, to, granularity });
      saveRange({ from, to, granularity, preset });
    },
    [saveRange],
  );

  const handleRevenueRangeChange = useCallback(
    (preset: RevenueRange) => {
      const { range, granularity } = rangeFromPreset(preset);
      const from = format(range.from!, "yyyy-MM-dd");
      const to = format(range.to!, "yyyy-MM-dd");
      setRevenueRange(preset);
      setDateParams({ from, to, granularity });
      // Resolve the shortcut to real dates *now* and store those. The tab is an
      // input, not a subscription: clicking 1W on the 2nd means that week, not
      // "whatever the last week happens to be whenever I next open this page".
      saveRange({ from, to, granularity, preset });
    },
    [saveRange],
  );

  // The widget stack is the page's arrival, and it is not a `data-stagger`
  // block on purpose. The grid is held back until localStorage has been read
  // (`prefs.hydrated`), so when a route change fires `useRouteArrival` the DOM
  // holds the skeleton, and a marked block would stagger that and then swap it
  // for the real thing unanimated. The skeleton-to-widgets swap is the moment
  // the content arrives, so that is what is sequenced: banner, KPI row and the
  // zones rise in turn, at the route arrival's own 40ms step. The key is null
  // until both the stats and the prefs exist, and a date-range change keeps it
  // "ready", so only the first appearance plays, never a refetch.
  const stackRef = useRef<HTMLDivElement>(null);
  const ready = stats !== null && prefs.hydrated;
  useStagger(stackRef, ready ? "ready" : null, { step: STAGGER_STEP, rise: 8 });

  // A widget switched on from Customize fades in where it lands. It mounts
  // inside the stack with the rest of the page, so the diff is against what was
  // visible on the previous commit. `data-widget` is how the widget's element is
  // found: it is a card the page does not hold a ref to, and wrapping each one
  // would break the grid (`:last-child:nth-child(odd)` spans the odd one out,
  // and a row-mate stretches to its neighbour's height).
  const shownRef = useRef<typeof prefs.visible | null>(null);
  useIsoLayoutEffect(() => {
    // `ready` is a dependency so this runs on the commit that mounts the stack
    // even when the saved prefs equal the defaults and `visible` never changed.
    const stack = ready ? stackRef.current : null;
    const before = shownRef.current;
    shownRef.current = stack ? prefs.visible : null;
    // The first commit with a stack is the page arriving, not a toggle.
    if (!stack || !before) return;
    for (const { key } of ALL_WIDGETS) {
      if (!prefs.visible[key] || before[key]) continue;
      const el = stack.querySelector<HTMLElement>(`[data-widget="${key}"]`);
      if (el) replayMotion(el, "motion-appear");
    }
  }, [prefs.visible, ready]);

  if (isLoading && !stats) {
    return (
      <section className="p-4 sm:p-6">
        <DashboardSkeleton />
      </section>
    );
  }

  if (!stats) {
    return (
      <section className="p-4 sm:p-6">
        <LoadErrorState
          title="Couldn't load your dashboard"
          message={result?.error ?? initialError}
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      </section>
    );
  }

  const { kpis } = stats;
  const { visible } = prefs;

  // The top band is Revenue beside Up next. Everything else flows in one
  // full-width grid below it, counted so its last row can be filled.
  const showAgenda = visible.agenda;
  const showRevenue = visible.revenue;
  const gridCount = GRID_WIDGETS.filter((key) => visible[key]).length;

  return (
    <section className="p-4 sm:p-6">
      <div className="space-y-6">
        {/* Only the range picker goes to the navbar: it governs the whole page,
            so it belongs beside the page title. Per-object actions live next to
            the objects they create. Below `md` the navbar has no room for it, and
            PageActions renders it here, at the top of the page, instead. */}
        <PageActions>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        </PageActions>

        <DashboardToolbar
          today={stats.agenda.from}
          updatedAt={dataUpdatedAt}
          isFetching={isFetching}
          prefs={prefs}
        />

        {/* Widget visibility lives in localStorage, so hold the grid until it is
            read — otherwise all eleven widgets paint and hidden ones then vanish. */}
        {!prefs.hydrated ? (
          <DashboardSkeleton hideToolbar />
        ) : (
          <div ref={stackRef} className="space-y-6">
            {visible.overdueAlert && (
              <WidgetErrorBoundary name="Overdue alert">
                <OverdueAlertBanner overdueInvoices={stats.overdueInvoices} />
              </WidgetErrorBoundary>
            )}

            {/* Four tiles: two across on a phone, four from `lg`. */}
            {visible.kpis && (
              <div
                data-widget="kpis"
                className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
              >
                <KpiPill
                  icon={IconBriefcase}
                  label="Jobs Today"
                  value={String(kpis.jobsToday.count)}
                  numericValue={kpis.jobsToday.count}
                  format={formatCount}
                  currentValue={kpis.jobsToday.count}
                  previousValue={kpis.jobsToday.yesterdayCount}
                  comparisonLabel="vs yesterday"
                  href="/jobs"
                  footnote={
                    kpis.jobsToday.emergencyCount > 0
                      ? `${kpis.jobsToday.emergencyCount} emergency`
                      : undefined
                  }
                  footnoteTone="danger"
                />
                <KpiPill
                  icon={IconCashBanknote}
                  label="Outstanding"
                  value={formatCurrency(kpis.outstandingBalance.amount)}
                  numericValue={kpis.outstandingBalance.amount}
                  format={formatCurrency}
                  windowLabel="All open"
                  href="/invoices"
                  footnote={`${kpis.outstandingBalance.invoiceCount} unpaid ${
                    kpis.outstandingBalance.invoiceCount === 1 ? "invoice" : "invoices"
                  }`}
                />
                <KpiPill
                  icon={IconTrendingUp}
                  label="Quote Conversion"
                  value={`${stats.quoteSummary.conversionRate}%`}
                  numericValue={stats.quoteSummary.conversionRate}
                  format={formatPercent}
                  href="/quotes"
                  footnote={`${stats.quoteSummary.accepted} of ${stats.quoteSummary.totalQuotes} accepted`}
                />
                {/* `activeCustomers` was computed on every dashboard load and
                    displayed nowhere. It is the one KPI here that measures the
                    book of business rather than this week's work. */}
                <KpiPill
                  icon={IconUsers}
                  label="Active Customers"
                  value={String(kpis.activeCustomers.count)}
                  numericValue={kpis.activeCustomers.count}
                  format={formatCount}
                  windowLabel="Last 90 days"
                  href="/customers"
                  footnote="with a job booked"
                />
              </div>
            )}

            {/*
              A top band, then one flowing grid. Not two zones.

              The page used to be two columns from `xl`: a side zone (Up next,
              Week ahead) and a main zone (Revenue, then a two-up grid of every
              other widget). The side zone held two cards and the main zone
              eight, so from about a screen down the right third was empty for
              the rest of the page. The user caught it on the first look.

              Now the only pair is Revenue beside Up next, and Up next takes
              Revenue's height and scrolls inside it (`fitRowAtXl`), so a busy
              week can't open a gap under Revenue either. Everything else flows
              in a single grid, two across from `md` and three from `xl`, and
              `fillLastRow` stretches the last widget over whatever its row has
              left, so hiding widgets in Customize never leaves a hole. Row-mates
              stretch to the taller card (`h-full`), so rows end flush.

              Up next is first in the DOM, so on a phone the day still comes
              before the money; from `xl` it moves to the right third of the band.
            */}
            {(showAgenda || showRevenue) && (
              <div className="grid gap-6 xl:grid-cols-3">
                {showAgenda && (
                  <div
                    className={cn(
                      "flex min-w-0 flex-col xl:row-start-1",
                      showRevenue ? "xl:col-start-3" : "xl:col-span-3",
                    )}
                  >
                    <WidgetErrorBoundary name="Up next">
                      <AgendaTimeline agenda={stats.agenda} fitRowAtXl={showRevenue} />
                    </WidgetErrorBoundary>
                  </div>
                )}

                {showRevenue && (
                  <div
                    className={cn(
                      "min-w-0 xl:col-start-1 xl:row-start-1",
                      showAgenda ? "xl:col-span-2" : "xl:col-span-3",
                    )}
                  >
                    <WidgetErrorBoundary name="Revenue">
                      <RevenueRangeChart
                        data={stats.revenueTrend}
                        granularity={stats.revenueGranularity}
                        currentValue={kpis.rangeRevenue.amount}
                        previousValue={kpis.rangeRevenue.previousAmount}
                        billedValue={kpis.rangeRevenue.billedAmount}
                        range={revenueRange}
                        onRangeChange={handleRevenueRangeChange}
                      />
                    </WidgetErrorBoundary>
                  </div>
                )}
              </div>
            )}

            {gridCount > 0 && (
              <div
                className={cn(
                  "grid gap-6 md:grid-cols-2 xl:grid-cols-3",
                  fillLastRow(gridCount),
                )}
              >
                {visible.weekAhead && (
                  <WidgetErrorBoundary name="Week ahead">
                    <WeekAhead agenda={stats.agenda} />
                  </WidgetErrorBoundary>
                )}
                {visible.invoiceAging && (
                  <WidgetErrorBoundary name="Invoice aging">
                    <InvoiceAging data={stats.invoiceAging} />
                  </WidgetErrorBoundary>
                )}
                {visible.jobsManagement && (
                  <WidgetErrorBoundary name="Jobs management">
                    <JobsManagementPanel
                      defaultPipeline={stats.jobPipeline}
                      priorityBreakdown={stats.priorityBreakdown}
                      serviceBreakdown={stats.serviceBreakdown}
                      pipelineId={pipelineId}
                      onPipelineChange={setPipelineId}
                    />
                  </WidgetErrorBoundary>
                )}
                {visible.quoteFunnel && (
                  <WidgetErrorBoundary name="Quote funnel">
                    <QuoteConversion data={stats.quoteSummary} />
                  </WidgetErrorBoundary>
                )}
                {visible.retention && (
                  <WidgetErrorBoundary name="Retention">
                    <RetentionChart data={stats.retentionTrend} />
                  </WidgetErrorBoundary>
                )}
                {visible.revenueByService && (
                  <WidgetErrorBoundary name="Revenue by service">
                    <RevenueByServiceChart data={stats.serviceRevenue} />
                  </WidgetErrorBoundary>
                )}
                {visible.topCustomers && (
                  <WidgetErrorBoundary name="Top customers">
                    <TopCustomersCard data={stats.topCustomers} />
                  </WidgetErrorBoundary>
                )}
                {visible.activity && (
                  <WidgetErrorBoundary name="Activity feed">
                    <RecentActivityFeed activities={stats.recentActivity} />
                  </WidgetErrorBoundary>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
