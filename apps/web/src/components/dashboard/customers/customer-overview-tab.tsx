"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  IconBriefcase,
  IconReceipt,
  IconDevices2,
  IconFileCheck,
  IconCalendarEvent,
  IconCurrencyDollar,
  IconActivity,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getJobs } from "@/actions/jobs";
import { getInvoices } from "@/actions/invoices";
import { getEquipment } from "@/actions/equipment";
import { getMaintenanceContracts } from "@/actions/maintenance-contracts";
import { getCustomerActivities } from "@/actions/customers";

interface CustomerOverviewTabProps {
  customerId: string;
  refreshKey?: number;
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

interface Stats {
  totalJobs: number;
  openInvoices: number;
  outstandingAmount: number;
  activeAgreements: number;
  totalAssets: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(val: string | number) {
  const num = typeof val === "string" ? parseFloat(val) : val;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
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

export function CustomerOverviewTab({ customerId, refreshKey }: CustomerOverviewTabProps) {
  const [upcomingJobs, setUpcomingJobs] = useState<UpcomingJob[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalJobs: 0,
    openInvoices: 0,
    outstandingAmount: 0,
    activeAgreements: 0,
    totalAssets: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().split("T")[0];

    const [jobsRes, invoicesRes, equipmentRes, agreementsRes, activityRes] =
      await Promise.all([
        getJobs({ customerId, sortBy: "scheduledDate", sortOrder: "asc", limit: 5 }),
        getInvoices({ customerId, limit: 20 }),
        getEquipment({ customerId, limit: 100 }),
        getMaintenanceContracts({ customerId, limit: 100 }),
        getCustomerActivities(customerId, { limit: 8 }),
      ]);

    // Upcoming jobs (scheduled or in_progress, future dates)
    if (jobsRes.data) {
      const upcoming = (jobsRes.data as UpcomingJob[]).filter(
        (j) => (j.status === "scheduled" || j.status === "in_progress") && j.scheduledDate >= today,
      );
      setUpcomingJobs(upcoming.slice(0, 5));
      setStats((s) => ({ ...s, totalJobs: jobsRes.pagination?.total ?? 0 }));
    }

    // Outstanding invoices
    if (invoicesRes.data) {
      const allInvoices = invoicesRes.data as OutstandingInvoice[];
      const outstanding = allInvoices.filter((i) =>
        ["sent", "overdue", "partially_paid"].includes(i.status),
      );
      setOutstandingInvoices(outstanding.slice(0, 5));

      const outstandingTotal = outstanding.reduce(
        (sum, i) => sum + parseFloat(i.balanceDue || i.totalAmount || "0"),
        0,
      );
      setStats((s) => ({
        ...s,
        openInvoices: outstanding.length,
        outstandingAmount: outstandingTotal,
      }));
    }

    if (equipmentRes.data) {
      setStats((s) => ({ ...s, totalAssets: (equipmentRes.data as unknown[]).length }));
    }

    if (agreementsRes.data) {
      const active = (agreementsRes.data as { isActive: boolean | null }[]).filter(
        (a) => a.isActive,
      );
      setStats((s) => ({ ...s, activeAgreements: active.length }));
    }

    if (activityRes.data) {
      setActivities(activityRes.data as Activity[]);
    }

    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<IconBriefcase className="h-4 w-4" />}
          label="Total Jobs"
          value={String(stats.totalJobs)}
        />
        <StatCard
          icon={<IconReceipt className="h-4 w-4" />}
          label="Open Invoices"
          value={String(stats.openInvoices)}
          accent={stats.openInvoices > 0}
        />
        <StatCard
          icon={<IconCurrencyDollar className="h-4 w-4" />}
          label="Outstanding"
          value={formatCurrency(stats.outstandingAmount)}
          accent={stats.outstandingAmount > 0}
        />
        <StatCard
          icon={<IconFileCheck className="h-4 w-4" />}
          label="Agreements"
          value={String(stats.activeAgreements)}
        />
      </div>

      {/* Two-column: Upcoming + Outstanding */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <IconCalendarEvent className="h-4 w-4 text-brand" />
              Upcoming Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {upcomingJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming jobs scheduled
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs?jobId=${job.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {job.title}
                      </p>
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

        {/* Outstanding Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <IconCurrencyDollar className="h-4 w-4 text-brand" />
              Outstanding Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {outstandingInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No outstanding invoices
              </p>
            ) : (
              <div className="space-y-2">
                {outstandingInvoices.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {inv.invoiceNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inv.issueDate)}
                      </p>
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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <IconActivity className="h-4 w-4 text-brand" />
              Recent Activity
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet
            </p>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between gap-3 rounded-md px-3 py-2"
                >
                  <p className="text-sm text-foreground font-body flex-1">
                    {activity.description}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
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
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-body">{label}</span>
      </div>
      <p
        className={`text-lg font-heading font-bold ${accent ? "text-brand" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
