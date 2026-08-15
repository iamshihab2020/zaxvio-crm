"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconUsers, IconMail, IconPhone, IconMapPin, IconArchive, IconTrash, IconArchiveOff, IconX } from "@tabler/icons-react";
import { queryKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
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
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useCustomers,
  useCustomerStats,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useBulkArchiveCustomers,
  useBulkRestoreCustomers,
  useBulkDeleteCustomers,
  prefetchCustomers,
} from "@/hooks/queries";
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
  archived?: number;
}

const DEFAULT_PAGINATION: PaginationData = { page: 1, limit: 15, total: 0, totalPages: 0 };
const DEFAULT_STATS: CustomerStats = { total: 0, withEmail: 0, withPhone: 0, withAddress: 0, archived: 0 };

export type CustomerSortKey = "createdAt" | "firstName" | "lastName" | "email";

interface CustomersPageClientProps {
  initialCustomers?: Customer[];
  initialPagination?: PaginationData;
  initialStats?: CustomerStats;
}

export function CustomersPageClient({
  initialCustomers = [],
  initialPagination = DEFAULT_PAGINATION,
  initialStats,
}: CustomersPageClientProps) {
  // UI state
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(initialPagination.page);
  const [viewFilter, setViewFilter] = useState("");
  const [sortBy, setSortBy] = useState<CustomerSortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [tagFilter, setTagFilter] = useState<{ id: string; name: string } | null>(null);
  const showingArchived = viewFilter === "archived";
  // Its own tab rather than a checkbox, because "who can I no longer email" is a
  // view of the list, not a modifier on one. It is deliberately NOT combined
  // with Archived: an unsubscribed customer is usually a *live* customer you
  // have to keep serving, and folding the two would suggest otherwise.
  const showingOptedOut = viewFilter === "unsubscribed";
  const debouncedSearch = useDebouncedValue(search, 300);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk selection
  const {
    selectedIds,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const listParams = {
    search: debouncedSearch,
    page,
    limit: 15,
    sortBy,
    sortOrder,
    showArchived: showingArchived || undefined,
    tagId: tagFilter?.id,
    optedOut: showingOptedOut || undefined,
  };

  // Seed the cache from the server render instead of throwing it away. The page
  // fetched customers and stats, passed both down, and the client never read
  // them — so every visit paid for two round trips and still showed a skeleton
  // (CUST-13, the same defect as BOOK-12). Seeded once, and only into the exact
  // key the server fetched, or changing a filter would show stale rows.
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    const seededAt = Date.now();
    if (initialCustomers.length > 0) {
      queryClient.setQueryData(
        queryKeys.customers.list({
          search: "",
          page: 1,
          limit: 15,
          sortBy: "createdAt",
          sortOrder: "desc",
          showArchived: undefined,
          tagId: undefined,
          // Present-and-undefined, mirroring `listParams`. The key has to be
          // byte-identical to the one the query builds or the seed lands
          // somewhere nothing reads — JOB-05 is the record of seeding a key the
          // page never asked for.
          optedOut: undefined,
        }),
        { data: initialCustomers, pagination: initialPagination, error: null },
        { updatedAt: seededAt },
      );
    }
    if (initialStats) {
      queryClient.setQueryData(
        queryKeys.customers.stats(),
        { data: initialStats, error: null },
        { updatedAt: seededAt },
      );
    }
  }

  const customersQuery = useCustomers(listParams);
  const statsQuery = useCustomerStats();

  const customers = customersQuery.data?.data ?? [];
  const pagination = customersQuery.data?.pagination ?? DEFAULT_PAGINATION;
  const loading = customersQuery.isLoading;
  const stats = statsQuery.data?.data ?? DEFAULT_STATS;

  // Prefetch next page
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchCustomers(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ──────────────────────────────────────────────
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const bulkArchiveMutation = useBulkArchiveCustomers();
  const bulkRestoreMutation = useBulkRestoreCustomers();
  const bulkDeleteMutation = useBulkDeleteCustomers();

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const bulkLoading = bulkArchiveMutation.isPending || bulkRestoreMutation.isPending || bulkDeleteMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────
  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
    clearSelection();
  }

  function handleViewFilterChange(value: string) {
    setViewFilter(value);
    setPage(1);
    clearSelection();
  }

  /** Click a column header to sort; click it again to flip direction (CUST-24). */
  function handleSortChange(key: CustomerSortKey) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder(key === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
    clearSelection();
  }

  function handleTagFilter(tag: { id: string; name: string } | null) {
    setTagFilter(tag);
    setPage(1);
    clearSelection();
  }

  function handleRestoreOne(customer: Customer) {
    bulkRestoreMutation.mutate([customer.id]);
  }

  function openCreateDialog() {
    setEditingCustomer(null);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer);
    setError(null);
    setDialogOpen(true);
  }

  function openDeleteDialog(customer: Customer) {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  }

  function handleSave(data: CustomerFormData) {
    setError(null);
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data }, {
        onSuccess: (res) => { if (!res.error) setDialogOpen(false); },
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: (res) => {
          if (!res.error) { setDialogOpen(false); setPage(1); }
        },
      });
    }
  }

  function handleDelete() {
    if (!deletingCustomer) return;
    setError(null);
    deleteMutation.mutate(deletingCustomer.id, {
      onSuccess: (res) => {
        if (!res.error) { setDeleteDialogOpen(false); setDeletingCustomer(null); }
      },
    });
  }

  function handleBulkArchive() {
    const ids = Array.from(selectedIds);
    const onDone = () => { setBulkArchiveOpen(false); clearSelection(); };
    if (showingArchived) {
      bulkRestoreMutation.mutate(ids, { onSuccess: onDone });
    } else {
      bulkArchiveMutation.mutate(ids, { onSuccess: onDone });
    }
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => { setBulkDeleteOpen(false); clearSelection(); },
    });
  }

  const hasCustomers = customers.length > 0;
  const loadFailed = customersQuery.isError || !!customersQuery.data?.error;
  const isFiltered = !!search || showingArchived || showingOptedOut || !!tagFilter;
  // A failed request must not read as "you have no customers" (CUST-02).
  const showEmptyState = !loading && !loadFailed && !hasCustomers && !isFiltered;
  const showNoResults = !loading && !loadFailed && !hasCustomers && isFiltered;

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
          {/* Filter tabs + search in card header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={[
                { value: "", label: "Active" },
                { value: "archived", label: "Archived" },
                { value: "unsubscribed", label: "Unsubscribed" },
              ]}
              value={viewFilter}
              onChange={handleViewFilterChange}
            />
            {/* Tag filter chip — set by clicking a tag in the table (CUST-12). */}
            {tagFilter && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Tagged &ldquo;{tagFilter.name}&rdquo;
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTagFilter(null)}
                  className="ml-0.5 h-4 w-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label="Clear tag filter"
                >
                  <IconX className="h-2.5 w-2.5" />
                </Button>
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by name, email, or phone..."
              />
              <Button onClick={openCreateDialog} size="sm" className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90 font-body">
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                Add Customer
              </Button>
            </div>
          </div>

          {loading && (
            <div className="p-4">
              <TableSkeleton columns={6} rows={5} />
            </div>
          )}

          {loadFailed && !loading && (
            <LoadErrorState
              title="Could not load customers"
              message={customersQuery.data?.error ?? "Something went wrong fetching this list."}
              onRetry={() => customersQuery.refetch()}
            />
          )}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              {search
                ? `No customers found matching “${search}”`
                : tagFilter
                  ? `No customers tagged “${tagFilter.name}”`
                  : showingOptedOut
                    ? "Nobody has unsubscribed. Every customer with an email address can still be reached."
                    : "No archived customers"}
            </p>
          )}

          {!loading && !loadFailed && hasCustomers && (
            <CustomerTable
              customers={customers}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onRestore={showingArchived ? handleRestoreOne : undefined}
              onTagClick={handleTagFilter}
              showingArchived={showingArchived}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
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
        // The old copy promised a cascade the API refuses to perform, and the
        // detail header promised a different one (CUST-18). This is what the
        // server actually does.
        description="Their notes, tags and activity history go with them. If they still have any jobs, invoices or quotes — archived ones included — the delete will be refused; archive the customer instead."
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
        description={`Permanently delete ${selectedCount} customer(s)? Anyone still linked to a job, invoice or quote will be skipped and reported back — the rest cannot be recovered.`}
        confirmLabel="Delete permanently"
        variant="destructive"
      />
    </section>
  );
}
