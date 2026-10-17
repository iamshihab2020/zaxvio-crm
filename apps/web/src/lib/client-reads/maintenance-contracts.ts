/**
 * Browser reads for service agreements: the TanStack Query side of
 * `@/actions/maintenance-contracts`. Same signatures, query keys, error text and
 * return shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/maintenance-contracts";
import { readJson } from "@/lib/api-client";

export async function getMaintenanceContracts(
  params?: Parameters<typeof actions.getMaintenanceContracts>[0],
) {
  // Built by hand rather than with `pickQuery`: the action sends
  // `isActive=false` (it tests `!== undefined`), and `pickQuery` drops `false`,
  // which would turn "inactive agreements" into "every agreement".
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.customerId) searchParams.set("customerId", params.customerId);
  if (params?.equipmentId) searchParams.set("equipmentId", params.equipmentId);
  if (params?.isActive !== undefined) searchParams.set("isActive", String(params.isActive));
  if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

  const qs = searchParams.toString();
  const r = await readJson(
    `/maintenance-contracts${qs ? `?${qs}` : ""}`,
    "Failed to fetch service agreements",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getMaintenanceContract(id: string) {
  const r = await readJson(`/maintenance-contracts/${id}`, "Service agreement not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
