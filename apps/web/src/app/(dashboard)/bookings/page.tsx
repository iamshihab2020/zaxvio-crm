import type { Metadata } from "next";
import { getBookings, getBookingStats } from "@/actions/bookings";
import { getTenant } from "@/actions/tenants";
import { BookingsPageClient } from "./bookings-page-client";

export const metadata: Metadata = {
  title: "Bookings",
  description: "Manage customer bookings and appointments",
};

export default async function BookingsPage() {
  const [bookingsResult, tenantResult, statsResult] = await Promise.all([
    getBookings({ page: 1, limit: 15 }),
    getTenant(),
    getBookingStats(),
  ]);

  return (
    <BookingsPageClient
      initialBookings={(bookingsResult.data ?? []) as never[]}
      initialPagination={bookingsResult.pagination as never}
      tenantSlug={tenantResult.data?.slug ?? null}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
