"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { readUrlStatus, QUOTE_STATUSES } from "@/lib/url-filters";
import { useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queryKeys } from "@/lib/query-keys";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";
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
  IconClockX,
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
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  useQuotes,
  useQuoteStats,
  useCreateQuote,
  useDeleteQuote,
  useBulkArchiveQuotes,
  useBulkRestoreQuotes,
  useBulkDeleteQuotes,
  useTenantSettings,
  prefetchQuotes,
} from "@/hooks/queries";
import { useEventStream } from "@/hooks/use-event-stream";

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
  expired: number;
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
  const queryClient = useQueryClient();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("quotes");

  // UI state
  const [search, setSearch] = useState("");
  // Seeded from ?status= so dashboard drill-through links land pre-filtered.
  const [statusFilter, setStatusFilter] = useState(() =>
    readUrlStatus(QUOTE_STATUSES),
  );
  const [viewFilter, setViewFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortPopoverOpen, setSortPopoverOpen] = useState(false);
  const [page, setPage] = useState(1);
  const showingArchived = viewFilter === "archived";

  // Debounce search for query key
  const debouncedSearch = useDebouncedValue(search, 300);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, viewFilter, sortBy, sortOrder]);

  // ── Queries ────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    limit: 15,
    sortBy,
    sortOrder,
    showArchived: showingArchived || undefined,
  };

  // QUO-14: the server render fetched the list and the stats, passed them in,
  // and nothing read them — so every visit paid for both twice and still showed
  // a skeleton. Seed only the exact key the server rendered (the first page,
  // no filters), with an honest `updatedAt` so it refetches on schedule rather
  // than looking fresh forever.
  const isInitialParams =
    page === 1 &&
    !debouncedSearch &&
    !statusFilter &&
    !showingArchived &&
    sortBy === "createdAt" &&
    sortOrder === "desc";

  const quotesQuery = useQuotes(
    listParams,
    isInitialParams && initialQuotes.length > 0 && initialPagination
      ? { data: initialQuotes, pagination: initialPagination, error: null }
      : undefined,
  );
  const statsQuery = useQuoteStats(
    initialStats ? { data: initialStats, error: null } : undefined,
  );
  const tenantQuery = useTenantSettings();

  // Derived state
  const quotes = (quotesQuery.data?.data ?? []) as QuoteRow[];
  const pagination = (quotesQuery.data?.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 }) as PaginationInfo;
  const loading = quotesQuery.isPending;
  // QUO-05: `failed` is not `empty`. Without this a 500 rendered "No quotes
  // yet — Create your first estimate" over four zeroed KPI cards.
  const loadFailed =
    quotesQuery.isError || Boolean(quotesQuery.data?.error && !quotesQuery.data?.data);
  const statsFailed =
    statsQuery.isError || Boolean(statsQuery.data?.error && !statsQuery.data?.data);
  const rawStats = statsQuery.data?.data as QuoteStats | undefined;
  const stats = rawStats ?? { draft: 0, sent: 0, accepted: 0, declined: 0, expired: 0 };
  const defaultTaxRate = (prefetchedTaxRate !== "0" ? prefetchedTaxRate : tenantQuery.data?.data?.defaultTaxRate) ?? "0";

  // Prefetch next page
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchQuotes(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // Subscribe to real-time quote updates (e.g., customer accepts/declines online)
  useEventStream("quotes", "quote_updated", () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all });
  });

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useCreateQuote();
  const deleteMutation = useDeleteQuote();
  const bulkArchiveMut = useBulkArchiveQuotes();
  const bulkRestoreMut = useBulkRestoreQuotes();
  const bulkDeleteMutation = useBulkDeleteQuotes();

  // Derived mutation state
  const saving = createMutation.isPending;
  const bulkLoading = bulkArchiveMut.isPending || bulkRestoreMut.isPending || bulkDeleteMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────

  function handleCreate(data: QuoteFormData) {
    createMutation.mutate(
      {
        customerId: data.customerId,
        issuedDate: data.issuedDate || undefined,
        expiryDate: data.expiryDate || undefined,
        taxRate: data.taxRate,
        discountAmount: data.discountAmount || undefined,
        notes: data.notes || undefined,
        equipmentId: data.equipmentId || undefined,
        // Sent with the quote instead of looped afterwards. The old flow
        // created the quote, then fired one server action per line from here —
        // and because Next queues server actions, the dialog sat open for the
        // whole chain and stayed open entirely if any of them rejected, with
        // the quote already created behind it.
        lineItems: data.lineItems?.length
          ? data.lineItems.map((li, index) => ({
              description: li.description || undefined,
              itemType: li.itemType,
              quantity: li.quantity || undefined,
              unitPrice: li.unitPrice,
              sortOrder: index,
              ...(li.catalogItemId ? { catalogItemId: li.catalogItemId } : {}),
            }))
          : undefined,
      },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setCreateDialogOpen(false);
          const quoteId = res.data?.id;
          if (quoteId) {
            setSelectedQuoteId(quoteId);
            setSheetOpen(true);
          }
        },
      },
    );
  }

  function handleDelete() {
    if (!deletingQuote) return;
    deleteMutation.mutate(deletingQuote.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setDeleteDialogOpen(false);
        setDeletingQuote(null);
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
      router.push(`/quotes/${id}`);
      return;
    }
    setSelectedQuoteId(id);
    setSheetOpen(true);
  }

  const hasQuotes = quotes.length > 0;
  const showEmptyState =
    !loading && !loadFailed && !hasQuotes && !search && !statusFilter && !showingArchived;
  const showNoResults =
    !loading && !loadFailed && !hasQuotes && (!!search || !!statusFilter || showingArchived);

  if (loadFailed) {
    return (
      <section className="p-6">
        <LoadErrorState
          title="Couldn't load your quotes"
          message={quotesQuery.data?.error ?? undefined}
          onRetry={() => {
            quotesQuery.refetch();
            statsQuery.refetch();
          }}
          isRetrying={quotesQuery.isFetching}
        />
      </section>
    );
  }

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

      {/* Stats Cards — hidden rather than zeroed when the count query fails, so
          the cards never assert "0 accepted" on a 500 (QUO-05). */}
      {!showEmptyState && !statsFailed && (
        <StatsCards
          stats={[
            { label: "Draft", count: stats.draft, icon: IconFileText, color: "text-muted-foreground", bg: "bg-muted/50" },
            { label: "Sent", count: stats.sent, icon: IconSend, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
            { label: "Accepted", count: stats.accepted, icon: IconCircleCheck, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
            { label: "Declined", count: stats.declined, icon: IconX, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40" },
            { label: "Expired", count: stats.expired, icon: IconClockX, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
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
              onChange={(next) => {
                // The status tabs are hidden while Archived is showing, so a
                // status left applied here filters the list by a control the
                // user can no longer see — which reads as "the filters don't
                // work". Switching views clears it.
                if (next === "archived") setStatusFilter("");
                setViewFilter(next);
              }}
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
              <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90 font-body">
                <IconPlus className="mr-1.5 h-3.5 w-3.5" />
                New Quote
              </Button>
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
          onPageChange={(p) => setPage(p)}
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
        onDataChange={() => { quotesQuery.refetch(); statsQuery.refetch(); }}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        entityName="Quote"
        itemLabel={deletingQuote?.quoteNumber ?? ""}
        description="This will permanently remove the quote and all its line items."
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
