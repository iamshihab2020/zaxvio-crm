"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import { toast } from "sonner";
import {
  IconPlus,
  IconSearch,
  IconFileText,
  IconSortDescending,
  IconSortAscending,
  IconCheck,
  IconSend,
  IconCircleCheck,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
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

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Created" },
  { value: "quoteNumber", label: "Quote #" },
  { value: "totalAmount", label: "Total Amount" },
  { value: "issuedDate", label: "Issued Date" },
  { value: "expiryDate", label: "Expiry Date" },
  { value: "status", label: "Status" },
];

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
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("quotes");
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [defaultTaxRate, setDefaultTaxRate] = useState("0");
  const [stats, setStats] = useState({ draft: 0, sent: 0, accepted: 0, declined: 0 });

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
        sortBy,
        sortOrder,
      });
      if (result.data) {
        setQuotes(result.data as QuoteRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationInfo);
        }
      }
      setLoading(false);
    },
    [search, statusFilter, sortBy, sortOrder],
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

  // Fetch stats
  useEffect(() => {
    async function loadStats() {
      const [draft, sent, accepted, declined] = await Promise.all([
        getQuotes({ status: "draft", limit: 1 }),
        getQuotes({ status: "sent", limit: 1 }),
        getQuotes({ status: "accepted", limit: 1 }),
        getQuotes({ status: "declined", limit: 1 }),
      ]);
      setStats({
        draft: draft.pagination?.total ?? 0,
        sent: sent.pagination?.total ?? 0,
        accepted: accepted.pagination?.total ?? 0,
        declined: declined.pagination?.total ?? 0,
      });
    }
    loadStats();
  }, [quotes]);

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
      // If last item on current page, go to previous page
      const targetPage =
        quotes.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchQuotes(targetPage);
    }
  }

  function handleRowClick(id: string) {
    if (viewMode === "page") {
      router.push(`/quotes/${id}`);
      return;
    }
    setSelectedQuoteId(id);
    setSheetOpen(true);
  }

  const hasQuotes = quotes.length > 0;
  const showEmptyState = !loading && !hasQuotes && !search && !statusFilter;
  const showNoResults = !loading && !hasQuotes && (!!search || !!statusFilter);

  return (
    <section className="p-6">
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

      {/* Stats Cards */}
      {/* Stats Cards */}
      {!showEmptyState && (
        <StatsCards
          stats={[
            { label: "Draft", count: stats.draft, icon: IconFileText, color: "text-muted-foreground", bg: "bg-muted/50" },
            { label: "Sent", count: stats.sent, icon: IconSend, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Accepted", count: stats.accepted, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Declined", count: stats.declined, icon: IconX, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
          ]}
          activeFilter={statusFilter}
          onFilterChange={setStatusFilter}
          className="mb-4"
        />
      )}

      {/* Card wrapper */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Search + filters */}
          <div className="border-b border-border px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search quotes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Popover open={sortPopoverOpen} onOpenChange={setSortPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 cursor-pointer shrink-0"
                  >
                    {sortOrder === "desc" ? (
                      <IconSortDescending className="h-4 w-4" />
                    ) : (
                      <IconSortAscending className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline text-xs font-body">
                      {SORT_OPTIONS.find((s) => s.value === sortBy)?.label ?? "Sort"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (sortBy === opt.value) {
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                        } else {
                          setSortBy(opt.value);
                          setSortOrder("desc");
                        }
                        setSortPopoverOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-muted font-body cursor-pointer"
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.value && (
                        <IconCheck className="h-3.5 w-3.5 text-brand" />
                      )}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              {viewMounted && (
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              )}
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="bg-brand text-brand-foreground hover:bg-brand/90 shrink-0"
              >
                <IconPlus className="mr-2 h-4 w-4" />
                New Quote
              </Button>
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
