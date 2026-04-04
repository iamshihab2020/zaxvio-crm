import type { Metadata } from "next";
import { getCatalogItems, getCatalogCategories } from "@/actions/catalog";
import { CatalogPageClient } from "./catalog-page-client";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage your service catalog items",
};

export default async function CatalogPage() {
  const [itemsResult, categoriesResult] = await Promise.all([
    getCatalogItems({ page: 1, limit: 15 }),
    getCatalogCategories(),
  ]);

  return (
    <CatalogPageClient
      initialItems={(itemsResult.data ?? []) as never[]}
      initialPagination={itemsResult.pagination as never}
      initialCategories={(categoriesResult.data ?? []) as never[]}
    />
  );
}
