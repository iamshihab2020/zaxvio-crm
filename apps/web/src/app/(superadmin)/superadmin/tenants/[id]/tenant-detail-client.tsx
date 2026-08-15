"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconArrowLeft,
  IconBuilding,
  IconMail,
  IconPhone,
  IconMapPin,
  IconCalendar,
  IconCurrencyDollar,
  IconUsers,
  IconBriefcase,
  IconFileInvoice,
  IconPlayerPlay,
  IconPlayerPause,
  IconClock,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantStatusBadge } from "@/components/superadmin/tenants/tenant-status-badge";
import { ImpersonateDialog } from "@/components/superadmin/tenants/impersonate-dialog";
import { ExtendTrialDialog } from "@/components/superadmin/tenants/extend-trial-dialog";
import { OverrideSubscriptionDialog } from "@/components/superadmin/tenants/override-subscription-dialog";
import { EditTenantDialog } from "@/components/superadmin/tenants/edit-tenant-dialog";
import { DeleteTenantDialog } from "@/components/superadmin/tenants/delete-tenant-dialog";
import { TenantAnalyticsTab } from "@/components/superadmin/tenants/tenant-analytics-tab";
import {
  deactivateTenant,
  activateTenant,
} from "@/actions/admin";
import Link from "next/link";

interface TenantDetail {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  isActive: boolean | null;
  trialEndsAt: string | null;
  referralSource: string | null;
  createdAt: string;
  updatedAt: string;
  subscription: {
    status: string;
    planName: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelledAt: string | null;
    mrr: number;
  } | null;
  stats: {
    customerCount: number;
    jobCount: number;
    invoiceCount: number;
  };
  lastActiveAt: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <p className="text-sm font-body text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-admin-accent/10">
        <Icon className="h-5 w-5 text-admin-accent" />
      </div>
      <div>
        <p className="font-heading text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground font-body">{label}</p>
      </div>
    </div>
  );
}

