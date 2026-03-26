"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  IconPlus,
  IconSearch,
  IconFileText,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  QuoteTable,
  type QuoteRow,
} from "@/components/dashboard/quotes/quote-table";
import {
  QuoteCreateDialog,
  type QuoteFormData,
} from "@/components/dashboard/quotes/quote-create-dialog";
import {
  QuoteDetailSheet,
  type QuoteDetail,
} from "@/components/dashboard/quotes/quote-detail-sheet";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { EmptyState } from "@/components/reusable/empty-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import {
  getQuotes,
  createQuote,
  deleteQuote,
  addQuoteLineItem,
} from "@/actions/quotes";
import { getTenant } from "@/actions/tenants";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function QuotesPageClient() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
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
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState<QuoteDetail | null>(null);

  // Deep-link support
  const searchParams = useSearchParams();
  const handledQuoteIdParam = useRef(false);

  useEffect(() => {
    const quoteIdParam = searchParams.get("quoteId");
    if (quoteIdParam && !handledQuoteIdParam.current) {
      handledQuoteIdParam.current = true;
      setSelectedQuoteId(quoteIdParam);
      setSheetOpen(true);
    }
  }, [searchParams]);

  const fetchQuotes = useCallback(
    async (page = 1) => {
      setLoading(true);
      const result = await getQuotes({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      if (result.data) {
        setQuotes(result.data as QuoteRow[]);
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

  // Fetch quotes on mount and on search/filter change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => fetchQuotes(1), 300);
    return () => clearTimeout(timer);
  }, [fetchQuotes]);

  async function handleCreate(data: QuoteFormData) {
    setSaving(true);
    const result = await createQuote({
      customerId: data.customerId,
      issuedDate: data.issuedDate || undefined,
      expiryDate: data.expiryDate || undefined,
      taxRate: data.taxRate,
      discountAmount: data.discountAmount || undefined,
      notes: data.notes || undefined,
    });
    if (result.error) {
      setSaving(false);
      toast.error(result.error);
      return;
    }

    // Add line items if any were provided during creation
    const quoteId = result.data?.id;
    if (quoteId && data.lineItems && data.lineItems.length > 0) {
      for (const li of data.lineItems) {
        await addQuoteLineItem(quoteId, {
          description: li.description,
          itemType: li.itemType,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          ...(li.catalogItemId ? { catalogItemId: li.catalogItemId } : {}),
        });
      }
    }

    setSaving(false);
    toast.success("Quote created");
    setCreateDialogOpen(false);
    fetchQuotes(1);
    if (quoteId) {
      setSelectedQuoteId(quoteId);
      setSheetOpen(true);
    }
  }

  async function handleDelete() {
    if (!deletingQuote) return;
    const result = await deleteQuote(deletingQuote.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quote deleted");
      setDeleteDialogOpen(false);
      setDeletingQuote(null);
      fetchQuotes(pagination.page);
    }
  }

  function handleRowClick(id: string) {
    setSelectedQuoteId(id);
    setSheetOpen(true);
  }

  const hasQuotes = quotes.length > 0;
  const showEmptyState = !loading && !hasQuotes && !search && !statusFilter;
  const showNoResults = !loading && !hasQuotes && (!!search || !!statusFilter);

  return (
    <section className="p-6" aria-labelledby="quotes-heading">
      {/* Header row */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1
            id="quotes-heading"
            className="font-heading text-2xl font-bold text-foreground"
          >
            Quotes
          </h1>
          {!loading && (
            <p className="mt-1 text-sm text-muted-foreground font-body">
              {pagination.total} {pagination.total === 1 ? "quote" : "quotes"} total
            </p>
          )}
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconPlus className="mr-2 h-4 w-4" />
          New Quote
        </Button>
      </div>

      {/* Empty state */}
      {showEmptyState && (
        <EmptyState
          icon={IconFileText}
          title="No quotes yet"
          description="Create your first estimate to start sending professional quotes to your customers."
          actionLabel="Create Your First Quote"
          onAction={() => setCreateDialogOpen(true)}
        />
      )}

      {/* Card wrapper */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Search + filters */}
          <div className="border-b border-border px-4 py-3 space-y-3">
            <div className="relative max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
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

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={6} rows={5} />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              No quotes found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
            </p>
          )}

          {/* Table */}
          {!loading && hasQuotes && (
            <QuoteTable quotes={quotes} onRowClick={handleRowClick} />
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && hasQuotes && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => fetchQuotes(p)}
          entityName="quote"
        />
      )}

      {/* Create dialog */}
      <QuoteCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSave={handleCreate}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
      />

      {/* Detail sheet */}
      <QuoteDetailSheet
        quoteId={selectedQuoteId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onDelete={(q) => {
          setDeletingQuote(q);
          setDeleteDialogOpen(true);
        }}
        onDataChange={() => fetchQuotes(pagination.page)}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        entityName="Quote"
        itemLabel={deletingQuote?.quoteNumber ?? ""}
        description="This will permanently remove the quote and all its line items."
        loading={false}
      />
    </section>
  );
}
