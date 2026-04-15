"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Booking } from "@hvac-saas/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useBookings,
  useBookingStats,
  useUpdateBooking,
  useConvertBookingToJob,
  useCancelBooking,
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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BookingStats {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface BookingsPageClientProps {
  initialBookings?: Booking[];
  initialPagination?: PaginationInfo;
  tenantSlug?: string | null;
  initialStats?: BookingStats;
}

export function BookingsPageClient({
  initialBookings = [],
  initialPagination,
  tenantSlug: prefetchedSlug,
  initialStats,
}: BookingsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // UI state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Row selection
  const {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount,
  } = useRowSelection();

  // Bulk action state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
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

  // Reset page & selection when search/filter changes
  // (debouncedSearch drives the query, so page reset is immediate on raw search change)
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

  // ── Queries ────────────────────────────────────────────────

  const listParams = {
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    page,
    limit: 15,
    sortBy: "bookingDate",
    sortOrder: "asc",
  };

  const bookingsQuery = useBookings(listParams);
  const statsQuery = useBookingStats();
  const tenantQuery = useTenantSettings();

  // ── Derived state ──────────────────────────────────────────

  const bookings = (bookingsQuery.data?.data ?? []) as Booking[];
  const pagination = bookingsQuery.data?.pagination ?? { page: 1, limit: 15, total: 0, totalPages: 0 };
  const loading = bookingsQuery.isLoading;
  const stats = statsQuery.data?.data ?? { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  const tenantSlug = tenantQuery.data?.data?.slug ?? prefetchedSlug ?? null;

  // Prefetch next page
  const queryClient = useQueryClient();
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
  const bulkDeleteMutation = useBulkDeleteBookings();
  const bulkStatusMutation = useBulkUpdateBookingStatus();

  // Derive loading states from mutations
  const cancelLoading = cancelMutation.isPending;
  const convertLoading = convertMutation.isPending;
  const bulkLoading = bulkDeleteMutation.isPending || bulkStatusMutation.isPending;

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

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    bulkDeleteMutation.mutate(ids, {
      onSuccess: () => {
        setBulkDeleteOpen(false);
        clearSelection();
      },
    });
  }

  async function handleBulkStatusUpdate() {
    const ids = Array.from(selectedIds);
    bulkStatusMutation.mutate({ ids, status: bulkConfirmStatus }, {
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

  const handleConfirm = async (id: string) => {
    confirmMutation.mutate({ id, data: { status: "confirmed" } });
  };

  const handleCancelClick = (id: string) => {
    setCancelId(id);
    setCancelOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelId) return;
    cancelMutation.mutate(cancelId, {
      onSuccess: () => setCancelOpen(false),
    });
  };

  const handleConvertClick = (id: string) => {
    setConvertId(id);
    setConvertOpen(true);
  };

  const handleConvertConfirm = async (pipelineStageId: string) => {
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
  const showEmptyState = !loading && !hasBookings && !search && !statusFilter;
  const showNoResults = !loading && !hasBookings && (!!search || !!statusFilter);

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
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
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
              No bookings found{search ? <> matching &ldquo;{search}&rdquo;</> : " for this filter"}.
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
        onOpenChange={setSheetOpen}
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
        actions={[
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
            label: "Delete",
            icon: IconTrash,
            onClick: () => setBulkDeleteOpen(true),
            variant: "destructive",
          },
        ]}
      />

      {/* Bulk delete confirmation */}
      <BulkConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        loading={bulkLoading}
        title={`Delete ${selectedCount} Booking${selectedCount !== 1 ? "s" : ""}`}
        description={`This will permanently delete ${selectedCount} booking${selectedCount !== 1 ? "s" : ""}. This action cannot be undone.`}
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
