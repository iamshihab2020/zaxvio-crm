import { getAdminDashboard } from "@/actions/admin";
import { DashboardPageClient } from "./dashboard-page-client";

export default async function SuperAdminDashboardPage() {
  const result = await getAdminDashboard();
  const d = result.data;

  return (
    <DashboardPageClient
      mrr={d?.mrr ?? null}
      signups={d?.signups ?? null}
      activeUsers={d?.activeUsers ?? null}
      trialConversion={d?.trialConversion ?? null}
      totalTenants={d?.totalTenants ?? 0}
    />
  );
}
