import type { Metadata } from "next";
import { getConversations } from "@/actions/conversations";
import { getTenant } from "@/actions/tenants";
import { ConversationsPageClient } from "./conversations-page-client";

export const metadata: Metadata = {
  title: "Conversations — Zaxvio",
  description: "Send emails and messages to your customers",
};

export default async function ConversationsPage() {
  const [conversationsResult, tenantResult] = await Promise.all([
    getConversations(),
    getTenant(),
  ]);

  return (
    <ConversationsPageClient
      initialConversations={conversationsResult.data ?? []}
      tenantId={tenantResult.data?.id ?? null}
    />
  );
}
