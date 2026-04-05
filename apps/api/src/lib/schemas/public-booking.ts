import { z } from "zod";
import { SERVICE_TYPES } from "@hvac-saas/types";

// ── Shared slug param (all public booking routes) ─────────────────────────

export const bookingSlugParam = z.object({
  slug: z.string().min(1),
});

export const bookingSlugAndIdParam = z.object({
  slug: z.string().min(1),
  bookingId: z.string().min(1),
});

// ── GET /:slug/availability?month=YYYY-MM ────────────────────────────────

export const availabilityQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Invalid month format. Expected YYYY-MM."),
});

// ── GET /:slug/slots?date=YYYY-MM-DD ─────────────────────────────────────

export const slotsQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD."),
});

// ── POST /:slug/submit ────────────────────────────────────────────────────

export const submitBookingBody = z.object({
  customerName: z
    .string()
    .min(2, "Customer name is required (min 2 characters).")
    .trim(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  serviceType: z.enum(SERVICE_TYPES, {
    errorMap: () => ({ message: "Invalid service type." }),
  }),
  bookingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD."),
  preferredTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid time format. Expected HH:MM."),
  address: z.string().optional(),
  description: z.string().optional(),
  source: z.enum(["portal", "embed", "widget"]).optional().default("portal"),
});

export type SubmitBookingBody = z.infer<typeof submitBookingBody>;
