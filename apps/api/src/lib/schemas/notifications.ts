import { z } from "zod";

export const notificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export const updatePreferencesBody = z.object({
  preferences: z
    .array(
      z.object({
        type: z.enum([
          "booking_received",
          "job_status_changed",
          "invoice_paid",
          "customer_created",
          "quote_accepted",
          "quote_declined",
          "invoice_overdue",
          "team_member_joined",
        ]),
        inApp: z.boolean(),
        email: z.boolean(),
        sms: z.boolean(),
        voice: z.boolean(),
      }),
    )
    .min(1),
});
