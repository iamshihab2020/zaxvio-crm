import type { Metadata } from "next";
import { getTenant } from "@/actions/tenants";
import { BusinessSettingsClient } from "./business-settings-client";

export const metadata: Metadata = {
  title: "Business Settings",
  description: "Manage your business information and defaults",
};

export default async function BusinessSettingsPage() {
  const result = await getTenant();

  return <BusinessSettingsClient initialTenant={result.data ?? undefined} />;
}
