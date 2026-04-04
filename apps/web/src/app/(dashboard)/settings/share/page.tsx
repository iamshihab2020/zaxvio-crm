import type { Metadata } from "next";
import { getTenant } from "@/actions/tenants";
import { ShareSettingsClient } from "@/components/dashboard/settings/share/share-settings-client";

export const metadata: Metadata = {
  title: "Share Booking Page",
  description: "Distribute your booking page across your website, social profiles, and more",
};

export default async function ShareSettingsPage() {
  const result = await getTenant();
  const slug = result.data?.slug ?? "";
  const appUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

  return <ShareSettingsClient slug={slug} appUrl={appUrl} />;
}
