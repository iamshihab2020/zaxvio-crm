"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@hvac-saas/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queryKeys } from "@/lib/query-keys";
import {
  useBookings,
  useBookingStats,
  useUpdateBooking,
  useConvertBookingToJob,
  useCancelBooking,
  useBulkArchiveBookings,
  useBulkRestoreBookings,
  useBulkDeleteBookings,
  useBulkUpdateBookingStatus,
  useTenantSettings,
  prefetchBookings,
} from "@/hooks/queries";
import { BookingTable } from "@/components/dashboard/bookings/booking-table";
import { BookingDetailSheet } from "@/components/dashboard/bookings/booking-detail-sheet";
import { ConvertToJobDialog } from "@/components/reusable/convert-to-job-dialog";
import { Pagination } from "@/components/reusable/pagination";
import { TableSkeleton } from "@/components/reusable/table-skeleton";
import { EmptyState } from "@/components/reusable/empty-state";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { BulkActionBar } from "@/components/reusable/bulk-action-bar";
import { BulkConfirmDialog } from "@/components/reusable/bulk-confirm-dialog";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/reusable/search-input";
import { StatusFilterTabs } from "@/components/reusable/status-filter-tabs";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  IconCalendarEvent,
  IconCopy,
  IconCheck,
  IconSettings,
  IconExternalLink,
  IconLink,
  IconClock,
  IconCircleCheck,
  IconX,
  IconTrash,
  IconArchive,
  IconArchiveOff,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatsCards } from "@/components/dashboard/reusable/stats-cards";
import { PageHeader } from "@/components/reusable/page-header";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const VIEW_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BookingStats {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface BookingsPageClientProps {
  initialBookings?: Booking[] | null;
  initialPagination?: PaginationInfo | null;
  tenantSlug?: string | null;
  initialStats?: BookingStats | null;
}

const EMPTY_STATS: BookingStats = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };

