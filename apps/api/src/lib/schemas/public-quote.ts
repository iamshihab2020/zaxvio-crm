import { z } from "zod";

export const quoteTokenParam = z.object({
  token: z.string().uuid(),
});

export const acceptQuoteBody = z.object({
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const declineQuoteBody = z.object({
  reason: z.string().max(2000).optional(),
});
