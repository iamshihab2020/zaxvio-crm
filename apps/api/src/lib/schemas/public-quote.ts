import { z } from "zod";
import { isoDate, isoTime, boundedText } from "./common.js";

export const quoteTokenParam = z.object({
  token: z.string().uuid(),
});

/**
 * `scheduledDate` was regex-only (`^\d{4}-\d{2}-\d{2}$`), which admits
 * `2026-13-45` (QUO-21, verified). The value is written to
 * `customer_scheduled_date` and then used as a job's `scheduledDate` by
 * `quote-to-job.ts`, so an impossible date reaches a `date` column as a 500.
 * `isoDate`'s `.refine` is the half that was missing.
 */
export const acceptQuoteBody = z.object({
  scheduledDate: isoDate.optional(),
  scheduledTime: isoTime.optional(),
});

export const declineQuoteBody = z.object({
  reason: boundedText(2000).optional(),
});
