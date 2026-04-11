"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import { toast } from "sonner";
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
import {
  getInvoices,
  getInvoiceStats,
  createInvoice,
  deleteInvoice,
  bulkArchiveInvoices,
  bulkRestoreInvoices,
  bulkDeleteInvoices,
} from "@/actions/invoices";
import { getTenant } from "@/actions/tenants";

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
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [loading, setLoading] = useState(initialInvoices.length === 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewFilter, setViewFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialPagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 },
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(prefetchedTaxRate);
  const [stats, setStats] = useState(initialStats ?? { draft: 0, sent: 0, paid: 0, overdue: 0 });

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const showingArchived = viewFilter === "archived";

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

  const fetchInvoices = useCallback(
    async (page = 1) => {
      setLoading(true);
      const result = await getInvoices({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 15,
        sortBy: "createdAt",
        sortOrder: "desc",
        showArchived: showingArchived || undefined,
      });
      if (result.data) {
        setInvoices(result.data as InvoiceRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationInfo);
        }
      }
      setLoading(false);
    },
    [search, statusFilter, showingArchived],
  );

  // Fetch tenant for default tax rate (skip if server-prefetched)
  useEffect(() => {
    if (prefetchedTaxRate !== "0") return;
    getTenant().then((res) => {
      if (res.data?.defaultTaxRate) {
        setDefaultTaxRate(res.data.defaultTaxRate);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch invoices on mount and on search/filter change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => fetchInvoices(1), 300);
    clearSelection();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInvoices]);

  // Refresh stats after mutations (single API call)
  async function refreshStats() {
    const result = await getInvoiceStats();
    if (result.data) setStats(result.data);
  }

  async function handleCreate(data: InvoiceFormData) {
    setSaving(true);
    const result = await createInvoice({
      customerId: data.customerId,
      issuedDate: data.issuedDate || undefined,
      dueDate: data.dueDate || undefined,
      taxRate: data.taxRate,
      discountAmount: data.discountAmount || undefined,
      notes: data.notes || undefined,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice created");
      setCreateDialogOpen(false);
      fetchInvoices(1);
      refreshStats();
      if (result.data?.id) {
        setSelectedInvoiceId(result.data.id);
        setSheetOpen(true);
      }
    }
  }

  async function handleDelete() {
    if (!deletingInvoice) return;
    const result = await deleteInvoice(deletingInvoice.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice deleted");
      setDeleteDialogOpen(false);
      setDeletingInvoice(null);
      fetchInvoices(pagination.page);
      refreshStats();
    }
  }

  // Bulk action handlers
  async function handleBulkArchive() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const result = showingArchived
      ? await bulkRestoreInvoices(ids)
      : await bulkArchiveInvoices(ids);
    setBulkLoading(false);
    setBulkArchiveOpen(false);
    clearSelection();
    fetchInvoices(pagination.page);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} invoice(s) ${showingArchived ? "restored" : "archived"}`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} invoice(s) could not be ${showingArchived ? "restored" : "archived"}`);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    const result = await bulkDeleteInvoices(Array.from(selectedIds));
    setBulkLoading(false);
    setBulkDeleteOpen(false);
    clearSelection();
    fetchInvoices(pagination.page);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} invoice(s) permanently deleted`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} invoice(s) could not be deleted`);
    }
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
          onPageChange={(p) => fetchInvoices(p)}
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
        onDataChange={() => { fetchInvoices(pagination.page); refreshStats(); }}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        entityName="Invoice"
        itemLabel={deletingInvoice?.invoiceNumber ?? ""}
        description="This will permanently remove the invoice and all its line items and payment records."
        loading={false}
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
