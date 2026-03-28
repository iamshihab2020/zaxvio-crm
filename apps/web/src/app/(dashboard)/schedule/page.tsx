import { SchedulePageClient } from "./schedule-page-client";

export const metadata = {
  title: "Schedule",
  description: "Calendar view of jobs and bookings",
};

export default function SchedulePage() {
  return <SchedulePageClient />;
}
