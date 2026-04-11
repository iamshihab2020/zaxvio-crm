"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconUsers, IconMail, IconPhone, IconMapPin, IconArchive, IconTrash, IconArchiveOff } from "@tabler/icons-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/reusable/page-header";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/reusable/search-input";
import { CustomerTable } from "@/components/dashboard/customers/customer-table";
import { CustomerDialog, type CustomerFormData } from "@/components/dashboard/customers/customer-dialog";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { EmptyState } from "@/components/reusable/empty-state";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  getCustomers,
  getCustomerStats,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  bulkArchiveCustomers,
  bulkRestoreCustomers,
  bulkDeleteCustomers,
} from "@/actions/customers";
import type { Customer } from "@hvac-saas/types";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CustomerStats {
  total: number;
  withEmail: number;
  withPhone: number;
  withAddress: number;
}

interface CustomersPageClientProps {
  initialCustomers?: Customer[];
  initialPagination?: PaginationData;
  initialStats?: CustomerStats;
}

export function CustomersPageClient({
  initialCustomers = [],
  initialPagination = { page: 1, limit: 15, total: 0, totalPages: 0 },
  initialStats,
}: CustomersPageClientProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [pagination, setPagination] = useState<PaginationData>(initialPagination);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState("");
  const [loading, setLoading] = useState(initialCustomers.length === 0);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats ?? { total: 0, withEmail: 0, withPhone: 0, withAddress: 0 });

  // Bulk selection
  const {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const showingArchived = viewFilter === "archived";

  // Refresh stats after mutations (single API call)
  async function refreshStats() {
    const result = await getCustomerStats();
    if (result.data) setStats(result.data);
  }

  const fetchCustomers = useCallback(
    async (page: number, searchTerm: string, archived = false) => {
      setLoading(true);
      const result = await getCustomers({ search: searchTerm, page, limit: 15, showArchived: archived || undefined });
      if (result.data) {
        setCustomers(result.data);
        setPagination(result.pagination ?? { page, limit: 15, total: 0, totalPages: 0 });
      }
      setLoading(false);
    },
    [],
  );

  // Fetch on mount (skip if server-prefetched)
  useEffect(() => {
    if (initialCustomers.length > 0) return;
    fetchCustomers(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(1, search, showingArchived);
    }, 300);
    clearSelection();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, viewFilter, fetchCustomers]);

  function handlePageChange(newPage: number) {
    fetchCustomers(newPage, search, showingArchived);
  }

  function openCreateDialog() {
    setEditingCustomer(null);
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setDialogOpen(true);
  }

  function openDeleteDialog(customer: Customer) {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  }

  async function handleSave(data: CustomerFormData) {
    setSaving(true);
    setError(null);
    if (editingCustomer) {
      const result = await updateCustomer(editingCustomer.id, data);
      if (result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        fetchCustomers(pagination.page, search);
        refreshStats();
      }
    } else {
      const result = await createCustomer(data);
      if (result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        fetchCustomers(1, search);
        refreshStats();
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deletingCustomer) return;
    setSaving(true);
    setError(null);
    const result = await deleteCustomer(deletingCustomer.id);
    if (result.error) {
      setError(result.error);
    } else {
      setDeleteDialogOpen(false);
      setDeletingCustomer(null);
      fetchCustomers(pagination.page, search);
      refreshStats();
    }
    setSaving(false);
  }

  // Bulk action handlers
  async function handleBulkArchive() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const result = showingArchived
      ? await bulkRestoreCustomers(ids)
      : await bulkArchiveCustomers(ids);
    setBulkLoading(false);
    setBulkArchiveOpen(false);
    clearSelection();
    fetchCustomers(pagination.page, search, showingArchived);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} customer(s) ${showingArchived ? "restored" : "archived"}`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} customer(s) could not be ${showingArchived ? "restored" : "archived"}`);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    const result = await bulkDeleteCustomers(Array.from(selectedIds));
    setBulkLoading(false);
    setBulkDeleteOpen(false);
    clearSelection();
    fetchCustomers(pagination.page, search, showingArchived);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} customer(s) permanently deleted`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} customer(s) could not be deleted`);
    }
  }

  const hasCustomers = customers.length > 0;
  const showEmptyState = !loading && !hasCustomers && !search && !showingArchived;
  const showNoResults = !loading && !hasCustomers && (!!search || showingArchived);

  return (
    <section className="p-6">
      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      <PageHeader
        title="Customers"
        subtitle="Manage your customer database and contact information."
        action={
          <Button onClick={openCreateDialog} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            Add Customer
          </Button>
        }
        className="mb-4"
      />

      {showEmptyState && (
        <EmptyState
          icon={IconUsers}
          title="No customers yet"
          description="Add your first customer to start scheduling jobs, sending invoices, and tracking service history."
          actionLabel="Add Your First Customer"
          onAction={openCreateDialog}
        />
      )}

      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Total", count: stats.total, icon: IconUsers, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "With Email", count: stats.withEmail, icon: IconMail, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "With Phone", count: stats.withPhone, icon: IconPhone, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
            { label: "With Address", count: stats.withAddress, icon: IconMapPin, color: "text-muted-foreground", bg: "bg-muted/50" },
          ]}
          className="mb-4"
        />
      )}

      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Filter tabs + search in card header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={[
                { value: "", label: "Active" },
                { value: "archived", label: "Archived" },
              ]}
              value={viewFilter}
              onChange={setViewFilter}
            />
            <div className="ml-auto">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name, email, or phone..."
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
              No customers found matching &ldquo;{search}&rdquo;
            </p>
          )}

          {!loading && hasCustomers && (
            <CustomerTable
              customers={customers}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onToggleSelectAll={() => toggleAll(customers)}
              isAllSelected={isAllSelected(customers)}
              isIndeterminate={isIndeterminate(customers)}
            />
          )}
        </div>
      )}

      {!loading && hasCustomers && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={handlePageChange}
          entityName="customer"
        />
      )}

      <CustomerDialog
        customer={editingCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        loading={saving}
      />

      <DeleteConfirmDialog
        entityName="Customer"
        itemLabel={deletingCustomer ? `${deletingCustomer.firstName} ${deletingCustomer.lastName}` : ""}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={saving}
        description="All jobs, invoices, and notes linked to this customer will also be removed."
      />

      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        loading={bulkLoading}
        actions={
          showingArchived
            ? [
                { label: "Restore", icon: IconArchiveOff, onClick: () => setBulkArchiveOpen(true) },
                { label: "Delete permanently", icon: IconTrash, onClick: () => setBulkDeleteOpen(true), variant: "destructive" as const },
              ]
            : [
                { label: "Archive", icon: IconArchive, onClick: () => setBulkArchiveOpen(true) },
                { label: "Delete", icon: IconTrash, onClick: () => setBulkDeleteOpen(true), variant: "destructive" as const },
              ]
        }
      />

      <BulkConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        onConfirm={handleBulkArchive}
        loading={bulkLoading}
        title={showingArchived ? "Restore customers" : "Archive customers"}
        description={`Are you sure you want to ${showingArchived ? "restore" : "archive"} ${selectedCount} customer(s)?`}
        confirmLabel={showingArchived ? "Restore" : "Archive"}
        variant={showingArchived ? "default" : "destructive"}
      />

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title="Delete customers permanently"
        description={`Are you sure you want to permanently delete ${selectedCount} customer(s)? This action cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="destructive"
      />
    </section>
  );
}
