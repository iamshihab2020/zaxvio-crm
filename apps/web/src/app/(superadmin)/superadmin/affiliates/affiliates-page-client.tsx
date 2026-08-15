"use client";

import {
  IconUsers,
  IconCurrencyDollar,
  IconPercentage,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface Tenant {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  referralSource: string | null;
  createdAt: string;
  subscriptionStatus: string | null;
  planName: string | null;
  isActive: boolean | null;
  mrr: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AffiliatesPageClient({
  tenants,
  totalTenants,
}: {
  tenants: Tenant[];
  totalTenants: number;
}) {
  const affiliateMRR = tenants.reduce((sum, t) => sum + t.mrr, 0);
  const affiliateRate = totalTenants > 0
    ? Math.round((tenants.length / totalTenants) * 100)
    : 0;

  return (
    <section className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconUsers className="h-4 w-4 text-admin-accent" />
              <span className="text-sm font-body">Referred Tenants</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold">{tenants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconCurrencyDollar className="h-4 w-4 text-admin-accent" />
              <span className="text-sm font-body">Affiliate MRR</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(affiliateMRR)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconPercentage className="h-4 w-4 text-admin-accent" />
              <span className="text-sm font-body">Affiliate Rate</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold">{affiliateRate}%</p>
            <p className="text-xs text-muted-foreground font-body mt-1">
              of {totalTenants} total tenants
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referred Tenants Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-heading text-sm font-semibold">Referred Tenants</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Business</TableHead>
              <TableHead className="font-body">Owner</TableHead>
              <TableHead className="font-body">Plan</TableHead>
              <TableHead className="font-body">Status</TableHead>
              <TableHead className="font-body text-right">MRR</TableHead>
              <TableHead className="font-body">Signed Up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <p className="text-sm text-muted-foreground font-body">
                    No affiliate-referred tenants yet.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell className="font-body font-medium">{tenant.businessName}</TableCell>
                  <TableCell className="font-body text-muted-foreground text-sm">{tenant.ownerName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-body text-xs capitalize">
                      {tenant.planName ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TenantStatusBadge status={tenant.subscriptionStatus} isActive={tenant.isActive} />
                  </TableCell>
                  <TableCell className="text-right font-heading font-semibold text-sm">
                    {formatCurrency(tenant.mrr)}
                  </TableCell>
                  <TableCell className="font-body text-sm text-muted-foreground">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
