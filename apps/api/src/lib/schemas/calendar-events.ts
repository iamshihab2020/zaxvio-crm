import { z } from "zod";
import { isoDate, isoTime, boundedText } from "./common.js";

/**
 * Colours are rendered through a fixed lookup map on the client, so an unknown
 * value falls back to purple rather than injecting anything. Constraining the
 * enum here keeps the DB from accumulating values no surface can render.
 */
export const calendarEventColorSchema = z.enum([
  "purple",
  "blue",
  "green",
  "amber",
  "red",
  "teal",
]);

export const calendarEventsQuery = z.object({
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** `endTime` before `startTime` produced an event that rendered inverted. */
function endAfterStart<T extends { startTime?: string | null; endTime?: string | null }>(
  val: T,
  ctx: z.RefinementCtx,
) {
  if (val.startTime && val.endTime && val.endTime <= val.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "End time must be after start time",
    });
  }
}

export const createCalendarEventBody = z
  .object({
    title: boundedText(200).min(1, "Title is required"),
    description: boundedText(2000).optional(),
    eventDate: isoDate,
    startTime: isoTime.optional(),
    endTime: isoTime.optional(),
    contactName: boundedText(100).optional(),
    contactPhone: boundedText(20).optional(),
    address: boundedText(500).optional(),
    notes: boundedText(2000).optional(),
    color: calendarEventColorSchema.optional(),
    customerId: z.string().uuid().optional(),
  })
  .superRefine(endAfterStart);

export const updateCalendarEventBody = z
  .object({
    title: boundedText(200).min(1).optional(),
    description: boundedText(2000).nullable().optional(),
    eventDate: isoDate.optional(),
    startTime: isoTime.nullable().optional(),
    endTime: isoTime.nullable().optional(),
    contactName: boundedText(100).nullable().optional(),
    contactPhone: boundedText(20).nullable().optional(),
    address: boundedText(500).nullable().optional(),
    notes: boundedText(2000).nullable().optional(),
    color: calendarEventColorSchema.optional(),
    customerId: z.string().uuid().nullable().optional(),
  })
  .superRefine(endAfterStart);
