"use client";

import { useState, useEffect, useRef } from "react";
import { PageActions } from "@/components/dashboard/page-actions";
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
  IconBan,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import {
  InvoiceTable,
  type InvoiceRow,
  type InvoiceSortKey,
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
import { formatMoney } from "@/lib/format";
import {
  useInvoices,
  useInvoiceStats,
  useCreateInvoice,
  useDeleteInvoice,
  useBulkArchiveInvoices,
  useBulkRestoreInvoices,
  useBulkDeleteInvoices,
  useBulkUpdateInvoiceStatus,
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

/** INV-38: 15 here versus 20 on every other list page. */
const PAGE_SIZE = 20;

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * INV-37: this declared 4 of the 6 counts the endpoint returns, so `partially_paid`
 * and `void` were filterable tabs with no card. It now matches the response,
 * including the two money totals the aging story needs.
 */
interface InvoiceStats {
  draft: number;
  sent: number;
  paid: number;
  overdue: number;
  partially_paid: number;
  void: number;
  outstanding: string;
  overdueAmount: string;
}

const ZERO_STATS: InvoiceStats = {
  draft: 0,
  sent: 0,
  paid: 0,
  overdue: 0,
  partially_paid: 0,
  void: 0,
  outstanding: "0.00",
  overdueAmount: "0.00",
};

interface InvoicesPageClientProps {
  initialInvoices?: InvoiceRow[];
  initialPagination?: PaginationInfo;
  defaultTaxRate?: string;
  initialStats?: InvoiceStats;
  /** When the server read the two initial payloads. See `canSeed*` below. */
  initialFetchedAt?: number;
}

export function InvoicesPageClient({
  initialInvoices = [],
  initialPagination,
  defaultTaxRate: prefetchedTaxRate = "0",
  initialStats,
  initialFetchedAt,
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
  const [sortBy, setSortBy] = useState<InvoiceSortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const showingArchived = viewFilter === "archived";

  const debouncedSearch = useDebouncedValue(search, 300);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);

  // Deep-link support
  const searchParams = useSearchParams();
  const handledInvoiceIdParam = useRef(false);

  useEffect(() => {
    const invoiceIdParam = searchParams.get("invoiceId");
    if (invoiceIdParam && !handledInvoiceIdParam.current) {
      handledInvoiceIdParam.current = true;
      setSelectedInvoiceId(invoiceIdParam);
      // §4.7: `?invoiceId=` always forced the sheet, even for a user who had
      // chosen full-page view.
      if (viewMounted && viewMode === "page") {
        router.push(`/invoices/${invoiceIdParam}`);
        return;
      }
      setSheetOpen(true);
    }
  }, [searchParams, viewMounted, viewMode, router]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, viewFilter, sortBy, sortOrder]);

  // INV-24: switching to Archived hid the status tabs but left `statusFilter`
  // in the query, so the user got "No invoices found" with no visible cause.
  useEffect(() => {
    if (showingArchived && statusFilter) setStatusFilter("");
  }, [showingArchived, statusFilter]);

  // ── Queries ────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
    sortBy,
    sortOrder,
    showArchived: showingArchived || undefined,
  };
  const statsParams = { showArchived: showingArchived || undefined };

  // Seed only the exact key the server rendered. Seeding unconditionally is the
  // defect the jobs audit fixed (JOB-05): change a filter and you get the
  // previous filter's rows for the whole staleTime and never refetch.
  const isServerRenderedList =
    page === 1 &&
    !debouncedSearch &&
    !statusFilter &&
    !showingArchived &&
    sortBy === "createdAt" &&
    sortOrder === "desc";

  const invoicesQuery = useInvoices(listParams, {
    canSeed: isServerRenderedList && initialInvoices.length > 0,
    initialData:
      initialInvoices.length > 0
        ? { data: initialInvoices, pagination: initialPagination, error: null }
        : undefined,
    initialFetchedAt,
  });
  const statsQuery = useInvoiceStats(statsParams, {
    canSeed: !showingArchived && !!initialStats,
    initialData: initialStats ? { data: initialStats, error: null } : undefined,
    initialFetchedAt,
  });
  const tenantQuery = useTenantSettings();

  // Derived state
  const invoices = (invoicesQuery.data?.data ?? []) as InvoiceRow[];
  const pagination = (invoicesQuery.data?.pagination ?? {
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  }) as PaginationInfo;
  const loading = invoicesQuery.isPending;

  // INV-10: `?? []` and `?? {draft:0,…}` with no `isError` branch anywhere in
  // the file, so an API outage rendered an empty table reading "No invoices
  // found for this filter" under four zeroed KPI cards. Failed is not empty.
  const listError =
    invoicesQuery.data?.error ?? (invoicesQuery.error ? "Network error" : null);
  const statsError =
    statsQuery.data?.error ?? (statsQuery.error ? "Network error" : null);

  const stats = (statsQuery.data?.data as InvoiceStats | undefined) ?? ZERO_STATS;
  const defaultTaxRate =
    (prefetchedTaxRate !== "0" ? prefetchedTaxRate : tenantQuery.data?.data?.defaultTaxRate) ?? "0";

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
  const bulkStatusMutation = useBulkUpdateInvoiceStatus();

  const saving = createMutation.isPending;
  const bulkLoading =
    bulkArchiveMut.isPending ||
    bulkRestoreMut.isPending ||
    bulkDeleteMutation.isPending ||
    bulkStatusMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────

  function handleSortChange(key: InvoiceSortKey) {
    if (key === sortBy) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    // Dates and money read most usefully newest/largest first; text ascending.
    setSortOrder(key === "invoiceNumber" || key === "status" ? "asc" : "desc");
  }

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

  function handleBulkVoid() {
    bulkStatusMutation.mutate(
      { ids: Array.from(selectedIds), status: "void" },
      {
        onSettled: () => {
          setBulkVoidOpen(false);
          clearSelection();
        },
      },
    );
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
  const showEmptyState =
    !loading && !listError && !hasInvoices && !search && !statusFilter && !showingArchived;
  const showNoResults =
    !loading && !listError && !hasInvoices && (!!search || !!statusFilter || showingArchived);

  return (
    <section className="p-6">
      <PageActions>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90 font-body"
        >
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          New Invoice
        </Button>
      </PageActions>

      {/* Stats Cards */}
      {!showEmptyState && !statsError && (
        <>
          <StatsCards
            stats={[
              { label: "Draft", count: stats.draft, icon: IconFileText, color: "text-muted-foreground", bg: "bg-muted/50" },
              { label: "Sent", count: stats.sent, icon: IconSend, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
              { label: "Paid", count: stats.paid, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
              { label: "Overdue", count: stats.overdue, icon: IconAlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
            ]}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
            className="mb-3"
          />
          {/*
            §4.5: the page where you chase money showed four counts, while the
            aging that tells you *which* money to chase lived on the dashboard.
          */}
          <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-border bg-card px-4 py-3">
            <div>
              <p className="text-xs text-muted-foreground font-body">Outstanding</p>
              <p className="font-heading text-lg font-semibold text-foreground">
                {formatMoney(stats.outstanding)}
              </p>
            </div>
            <div className="border-l border-border pl-4">
              <p className="text-xs text-muted-foreground font-body">Overdue</p>
              <p
                className={`font-heading text-lg font-semibold ${
                  parseFloat(stats.overdueAmount) > 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}
              >
                {formatMoney(stats.overdueAmount)}
              </p>
            </div>
            {stats.partially_paid > 0 && (
              <div className="border-l border-border pl-4">
                <p className="text-xs text-muted-foreground font-body">Partially paid</p>
                <p className="font-heading text-lg font-semibold text-foreground">
                  {stats.partially_paid}
                </p>
              </div>
            )}
          </div>
        </>
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

      {/* INV-10: an outage says so instead of claiming you have no invoices. */}
      {listError && (
        <LoadErrorState
          title="Couldn't load your invoices"
          message={listError}
          isRetrying={invoicesQuery.isFetching}
          onRetry={() => {
            invoicesQuery.refetch();
            statsQuery.refetch();
          }}
        />
      )}

      {/* Card wrapper — search + filters + table */}
      {!showEmptyState && !listError && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
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

          {loading && (
            <div className="p-4">
              <TableSkeleton columns={8} rows={5} />
            </div>
          )}

          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No invoices found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {!loading && hasInvoices && (
            <InvoiceTable
              invoices={invoices}
              onRowClick={handleRowClick}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onToggleSelectAll={() => toggleAll(invoices)}
              isAllSelected={isAllSelected(invoices)}
              isIndeterminate={isIndeterminate(invoices)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
            />
          )}
        </div>
      )}

      {/* Pagination below card */}
      {!loading && !listError && hasInvoices && pagination.totalPages > 1 && (
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
        onDataChange={() => {
          invoicesQuery.refetch();
          statsQuery.refetch();
        }}
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
                // INV-26: `bulkUpdateInvoiceStatus` was a fully-wired dead path —
                // server action and endpoint existed, no hook and no UI reached
                // them. Void is the one bulk transition that makes sense.
                { label: "Void", icon: IconBan, onClick: () => setBulkVoidOpen(true) },
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
        open={bulkVoidOpen}
        onOpenChange={setBulkVoidOpen}
        onConfirm={handleBulkVoid}
        loading={bulkLoading}
        title="Void invoices"
        description={`Void ${selectedCount} invoice(s)? Paid and already-void invoices will be skipped. Voiding cannot be undone.`}
        confirmLabel="Void"
        variant="destructive"
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