export function BookingsPageClient({
  initialBookings,
  initialPagination,
  tenantSlug: prefetchedSlug,
  initialStats,
}: BookingsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // UI state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Row selection
  const {
    selectedIds,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();

  // Bulk action state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkConfirmStatus, setBulkConfirmStatus] = useState<string>("");

  // Sheet / Dialog state — auto-open from URL param (e.g., notification click)
  const bookingIdParam = searchParams.get("bookingId");
  const [sheetOpen, setSheetOpen] = useState(!!bookingIdParam);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(bookingIdParam);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertId, setConvertId] = useState<string | null>(null);

  // Deep links arriving after mount (in-app navigation from the calendar or a
  // notification) need to open the sheet too, not only a cold page load.
  useEffect(() => {
    if (!bookingIdParam) return;
    setSelectedBookingId(bookingIdParam);
    setSheetOpen(true);
  }, [bookingIdParam]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    clearSelection();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    clearSelection();
  };

  const handleViewChange = (value: string) => {
    setView(value === "archived" ? "archived" : "active");
    setPage(1);
    clearSelection();
  };

  // ── Queries ────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    limit: 15,
    sortBy: "bookingDate",
    sortOrder: "asc",
    ...(view === "archived" ? { showArchived: true } : {}),
  };

  // Seed the cache from the server render instead of throwing it away.
  // The page ran three server-side fetches and passed all three down; the client
  // destructured them and never read them, so the user saw a skeleton on every
  // visit anyway (BOOK-12). Seeded once, and only into the key the server
  // actually fetched — otherwise changing the filter shows stale rows.
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    const seededAt = Date.now();
    if (initialBookings && initialPagination) {
      queryClient.setQueryData(
        queryKeys.bookings.list({
          search: undefined,
          status: undefined,
          page: 1,
          limit: 15,
          sortBy: "bookingDate",
          sortOrder: "asc",
        }),
        { data: initialBookings, pagination: initialPagination, error: null },
        { updatedAt: seededAt },
      );
    }
    if (initialStats) {
      queryClient.setQueryData(
        queryKeys.bookings.stats(),
        { data: initialStats, error: null },
        { updatedAt: seededAt },
      );
    }
  }

  const bookingsQuery = useBookings(listParams);
  const statsQuery = useBookingStats();
  const tenantQuery = useTenantSettings();

  // ── Derived state ──────────────────────────────────────────

  const bookings = (bookingsQuery.data?.data ?? []) as Booking[];
  const pagination = bookingsQuery.data?.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 };
  const loading = bookingsQuery.isLoading;
  const listError =
    bookingsQuery.data?.error ?? (bookingsQuery.isError ? "Failed to load bookings" : null);
  const stats = statsQuery.data?.data ?? EMPTY_STATS;
  const tenantSlug = tenantQuery.data?.data?.slug ?? prefetchedSlug ?? null;

  // Prefetch next page
  useEffect(() => {
    if (pagination && page < pagination.totalPages) {
      prefetchBookings(queryClient, { ...listParams, page: page + 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pagination?.totalPages]);

  // ── Mutations ──────────────────────────────────────────────

  const confirmMutation = useUpdateBooking();
  const cancelMutation = useCancelBooking();
  const convertMutation = useConvertBookingToJob();
  const bulkArchiveMutation = useBulkArchiveBookings();
  const bulkRestoreMutation = useBulkRestoreBookings();
  const bulkDeleteMutation = useBulkDeleteBookings();
  const bulkStatusMutation = useBulkUpdateBookingStatus();

  const cancelLoading = cancelMutation.isPending;
  const convertLoading = convertMutation.isPending;
  const bulkLoading =
    bulkDeleteMutation.isPending ||
    bulkStatusMutation.isPending ||
    bulkArchiveMutation.isPending ||
    bulkRestoreMutation.isPending;

  // ── Handlers ───────────────────────────────────────────────

  const bookingUrl =
    tenantSlug && typeof window !== "undefined"
      ? `${window.location.origin}/book/${tenantSlug}`
      : null;

  const handleCopyLink = async () => {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Booking link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  function openBulkStatusConfirm(status: string) {
    setBulkConfirmStatus(status);
    setBulkConfirmOpen(true);
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setBulkDeleteOpen(false);
        clearSelection();
      },
    });
  }

  function handleBulkArchive() {
    const ids = Array.from(selectedIds);
    const mutation = view === "archived" ? bulkRestoreMutation : bulkArchiveMutation;
    mutation.mutate(ids, {
      onSuccess: () => {
        setBulkArchiveOpen(false);
        clearSelection();
      },
    });
  }

  function handleBulkStatusUpdate() {
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status: bulkConfirmStatus }, {
      onSuccess: () => {
        setBulkConfirmOpen(false);
        clearSelection();
      },
    });
  }

  const handleRowClick = (id: string) => {
    setSelectedBookingId(id);
    setSheetOpen(true);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    // Clear the deep-link param on close, so reopening the same booking works.
    if (!open && bookingIdParam) {
      router.replace("/bookings", { scroll: false });
    }
  };

  const handleConfirm = (id: string) => {
    confirmMutation.mutate({ id, data: { status: "confirmed" } });
  };

  const handleCancelClick = (id: string) => {
    setCancelId(id);
    setCancelOpen(true);
  };

  const handleCancelConfirm = () => {
    if (!cancelId) return;
    cancelMutation.mutate(cancelId, {
      onSuccess: () => setCancelOpen(false),
    });
  };

  const handleConvertClick = (id: string) => {
    setConvertId(id);
    setConvertOpen(true);
  };

  const handleConvertConfirm = (pipelineStageId: string) => {
    if (!convertId) return;
    convertMutation.mutate({ id: convertId, pipelineStageId }, {
      onSuccess: (res) => {
        setConvertOpen(false);
        if (!res.error && res.data?.id) {
          router.push(`/jobs/${res.data.id}`);
        }
      },
    });
  };

  const hasBookings = bookings.length > 0;
  const isFiltered = !!search || !!statusFilter || view === "archived";
  const showEmptyState = !loading && !listError && !hasBookings && !isFiltered;
  const showNoResults = !loading && !listError && !hasBookings && isFiltered;

  // Failed is not empty — an expired session must not read as "no bookings".
  if (!loading && !hasBookings && listError) {
    return (
      <section className="p-6">
        <PageHeader title="Bookings" subtitle="View and manage customer booking requests." className="mb-4" />
        <LoadErrorState
          title="Couldn't load your bookings"
          message={listError}
          onRetry={() => bookingsQuery.refetch()}
          isRetrying={bookingsQuery.isFetching}
        />
      </section>
    );
  }

  return (
    <section className="p-6">
      <PageHeader title="Bookings" subtitle="View and manage customer booking requests." className="mb-4" />

      {/* Booking Link Card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10">
              <IconLink className="h-5 w-5 text-brand" />
            </div>
            <div>
              <p className="text-sm font-semibold font-heading text-foreground">
                Your Booking Portal
              </p>
              {bookingUrl ? (
                <p className="text-xs text-muted-foreground font-body break-all">
                  {bookingUrl}
                </p>
              ) : (
                <Skeleton className="mt-1 h-3 w-48" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopyLink}
              disabled={!bookingUrl}
              className={cn(
                copied && "bg-green-600 text-white hover:bg-green-600 dark:bg-green-600 dark:text-white",
              )}
            >
              {copied ? (
                <>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <IconCopy className="mr-2 h-4 w-4" />
                  Copy Link
                </>
              )}
            </Button>
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
                  <IconExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </a>
            )}
            <Link href="/settings/bookings">
              <Button size="sm" variant="secondary">
                <IconSettings className="mr-2 h-4 w-4" />
                Availability
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <StatsCards
        stats={[
          { label: "Pending", count: stats.pending, icon: IconClock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
          { label: "Confirmed", count: stats.confirmed, icon: IconCircleCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
          { label: "Completed", count: stats.completed, icon: IconCalendarEvent, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
          { label: "Cancelled", count: stats.cancelled, icon: IconX, color: "text-muted-foreground", bg: "bg-muted/50" },
        ]}
        activeFilter={statusFilter}
        onFilterChange={handleStatusFilterChange}
        className="mb-4"
      />

      {/* Empty state — no bookings at all */}
      {showEmptyState && (
        <EmptyState
          icon={IconCalendarEvent}
          title="No bookings yet"
          description="Share your booking portal link with customers to start receiving appointment requests."
          actionLabel="Copy Booking Link"
          onAction={handleCopyLink}
        />
      )}

      {/* Card wrapper — search + filters + table */}
      {!showEmptyState && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Search + status pills inside card header */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            {/* Active/Archived — the API has had archive and restore since the
                bulk-actions work; the page exposed only hard Delete (BOOK-19). */}
            <StatusFilterTabs
              options={VIEW_OPTIONS}
              value={view}
              onChange={handleViewChange}
            />
            <span className="h-5 w-px bg-border" aria-hidden />
            <StatusFilterTabs
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={handleStatusFilterChange}
            />
            <div className="ml-auto flex items-center gap-2">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search bookings..."
              />
            </div>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="p-4">
              <TableSkeleton columns={7} rows={5} />
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="py-12 text-center text-sm text-muted-foreground font-body">
              {view === "archived"
                ? "No archived bookings."
                : <>No bookings found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.</>}
            </p>
          )}

          {/* Table */}
          {!loading && hasBookings && (
            <BookingTable
              bookings={bookings}
              onViewDetail={handleRowClick}
              onConfirm={handleConfirm}
              onConvert={handleConvertClick}
              onCancel={handleCancelClick}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={() => toggleAll(bookings)}
              isAllSelected={isAllSelected(bookings)}
              isIndeterminate={isIndeterminate(bookings)}
            />
          )}
        </div>
      )}

      {/* Pagination below card */}
      {!loading && hasBookings && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={(p) => setPage(p)}
          entityName="booking"
        />
      )}

      {/* Detail sheet */}
      <BookingDetailSheet
        bookingId={selectedBookingId}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        onConfirm={handleConfirm}
        onConvert={handleConvertClick}
        onCancel={handleCancelClick}
      />

      {/* Cancel confirmation */}
      <DeleteConfirmDialog
        entityName="booking"
        itemLabel="this booking"
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancelConfirm}
        loading={cancelLoading}
      />

      {/* Convert to job dialog */}
      <ConvertToJobDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConfirm={handleConvertConfirm}
        loading={convertLoading}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        loading={bulkLoading}
        actions={
          view === "archived"
            ? [
                {
                  label: "Restore",
                  icon: IconArchiveOff,
                  onClick: () => setBulkArchiveOpen(true),
                },
                {
                  label: "Delete",
                  icon: IconTrash,
                  onClick: () => setBulkDeleteOpen(true),
                  variant: "destructive",
                },
              ]
            : [
                {
                  label: "Mark Confirmed",
                  icon: IconCircleCheck,
                  onClick: () => openBulkStatusConfirm("confirmed"),
                },
                {
                  label: "Mark Completed",
                  icon: IconCheck,
                  onClick: () => openBulkStatusConfirm("completed"),
                },
                {
                  label: "Archive",
                  icon: IconArchive,
                  onClick: () => setBulkArchiveOpen(true),
                },
                {
                  label: "Delete",
                  icon: IconTrash,
                  onClick: () => setBulkDeleteOpen(true),
                  variant: "destructive",
                },
              ]
        }
      />

      {/* Bulk archive / restore confirmation */}
      <BulkConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        onConfirm={handleBulkArchive}
        loading={bulkLoading}
        title={
          view === "archived"
            ? `Restore ${selectedCount} Booking${selectedCount !== 1 ? "s" : ""}`
            : `Archive ${selectedCount} Booking${selectedCount !== 1 ? "s" : ""}`
        }
        description={
          view === "archived"
            ? `This will move ${selectedCount} booking${selectedCount !== 1 ? "s" : ""} back into your active list.`
            : `This hides ${selectedCount} booking${selectedCount !== 1 ? "s" : ""} from the active list. You can restore ${selectedCount !== 1 ? "them" : "it"} from the Archived tab at any time.`
        }
        confirmLabel={view === "archived" ? "Restore" : "Archive"}
        variant="default"
      />

      {/* Bulk delete confirmation */}
      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title={`Delete ${selectedCount} Booking${selectedCount !== 1 ? "s" : ""}`}
        description={`This permanently deletes ${selectedCount} booking${selectedCount !== 1 ? "s" : ""} and cannot be undone. Bookings already converted to a job will be skipped — archive those instead.`}
        confirmLabel="Delete"
        variant="destructive"
      />

      {/* Bulk status update confirmation */}
      <BulkConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        onConfirm={handleBulkStatusUpdate}
        loading={bulkLoading}
        title={`Update ${selectedCount} Booking${selectedCount !== 1 ? "s" : ""}`}
        description={`This will mark ${selectedCount} booking${selectedCount !== 1 ? "s" : ""} as ${bulkConfirmStatus}.`}
        confirmLabel="Update"
        variant="default"
      />
    </section>
  );
}
