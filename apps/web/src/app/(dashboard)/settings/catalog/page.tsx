import type { Metadata } from "next";
import { CatalogSettingsPageClient } from "./catalog-settings-page-client";

export const metadata: Metadata = {
  title: "Service Catalog",
  description: "Manage your service catalog items",
};

export default function CatalogSettingsPage() {
  return <CatalogSettingsPageClient />;
}
