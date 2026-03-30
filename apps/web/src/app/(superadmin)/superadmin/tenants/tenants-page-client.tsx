"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconSearch, IconBuilding } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TenantStatusBadge } from "@/components/superadmin/tenants/tenant-status-badge";
import { getAdminTenants } from "@/actions/admin";

interface Tenant {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  slug: string;
  phone: string | null;
  isActive: boolean | null;
  trialEndsAt: string | null;
  referralSource: string | null;
  createdAt: string;
  subscriptionStatus: string | null;
  planName: string | null;
  mrr: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

export function TenantsPageClient({
  initialData,
  initialPagination,
}: {
  initialData: Tenant[];
  initialPagination: Pagination;
}) {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>(initialData);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTenants = useCallback(
    async (params: { search?: string; page?: number }) => {
      setLoading(true);
      const result = await getAdminTenants({
        search: params.search ?? search,
        page: params.page ?? pagination.page,
        limit: pagination.limit,
      });
      if (result.data) {
        setTenants(result.data);
        if (result.pagination) setPagination(result.pagination);
      }
      setLoading(false);
    },
    [search, pagination.page, pagination.limit],
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    fetchTenants({ search: value, page: 1 });
  };

  return (
    <section className="p-6">
      {/* Card wrapper */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Search bar */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 font-body"
            />
          </div>
          <Badge variant="secondary" className="font-body text-xs shrink-0">
            {pagination.total} tenants
          </Badge>
        </div>

        {/* Table */}
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
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <IconBuilding className="h-8 w-8" />
                    <p className="font-body text-sm">No tenants found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/superadmin/tenants/${tenant.id}`)}
                >
                  <TableCell className="font-medium font-body text-foreground">
                    {tenant.businessName}
                  </TableCell>
                  <TableCell className="font-body text-muted-foreground">
                    <div>
                      <p className="text-sm">{tenant.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{tenant.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-body text-xs capitalize">
                      {tenant.planName ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TenantStatusBadge
                      status={tenant.subscriptionStatus}
                      isActive={tenant.isActive}
                    />
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-body">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => fetchTenants({ page: pagination.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchTenants({ page: pagination.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
