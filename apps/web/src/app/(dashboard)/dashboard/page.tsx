import { getDashboardStats, type DashboardStatsParams } from "@/actions/dashboard";
import { DashboardPageClient } from "./dashboard-page-client";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  // The API defaults to month-to-date in the tenant's timezone when no range is
  // given. The client seeds its cache with this payload only if its own initial
  // params match, so the two must not drift — send no params, and let the client
  // open on the same default.
  const initialParams: DashboardStatsParams = {};
  const result = await getDashboardStats(initialParams);

  return (
    <DashboardPageClient
      initialStats={result.data ?? null}
      initialError={result.error}
      initialParams={initialParams}
      initialFetchedAt={Date.now()}
    />
  );
}
