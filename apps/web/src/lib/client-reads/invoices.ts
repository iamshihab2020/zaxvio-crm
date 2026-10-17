/**
 * Browser reads for invoices: the TanStack Query side of `@/actions/invoices`.
 * Same signatures, query keys, error text and return shapes as the server
 * actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/invoices";
import { pickQuery, readJson } from "@/lib/api-client";

const INVOICE_STATS_KEYS = ["customerId", "jobId", "dateFrom", "dateTo", "showArchived"] as const;

const INVOICE_LIST_KEYS = [
  "search",
  "status",
  "customerId",
  "jobId",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
  "showArchived",
] as const;

export async function getInvoiceStats(params?: Parameters<typeof actions.getInvoiceStats>[0]) {
  const r = await readJson(
    `/invoices/stats${pickQuery(params, INVOICE_STATS_KEYS)}`,
    "Failed to load stats",
  );
  // The action never read the body on a refusal: it answered with this one
  // string, and only a dropped connection carried different words.
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to load stats" };
  return { data: r.json.data, error: null };
}

export async function getInvoices(params?: Parameters<typeof actions.getInvoices>[0]) {
  const r = await readJson(
    `/invoices${pickQuery(params, INVOICE_LIST_KEYS)}`,
    "Failed to fetch invoices",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getInvoice(id: string) {
  const r = await readJson(`/invoices/${id}`, "Failed to load invoice");
  if (!r.ok) return { data: null, error: r.error, status: r.status };
  return { data: r.json.data, error: null, status: r.status };
}
