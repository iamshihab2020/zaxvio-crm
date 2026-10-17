/**
 * Browser reads for the service catalog: the TanStack Query side of
 * `@/actions/catalog`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/catalog";
import { pickQuery, readJson } from "@/lib/api-client";

const CATALOG_LIST_KEYS = [
  "search",
  "page",
  "limit",
  "itemType",
  "showArchived",
  "sortBy",
  "sortOrder",
] as const;

export async function getCatalogItems(params?: Parameters<typeof actions.getCatalogItems>[0]) {
  const r = await readJson(
    `/catalog${pickQuery(params, CATALOG_LIST_KEYS)}`,
    "Failed to fetch catalog items",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getCatalogCategories() {
  const r = await readJson("/catalog/categories", "Failed to fetch categories");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data as string[], error: null };
}

export async function getCatalogItem(id: string) {
  const r = await readJson(`/catalog/${id}`, "Catalog item not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
