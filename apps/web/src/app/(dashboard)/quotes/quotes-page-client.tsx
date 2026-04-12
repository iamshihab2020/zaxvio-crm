"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
import { toast } from "sonner";
import {
  IconPlus,
  IconFileText,
  IconSortDescending,
  IconSortAscending,
  IconCheck,
  IconSend,
  IconCircleCheck,
  IconX,
  IconArchive,
  IconArchiveOff,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
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
import { PageHeader } from "@/components/reusable/page-header";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  getQuotes,
  getQuoteStats,
  createQuote,
  deleteQuote,
  addQuoteLineItem,
  bulkArchiveQuotes,
  bulkRestoreQuotes,
  bulkDeleteQuotes,
} from "@/actions/quotes";
import { getTenant } from "@/actions/tenants";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

interface QuoteStats {
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
}

interface QuotesPageClientProps {
  initialQuotes?: QuoteRow[];
  initialPagination?: PaginationInfo;
  defaultTaxRate?: string;
  initialStats?: QuoteStats;
}

export function QuotesPageClient({
  initialQuotes = [],
  initialPagination,
  defaultTaxRate: prefetchedTaxRate = "0",
  initialStats,
}: QuotesPageClientProps) {
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("quotes");
  const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes);
  const [loading, setLoading] = useState(initialQuotes.length === 0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewFilter, setViewFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialPagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 },
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(prefetchedTaxRate);
  const [stats, setStats] = useState(initialStats ?? { draft: 0, sent: 0, accepted: 0, declined: 0 });

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingQuote, setDeletingQuote] = useState<QuoteDetail | null>(null);

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
        limit: 15,
        sortBy,
        sortOrder,
        showArchived: showingArchived || undefined,
      });
      if (result.data) {
        setQuotes(result.data as QuoteRow[]);
        if (result.pagination) {
          setPagination(result.pagination as PaginationInfo);
        }
      }
      setLoading(false);
    },
    [search, statusFilter, sortBy, sortOrder, showingArchived],
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

  // Fetch quotes on mount and on search/filter change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => fetchQuotes(1), 300);
    clearSelection();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuotes]);

  // Subscribe to real-time quote updates (e.g., customer accepts/declines online)
  useEffect(() => {
    let mounted = true;
    let channelRef: RealtimeChannel | null = null;

    async function subscribe() {
      const { data: tenant } = await getTenant();
      if (!tenant?.id || !mounted) return;

      const supabase = getSupabaseBrowserClient();
      channelRef = supabase
        .channel(`quotes:${tenant.id}`)
        .on("broadcast", { event: "quote_updated" }, () => {
          if (!mounted) return;
          fetchQuotes(pagination.page);
          refreshStats();
        })
        .subscribe();
    }

    void subscribe();

    return () => {
      mounted = false;
      if (channelRef) {
        const supabase = getSupabaseBrowserClient();
        void supabase.removeChannel(channelRef);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh stats after mutations (single API call)
  async function refreshStats() {
    const result = await getQuoteStats();
    if (result.data) setStats(result.data);
  }

  async function handleCreate(data: QuoteFormData) {
    setSaving(true);
    const result = await createQuote({
      customerId: data.customerId,
      issuedDate: data.issuedDate || undefined,
      expiryDate: data.expiryDate || undefined,
      taxRate: data.taxRate,
      discountAmount: data.discountAmount || undefined,
      notes: data.notes || undefined,
      equipmentId: data.equipmentId || undefined,
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
    refreshStats();
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
      const targetPage =
        quotes.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;
      fetchQuotes(targetPage);
      refreshStats();
    }
  }

  // Bulk action handlers
  async function handleBulkArchive() {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const result = showingArchived
      ? await bulkRestoreQuotes(ids)
      : await bulkArchiveQuotes(ids);
    setBulkLoading(false);
    setBulkArchiveOpen(false);
    clearSelection();
    fetchQuotes(pagination.page);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} quote(s) ${showingArchived ? "restored" : "archived"}`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} quote(s) could not be ${showingArchived ? "restored" : "archived"}`);
    }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    const result = await bulkDeleteQuotes(Array.from(selectedIds));
    setBulkLoading(false);
    setBulkDeleteOpen(false);
    clearSelection();
    fetchQuotes(pagination.page);
    refreshStats();
    if (result.succeeded > 0) {
      toast.success(`${result.succeeded} quote(s) permanently deleted`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} quote(s) could not be deleted`);
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
  const showEmptyState = !loading && !hasQuotes && !search && !statusFilter && !showingArchived;
  const showNoResults = !loading && !hasQuotes && (!!search || !!statusFilter || showingArchived);

  return (
    <section className="p-6">
      <PageHeader
        title="Quotes"
        subtitle="Prepare and send estimates to your customers."
        action={
          <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
            <IconPlus className="mr-1.5 h-3.5 w-3.5" />
            New Quote
          </Button>
        }
        className="mb-4"
      />

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
          {/* View toggle (Active/Archived) + Status tabs + search */}
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
                placeholder="Search quotes..."
              />
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
                    <Button
                      key={opt.value}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (sortBy === opt.value) {
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
                        } else {
                          setSortBy(opt.value);
                          setSortOrder("desc");
                        }
                        setSortPopoverOpen(false);
                      }}
                      className="w-full justify-between font-body"
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.value && (
                        <IconCheck className="h-3.5 w-3.5 text-brand" />
                      )}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
              {viewMounted && (
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              )}
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
            <QuoteTable
              quotes={quotes}
              onRowClick={handleRowClick}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
              onToggleSelectAll={() => toggleAll(quotes)}
              isAllSelected={isAllSelected(quotes)}
              isIndeterminate={isIndeterminate(quotes)}
            />
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
        onDataChange={() => { fetchQuotes(pagination.page); refreshStats(); }}
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
        title={showingArchived ? "Restore quotes" : "Archive quotes"}
        description={`Are you sure you want to ${showingArchived ? "restore" : "archive"} ${selectedCount} quote(s)?`}
        confirmLabel={showingArchived ? "Restore" : "Archive"}
        variant={showingArchived ? "default" : "destructive"}
      />

      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title="Delete quotes permanently"
        description={`Are you sure you want to permanently delete ${selectedCount} quote(s)? Only draft quotes can be deleted — others will be skipped. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="destructive"
      />
    </section>
  );
}
