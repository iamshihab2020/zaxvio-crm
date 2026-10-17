/**
 * Browser reads for quotes: the TanStack Query side of `@/actions/quotes`.
 * Same signatures, query keys, error text and return shapes as the server
 * actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/quotes";
import { pickQuery, readJson } from "@/lib/api-client";

const QUOTE_LIST_KEYS = [
  "search",
  "status",
  "customerId",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
  "showArchived",
] as const;

const PAGE_KEYS = ["page", "limit"] as const;

export async function getQuoteStats() {
  const r = await readJson("/quotes/stats", "Failed to load stats");
  // The action never read the body on a refusal: it answered with this one
  // string, and only a dropped connection carried different words.
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to load stats" };
  return { data: r.json.data, error: null };
}

export async function getQuotes(params?: Parameters<typeof actions.getQuotes>[0]) {
  const r = await readJson(
    `/quotes${pickQuery(params, QUOTE_LIST_KEYS)}`,
    "Failed to fetch quotes",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getQuote(id: string) {
  const r = await readJson(`/quotes/${id}`, "Quote not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getQuoteActivities(
  quoteId: string,
  params?: Parameters<typeof actions.getQuoteActivities>[1],
) {
  const r = await readJson(
    `/quotes/${quoteId}/activities${pickQuery(params, PAGE_KEYS)}`,
    "Failed to fetch activities",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}
