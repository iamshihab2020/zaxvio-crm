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
    .max(100, "Customer name is too long (max 100 characters).")
    .trim(),
  customerEmail: z.string().email().optional(),
  customerPhone: z
    .string()
    .max(20, "Phone number is too long.")
    .regex(/^[\d\s+\-().]+$/, "Invalid phone format.")
    .optional(),
  serviceType: z.enum([...SERVICE_TYPES]),
  bookingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD.")
    .refine((val) => {
      const d = new Date(val + "T12:00:00Z");
      return !isNaN(d.getTime()) && d.toISOString().startsWith(val);
    }, "Invalid calendar date."),
  preferredTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Invalid time format. Expected HH:MM.")
    .refine((t) => {
      const [h, m] = t.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    }, "Invalid time value."),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  source: z.enum(["portal", "embed", "widget"]).optional().default("portal"),
  quoteId: z.string().uuid().optional(),
});

export type SubmitBookingBody = z.infer<typeof submitBookingBody>;
