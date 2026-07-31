"use client";

import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  IconDevices2,
  IconShieldCheck,
  IconClock,
  IconAlertTriangle,
  IconStack2,
  IconTrash,
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
  AssetTable,
  type AssetRow,
} from "@/components/dashboard/equipment/asset-table";
import {
  AssetDialog,
  type AssetFormData,
} from "@/components/dashboard/equipment/asset-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useEquipment,
  useUpdateEquipment,
  useDeleteEquipment,
  useBulkDeleteEquipment,
  prefetchEquipment,
} from "@/hooks/queries";
import { useRowSelection } from "@/hooks/use-row-selection";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "under_warranty", label: "Under Warranty" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const DEFAULT_PAGINATION: PaginationData = { page: 1, limit: 15, total: 0, totalPages: 0 };

function getWarrantyStatus(asset: AssetRow): string {
  if (!asset.warrantyExpiry) return "expired";
  const now = new Date();
  const expiry = new Date(asset.warrantyExpiry);
  if (expiry < now) return "expired";
  const ninetyDays = new Date();
  ninetyDays.setDate(ninetyDays.getDate() + 90);
  if (expiry <= ninetyDays) return "expiring";
  return "under_warranty";
}

interface AssetsPageClientProps {
  initialAssets?: AssetRow[];
  initialPagination?: PaginationData;
}

export function AssetsPageClient({
  initialAssets = [],
  initialPagination,
}: AssetsPageClientProps) {
  const router = useRouter();

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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<AssetRow | null>(null);

  // ── Queries ────────────────────────────────────────────────
  const listParams = { search: debouncedSearch, page, limit: 15 };
  const assetsQuery = useEquipment(listParams);

  const assets = (assetsQuery.data?.data ?? []) as AssetRow[];
  const pagination = (assetsQuery.data?.pagination ?? DEFAULT_PAGINATION) as PaginationData;
  const loading = assetsQuery.isLoading;

  // Prefetch next page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchEquipment(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ──────────────────────────────────────────────
  const updateMutation = useUpdateEquipment();
  const deleteMutation = useDeleteEquipment();
  const bulkDeleteMutation = useBulkDeleteEquipment();

  const saving = updateMutation.isPending || deleteMutation.isPending;
  const bulkLoading = bulkDeleteMutation.isPending;

  // ── Derived ────────────────────────────────────────────────
  const stats = useMemo(() => {
    let underWarranty = 0, expiring = 0, expired = 0;
    for (const a of assets) {
      const status = getWarrantyStatus(a);
      if (status === "under_warranty") underWarranty++;
      else if (status === "expiring") expiring++;
      else if (status === "expired") expired++;
    }
    return { total: pagination.total, underWarranty, expiring, expired };
  }, [assets, pagination.total]);

  const filteredAssets = useMemo(() => {
    if (!statusFilter) return assets;
    return assets.filter((a) => getWarrantyStatus(a) === statusFilter);
  }, [assets, statusFilter]);

  // ── Handlers ───────────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    clearSelection();
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function openEditDialog(asset: AssetRow) {
    setEditingAsset(asset);
    setDialogOpen(true);
  }

  function openDeleteDialog(asset: AssetRow) {
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  }

  function handleSave(data: AssetFormData) {
    if (!editingAsset) return;
    updateMutation.mutate(
      { id: editingAsset.id, data },
      { onSuccess: (res) => { if (!res.error) setDialogOpen(false); } },
    );
  }

  function handleDelete() {
    if (!deletingAsset) return;
    deleteMutation.mutate(deletingAsset.id, {
      onSuccess: (res) => {
        if (!res.error) {
          setDeleteDialogOpen(false);
          setDeletingAsset(null);
        }
      },
    });
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: (res) => {
        if (!res.error) { setBulkDeleteOpen(false); clearSelection(); }
      },
    });
  }

  const hasAssets = filteredAssets.length > 0;
  const showEmptyState = !loading && assets.length === 0 && !search && !statusFilter;
  const showNoResults = !loading && !hasAssets && (!!search || !!statusFilter);

  return (
    <section className="p-6">
      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Total", count: stats.total, icon: IconStack2, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Under Warranty", count: stats.underWarranty, icon: IconShieldCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Expiring Soon", count: stats.expiring, icon: IconClock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            { label: "Expired", count: stats.expired, icon: IconAlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
          ]}
          className="mb-4"
        />
      )}

      {/* Empty state */}
      {showEmptyState && (
        <EmptyState
          icon={IconDevices2}
          title="No assets yet"
          description="Assets are created from customer detail pages. Go to a customer and add their equipment."
          actionLabel="Go to Customers"
          onAction={() => router.push("/customers")}
        />
      )}

      {/* Card wrapper */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); clearSelection(); }}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by type, brand, model, serial..."
              />
            </div>
          </div>

          {loading && (
            <div className="p-4">
              <TableSkeleton columns={6} rows={5} />
            </div>
          )}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No assets found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {!loading && hasAssets && (
            <AssetTable
              assets={filteredAssets}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onRowClick={(asset) => router.push(`/assets/${asset.id}`)}
              showCustomer
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              isAllSelected={isAllSelected(filteredAssets)}
              isIndeterminate={isIndeterminate(filteredAssets)}
            />
          )}
        </div>
      )}

      {!loading && hasAssets && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={handlePageChange}
          entityName="asset"
        />
      )}

      <AssetDialog
        asset={
          editingAsset
            ? {
                equipmentType: editingAsset.equipmentType,
                brand: editingAsset.brand ?? "",
                model: editingAsset.model ?? "",
                serialNumber: editingAsset.serialNumber ?? "",
                installDate: editingAsset.installDate ?? "",
                warrantyExpiry: editingAsset.warrantyExpiry ?? "",
                location: editingAsset.location ?? "",
                notes: editingAsset.notes ?? "",
              }
            : null
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
      />

      <DeleteConfirmDialog
        entityName="Asset"
        itemLabel={deletingAsset?.equipmentType ?? "this asset"}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />

      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        loading={bulkLoading}
        actions={[
          {
            label: "Delete",
            icon: IconTrash,
            onClick: () => setBulkDeleteOpen(true),
            variant: "destructive",
          },
        ]}
      />

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title={`Delete ${selectedCount} Asset${selectedCount !== 1 ? "s" : ""}`}
        description={`This will permanently delete ${selectedCount} asset${selectedCount !== 1 ? "s" : ""}. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
      />
    </section>
  );
}
