import { z } from "zod";
import { isoDate } from "./common.js";

/** Revenue trend granularity for GET /dashboard/stats */
export const revenueGranularitySchema = z.enum(["day", "week", "month"]);

/** Query params for GET /dashboard/stats */
export const dashboardStatsQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  granularity: revenueGranularitySchema.optional().default("month"),
});

/** Query params for GET /dashboard/pipeline */
export const dashboardPipelineQuery = z.object({
  pipelineId: z.string().uuid().optional(),
});

/** Valid section names for GET /reports/stats */
export const reportSectionEnum = z.enum([
  "revenue",
  "jobs",
  "customers",
  "quotes-invoices",
  "bookings",
]);

/**
 * Query params for GET /reports/stats.
 *
 * `granularity` is optional: omitted, the service picks a bucket size from the
 * span (day ≤31d, week ≤120d, month beyond) so "Last 7 days" no longer renders a
 * single bar. The resolved value is echoed back in the response.
 */
export const reportStatsQuery = z.object({
  section: reportSectionEnum.optional().default("revenue"),
  from: isoDate.optional(),
  to: isoDate.optional(),
  granularity: revenueGranularitySchema.optional(),
});
