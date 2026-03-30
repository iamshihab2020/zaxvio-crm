import type { Metadata } from "next";
import { CatalogPageClient } from "./catalog-page-client";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage your service catalog items",
};

export default function CatalogPage() {
  return <CatalogPageClient />;
}
