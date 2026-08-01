"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconFileCheck,
  IconPlus,
  IconCircleCheck,
  IconClock,
  IconAlertTriangle,
  IconX,
  IconTrash,
  IconPower,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import {
  ServiceAgreementTable,
  type AgreementRow,
} from "@/components/dashboard/service-agreements/service-agreement-table";
import {
  ServiceAgreementDialog,
  type AgreementSaveData,
} from "@/components/dashboard/service-agreements/service-agreement-dialog";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useServiceAgreements,
  useCreateServiceAgreement,
  useUpdateServiceAgreement,
  useDeleteServiceAgreement,
  useBulkDeleteServiceAgreements,
  useBulkToggleServiceAgreementActive,
  prefetchServiceAgreements,
} from "@/hooks/queries";

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

const DEFAULT_PAGINATION: PaginationData = {
  page: 1,
  limit: 15,
  total: 0,
  totalPages: 0,
};

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

interface ServiceAgreementsPageClientProps {
  initialAgreements?: AgreementRow[];
  initialPagination?: PaginationData;
}

export function ServiceAgreementsPageClient({
  initialAgreements = [],
  initialPagination,
}: ServiceAgreementsPageClientProps) {
  // UI state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPagination?.page ?? 1);
  const [statusFilter, setStatusFilter] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  // Row selection
  const {
    selectedIds,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();

  // Bulk action state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkToggleOpen, setBulkToggleOpen] = useState(false);
  const [bulkToggleValue, setBulkToggleValue] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] =
    useState<AgreementRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAgreement, setDeletingAgreement] =
    useState<AgreementRow | null>(null);

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    clearSelection();
  };

  // Reset selection when status filter changes
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    clearSelection();
  };

  // ── Query ─────────────────────────────────────────────────
  const listParams = { search: debouncedSearch, page, limit: 15 };
  const agreementsQuery = useServiceAgreements(listParams);

  const agreements = (agreementsQuery.data?.data ?? []) as AgreementRow[];
  const pagination =
    (agreementsQuery.data?.pagination as PaginationData | undefined) ??
    DEFAULT_PAGINATION;
  const loading = agreementsQuery.isLoading;

  // Prefetch next page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchServiceAgreements(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ─────────────────────────────────────────────
  const createMutation = useCreateServiceAgreement();
  const updateMutation = useUpdateServiceAgreement();
  const deleteMutation = useDeleteServiceAgreement();
  const bulkDeleteMutation = useBulkDeleteServiceAgreements();
  const bulkToggleActiveMutation = useBulkToggleServiceAgreementActive();

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const bulkLoading =
    bulkDeleteMutation.isPending || bulkToggleActiveMutation.isPending;

  // Compute stats client-side
  const stats = useMemo(() => {
    let active = 0,
      expiring = 0,
      expired = 0,
      inactive = 0;
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
    if (editingAgreement) {
      updateMutation.mutate(
        {
          id: editingAgreement.id,
          data: {
            contractName: data.contractName,
            startDate: data.startDate,
            endDate: data.endDate,
            frequency: data.frequency,
            visitsPerYear: parseInt(data.visitsPerYear, 10) || 2,
            annualPrice: data.annualPrice ? parseFloat(data.annualPrice) : null,
            notes: data.notes || undefined,
          },
        },
        { onSuccess: (res) => { if (!res.error) setDialogOpen(false); } },
      );
    } else {
      createMutation.mutate(
        {
          customerId: data.customerId,
          contractName: data.contractName,
          startDate: data.startDate,
          endDate: data.endDate,
          frequency: data.frequency,
          visitsPerYear: parseInt(data.visitsPerYear, 10) || 2,
          annualPrice: data.annualPrice ? parseFloat(data.annualPrice) : undefined,
          notes: data.notes || undefined,
        },
        { onSuccess: (res) => { if (!res.error) { setDialogOpen(false); setPage(1); } } },
      );
    }
  }

  async function handleDelete() {
    if (!deletingAgreement) return;
    deleteMutation.mutate(deletingAgreement.id, {
      onSuccess: (res) => {
        if (!res.error) { setDeleteDialogOpen(false); setDeletingAgreement(null); }
      },
    });
  }

  async function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => { setBulkDeleteOpen(false); clearSelection(); },
    });
  }

  async function handleBulkToggleActive() {
    bulkToggleActiveMutation.mutate(
      { ids: Array.from(selectedIds), isActive: bulkToggleValue },
      { onSuccess: () => { setBulkToggleOpen(false); clearSelection(); } },
    );
  }

  const hasAgreements = filteredAgreements.length > 0;
  const showEmptyState =
    !loading && agreements.length === 0 && !search && !statusFilter;
  const showNoResults =
    !loading && !hasAgreements && (!!search || !!statusFilter);

  return (
    <section className="p-6">
      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            {
              label: "Active",
              count: stats.active,
              icon: IconCircleCheck,
              color: "text-green-600 dark:text-green-400",
              bg: "bg-green-50 dark:bg-green-950/40",
            },
            {
              label: "Expiring",
              count: stats.expiring,
              icon: IconClock,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-950/40",
            },
            {
              label: "Expired",
              count: stats.expired,
              icon: IconAlertTriangle,
              color: "text-red-600 dark:text-red-400",
              bg: "bg-red-50 dark:bg-red-950/40",
            },
            {
              label: "Inactive",
              count: stats.inactive,
              icon: IconX,
              color: "text-muted-foreground",
              bg: "bg-muted/50",
            },
          ]}
          activeFilter={statusFilter}
          onFilterChange={handleStatusFilterChange}
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
              onChange={handleStatusFilterChange}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search agreements..."
              />
              <Button
                onClick={openCreateDialog}
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90 font-body"
              >
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                Add Agreement
              </Button>
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
              No agreements found
              {search ? (
                <>
                  {" "}
                  matching &ldquo;{search}&rdquo;
                </>
              ) : (
                " for this filter"
              )}
              .
            </p>
          )}

          {/* Table */}
          {!loading && hasAgreements && (
            <ServiceAgreementTable
              agreements={filteredAgreements}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              isAllSelected={isAllSelected(filteredAgreements)}
              isIndeterminate={isIndeterminate(filteredAgreements)}
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
          onPageChange={(p) => setPage(p)}
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
                visitsPerYear: String(editingAgreement.visitsPerYear ?? 2),
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

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        loading={bulkLoading}
        actions={[
          {
            label: "Set Active",
            icon: IconPower,
            onClick: () => {
              setBulkToggleValue(true);
              setBulkToggleOpen(true);
            },
            variant: "default",
          },
          {
            label: "Set Inactive",
            icon: IconPower,
            onClick: () => {
              setBulkToggleValue(false);
              setBulkToggleOpen(true);
            },
            variant: "default",
          },
          {
            label: "Delete",
            icon: IconTrash,
            onClick: () => setBulkDeleteOpen(true),
            variant: "destructive",
          },
        ]}
      />

      {/* Bulk delete confirmation */}
      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title={`Delete ${selectedCount} Agreement${selectedCount !== 1 ? "s" : ""}`}
        description={`This will permanently delete ${selectedCount} service agreement${selectedCount !== 1 ? "s" : ""}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Bulk toggle active confirmation */}
      <BulkConfirmDialog
        open={bulkToggleOpen}
        onOpenChange={setBulkToggleOpen}
        onConfirm={handleBulkToggleActive}
        loading={bulkLoading}
        title={`${bulkToggleValue ? "Activate" : "Deactivate"} ${selectedCount} Agreement${selectedCount !== 1 ? "s" : ""}`}
        description={`This will ${bulkToggleValue ? "activate" : "deactivate"} ${selectedCount} service agreement${selectedCount !== 1 ? "s" : ""}.`}
        confirmLabel={bulkToggleValue ? "Activate" : "Deactivate"}
        variant="default"
      />
    </section>
  );
}
