"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IconFileCheck,
  IconPlus,
  IconCircleCheck,
  IconClock,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/reusable/page-header";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  ServiceAgreementTable,
  type AgreementRow,
} from "@/components/dashboard/service-agreements/service-agreement-table";
import {
  ServiceAgreementDialog,
  type AgreementSaveData,
} from "@/components/dashboard/service-agreements/service-agreement-dialog";
import {
  getMaintenanceContracts,
  createMaintenanceContract,
  updateMaintenanceContract,
  deleteMaintenanceContract,
} from "@/actions/maintenance-contracts";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring" },
  { value: "expired", label: "Expired" },
  { value: "inactive", label: "Inactive" },
];

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getAgreementStatus(agreement: AgreementRow): string {
  const now = new Date();
  const endDate = agreement.endDate ? new Date(agreement.endDate) : null;
  const isActive = agreement.isActive !== false;

  if (!isActive) return "inactive";
  if (endDate && endDate < now) return "expired";
  if (endDate) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    if (endDate <= thirtyDaysFromNow) return "expiring";
  }
  return "active";
}

export function ServiceAgreementsPageClient() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] =
    useState<AgreementRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAgreement, setDeletingAgreement] =
    useState<AgreementRow | null>(null);

  const fetchAgreements = useCallback(
    async (page: number, searchTerm: string) => {
      setLoading(true);
      const result = await getMaintenanceContracts({
        search: searchTerm,
        page,
        limit: 15,
      });
      if (result.data) {
        setAgreements(result.data as AgreementRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationData);
        }
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    fetchAgreements(1, "");
  }, [fetchAgreements]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAgreements(1, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchAgreements]);

  // Compute stats client-side
  const stats = useMemo(() => {
    let active = 0, expiring = 0, expired = 0, inactive = 0;
    for (const a of agreements) {
      const status = getAgreementStatus(a);
      if (status === "active") active++;
      else if (status === "expiring") expiring++;
      else if (status === "expired") expired++;
      else if (status === "inactive") inactive++;
    }
    return { active, expiring, expired, inactive };
  }, [agreements]);

  // Client-side status filtering
  const filteredAgreements = useMemo(() => {
    if (!statusFilter) return agreements;
    return agreements.filter((a) => getAgreementStatus(a) === statusFilter);
  }, [agreements, statusFilter]);

  function openCreateDialog() {
    setEditingAgreement(null);
    setDialogOpen(true);
  }

  function openEditDialog(agreement: AgreementRow) {
    setEditingAgreement(agreement);
    setDialogOpen(true);
  }

  function openDeleteDialog(agreement: AgreementRow) {
    setDeletingAgreement(agreement);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: AgreementSaveData) {
    setSaving(true);
    if (editingAgreement) {
      const result = await updateMaintenanceContract(editingAgreement.id, {
        contractName: data.contractName,
        startDate: data.startDate,
        endDate: data.endDate,
        frequency: data.frequency,
        visitsPerYear: parseInt(data.visitsPerYear, 10) || 2,
        annualPrice: data.annualPrice ? parseFloat(data.annualPrice) : null,
        notes: data.notes || undefined,
      });
      if (!result.error) {
        setDialogOpen(false);
        await fetchAgreements(pagination.page, search);
      }
    } else {
      const result = await createMaintenanceContract({
        customerId: data.customerId,
        contractName: data.contractName,
        startDate: data.startDate,
        endDate: data.endDate,
        frequency: data.frequency,
        visitsPerYear: parseInt(data.visitsPerYear, 10) || 2,
        annualPrice: data.annualPrice ? parseFloat(data.annualPrice) : undefined,
        notes: data.notes || undefined,
      });
      if (!result.error) {
        setDialogOpen(false);
        await fetchAgreements(1, search);
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingAgreement) return;
    setSaving(true);
    const result = await deleteMaintenanceContract(deletingAgreement.id);
    if (!result.error) {
      setDeleteDialogOpen(false);
      setDeletingAgreement(null);
      await fetchAgreements(pagination.page, search);
    }
    setSaving(false);
  }

  const hasAgreements = filteredAgreements.length > 0;
  const showEmptyState = !loading && agreements.length === 0 && !search && !statusFilter;
  const showNoResults = !loading && !hasAgreements && (!!search || !!statusFilter);

  return (
    <section className="p-6">
      <PageHeader
        title="Service Agreements"
        subtitle="Manage recurring service contracts and maintenance plans."
        action={
          <Button
            onClick={openCreateDialog}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90 font-body"
          >
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            Add Agreement
          </Button>
        }
        className="mb-4"
      />

      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Active", count: stats.active, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Expiring", count: stats.expiring, icon: IconClock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            { label: "Expired", count: stats.expired, icon: IconAlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
            { label: "Inactive", count: stats.inactive, icon: IconX, color: "text-muted-foreground", bg: "bg-muted/50" },
          ]}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
          className="mb-4"
        />
      )}

      {/* Empty state */}
      {showEmptyState && (
        <EmptyState
          icon={IconFileCheck}
          title="No service agreements yet"
          description="Create recurring service contracts to track maintenance schedules and revenue."
          actionLabel="Add Agreement"
          onAction={openCreateDialog}
        />
      )}

      {/* Card wrapper — search + filters + table */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search agreements..."
              />
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={7} rows={5} />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No agreements found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {/* Table */}
          {!loading && hasAgreements && (
            <ServiceAgreementTable
              agreements={filteredAgreements}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
            />
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && hasAgreements && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => fetchAgreements(p, search)}
          entityName="agreement"
        />
      )}

      <ServiceAgreementDialog
        agreement={
          editingAgreement
            ? {
                contractName: editingAgreement.contractName,
                startDate: editingAgreement.startDate,
                endDate: editingAgreement.endDate,
                frequency: editingAgreement.frequency ?? "annual",
                visitsPerYear: String(
                  editingAgreement.visitsPerYear ?? 2,
                ),
                annualPrice: editingAgreement.annualPrice ?? "",
                notes: editingAgreement.notes ?? "",
                equipmentId: editingAgreement.equipmentId ?? "",
              }
            : null
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
      />

      <DeleteConfirmDialog
        entityName="Service Agreement"
        itemLabel={deletingAgreement?.contractName ?? "this agreement"}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />
    </section>
  );
}
