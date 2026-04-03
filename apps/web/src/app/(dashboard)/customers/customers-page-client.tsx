"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconUsers, IconMail, IconPhone, IconMapPin } from "@tabler/icons-react";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerTable } from "@/components/dashboard/customers/customer-table";
import { CustomerDialog, type CustomerFormData } from "@/components/dashboard/customers/customer-dialog";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { EmptyState } from "@/components/reusable/empty-state";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/actions/customers";
import type { Customer } from "@hvac-saas/types";

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function CustomersPageClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, withEmail: 0, withPhone: 0, withAddress: 0 });

  // Compute stats from all customers
  useEffect(() => {
    async function loadStats() {
      const result = await getCustomers({ limit: 9999 });
      if (result.data) {
        const all = result.data as Customer[];
        setStats({
          total: all.length,
          withEmail: all.filter((c: Customer) => c.email).length,
          withPhone: all.filter((c: Customer) => c.phone).length,
          withAddress: all.filter((c: Customer) => c.address || c.city).length,
        });
      }
    }
    loadStats();
  }, [customers]);

  const fetchCustomers = useCallback(
    async (page: number, searchTerm: string) => {
      setLoading(true);
      const result = await getCustomers({ search: searchTerm, page, limit: 15 });
      if (result.data) {
        setCustomers(result.data);
        setPagination(result.pagination ?? { page, limit: 15, total: 0, totalPages: 0 });
      }
      setLoading(false);
    },
    [],
  );

  // Fetch on mount
  useEffect(() => {
    fetchCustomers(1, "");
  }, [fetchCustomers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(1, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchCustomers]);

  function handlePageChange(newPage: number) {
    fetchCustomers(newPage, search);
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
      }
    } else {
      const result = await createCustomer(data);
      if (result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        fetchCustomers(1, search);
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
    }
    setSaving(false);
  }

  const hasCustomers = customers.length > 0;
  const showEmptyState = !loading && !hasCustomers && !search;
  const showNoResults = !loading && !hasCustomers && !!search;

  return (
    <section className="p-6">
      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

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
          {/* Search bar + action inside card header */}
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="relative max-w-sm flex-1">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={openCreateDialog}
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90 shrink-0"
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
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
    </section>
  );
}
