"use client";

import { useState, useEffect, useCallback } from "react";
import { IconDevices2, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { AssetTable, type AssetRow } from "@/components/dashboard/equipment/asset-table";
import {
  AssetDialog,
  type AssetFormData,
} from "@/components/dashboard/equipment/asset-dialog";
import { RefrigerantLogsPanel } from "@/components/dashboard/equipment/refrigerant-logs-panel";
import {
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from "@/actions/equipment";

interface CustomerEquipmentTabProps {
  customerId: string;
}

const ASSET_LIMIT = 100;

export function CustomerEquipmentTab({
  customerId,
}: CustomerEquipmentTabProps) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<AssetRow | null>(null);

  // Expanded row for refrigerant logs
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalAssets, setTotalAssets] = useState(0);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const result = await getEquipment({ customerId, limit: ASSET_LIMIT });
    if (result.data) {
      setAssets(result.data as AssetRow[]);
      setTotalAssets(result.pagination?.total ?? (result.data as AssetRow[]).length);
      setLoadError(null);
    } else {
      // A failure used to leave the list empty and indistinguishable from a
      // customer who genuinely owns no equipment (CUST-02).
      setLoadError(result.error ?? "Could not load assets");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  function openCreateDialog() {
    setEditingAsset(null);
    setDialogOpen(true);
  }

  function openEditDialog(asset: AssetRow) {
    setEditingAsset(asset);
    setDialogOpen(true);
  }

  function openDeleteDialog(asset: AssetRow) {
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: AssetFormData) {
    setSaving(true);
    if (editingAsset) {
      const result = await updateEquipment(editingAsset.id, data);
      if (!result.error) {
        setDialogOpen(false);
        await fetchAssets();
      }
    } else {
      const result = await createEquipment({
        customerId,
        ...data,
      });
      if (!result.error) {
        setDialogOpen(false);
        await fetchAssets();
      }
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
      if (expandedAssetId === deletingAsset.id) {
        setExpandedAssetId(null);
      }
      await fetchAssets();
    }
    setSaving(false);
  }

  if (loading) {
    return <TableSkeleton columns={5} rows={3} />;
  }

  if (loadError) {
    return (
      <LoadErrorState title="Could not load assets" message={loadError} onRetry={fetchAssets} />
    );
  }

  if (assets.length === 0) {
    return (
      <>
        <EmptyState
          icon={IconDevices2}
          title="No assets yet"
          description="Track equipment, units, and devices for this customer."
          actionLabel="Add Asset"
          onAction={openCreateDialog}
        />
        <AssetDialog
          asset={null}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          loading={saving}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          {/* Says so when the list is capped, instead of presenting the first
              100 as though they were all of them (CUST-15). */}
          {totalAssets > assets.length
            ? `Showing ${assets.length} of ${totalAssets} assets`
            : `${assets.length} asset${assets.length !== 1 ? "s" : ""}`}
        </p>
        <Button
          size="sm"
          onClick={openCreateDialog}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="h-4 w-4 mr-1" />
          Add Asset
        </Button>
      </div>

      <Card className="overflow-hidden">
        <AssetTable
          assets={assets}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onRowClick={(asset) =>
            setExpandedAssetId(
              expandedAssetId === asset.id ? null : asset.id,
            )
          }
        />
      </Card>

      {/* Expanded refrigerant logs panel */}
      {expandedAssetId && (
        <Card className="p-4">
          <RefrigerantLogsPanel equipmentId={expandedAssetId} />
        </Card>
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
        itemLabel={
          editingAsset?.equipmentType ??
          deletingAsset?.equipmentType ??
          "this asset"
        }
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        description="All refrigerant logs and service agreements linked to this asset will also be affected."
      />
    </div>
  );
}
