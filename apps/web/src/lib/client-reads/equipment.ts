/**
 * Browser reads for equipment / assets: the TanStack Query side of
 * `@/actions/equipment`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/equipment";
import { pickQuery, readJson, readResult } from "@/lib/api-client";

const EQUIPMENT_LIST_KEYS = ["search", "page", "limit", "customerId", "sortBy", "sortOrder"] as const;

export async function getEquipment(params?: Parameters<typeof actions.getEquipment>[0]) {
  const r = await readJson(
    `/equipment${pickQuery(params, EQUIPMENT_LIST_KEYS)}`,
    "Failed to fetch equipment",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getEquipmentItem(id: string) {
  const r = await readJson(`/equipment/${id}`, "Equipment not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getEquipmentHistory(equipmentId: string) {
  return readResult<unknown>(
    `/equipment/${equipmentId}/history`,
    "Failed to load service history",
  );
}

const REFRIGERANT_LOG_KEYS = ["page", "limit"] as const;

export async function getEquipmentRefrigerantLogs(
  equipmentId: string,
  params?: { page?: number; limit?: number },
) {
  const r = await readJson(
    `/equipment/${equipmentId}/refrigerant-logs${pickQuery(params, REFRIGERANT_LOG_KEYS)}`,
    "Failed to fetch refrigerant logs",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}
