"use client";

import { useState, useEffect, useCallback } from "react";
import { IconFileCheck, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { LoadErrorState } from "@/components/reusable/load-error-state";
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

interface CustomerAgreementsTabProps {
  customerId: string;
}

const AGREEMENT_LIMIT = 100;

export function CustomerAgreementsTab({
  customerId,
}: CustomerAgreementsTabProps) {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] =
    useState<AgreementRow | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAgreement, setDeletingAgreement] =
    useState<AgreementRow | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [totalAgreements, setTotalAgreements] = useState(0);

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    const result = await getMaintenanceContracts({
      customerId,
      limit: AGREEMENT_LIMIT,
    });
    if (result.data) {
      setAgreements(result.data as AgreementRow[]);
      setTotalAgreements(result.pagination?.total ?? (result.data as AgreementRow[]).length);
      setLoadError(null);
    } else {
      // Otherwise a failed request renders as "no agreements" (CUST-02).
      setLoadError(result.error ?? "Could not load agreements");
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

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
        equipmentId: data.equipmentId || null,
      });
      if (!result.error) {
        setDialogOpen(false);
        await fetchAgreements();
      }
    } else {
      const result = await createMaintenanceContract({
        customerId,
        contractName: data.contractName,
        startDate: data.startDate,
        endDate: data.endDate,
        frequency: data.frequency,
        visitsPerYear: parseInt(data.visitsPerYear, 10) || 2,
        annualPrice: data.annualPrice
          ? parseFloat(data.annualPrice)
          : undefined,
        notes: data.notes || undefined,
        equipmentId: data.equipmentId || undefined,
      });
      if (!result.error) {
        setDialogOpen(false);
        await fetchAgreements();
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
      await fetchAgreements();
    }
    setSaving(false);
  }

  if (loading) {
    return <TableSkeleton columns={5} rows={3} />;
  }

  if (loadError) {
    return (
      <LoadErrorState
        title="Could not load agreements"
        message={loadError}
        onRetry={fetchAgreements}
      />
    );
  }

  if (agreements.length === 0) {
    return (
      <>
        <EmptyState
          icon={IconFileCheck}
          title="No service agreements"
          description="Create recurring service contracts for this customer."
          actionLabel="Add Agreement"
          onAction={openCreateDialog}
        />
        <ServiceAgreementDialog
          agreement={null}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSave={handleSave}
          loading={saving}
          customerId={customerId}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          {/* Reports the cap rather than hiding it (CUST-15). */}
          {totalAgreements > agreements.length
            ? `Showing ${agreements.length} of ${totalAgreements} agreements`
            : `${agreements.length} agreement${agreements.length !== 1 ? "s" : ""}`}
        </p>
        <Button
          size="sm"
          onClick={openCreateDialog}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="h-4 w-4 mr-1" />
          Add Agreement
        </Button>
      </div>

      <Card className="overflow-hidden">
        <ServiceAgreementTable
          agreements={agreements}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          showCustomer={false}
        />
      </Card>

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
        customerId={customerId}
      />

      <DeleteConfirmDialog
        entityName="Service Agreement"
        itemLabel={deletingAgreement?.contractName ?? "this agreement"}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
      />
    </div>
  );
}
