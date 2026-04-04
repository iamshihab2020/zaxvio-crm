"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import { toast } from "sonner";
import {
  IconPlus,
  IconSearch,
  IconFileInvoice,
  IconFileText,
  IconSend,
  IconCircleCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
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
import {
  getInvoices,
  createInvoice,
  deleteInvoice,
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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface InvoicesPageClientProps {
  initialInvoices?: InvoiceRow[];
  initialPagination?: PaginationInfo;
  defaultTaxRate?: string;
}

export function InvoicesPageClient({
  initialInvoices = [],
  initialPagination,
  defaultTaxRate: prefetchedTaxRate = "0",
}: InvoicesPageClientProps) {
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("invoices");
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [loading, setLoading] = useState(initialInvoices.length === 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialPagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 },
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(prefetchedTaxRate);
  const [stats, setStats] = useState({ draft: 0, sent: 0, paid: 0, overdue: 0 });

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceDetail | null>(
    null,
  );

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
      });
      if (result.data) {
        setInvoices(result.data as InvoiceRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationInfo);
        }
      }
      setLoading(false);
    },
    [search, statusFilter],
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
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

  // Fetch stats
  useEffect(() => {
    async function loadStats() {
      const [draft, sent, paid, overdue] = await Promise.all([
        getInvoices({ status: "draft", limit: 1 }),
        getInvoices({ status: "sent", limit: 1 }),
        getInvoices({ status: "paid", limit: 1 }),
        getInvoices({ status: "overdue", limit: 1 }),
      ]);
      setStats({
        draft: draft.pagination?.total ?? 0,
        sent: sent.pagination?.total ?? 0,
        paid: paid.pagination?.total ?? 0,
        overdue: overdue.pagination?.total ?? 0,
      });
    }
    loadStats();
  }, [invoices]);

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
  const showEmptyState = !loading && !hasInvoices && !search && !statusFilter;
  const showNoResults = !loading && !hasInvoices && (!!search || !!statusFilter);

  return (
    <section className="p-6">
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
          {/* Search + filters in card header */}
          <div className="border-b border-border px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {viewMounted && (
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              )}
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90 shrink-0"
              >
                <IconPlus className="mr-2 h-4 w-4" />
                New Invoice
              </Button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium font-body h-auto",
                    statusFilter === opt.value
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {opt.label}
                </Button>
              ))}
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
            <InvoiceTable invoices={invoices} onRowClick={handleRowClick} />
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
        onDataChange={() => fetchInvoices(pagination.page)}
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
    </section>
  );
}
