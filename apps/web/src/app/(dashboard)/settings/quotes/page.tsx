import type { Metadata } from "next";
import { getTenant } from "@/actions/tenants";
import { QuoteSettingsClient } from "./quote-settings-client";

export const metadata: Metadata = {
  title: "Quote Settings",
  description: "Customize your quote PDF footer and terms",
};

export default async function QuoteSettingsPage() {
  const result = await getTenant();

  return <QuoteSettingsClient initialTenant={result.data ?? undefined} />;
}
