import { getTenant } from "@/actions/tenants";
import { SchedulePageClient } from "./schedule-page-client";

export const metadata = {
  title: "Schedule",
  description: "Calendar view of jobs and bookings",
};

export default async function SchedulePage() {
  // Resolved on the server so the calendar opens on the *tenant's* today rather
  // than the browser's. A contractor working away from home, or a laptop with the
  // wrong zone, otherwise sees a calendar that disagrees with the dashboard
  // agenda about the same data (BOOK-25).
  const tenant = await getTenant();

  return <SchedulePageClient timezone={tenant.data?.timezone ?? "America/Chicago"} />;
}
