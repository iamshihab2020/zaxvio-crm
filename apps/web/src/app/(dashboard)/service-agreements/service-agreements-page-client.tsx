"use client";

import { useState, useEffect, useCallback } from "react";
import { IconFileCheck, IconPlus, IconSearch } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

  return (
    <section className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Service Agreements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Manage recurring service contracts and maintenance plans.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="h-4 w-4 mr-1.5" />
          Add Agreement
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agreements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <Card className="overflow-hidden">
          <TableSkeleton columns={7} rows={5} />
        </Card>
      ) : agreements.length === 0 && !search ? (
        <EmptyState
          icon={IconFileCheck}
          title="No service agreements yet"
          description="Create recurring service contracts to track maintenance schedules and revenue."
          actionLabel="Add Agreement"
          onAction={openCreateDialog}
        />
      ) : agreements.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No agreements found matching &quot;{search}&quot;
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <ServiceAgreementTable
              agreements={agreements}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
            />
          </Card>

          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchAgreements(p, search)}
              entityName="agreement"
            />
          )}
        </>
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
