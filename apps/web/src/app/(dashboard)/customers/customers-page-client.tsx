"use client";

import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconUsers } from "@tabler/icons-react";
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
    limit: 20,
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

  const fetchCustomers = useCallback(
    async (page: number, searchTerm: string) => {
      setLoading(true);
      const result = await getCustomers({ search: searchTerm, page, limit: 20 });
      if (result.data) {
        setCustomers(result.data);
        setPagination(result.pagination ?? { page, limit: 20, total: 0, totalPages: 0 });
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
    <section className="p-6" aria-labelledby="customers-heading">
      <div className="mb-6 flex items-center justify-between">
        <h1
          id="customers-heading"
          className="font-heading text-2xl font-bold text-foreground"
        >
          Customers
        </h1>
        <Button
          onClick={openCreateDialog}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive font-body">
          {error}
        </div>
      )}

      {!showEmptyState && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {loading && <TableSkeleton columns={6} rows={5} />}

      {showEmptyState && (
        <EmptyState
          icon={IconUsers}
          title="No customers yet"
          description="Add your first customer to get started."
          actionLabel="Add Customer"
          onAction={openCreateDialog}
        />
      )}

      {showNoResults && (
        <p className="py-12 text-center text-sm text-muted-foreground font-body">
          No customers found matching &ldquo;{search}&rdquo;
        </p>
      )}

      {!loading && hasCustomers && (
        <>
          <CustomerTable
            customers={customers}
            onEdit={openEditDialog}
            onDelete={openDeleteDialog}
          />
          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={handlePageChange}
              entityName="customer"
            />
          )}
        </>
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
      />
    </section>
  );
}
