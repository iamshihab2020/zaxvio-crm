import { getReportStats, type ReportStatsParams } from "@/actions/reports";
import { ReportsPageClient } from "./reports-page-client";

export const metadata = {
  title: "Reports & Analytics",
};

export default async function ReportsPage() {
  // Reports was the only major page with no server-side prefetch, so every
  // visit opened on a full-page skeleton. Send no range: the API resolves
  // month-to-date in the tenant's timezone and echoes it back, and the client
  // opens on exactly the same params so its cache seeds instead of refetching.
  const initialParams: ReportStatsParams = { section: "revenue" };
  const initialReport = await getReportStats(initialParams);

  return (
    <ReportsPageClient
      initialReport={initialReport}
      initialParams={initialParams}
      initialFetchedAt={Date.now()}
    />
  );
}
