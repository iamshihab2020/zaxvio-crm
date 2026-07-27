import { z } from "zod";
import { idParam, paginationQuery, isoDate, isoTime, boundedText } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Shared enums ──────────────────────────────────────────────────────────────

export const bookingStatusSchema = z.enum([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

export type BookingStatus = z.infer<typeof bookingStatusSchema>;

// ── Querystrings ──────────────────────────────────────────────────────────────

export const bookingListQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  status: bookingStatusSchema.optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  sortBy: z.enum(["bookingDate", "createdAt"]).default("bookingDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /bookings/stats takes no input. Declared anyway so the route satisfies
 * [[api-rules]] §6 and so an unknown query param is stripped rather than
 * silently ignored.
 */
export const bookingStatsQuery = z.object({});

export const bookingActivitiesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

/**
 * Reschedule + edit. `bookingDate`/`preferredTime` are the same two fields the
 * public portal validates hard; before BOOK-04 this schema accepted
 * `bookingDate: "infinity"` and a 100 KB address.
 */
export const updateBookingBody = z.object({
  status: bookingStatusSchema.optional(),
  notes: boundedText(5000).optional(),
  bookingDate: isoDate.optional(),
  preferredTime: isoTime.optional(),
  address: boundedText(500).optional(),
  description: boundedText(2000).optional(),
  /**
   * Staff override for the availability rules the portal enforces. Rescheduling
   * onto a closed day or an occupied slot is a legitimate thing for a contractor
   * to do — it just has to be deliberate rather than the default (BOOK-09).
   */
  force: z.boolean().optional(),
});

export const convertBookingBody = z.object({
  pipelineStageId: z.string().uuid().optional(),
});

// ── Bulk Operations ──────────────────────────────────────────────────────────

export const bulkBookingStatusBody = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: bookingStatusSchema,
});
