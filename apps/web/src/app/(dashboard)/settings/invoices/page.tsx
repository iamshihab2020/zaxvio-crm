import type { Metadata } from "next";
import { getTenant } from "@/actions/tenants";
import { InvoiceSettingsClient } from "./invoice-settings-client";

export const metadata: Metadata = {
  title: "Invoice Settings",
  description: "Customize your invoice appearance and details",
};

export default async function InvoiceSettingsPage() {
  const result = await getTenant();

  return <InvoiceSettingsClient initialTenant={result.data ?? undefined} />;
}
