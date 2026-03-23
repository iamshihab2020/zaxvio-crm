import type { Metadata } from "next";
import { BusinessSettingsClient } from "./business-settings-client";

export const metadata: Metadata = {
  title: "Business Settings",
  description: "Manage your business information and defaults",
};

export default function BusinessSettingsPage() {
  return <BusinessSettingsClient />;
}
