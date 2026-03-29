"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IconUsers,
  IconBriefcase,
  IconFileText,
  IconFileInvoice,
  IconCalendarEvent,
  IconTool,
  IconPackage,
  IconCurrencyDollar,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAdminTenantAnalytics } from "@/actions/admin";

interface AnalyticsData {
  usage: {
    customers: number;
    jobs: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> };
    quotes: { total: number; byStatus: Record<string, number> };
    invoices: { total: number; byStatus: Record<string, number> };
    bookings: { total: number; byStatus: Record<string, number> };
    equipment: number;
    catalogItems: number;
  };
  financial: {
    lifetimeRevenue: number;
    outstandingBalance: number;
    revenueByMonth: { month: string; total: number }[];
    paymentMethods: { method: string; count: number; total: number }[];
    avgJobValue: number;
  };
  operational: {
    jobCompletionRate: number;
    quoteAcceptanceRate: number;
    checklistCompletionRate: number;
  };
  activity: { id: string; eventType: string; createdAt: string; userId: string | null }[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const PIE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const EVENT_LABELS: Record<string, string> = {
  login: "User Login",
  job_created: "Job Created",
  invoice_sent: "Invoice Sent",
  booking_received: "Booking Received",
  customer_created: "Customer Created",
};

function KpiMini({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-heading text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground font-body">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RateCard({ label, rate, color }: { label: string; rate: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2">{label}</p>
        <p className={`font-heading text-3xl font-bold ${color}`}>{rate}%</p>
        <Progress value={rate} className="mt-3 h-2" />
      </CardContent>
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}

export function TenantAnalyticsTab({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminTenantAnalytics(tenantId).then((result) => {
      if (cancelled) return;
      if (result.data) setData(result.data);
      else setError(result.error ?? "Failed to load");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading) return <AnalyticsSkeleton />;
  if (error || !data) return <p className="text-sm text-destructive font-body">{error}</p>;

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-500 dark:bg-blue-400",
    in_progress: "bg-amber-500 dark:bg-amber-400",
    completed: "bg-green-500 dark:bg-green-400",
    cancelled: "bg-gray-400 dark:bg-gray-500",
    draft: "bg-gray-400 dark:bg-gray-500",
    sent: "bg-blue-500 dark:bg-blue-400",
    accepted: "bg-green-500 dark:bg-green-400",
    declined: "bg-red-500 dark:bg-red-400",
    expired: "bg-gray-400 dark:bg-gray-500",
    paid: "bg-green-500 dark:bg-green-400",
    partially_paid: "bg-amber-500 dark:bg-amber-400",
    overdue: "bg-red-500 dark:bg-red-400",
    void: "bg-gray-400 dark:bg-gray-500",
    pending: "bg-amber-500 dark:bg-amber-400",
    confirmed: "bg-blue-500 dark:bg-blue-400",
  };

  const badgeBg: Record<string, string> = {
    scheduled: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0",
    in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0",
    completed: "bg-green-500/15 text-green-700 dark:text-green-300 border-0",
    cancelled: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0",
    draft: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0",
    sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0",
    accepted: "bg-green-500/15 text-green-700 dark:text-green-300 border-0",
    declined: "bg-red-500/15 text-red-700 dark:text-red-300 border-0",
    expired: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0",
    paid: "bg-green-500/15 text-green-700 dark:text-green-300 border-0",
    partially_paid: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0",
    overdue: "bg-red-500/15 text-red-700 dark:text-red-300 border-0",
    void: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0",
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0",
    confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0",
  };

  const tooltipBg: Record<string, string> = {
    scheduled: "bg-blue-600 text-white",
    in_progress: "bg-amber-600 text-white",
    completed: "bg-green-600 text-white",
    cancelled: "bg-gray-600 text-white",
    draft: "bg-gray-600 text-white",
    sent: "bg-blue-600 text-white",
    accepted: "bg-green-600 text-white",
    declined: "bg-red-600 text-white",
    expired: "bg-gray-600 text-white",
    paid: "bg-green-600 text-white",
    partially_paid: "bg-amber-600 text-white",
    overdue: "bg-red-600 text-white",
    void: "bg-gray-600 text-white",
    pending: "bg-amber-600 text-white",
    confirmed: "bg-blue-600 text-white",
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Section 1: Usage KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <KpiMini icon={IconUsers} label="Customers" value={data.usage.customers} color="bg-blue-500" />
          <KpiMini icon={IconBriefcase} label="Jobs" value={data.usage.jobs.total} color="bg-emerald-500" />
          <KpiMini icon={IconFileText} label="Quotes" value={data.usage.quotes.total} color="bg-purple-500" />
          <KpiMini icon={IconFileInvoice} label="Invoices" value={data.usage.invoices.total} color="bg-amber-500" />
          <KpiMini icon={IconCalendarEvent} label="Bookings" value={data.usage.bookings.total} color="bg-cyan-500" />
          <KpiMini icon={IconTool} label="Equipment" value={data.usage.equipment} color="bg-rose-500" />
          <KpiMini icon={IconPackage} label="Catalog" value={data.usage.catalogItems} color="bg-indigo-500" />
        </div>

        {/* Section 2: Financial + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Chart */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-sm font-semibold">Revenue (12 Months)</CardTitle>
                <Badge variant="secondary" className="font-body text-xs">
                  {formatCurrency(data.financial.lifetimeRevenue)} lifetime
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              {data.financial.revenueByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                  <BarChart data={data.financial.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.5rem", fontSize: "12px" }}
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--chart-5))" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center">
                  <p className="text-sm text-muted-foreground font-body">No payment data yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job & Quote Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-sm font-semibold">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job statuses */}
              <div>
                <p className="text-xs text-muted-foreground font-body mb-2 uppercase tracking-wider">Jobs ({data.usage.jobs.total})</p>
                <div className="flex gap-1 h-7 rounded-full overflow-hidden bg-muted cursor-pointer">
                  {Object.entries(data.usage.jobs.byStatus).map(([status, cnt]) => {
                    const pct = data.usage.jobs.total > 0 ? Math.round((cnt / data.usage.jobs.total) * 100) : 0;
                    return (
                      <Tooltip key={status} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div className={`${statusColors[status] ?? "bg-gray-400"} transition-all hover:opacity-80`} style={{ width: `${pct}%`, minWidth: cnt > 0 ? "24px" : 0 }} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className={`font-body border-0 ${tooltipBg[status] ?? "bg-gray-600 text-white"}`}>
                          <p className="capitalize font-medium">{status.replace("_", " ")}</p>
                          <p className="text-xs opacity-80">{cnt} jobs ({pct}%)</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(data.usage.jobs.byStatus).map(([status, cnt]) => (
                    <Badge key={status} className={`text-xs font-body capitalize ${badgeBg[status] ?? "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0"}`}>
                      {status.replace("_", " ")}: {cnt}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Quote statuses */}
              <div>
                <p className="text-xs text-muted-foreground font-body mb-2 uppercase tracking-wider">Quotes ({data.usage.quotes.total})</p>
                <div className="flex gap-1 h-7 rounded-full overflow-hidden bg-muted cursor-pointer">
                  {Object.entries(data.usage.quotes.byStatus).map(([status, cnt]) => {
                    const pct = data.usage.quotes.total > 0 ? Math.round((cnt / data.usage.quotes.total) * 100) : 0;
                    return (
                      <Tooltip key={status} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div className={`${statusColors[status] ?? "bg-gray-400"} transition-all hover:opacity-80`} style={{ width: `${pct}%`, minWidth: cnt > 0 ? "24px" : 0 }} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className={`font-body border-0 ${tooltipBg[status] ?? "bg-gray-600 text-white"}`}>
                          <p className="capitalize font-medium">{status}</p>
                          <p className="text-xs opacity-80">{cnt} quotes ({pct}%)</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(data.usage.quotes.byStatus).map(([status, cnt]) => (
                    <Badge key={status} className={`text-xs font-body capitalize ${badgeBg[status] ?? "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0"}`}>
                      {status}: {cnt}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Invoice statuses */}
              <div>
                <p className="text-xs text-muted-foreground font-body mb-2 uppercase tracking-wider">Invoices ({data.usage.invoices.total})</p>
                <div className="flex gap-1 h-7 rounded-full overflow-hidden bg-muted cursor-pointer">
                  {Object.entries(data.usage.invoices.byStatus).map(([status, cnt]) => {
                    const pct = data.usage.invoices.total > 0 ? Math.round((cnt / data.usage.invoices.total) * 100) : 0;
                    return (
                      <Tooltip key={status} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div className={`${statusColors[status] ?? "bg-gray-400"} transition-all hover:opacity-80`} style={{ width: `${pct}%`, minWidth: cnt > 0 ? "24px" : 0 }} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className={`font-body border-0 ${tooltipBg[status] ?? "bg-gray-600 text-white"}`}>
                          <p className="capitalize font-medium">{status.replace("_", " ")}</p>
                          <p className="text-xs opacity-80">{cnt} invoices ({pct}%)</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(data.usage.invoices.byStatus).map(([status, cnt]) => (
                    <Badge key={status} className={`text-xs font-body capitalize ${badgeBg[status] ?? "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0"}`}>
                      {status.replace("_", " ")}: {cnt}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Operational Health */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <RateCard label="Job Completion" rate={data.operational.jobCompletionRate} color="text-emerald-600 dark:text-emerald-400" />
          <RateCard label="Quote Acceptance" rate={data.operational.quoteAcceptanceRate} color="text-blue-600 dark:text-blue-400" />
          <RateCard label="Checklist Completion" rate={data.operational.checklistCompletionRate} color="text-purple-600 dark:text-purple-400" />
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2">Avg Job Value</p>
              <p className="font-heading text-3xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(data.financial.avgJobValue)}</p>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground font-body">
                <IconCurrencyDollar className="h-3.5 w-3.5" />
                <span>{formatCurrency(data.financial.outstandingBalance)} outstanding</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 4: Payment Methods + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment Methods Donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-sm font-semibold">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              {data.financial.paymentMethods.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={data.financial.paymentMethods}
                        dataKey="count"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        strokeWidth={2}
                        stroke="hsl(var(--card))"
                      >
                        {data.financial.paymentMethods.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {data.financial.paymentMethods.map((pm, i) => (
                      <div key={pm.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm font-body capitalize">{pm.method?.replace("_", " ") ?? "Other"}</span>
                        </div>
                        <span className="text-sm font-body font-medium">{pm.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[140px] items-center justify-center">
                  <p className="text-sm text-muted-foreground font-body">No payments recorded</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-sm font-semibold">Recent Activity</CardTitle>
                <Badge variant="secondary" className="text-xs font-body">{data.activity.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[180px]">
                {data.activity.length > 0 ? (
                  <Table>
                    <TableBody>
                      {data.activity.slice(0, 20).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="py-2 px-4">
                            <Badge variant="outline" className="text-xs font-body capitalize">
                              {EVENT_LABELS[event.eventType] ?? event.eventType}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 px-4 text-xs text-muted-foreground font-body text-right whitespace-nowrap">
                            {formatDate(event.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex h-full items-center justify-center p-6">
                    <p className="text-sm text-muted-foreground font-body">No activity recorded</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
