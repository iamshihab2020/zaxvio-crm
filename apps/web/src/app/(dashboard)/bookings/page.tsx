import type { Metadata } from "next";
import type { Booking } from "@hvac-saas/types";
import { getBookings, getBookingStats } from "@/actions/bookings";
import { getTenant } from "@/actions/tenants";
import { BookingsPageClient, type BookingStats, type PaginationInfo } from "./bookings-page-client";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Manage customer bookings and appointments",
};

/**
 * Must match the client's first-page query params exactly, or the seeded cache
 * entry is written under a key nothing reads and the server work is wasted.
 */
export const INITIAL_BOOKINGS_PARAMS = {
  page: 1,
  limit: 15,
  sortBy: "bookingDate",
  sortOrder: "asc",
} as const;

export default async function BookingsPage() {
  const [bookingsResult, tenantResult, statsResult] = await Promise.all([
    getBookings(INITIAL_BOOKINGS_PARAMS),
    getTenant(),
    getBookingStats(),
  ]);

  return (
    <BookingsPageClient
      initialBookings={(bookingsResult.data ?? null) as Booking[] | null}
      initialPagination={(bookingsResult.pagination ?? null) as PaginationInfo | null}
      tenantSlug={tenantResult.data?.slug ?? null}
      initialStats={(statsResult.data ?? null) as BookingStats | null}
    />
  );
}
