/**
 * Browser reads for the tenant: the TanStack Query side of `@/actions/tenants`.
 * Same signatures, error text and return shapes as the server actions; see
 * lib/api-client.ts for why.
 */
import type { MemberRatesPayload } from "@/actions/tenants";
import { readJson, readResult } from "@/lib/api-client";

export async function getTenant() {
  const r = await readJson("/tenants/current", "Failed to fetch tenant");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getMemberRates() {
  return readResult<MemberRatesPayload>("/tenants/member-rates", "Failed to load cost rates");
}

export async function getPendingImpersonationRequest() {
  const r = await readJson("/tenants/impersonation/pending", "Failed to check");
  // The action never read the body on a refusal: it answered with this one
  // string, and only a dropped connection carried different words.
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to check" };
  // The whole body, not `.data`: the callers read `pending` and `request` off it.
  return { data: r.json, error: null };
}

export async function getActiveImpersonationViewer() {
  const r = await readJson("/tenants/impersonation/active-viewer", "Failed to check");
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to check" };
  return { data: r.json, error: null };
}
