/**
 * Browser reads for customers: the TanStack Query side of `@/actions/customers`.
 * Same signatures, query keys, error text and return shapes as the server
 * actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/customers";
import { pickQuery, readJson } from "@/lib/api-client";

const CUSTOMER_LIST_KEYS = [
  "search",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
  "showArchived",
  "tagId",
] as const;

const PAGE_KEYS = ["page", "limit"] as const;

export async function getCustomerStats() {
  const r = await readJson("/customers/stats", "Failed to load stats");
  // The action never read the body on a refusal: it answered with this one
  // string, and only a dropped connection carried different words.
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to load stats" };
  return { data: r.json.data, error: null };
}

export async function getCustomers(params?: Parameters<typeof actions.getCustomers>[0]) {
  const search = new URLSearchParams(pickQuery(params, CUSTOMER_LIST_KEYS));
  // Tri-state: `false` must travel as "false", which `pickQuery` would drop.
  if (params?.optedOut !== undefined) {
    search.set("optedOut", params.optedOut ? "true" : "false");
  }
  const qs = search.toString();
  const r = await readJson(`/customers${qs ? `?${qs}` : ""}`, "Failed to fetch customers");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getCustomer(id: string) {
  const r = await readJson(`/customers/${id}`, "Customer not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getCustomerSummary(customerId: string) {
  const r = await readJson(`/customers/${customerId}/summary`, "Failed to load summary");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getCustomerNotes(
  customerId: string,
  params?: Parameters<typeof actions.getCustomerNotes>[1],
) {
  const r = await readJson(
    `/customers/${customerId}/notes${pickQuery(params, PAGE_KEYS)}`,
    "Failed to fetch notes",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getCustomerActivities(
  customerId: string,
  params?: Parameters<typeof actions.getCustomerActivities>[1],
) {
  const r = await readJson(
    `/customers/${customerId}/activities${pickQuery(params, PAGE_KEYS)}`,
    "Failed to fetch activities",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getCustomerTags(customerId: string) {
  const r = await readJson(`/customers/${customerId}/tags`, "Failed to fetch customer tags");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getCustomerPhotos(
  customerId: string,
  params?: Parameters<typeof actions.getCustomerPhotos>[1],
) {
  const r = await readJson(
    `/customers/${customerId}/photos${pickQuery(params, PAGE_KEYS)}`,
    "Failed to fetch photos",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

/** Advisory duplicate-email lookup used by the create/edit dialog (CUST-28). */
export async function checkDuplicateCustomer(email: string, excludeId?: string) {
  const qs = new URLSearchParams({ email });
  if (excludeId) qs.set("excludeId", excludeId);
  const r = await readJson(
    `/customers/check-duplicate?${qs.toString()}`,
    "Failed to check for duplicates",
  );
  // The action never read the body on a refusal: it answered with this one
  // string, and only a dropped connection carried different words.
  if (!r.ok) {
    return { data: null, error: r.status === 0 ? r.error : "Failed to check for duplicates" };
  }
  return { data: r.json.data, error: null };
}
