import { getAdminAnalytics } from "@/actions/admin";
import { AnalyticsPageClient } from "./analytics-page-client";

export default async function AnalyticsPage() {
  const result = await getAdminAnalytics();
  const d = result.data;

  return (
    <AnalyticsPageClient
      mrr={d?.mrr ?? null}
      signups={d?.signups ?? null}
      activeUsers={d?.activeUsers ?? null}
      trialConversion={d?.trialConversion ?? null}
      churnList={d?.churnList ?? null}
      inactiveAlerts={d?.inactiveAlerts ?? null}
      featureAdoption={d?.featureAdoption ?? null}
    />
  );
}
