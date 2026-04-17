import { z } from "zod";

/** Revenue trend granularity for GET /dashboard/stats */
export const revenueGranularitySchema = z.enum(["day", "week", "month"]);

/** Query params for GET /dashboard/stats */
export const dashboardStatsQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  granularity: revenueGranularitySchema.optional().default("month"),
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

/** Query params for GET /reports/stats */
export const reportStatsQuery = z.object({
  section: reportSectionEnum.optional().default("revenue"),
  from: z.string().optional(),
  to: z.string().optional(),
});
