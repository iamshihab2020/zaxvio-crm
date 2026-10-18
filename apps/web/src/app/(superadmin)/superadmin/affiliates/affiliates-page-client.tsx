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
import { AnimatedNumber } from "@/components/reusable/animated-number";

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

function formatCount(n: number): string {
  return String(n);
}

function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
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
    <section data-stagger className="p-4 sm:p-6 space-y-6">
      {/* KPI Cards. Padding is 16px on phones (24px from `sm`), the card rule
          in DESIGN.md; the three stack on a phone and sit in a row from `sm`. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconUsers className="h-4 w-4 shrink-0 text-admin-accent" />
              <span className="text-sm font-body">Referred Tenants</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold">
              <AnimatedNumber value={tenants.length} format={formatCount} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconCurrencyDollar className="h-4 w-4 shrink-0 text-admin-accent" />
              <span className="text-sm font-body">Affiliate MRR</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              <AnimatedNumber value={affiliateMRR} format={formatCurrency} />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <IconPercentage className="h-4 w-4 shrink-0 text-admin-accent" />
              <span className="text-sm font-body">Affiliate Rate</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold">
              <AnimatedNumber value={affiliateRate} format={formatPercent} />
            </p>
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
        {/* Below `md`: Business, Status and MRR, with Owner and Plan folded
            under the business name and the sign-up date dropped. */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body">Business</TableHead>
              <TableHead className="font-body hidden md:table-cell">Owner</TableHead>
              <TableHead className="font-body hidden md:table-cell">Plan</TableHead>
              <TableHead className="font-body">Status</TableHead>
              <TableHead className="font-body text-right">MRR</TableHead>
              <TableHead className="font-body hidden md:table-cell">Signed Up</TableHead>
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
                  <TableCell className="font-body font-medium">
                    {tenant.businessName}
                    <p className="mt-0.5 text-xs font-normal text-muted-foreground md:hidden">
                      {tenant.ownerName}
                      {tenant.planName && (
                        <span className="capitalize"> · {tenant.planName}</span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="font-body text-muted-foreground text-sm hidden md:table-cell">{tenant.ownerName}</TableCell>
                  <TableCell className="hidden md:table-cell">
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
                  <TableCell className="font-body text-sm text-muted-foreground hidden md:table-cell">
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
