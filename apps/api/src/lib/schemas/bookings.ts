import { z } from "zod";
import { idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Querystrings ──────────────────────────────────────────────────────────────

export const bookingListQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["bookingDate", "createdAt"]).default("bookingDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const updateBookingBody = z.object({
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
  bookingDate: z.string().optional(),
  preferredTime: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
});

export const convertBookingBody = z.object({
  pipelineStageId: z.string().uuid().optional(),
});

// ── Bulk Operations ──────────────────────────────────────────────────────────

export const bulkBookingStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
});
