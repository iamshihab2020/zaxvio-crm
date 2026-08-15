"use client";

import {
  IconBuilding,
  IconCurrencyDollar,
  IconUsers,
  IconTrendingUp,
  IconTrendingDown,
  IconArrowRight,
} from "@tabler/icons-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardPageClientProps {
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
  totalTenants: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  iconColor = "text-admin-accent",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-body">{label}</span>
        </div>
        <p className="mt-2 font-heading text-3xl font-bold text-foreground">
          {value}
        </p>
        {trendLabel && (
          <div className="mt-1 flex items-center gap-1">
            {trend === "up" && (
              <IconTrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            )}
            {trend === "down" && (
              <IconTrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            )}
            <span
              className={`text-xs font-body ${
                trend === "up"
                  ? "text-green-600 dark:text-green-400"
                  : trend === "down"
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              }`}
            >
              {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPageClient({
  mrr,
  signups,
  activeUsers,
  trialConversion,
  totalTenants,
}: DashboardPageClientProps) {
  const recentSignups = signups?.slice(-7).reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <section className="p-6 space-y-6">
      {/* KPI Grid — no page title needed, navbar shows "Dashboard" */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Tenants"
          value={String(totalTenants)}
          icon={IconBuilding}
          iconColor="text-blue-500 dark:text-blue-400"
          trend={recentSignups > 0 ? "up" : "neutral"}
          trendLabel={recentSignups > 0 ? `+${recentSignups} this week` : "No new signups"}
        />
        <KpiCard
          label="MRR"
          value={formatCurrency(mrr?.currentMRR ?? 0)}
          icon={IconCurrencyDollar}
          iconColor="text-emerald-500 dark:text-emerald-400"
          trend="up"
          trendLabel={`${mrr?.totalActiveSubscriptions ?? 0} active subscriptions`}
        />
        <KpiCard
          label="Active Tenants (DAT)"
          value={String(activeUsers?.dat ?? 0)}
          icon={IconUsers}
          iconColor="text-purple-500 dark:text-purple-400"
          trendLabel={`WAT: ${activeUsers?.wat ?? 0} · MAT: ${activeUsers?.mat ?? 0}`}
        />
        <KpiCard
          label="Conversion Rate"
          value={`${trialConversion?.conversionRate ?? 0}%`}
          icon={IconTrendingUp}
          iconColor="text-amber-500 dark:text-amber-400"
          trend={
            (trialConversion?.conversionRate ?? 0) > 30
              ? "up"
              : (trialConversion?.conversionRate ?? 0) > 0
                ? "neutral"
                : "down"
          }
          trendLabel={`${trialConversion?.converted ?? 0} of ${trialConversion?.totalTrials ?? 0} trials`}
        />
      </div>

      {/* MRR Breakdown + Trial Funnel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* MRR Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-semibold">
              MRR by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mrr?.breakdown && mrr.breakdown.length > 0 ? (
              <div className="space-y-3">
                {mrr.breakdown.map((plan) => (
                  <div
                    key={plan.planName}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-body text-xs capitalize">
                        {plan.planName}
                      </Badge>
                      <span className="text-sm text-muted-foreground font-body">
                        {plan.count} tenants
                      </span>
                    </div>
                    <span className="font-heading text-sm font-semibold">
                      {formatCurrency(plan.mrr)}/mo
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground font-body">
                    Total MRR
                  </span>
                  <span className="font-heading text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(mrr.currentMRR)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-body">
                No active subscriptions yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Trial Conversion Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base font-semibold">
              Trial Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trialConversion ? (
              <div className="space-y-3">
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
                        <span className="font-medium text-foreground">
                          {stage.value} ({pct}%)
                        </span>
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
            ) : (
              <p className="text-sm text-muted-foreground font-body">
                No trial data yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base font-semibold">
            Recent Signups (Last 90 Days)
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/superadmin/analytics" className="gap-1 text-xs">
              View Analytics
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {signups && signups.length > 0 ? (
            <div className="flex items-end gap-[3px] h-32">
              {(() => {
                // Pad to at least 30 bars for visual consistency
                const data = signups.slice(-60);
                const maxCount = Math.max(...data.map((d) => d.count), 1);
                const minBars = 30;
                const paddedData = data.length < minBars
                  ? [...Array.from({ length: minBars - data.length }, (_, i) => ({ date: `pad-${i}`, count: 0 })), ...data]
                  : data;
                return paddedData.map((day) => {
                  const height = day.count > 0 ? Math.max((day.count / maxCount) * 100, 8) : 2;
                  return (
                    <div
                      key={day.date}
                      className={`flex-1 rounded-t transition-colors cursor-default ${
                        day.count > 0
                          ? "bg-blue-500/80 hover:bg-blue-500 dark:bg-blue-400/80 dark:hover:bg-blue-400"
                          : "bg-muted/40"
                      }`}
                      style={{ height: `${height}%`, maxWidth: "12px" }}
                      title={day.count > 0 ? `${day.date}: ${day.count} signups` : ""}
                    />
                  );
                });
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-body">
              No signup data yet.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
