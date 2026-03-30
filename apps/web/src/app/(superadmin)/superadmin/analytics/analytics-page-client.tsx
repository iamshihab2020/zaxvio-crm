"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TenantStatusBadge } from "@/components/superadmin/tenants/tenant-status-badge";

interface AnalyticsPageClientProps {
  mrr: {
    currentMRR: number;
    totalActiveSubscriptions: number;
    breakdown: { planName: string; count: number; price: number; mrr: number }[];
  } | null;
  signups: { date: string; count: number }[] | null;
  activeUsers: { dat: number; wat: number; mat: number } | null;
  trialConversion: {
    totalTrials: number;
    activeTrials: number;
    converted: number;
    cancelled: number;
    conversionRate: number;
  } | null;
  churnList: {
    tenantId: string;
    businessName: string;
    planName: string | null;
    cancelledAt: string | null;
    createdAt: string;
    mrrLost: number;
    daysActive: number | null;
  }[] | null;
  inactiveAlerts: {
    id: string;
    businessName: string;
    ownerName: string;
    email: string;
    planName: string | null;
    subscriptionStatus: string | null;
    mrr: number;
  }[] | null;
  featureAdoption: {
    totalTenants: number;
    features: { feature: string; tenants: number; percentage: number }[];
  } | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AnalyticsPageClient({
  mrr,
  signups,
  activeUsers,
  trialConversion,
  churnList,
  inactiveAlerts,
  featureAdoption,
}: AnalyticsPageClientProps) {
  // Prepare signup data for chart — aggregate by week for cleaner visuals
  const signupData = signups ?? [];

  return (
    <section className="p-6 space-y-6">
      {/* Row 1: MRR Breakdown + Active Users */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MRR Breakdown Bar Chart */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base font-semibold">
                MRR by Plan
              </CardTitle>
              <span className="font-heading text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(mrr?.currentMRR ?? 0)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center">
            {mrr?.breakdown && mrr.breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={180}>
                <BarChart data={mrr.breakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="planName"
                    tick={{ fontSize: 12, className: "fill-muted-foreground" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, className: "fill-muted-foreground" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "MRR"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="mrr" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground font-body py-8 text-center">
                No subscription data yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Active Users Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-semibold">
              Active Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "DAT", sublabel: "Daily", value: activeUsers?.dat ?? 0, color: "text-green-600 dark:text-green-400" },
                { label: "WAT", sublabel: "Weekly", value: activeUsers?.wat ?? 0, color: "text-blue-600 dark:text-blue-400" },
                { label: "MAT", sublabel: "Monthly", value: activeUsers?.mat ?? 0, color: "text-purple-600 dark:text-purple-400" },
              ].map((metric) => (
                <div key={metric.label} className="text-center rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                    {metric.label}
                  </p>
                  <p className={`font-heading text-3xl font-bold mt-1 ${metric.color}`}>
                    {metric.value}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    {metric.sublabel}
                  </p>
                </div>
              ))}
            </div>

            {/* Trial Funnel */}
            {trialConversion && (
              <div className="mt-6 space-y-3">
                <h4 className="font-heading text-sm font-semibold text-muted-foreground">
                  Trial Conversion Funnel
                </h4>
                {[
                  { label: "Total Trials", value: trialConversion.totalTrials, color: "bg-blue-500 dark:bg-blue-400" },
                  { label: "Active Trials", value: trialConversion.activeTrials, color: "bg-amber-500 dark:bg-amber-400" },
                  { label: "Converted", value: trialConversion.converted, color: "bg-green-500 dark:bg-green-400" },
                  { label: "Cancelled", value: trialConversion.cancelled, color: "bg-red-500 dark:bg-red-400" },
                ].map((stage) => {
                  const maxVal = trialConversion.totalTrials || 1;
                  const pct = Math.round((stage.value / maxVal) * 100);
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between text-sm font-body mb-1">
                        <span className="text-muted-foreground">{stage.label}</span>
                        <span className="font-medium">{stage.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${stage.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Signup Trend Area Chart */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base font-semibold">
              Signups (Last 90 Days)
            </CardTitle>
            <Badge variant="secondary" className="font-body text-xs">
              {signupData.reduce((sum, d) => sum + d.count, 0)} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {signupData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={signupData}>
                <defs>
                  <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, className: "fill-muted-foreground" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  interval={6}
                />
                <YAxis
                  tick={{ fontSize: 12, className: "fill-muted-foreground" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(d) => formatDate(d)}
                  formatter={(value: number) => [value, "Signups"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  fill="url(#signupGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground font-body py-12 text-center">
              No signup data yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Row 3: Churn Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base font-semibold">
              Churned Tenants (Last 90 Days)
            </CardTitle>
            <Badge variant="secondary" className="font-body text-xs">
              {churnList?.length ?? 0} churned
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-body">Business</TableHead>
                <TableHead className="font-body">Plan</TableHead>
                <TableHead className="font-body text-right">MRR Lost</TableHead>
                <TableHead className="font-body">Days Active</TableHead>
                <TableHead className="font-body">Cancelled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!churnList || churnList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <p className="text-sm text-muted-foreground font-body">
                      No churned tenants in this period.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                churnList.map((item) => (
                  <TableRow key={item.tenantId}>
                    <TableCell className="font-body font-medium">
                      {item.businessName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-body text-xs capitalize">
                        {item.planName ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-heading font-semibold text-destructive text-sm">
                      -{formatCurrency(item.mrrLost)}
                    </TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">
                      {item.daysActive !== null ? `${item.daysActive}d` : "—"}
                    </TableCell>
                    <TableCell className="font-body text-sm text-muted-foreground">
                      {formatDate(item.cancelledAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Row 4: Feature Adoption + Inactive Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Feature Adoption */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-semibold">
              Feature Adoption
            </CardTitle>
          </CardHeader>
          <CardContent>
            {featureAdoption?.features && featureAdoption.features.length > 0 ? (
              <div className="space-y-3">
                {featureAdoption.features.map((f, i) => {
                  const barColors = [
                    "bg-blue-500 dark:bg-blue-400",
                    "bg-emerald-500 dark:bg-emerald-400",
                    "bg-amber-500 dark:bg-amber-400",
                    "bg-purple-500 dark:bg-purple-400",
                    "bg-cyan-500 dark:bg-cyan-400",
                  ];
                  return (
                    <div key={f.feature}>
                      <div className="flex items-center justify-between text-sm font-body mb-1">
                        <span className="text-foreground font-medium">{f.feature}</span>
                        <span className="text-muted-foreground">
                          {f.tenants} of {featureAdoption.totalTenants} ({f.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${barColors[i % barColors.length]}`}
                          style={{ width: `${Math.max(f.percentage, 3)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-body py-8 text-center">
                No feature data yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Inactive Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base font-semibold">
                Inactive Alerts (14+ days)
              </CardTitle>
              {inactiveAlerts && inactiveAlerts.length > 0 && (
                <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-0 text-xs">
                  {inactiveAlerts.length} at risk
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Business</TableHead>
                  <TableHead className="font-body">Plan</TableHead>
                  <TableHead className="font-body text-right">MRR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!inactiveAlerts || inactiveAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center">
                      <p className="text-sm text-muted-foreground font-body">
                        All tenants are active. No churn risk detected.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  inactiveAlerts.slice(0, 10).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <p className="font-body text-sm font-medium">{t.businessName}</p>
                          <p className="font-body text-xs text-muted-foreground">{t.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-body text-xs capitalize">
                          {t.planName ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-heading text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(t.mrr)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
