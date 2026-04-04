import type { Metadata } from "next";
import { getAvailability } from "@/actions/bookings";
import { BookingsSettingsClient } from "./bookings-settings-client";

export const metadata: Metadata = {
  title: "Booking Settings",
  description: "Manage your availability and scheduling preferences",
};

export default async function BookingsSettingsPage() {
  const result = await getAvailability();

  return <BookingsSettingsClient initialData={result.data ?? undefined} />;
}
