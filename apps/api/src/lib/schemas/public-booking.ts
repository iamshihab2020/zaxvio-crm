import { z } from "zod";
import { SERVICE_TYPES } from "@hvac-saas/types";
import { isoDate, isoMonth, isoTime, boundedText } from "./common.js";

// ── Shared slug param (all public booking routes) ─────────────────────────

export const bookingSlugParam = z.object({
  slug: z.string().min(1).max(100),
});

export const bookingSlugAndIdParam = z.object({
  slug: z.string().min(1).max(100),
  bookingId: z.string().uuid(),
});

// ── GET /:slug/availability?month=YYYY-MM ────────────────────────────────

export const availabilityQuery = z.object({
  month: isoMonth,
});

// ── GET /:slug/slots?date=YYYY-MM-DD ─────────────────────────────────────

export const slotsQuery = z.object({
  date: isoDate,
});

// ── POST /:slug/submit ────────────────────────────────────────────────────

export const submitBookingBody = z.object({
  customerName: boundedText(100)
    .min(2, "Customer name is required (min 2 characters).")
    .trim(),
  customerEmail: z.string().email().max(254).optional(),
  customerPhone: boundedText(20)
    .regex(/^[\d\s+\-().]+$/, "Invalid phone format.")
    .optional(),
  serviceType: z.enum([...SERVICE_TYPES]),
  bookingDate: isoDate,
  preferredTime: isoTime,
  address: boundedText(500).optional(),
  description: boundedText(2000).optional(),
  source: z.enum(["portal", "embed", "widget"]).optional().default("portal"),
  quoteId: z.string().uuid().optional(),
});

export type SubmitBookingBody = z.infer<typeof submitBookingBody>;
