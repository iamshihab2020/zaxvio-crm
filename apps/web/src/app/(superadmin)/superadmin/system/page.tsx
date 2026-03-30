import { getSystemHealth, getWebhookLogs, getCronHistory } from "@/actions/admin";
import { SystemPageClient } from "./system-page-client";

export default async function SystemPage() {
  const [healthResult, webhookResult, cronResult] = await Promise.all([
    getSystemHealth(),
    getWebhookLogs(100),
    getCronHistory(50),
  ]);

  return (
    <SystemPageClient
      health={healthResult.data}
      webhooks={webhookResult.data ?? []}
      crons={cronResult.data ?? []}
    />
  );
}
