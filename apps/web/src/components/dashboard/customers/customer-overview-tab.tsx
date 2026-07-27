"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconBriefcase,
  IconReceipt,
  IconFileCheck,
  IconCalendarEvent,
  IconCurrencyDollar,
  IconActivity,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { WidgetErrorBoundary } from "@/components/reusable/widget-error-boundary";
import { queryKeys } from "@/lib/query-keys";
import { jobLink, invoiceLink } from "@/lib/entity-links";
import { tenantToday } from "@/lib/tenant-time";
import { getJobs } from "@/actions/jobs";
import { getInvoices } from "@/actions/invoices";
import { useCustomerSummary, useCustomerActivities } from "@/hooks/queries";
import { useTenantSettings } from "@/hooks/queries/use-tenant";

interface CustomerOverviewTabProps {
  customerId: string;
}

interface UpcomingJob {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  scheduledDate: string;
  scheduledStart: string | null;
  serviceType: string;
}

interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: string;
  balanceDue: string;
  issueDate: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  performerName: string | null;
  createdAt: string;
}

function formatDate(dateStr: string) {
  // Date-only columns are rendered at midday so a timezone shift cannot roll
  // them onto the previous day.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Money, with the cents kept.
 *
 * `maximumFractionDigits: 0` displayed a $1,234.56 balance as "$1,235" — fine for
 * a KPI tile, wrong for the amount somebody owes you (CUST-30). The locale is the
 * viewer's rather than a hardcoded `en-US`.
 */
function formatCurrency(val: string | number) {
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(num) ? num : 0);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const jobStatusColors: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

const invoiceStatusColors: Record<string, string> = {
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  overdue: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  partially_paid: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

export function CustomerOverviewTab({ customerId }: CustomerOverviewTabProps) {
  const tenantQuery = useTenantSettings();
  // Falls back to the viewer's zone only while the tenant setting is in flight —
  // never to UTC, which is what produced the off-by-a-day (CUST-06).
  const tenantTimezone = (tenantQuery.data?.data as { timezone?: string } | undefined)?.timezone;
  const timeZone = tenantTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Counts and balances come from SQL now. They used to be reduced in the browser
  // from a page of 20 invoices and a page of 100 assets, so "Outstanding" was the
  // sum of whichever invoices happened to fall on page one (CUST-05).
  const summaryQuery = useCustomerSummary(customerId);
  const activitiesQuery = useCustomerActivities(customerId, { limit: 8 });

  const jobsQuery = useQuery({
    queryKey: queryKeys.customers.related(customerId, "upcoming-jobs"),
    queryFn: () =>
      getJobs({ customerId, sortBy: "scheduledDate", sortOrder: "asc", limit: 10 }),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const invoicesQuery = useQuery({
    queryKey: queryKeys.customers.related(customerId, "outstanding-invoices"),
    queryFn: () => getInvoices({ customerId, status: "unpaid", limit: 5 }),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const summary = summaryQuery.data?.data;
  const activities: Activity[] = (activitiesQuery.data?.data as Activity[]) ?? [];

  // "Today" in the *tenant's* timezone. `new Date().toISOString()` is UTC, so
  // after 19:00 in America/Chicago the date had already rolled over and today's
  // jobs dropped out of "Upcoming" for the last five hours of the working day
  // (CUST-06 — the same bug the dashboard audit plumbed tenant time to kill).
  const today = tenantToday(timeZone);

  const upcomingJobs = ((jobsQuery.data?.data as UpcomingJob[] | undefined) ?? [])
    .filter(
      (j) =>
        (j.status === "scheduled" || j.status === "in_progress") && j.scheduledDate >= today,
    )
    .slice(0, 5);

  const outstandingInvoices =
    (invoicesQuery.data?.data as OutstandingInvoice[] | undefined) ?? [];

  // Every one of these could fail and render as an empty state — "No outstanding
  // invoices" after a 500 reads as a fact about the customer's account (CUST-02).
  const summaryFailed = summaryQuery.isError || !!summaryQuery.data?.error;
  const jobsFailed = jobsQuery.isError || !!jobsQuery.data?.error;
  const invoicesFailed = invoicesQuery.isError || !!invoicesQuery.data?.error;
  const activitiesFailed = activitiesQuery.isError || !!activitiesQuery.data?.error;

  if (summaryQuery.isLoading && jobsQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <WidgetErrorBoundary name="Customer totals">
        {summaryFailed ? (
          <LoadErrorState
            title="Could not load totals"
            message={summaryQuery.data?.error}
            onRetry={() => summaryQuery.refetch()}
            isRetrying={summaryQuery.isFetching}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<IconBriefcase className="h-4 w-4" />}
              label="Total Jobs"
              value={String(summary?.totalJobs ?? 0)}
            />
            <StatCard
              icon={<IconReceipt className="h-4 w-4" />}
              label="Open Invoices"
              value={String(summary?.openInvoices ?? 0)}
              accent={(summary?.openInvoices ?? 0) > 0}
            />
            <StatCard
              icon={<IconCurrencyDollar className="h-4 w-4" />}
              label="Outstanding"
              value={formatCurrency(summary?.outstandingAmount ?? 0)}
              accent={Number(summary?.outstandingAmount ?? 0) > 0}
            />
            <StatCard
              icon={<IconFileCheck className="h-4 w-4" />}
              label="Agreements"
              value={String(summary?.activeAgreements ?? 0)}
            />
          </div>
        )}
      </WidgetErrorBoundary>

      {/* Two-column: Upcoming + Outstanding */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-sm">
              <IconCalendarEvent className="h-4 w-4 text-brand" />
              Upcoming Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {jobsFailed ? (
              <p className="py-4 text-center text-sm text-destructive" role="alert">
                Couldn&rsquo;t load jobs.{" "}
                <button
                  type="button"
                  onClick={() => jobsQuery.refetch()}
                  className="underline underline-offset-2"
                >
                  Retry
                </button>
              </p>
            ) : upcomingJobs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No upcoming jobs scheduled
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={jobLink(job.id)}
                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(job.scheduledDate)}
                        {job.scheduledStart ? ` at ${job.scheduledStart.slice(0, 5)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className={jobStatusColors[job.status] ?? ""}>
                      {job.status.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-heading text-sm">
              <IconCurrencyDollar className="h-4 w-4 text-brand" />
              Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {invoicesFailed ? (
              <p className="py-4 text-center text-sm text-destructive" role="alert">
                Couldn&rsquo;t load invoices.{" "}
                <button
                  type="button"
                  onClick={() => invoicesQuery.refetch()}
                  className="underline underline-offset-2"
                >
                  Retry
                </button>
              </p>
            ) : outstandingInvoices.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No outstanding invoices
              </p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={invoiceLink(inv.id)}
                    className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.issueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(inv.balanceDue || inv.totalAmount)}
                      </span>
                      <Badge variant="outline" className={invoiceStatusColors[inv.status] ?? ""}>
                        {inv.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-heading text-sm">
            <IconActivity className="h-4 w-4 text-brand" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activitiesFailed ? (
            <p className="py-4 text-center text-sm text-destructive" role="alert">
              Couldn&rsquo;t load activity.{" "}
              <button
                type="button"
                onClick={() => activitiesQuery.refetch()}
                className="underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          ) : activities.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between gap-3 rounded-md px-3 py-2"
                >
                  <p className="flex-1 font-body text-sm text-foreground">
                    {activity.description}
                  </p>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {timeAgo(activity.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-body text-xs">{label}</span>
      </div>
      <p
        className={`font-heading text-lg font-bold ${accent ? "text-brand" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
