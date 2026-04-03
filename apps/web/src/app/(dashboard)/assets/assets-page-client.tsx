"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { IconDevices2, IconPlus, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

  return (
    <section className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Assets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Track equipment, units, and devices across all customers.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by type, brand, model, serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <Card className="overflow-hidden">
          <TableSkeleton columns={6} rows={5} />
        </Card>
      ) : assets.length === 0 && !search ? (
        <EmptyState
          icon={IconDevices2}
          title="No assets yet"
          description="Assets are created from customer detail pages. Go to a customer and add their equipment."
          actionLabel="Go to Customers"
          onAction={() => router.push("/customers")}
        />
      ) : assets.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No assets found matching &quot;{search}&quot;
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <AssetTable
              assets={assets}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onRowClick={(asset) => router.push(`/assets/${asset.id}`)}
              showCustomer
            />
          </Card>

          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchAssets(p, search)}
              entityName="asset"
            />
          )}
        </>
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