export function TenantDetailClient({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";
  const [loading, setLoading] = useState(false);

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);
  const [impersonateOpen, setImpersonateOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [overrideSubOpen, setOverrideSubOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeactivate = async () => {
    setLoading(true);
    await deactivateTenant(tenant.id);
    router.refresh();
    setLoading(false);
  };

  const handleActivate = async () => {
    setLoading(true);
    await activateTenant(tenant.id);
    router.refresh();
    setLoading(false);
  };

  const handleSuccess = () => router.refresh();

  const address = [tenant.address, tenant.city, tenant.state, tenant.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/superadmin/tenants">
                <IconArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl font-bold">
                  {tenant.businessName}
                </h1>
                <TenantStatusBadge
                  status={tenant.subscription?.status ?? null}
                  isActive={tenant.isActive}
                />
              </div>
              <p className="text-sm text-muted-foreground font-body">
                {tenant.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImpersonateOpen(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <IconBriefcase className="h-3.5 w-3.5" />
              Impersonate
            </Button>
            {tenant.isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeactivate}
                disabled={loading}
                className="gap-1.5"
              >
                <IconPlayerPause className="h-3.5 w-3.5" />
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleActivate}
                disabled={loading}
                className="gap-1.5"
              >
                <IconPlayerPlay className="h-3.5 w-3.5" />
                Activate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExtendTrialOpen(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <IconClock className="h-3.5 w-3.5" />
              Extend Trial
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverrideSubOpen(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <IconCurrencyDollar className="h-3.5 w-3.5" />
              Override
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <IconEdit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              disabled={loading}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Content — Tabs at top level */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="overview" className="font-body">
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="font-body">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="font-body">
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Overview: info panel + stats side by side */}
          <TabsContent value="overview" className="mt-4">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Left panel — Info */}
              <div className="w-full lg:w-80 shrink-0 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Contact Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <InfoRow icon={IconBuilding} label="Owner" value={tenant.ownerName} />
                    <InfoRow icon={IconMail} label="Email" value={tenant.email} />
                    <InfoRow icon={IconPhone} label="Phone" value={tenant.phone} />
                    <InfoRow icon={IconMapPin} label="Address" value={address || null} />
                    <Separator />
                    <InfoRow icon={IconCalendar} label="Signed Up" value={formatDate(tenant.createdAt)} />
                    <InfoRow icon={IconCalendar} label="Trial Ends" value={formatDate(tenant.trialEndsAt)} />
                    <InfoRow icon={IconCalendar} label="Last Active" value={formatDate(tenant.lastActiveAt)} />
                    {tenant.referralSource && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-body capitalize">
                          {tenant.referralSource}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right — Stats + Trial + Subscription */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Usage stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard icon={IconUsers} label="Customers" value={tenant.stats.customerCount} />
                  <StatCard icon={IconBriefcase} label="Jobs" value={tenant.stats.jobCount} />
                  <StatCard icon={IconFileInvoice} label="Invoices" value={tenant.stats.invoiceCount} />
                </div>

                {/* Trial + Subscription side by side */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Trial Details */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-heading text-base font-semibold">
                        Trial Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground font-body">Trial Status</span>
                        {(() => {
                          const now = new Date();
                          const trialEnd = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : null;
                          const isTrialing = tenant.subscription?.status === "trialing";
                          const isExpired = trialEnd && trialEnd < now;
                          if (!trialEnd) return <Badge className="bg-gray-500/15 text-gray-600 dark:text-gray-400 border-0 text-xs">No trial</Badge>;
                          if (isExpired) return <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 text-xs">Expired</Badge>;
                          if (isTrialing) return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0 text-xs">Active</Badge>;
                          return <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 border-0 text-xs">Converted</Badge>;
                        })()}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground font-body">Trial Ends</span>
                        <span className="text-sm font-body font-medium">
                          {formatDate(tenant.trialEndsAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground font-body">Days Remaining</span>
                        <span className="text-sm font-body font-medium">
                          {(() => {
                            if (!tenant.trialEndsAt) return "—";
                            const days = Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            if (days < 0) return <span className="text-destructive">{Math.abs(days)}d overdue</span>;
                            if (days <= 3) return <span className="text-amber-600 dark:text-amber-400">{days}d left</span>;
                            return <span className="text-emerald-600 dark:text-emerald-400">{days}d left</span>;
                          })()}
                        </span>
                      </div>
                      {tenant.trialEndsAt && (
                        <div className="pt-1">
                          {(() => {
                            const created = new Date(tenant.createdAt);
                            const trialEnd = new Date(tenant.trialEndsAt);
                            const totalDays = Math.max(1, Math.ceil((trialEnd.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
                            const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            const elapsed = Math.max(0, totalDays - daysRemaining);
                            const pct = Math.min(100, Math.round((elapsed / totalDays) * 100));
                            return (
                              <>
                                <Progress value={pct} className="h-2" />
                                <p className="text-xs text-muted-foreground font-body mt-1 text-right">
                                  {elapsed}d elapsed of {totalDays}d total
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Subscription Details */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="font-heading text-base font-semibold">
                        Subscription
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tenant.subscription ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">Plan</span>
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-0 capitalize font-body text-xs">
                              {tenant.subscription.planName ?? "—"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">Status</span>
                            <TenantStatusBadge status={tenant.subscription.status} isActive={tenant.isActive} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">MRR</span>
                            <span className="font-heading font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(tenant.subscription.mrr)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">Period Start</span>
                            <span className="text-sm font-body">
                              {formatDate(tenant.subscription.currentPeriodStart)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">Period End</span>
                            <span className="text-sm font-body">
                              {formatDate(tenant.subscription.currentPeriodEnd)}
                            </span>
                          </div>
                          {tenant.subscription.cancelledAt && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground font-body">Cancelled At</span>
                              <span className="text-sm font-body text-destructive">
                                {formatDate(tenant.subscription.cancelledAt)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground font-body">Account</span>
                            {tenant.isActive ? (
                              <Badge className="bg-green-500/15 text-green-700 dark:text-green-300 border-0 text-xs">Active</Badge>
                            ) : (
                              <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-0 text-xs">Deactivated</Badge>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground font-body">No subscription found.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Analytics: full width */}
          <TabsContent value="analytics" className="mt-4">
            <TenantAnalyticsTab tenantId={tenant.id} />
          </TabsContent>

          {/* Activity: full width */}
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground font-body">
                  Activity log will appear here once platform events are emitted.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ImpersonateDialog
        tenantId={tenant.id}
        tenantName={tenant.businessName}
        open={impersonateOpen}
        onOpenChange={setImpersonateOpen}
      />
      <ExtendTrialDialog
        tenantId={tenant.id}
        tenantName={tenant.businessName}
        open={extendTrialOpen}
        onOpenChange={setExtendTrialOpen}
        onSuccess={handleSuccess}
      />
      <OverrideSubscriptionDialog
        tenantId={tenant.id}
        tenantName={tenant.businessName}
        currentStatus={tenant.subscription?.status ?? null}
        currentPlan={tenant.subscription?.planName ?? null}
        open={overrideSubOpen}
        onOpenChange={setOverrideSubOpen}
        onSuccess={handleSuccess}
      />
      <EditTenantDialog
        tenantId={tenant.id}
        initialValues={{
          businessName: tenant.businessName,
          ownerName: tenant.ownerName,
          email: tenant.email,
          phone: tenant.phone ?? "",
          slug: tenant.slug,
          address: tenant.address ?? "",
          city: tenant.city ?? "",
          state: tenant.state ?? "",
          zipCode: tenant.zipCode ?? "",
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={handleSuccess}
      />
      <DeleteTenantDialog
        tenantId={tenant.id}
        tenantName={tenant.businessName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => router.push("/superadmin/tenants")}
      />
    </section>
  );
}
