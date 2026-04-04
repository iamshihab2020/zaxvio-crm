"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  IconDevices2,
  IconShieldCheck,
  IconClock,
  IconAlertTriangle,
  IconStack2,
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
  AssetTable,
  type AssetRow,
} from "@/components/dashboard/equipment/asset-table";
import {
  AssetDialog,
  type AssetFormData,
} from "@/components/dashboard/equipment/asset-dialog";
import {
  getEquipment,
  updateEquipment,
  deleteEquipment,
} from "@/actions/equipment";

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

export function AssetsPageClient() {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetRow[]>([]);
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
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<AssetRow | null>(null);

  const fetchAssets = useCallback(
    async (page: number, searchTerm: string) => {
      setLoading(true);
      const result = await getEquipment({
        search: searchTerm,
        page,
        limit: 15,
      });
      if (result.data) {
        setAssets(result.data as AssetRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationData);
        }
      }
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    fetchAssets(1, "");
  }, [fetchAssets]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAssets(1, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchAssets]);

  // Compute stats client-side
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

  // Client-side status filtering
  const filteredAssets = useMemo(() => {
    if (!statusFilter) return assets;
    return assets.filter((a) => getWarrantyStatus(a) === statusFilter);
  }, [assets, statusFilter]);

  function openEditDialog(asset: AssetRow) {
    setEditingAsset(asset);
    setDialogOpen(true);
  }

  function openDeleteDialog(asset: AssetRow) {
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: AssetFormData) {
    if (!editingAsset) return;
    setSaving(true);
    const result = await updateEquipment(editingAsset.id, data);
    if (!result.error) {
      setDialogOpen(false);
      await fetchAssets(pagination.page, search);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingAsset) return;
    setSaving(true);
    const result = await deleteEquipment(deletingAsset.id);
    if (!result.error) {
      setDeleteDialogOpen(false);
      setDeletingAsset(null);
      await fetchAssets(pagination.page, search);
    }
    setSaving(false);
  }

  const hasAssets = filteredAssets.length > 0;
  const showEmptyState = !loading && assets.length === 0 && !search && !statusFilter;
  const showNoResults = !loading && !hasAssets && (!!search || !!statusFilter);

  return (
    <section className="p-6">
      <PageHeader
        title="Assets"
        subtitle="Track equipment, units, and devices across all customers."
        className="mb-4"
      />

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
                placeholder="Search by type, brand, model, serial..."
              />
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={6} rows={5} />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No assets found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {/* Table */}
          {!loading && hasAssets && (
            <AssetTable
              assets={filteredAssets}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onRowClick={(asset) => router.push(`/assets/${asset.id}`)}
              showCustomer
            />
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && hasAssets && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => fetchAssets(p, search)}
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
    </section>
  );
}
