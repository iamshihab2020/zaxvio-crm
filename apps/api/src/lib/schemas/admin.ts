import { z } from "zod";
import { passwordSchema } from "./auth.js";

// ── Shared ─────────────────────────────────────────────────────────────────

export const adminIdParam = z.object({
  id: z.string().min(1),
});

// ── Admin user management (admins.ts) ──────────────────────────────────────

const VALID_TIERS = ["super_admin", "support", "billing_admin"] as const;

export const createAdminBody = z.object({
  name: z.string().min(1, "Name is required").trim(),
  email: z.string().email("Valid email is required"),
  password: passwordSchema,
  adminTier: z.enum(VALID_TIERS, {
    errorMap: () => ({
      message: `adminTier must be one of: ${VALID_TIERS.join(", ")}`,
    }),
  }),
  makeOwner: z.boolean().optional(),
});

export const updateAdminBody = z.object({
  adminTier: z.enum(VALID_TIERS, {
    errorMap: () => ({
      message: `adminTier must be one of: ${VALID_TIERS.join(", ")}`,
    }),
  }),
  makeOwner: z.boolean().optional(),
});

// ── Tenant management (tenants.ts) ─────────────────────────────────────────

export const listTenantsQuery = z.object({
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const extendTrialBody = z.object({
  days: z.number().int().min(1).max(365, "days must be between 1 and 365"),
});

export const overrideSubscriptionBody = z.object({
  status: z.string().optional(),
  planName: z.string().optional(),
});

export const patchTenantBody = z.object({
  businessName: z.string().optional(),
  ownerName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  slug: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

export const deleteTenantBody = z.object({
  confirmBusinessName: z.string().min(1, "Business name confirmation is required"),
});

// ── Impersonation (impersonation.ts) ──────────────────────────────────────

export const startImpersonationBody = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  reason: z.string().min(1, "reason is required").trim(),
});

export const endImpersonationBody = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export const cancelImpersonationBody = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

// ── Analytics (analytics.ts) ──────────────────────────────────────────────

export const churnQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(90),
});

// ── Audit log (audit.ts) ──────────────────────────────────────────────────

export const auditLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  adminUserId: z.string().optional(),
});

export const impersonationLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const tenantActivityQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Search (search.ts) ────────────────────────────────────────────────────

export const adminSearchQuery = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

// ── System (system.ts) ────────────────────────────────────────────────────

export const systemLimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
