"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  IconPlus,
  IconSearch,
  IconFileInvoice,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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

export function InvoicesPageClient() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [defaultTaxRate, setDefaultTaxRate] = useState("0");

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

  const fetchInvoices = useCallback(
    async (page = 1) => {
      setLoading(true);
      const result = await getInvoices({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
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

  // Fetch tenant for default tax rate
  useEffect(() => {
    getTenant().then((res) => {
      if (res.data?.defaultTaxRate) {
        setDefaultTaxRate(res.data.defaultTaxRate);
      }
    });
  }, []);

  // Fetch invoices on mount and on search/filter change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => fetchInvoices(1), 300);
    return () => clearTimeout(timer);
  }, [fetchInvoices]);

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
    setSelectedInvoiceId(id);
    setSheetOpen(true);
  }

  const hasInvoices = invoices.length > 0;
  const showEmptyState = !loading && !hasInvoices && !search && !statusFilter;
  const showNoResults = !loading && !hasInvoices && (!!search || !!statusFilter);

  return (
    <section className="p-6" aria-labelledby="invoices-heading">
      {/* Header row — title + action button */}
      <div className="mb-6 flex items-center justify-between">
        <h1
          id="invoices-heading"
          className="font-heading text-2xl font-bold text-foreground"
        >
          Invoices
        </h1>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Search + status filters */}
      {!showEmptyState && (
        <div className="mb-4 space-y-3">
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer font-body",
                  statusFilter === opt.value
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <TableSkeleton columns={7} rows={5} />}

      {/* Empty state — no invoices at all */}
      {showEmptyState && (
        <EmptyState
          icon={IconFileInvoice}
          title="No invoices yet"
          description="Create your first invoice to start tracking payments."
          actionLabel="New Invoice"
          onAction={() => setCreateDialogOpen(true)}
        />
      )}

      {/* No results for current filters */}
      {showNoResults && (
        <p className="py-12 text-center text-sm text-muted-foreground font-body">
          No invoices found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
        </p>
      )}

      {/* Table + pagination */}
      {!loading && hasInvoices && (
        <>
          <InvoiceTable invoices={invoices} onRowClick={handleRowClick} />
          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={(p) => fetchInvoices(p)}
              entityName="invoice"
            />
          )}
        </>
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
        loading={false}
      />
    </section>
  );
}
