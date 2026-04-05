import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Querystrings ──────────────────────────────────────────────────────────────

export const equipmentListQuery = paginationQuery.extend({
  customerId: z.string().uuid().optional(),
  sortBy: z
    .enum(["createdAt", "equipmentType", "brand", "installDate", "warrantyExpiry"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const refrigerantLogListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createEquipmentBody = z.object({
  customerId: z.string().uuid(),
  equipmentType: z.string().min(1).trim(),
  brand: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  serialNumber: z.string().trim().optional().nullable(),
  installDate: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateEquipmentBody = z.object({
  equipmentType: z.string().min(1).trim().optional(),
  brand: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  serialNumber: z.string().trim().nullable().optional(),
  installDate: z.string().nullable().optional(),
  warrantyExpiry: z.string().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const addRefrigerantLogBody = z.object({
  refrigerantType: z.string().min(1).trim(),
  action: z.enum(["added", "recovered", "recycled"]),
  quantity: z.number().positive(),
  unit: z.string().trim().default("lbs"),
  jobId: z.string().uuid().optional().nullable(),
  technicianName: z.string().trim().optional().nullable(),
  epaCertNumber: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// ── Maintenance Contract Schemas ───────────────────────────────────────────────

export const maintenanceContractListQuery = paginationQuery.extend({
  customerId: z.string().uuid().optional(),
  equipmentId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined))
    .optional(),
  sortBy: z
    .enum(["createdAt", "contractName", "startDate", "endDate", "annualPrice"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const expiringContractsQuery = z.object({
  days: z.coerce.number().int().min(1).default(30),
});

export const createMaintenanceContractBody = z.object({
  customerId: z.string().uuid(),
  contractName: z.string().min(1).trim(),
  startDate: z.string(),
  endDate: z.string(),
  equipmentId: z.string().uuid().optional().nullable(),
  frequency: z
    .enum(["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "annual"])
    .default("annual"),
  visitsPerYear: z.coerce.number().int().min(1).default(2),
  annualPrice: z.number().min(0).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const updateMaintenanceContractBody = z.object({
  contractName: z.string().min(1).trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  frequency: z
    .enum(["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "annual"])
    .optional(),
  visitsPerYear: z.coerce.number().int().min(1).optional(),
  annualPrice: z.number().min(0).nullable().optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().nullable().optional(),
});
