import type { Metadata } from "next";
import { BookingsSettingsClient } from "./bookings-settings-client";

export const metadata: Metadata = {
  title: "Booking Settings",
  description: "Manage your availability and scheduling preferences",
};

export default function BookingsSettingsPage() {
  // Availability is fetched client-side through `useAvailability()` so this page
  // and the calendar share one cache key and one invalidation (BOOK-20).
  return <BookingsSettingsClient />;
}
