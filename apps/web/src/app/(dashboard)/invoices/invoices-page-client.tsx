"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { readUrlStatus, INVOICE_STATUSES } from "@/lib/url-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import {
  IconPlus,
  IconFileInvoice,
  IconFileText,
  IconSend,
  IconCircleCheck,
  IconAlertTriangle,
  IconArchive,
  IconArchiveOff,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { PageHeader } from "@/components/reusable/page-header";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import {
  InvoiceTable,
  type InvoiceRow,
} from "@/components/dashboard/invoices/invoice-table";
import {
  InvoiceCreateDialog,
  type InvoiceFormData,
} from "@/components/dashboard/invoices/invoice-create-dialog";
import {
  InvoiceDetailSheet,
  type InvoiceDetail,
} from "@/components/dashboard/invoices/invoice-detail-sheet";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { useRowSelection } from "@/hooks/use-row-selection";
import { useQueryClient } from "@tanstack/react-query";
import {
  useInvoices,
  useInvoiceStats,
  useCreateInvoice,
  useDeleteInvoice,
  useBulkArchiveInvoices,
  useBulkRestoreInvoices,
  useBulkDeleteInvoices,
  useTenantSettings,
  prefetchInvoices,
} from "@/hooks/queries";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

const VIEW_OPTIONS = [
  { value: "", label: "Active" },
  { value: "archived", label: "Archived" },
];

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InvoiceStats {
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
}

interface InvoicesPageClientProps {
  initialInvoices?: InvoiceRow[];
  initialPagination?: PaginationInfo;
  defaultTaxRate?: string;
  initialStats?: InvoiceStats;
}

export function InvoicesPageClient({
  initialInvoices = [],
  initialPagination,
  defaultTaxRate: prefetchedTaxRate = "0",
  initialStats,
}: InvoicesPageClientProps) {
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("invoices");

  // UI state
  const [search, setSearch] = useState("");
  // Seeded from ?status= so dashboard drill-through links land pre-filtered.
  const [statusFilter, setStatusFilter] = useState(() =>
    readUrlStatus(INVOICE_STATUSES),
  );
  const [viewFilter, setViewFilter] = useState("");
  const [page, setPage] = useState(1);
  const showingArchived = viewFilter === "archived";

  // Debounce search for query key
  const debouncedSearch = useDebouncedValue(search, 300);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceDetail | null>(null);

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

  // Deep-link support
  const searchParams = useSearchParams();
  const handledInvoiceIdParam = useRef(false);

  useEffect(() => {
    const invoiceIdParam = searchParams.get("invoiceId");
    if (invoiceIdParam && !handledInvoiceIdParam.current) {
      handledInvoiceIdParam.current = true;
      setSelectedInvoiceId(invoiceIdParam);
      setSheetOpen(true);
    }
  }, [searchParams]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, viewFilter]);

  // ── Queries ────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    limit: 15,
    sortBy: "createdAt",
    sortOrder: "desc",
    showArchived: showingArchived || undefined,
  };

  const invoicesQuery = useInvoices(listParams);
  const statsQuery = useInvoiceStats();
  const tenantQuery = useTenantSettings();

  // Derived state
  const invoices = (invoicesQuery.data?.data ?? []) as InvoiceRow[];
  const pagination = (invoicesQuery.data?.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 }) as PaginationInfo;
  const loading = invoicesQuery.isPending;
  const rawStats = statsQuery.data?.data as InvoiceStats | undefined;
  const stats = rawStats ?? { draft: 0, sent: 0, paid: 0, overdue: 0 };
  const defaultTaxRate = (prefetchedTaxRate !== "0" ? prefetchedTaxRate : tenantQuery.data?.data?.defaultTaxRate) ?? "0";

  // Prefetch next page
  const queryClient = useQueryClient();
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchInvoices(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useCreateInvoice();
  const deleteMutation = useDeleteInvoice();
  const bulkArchiveMut = useBulkArchiveInvoices();
  const bulkRestoreMut = useBulkRestoreInvoices();
  const bulkDeleteMutation = useBulkDeleteInvoices();

  // Derived mutation state
  const saving = createMutation.isPending;
  const bulkLoading = bulkArchiveMut.isPending || bulkRestoreMut.isPending || bulkDeleteMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────

  function handleCreate(data: InvoiceFormData) {
    createMutation.mutate(
      {
        customerId: data.customerId,
        issuedDate: data.issuedDate || undefined,
        dueDate: data.dueDate || undefined,
        taxRate: data.taxRate,
        discountAmount: data.discountAmount || undefined,
        notes: data.notes || undefined,
      },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setCreateDialogOpen(false);
          if (res.data?.id) {
            setSelectedInvoiceId(res.data.id);
            setSheetOpen(true);
          }
        },
      },
    );
  }

  function handleDelete() {
    if (!deletingInvoice) return;
    deleteMutation.mutate(deletingInvoice.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setDeleteDialogOpen(false);
        setDeletingInvoice(null);
      },
    });
  }

  function handleBulkArchive() {
    const ids = Array.from(selectedIds);
    const mut = showingArchived ? bulkRestoreMut : bulkArchiveMut;
    mut.mutate(ids, {
      onSettled: () => {
        setBulkArchiveOpen(false);
        clearSelection();
      },
    });
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSettled: () => {
        setBulkDeleteOpen(false);
        clearSelection();
      },
    });
  }

  function handleRowClick(id: string) {
    if (viewMode === "page") {
      router.push(`/invoices/${id}`);
      return;
    }
    setSelectedInvoiceId(id);
    setSheetOpen(true);
  }

  const hasInvoices = invoices.length > 0;
  const showEmptyState = !loading && !hasInvoices && !search && !statusFilter && !showingArchived;
  const showNoResults = !loading && !hasInvoices && (!!search || !!statusFilter || showingArchived);

  return (
    <section className="p-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, send, and track payment for your invoices."
        action={
          <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            New Invoice
          </Button>
        }
        className="mb-4"
      />

      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Draft", count: stats.draft, icon: IconFileText, color: "text-muted-foreground", bg: "bg-muted/50" },
            { label: "Sent", count: stats.sent, icon: IconSend, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Paid", count: stats.paid, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Overdue", count: stats.overdue, icon: IconAlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
          ]}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
          className="mb-4"
        />
      )}

      {/* Empty state — no invoices at all */}
      {showEmptyState && (
        <EmptyState
          icon={IconFileInvoice}
          title="No invoices yet"
          description="Create your first invoice to start tracking payments and keeping your books organized."
          actionLabel="Create Your First Invoice"
          onAction={() => setCreateDialogOpen(true)}
        />
      )}

      {/* Card wrapper — search + filters + table */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* View toggle (Active/Archived) + Status tabs + search in card header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <StatusFilterTabs
              options={VIEW_OPTIONS}
              value={viewFilter}
              onChange={setViewFilter}
            />
            {!showingArchived && (
              <StatusFilterTabs
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            )}
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search invoices..."
              />
              {viewMounted && (
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              )}
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={7} rows={5} />
            </div>
          )}

          {/* No results for current filters */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No invoices found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {/* Table */}
          {!loading && hasInvoices && (
            <InvoiceTable
              invoices={invoices}
              onRowClick={handleRowClick}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onToggleSelectAll={() => toggleAll(invoices)}
              isAllSelected={isAllSelected(invoices)}
              isIndeterminate={isIndeterminate(invoices)}
            />
          )}
        </div>
      )}

      {/* Pagination below card */}
      {!loading && hasInvoices && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => setPage(p)}
          entityName="invoice"
        />
      )}

      {/* Create dialog */}
      <InvoiceCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={handleCreate}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
      />

      {/* Detail sheet */}
      <InvoiceDetailSheet
        invoiceId={selectedInvoiceId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDelete={(inv) => {
          setDeletingInvoice(inv);
          setDeleteDialogOpen(true);
        }}
        onDataChange={() => { invoicesQuery.refetch(); statsQuery.refetch(); }}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        entityName="Invoice"
        itemLabel={deletingInvoice?.invoiceNumber ?? ""}
        description="This will permanently remove the invoice and all its line items and payment records."
        loading={deleteMutation.isPending}
      />

      {/* Bulk action bar */}
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
        title={showingArchived ? "Restore invoices" : "Archive invoices"}
        description={`Are you sure you want to ${showingArchived ? "restore" : "archive"} ${selectedCount} invoice(s)?`}
        confirmLabel={showingArchived ? "Restore" : "Archive"}
        variant={showingArchived ? "default" : "destructive"}
      />

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title="Delete invoices permanently"
        description={`Are you sure you want to permanently delete ${selectedCount} invoice(s)? Only draft invoices can be deleted — others will be skipped. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="destructive"
      />
    </section>
  );
}
