import { z } from "zod";
import { idParam, isoDate, isoTime, boundedText } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Bodies ────────────────────────────────────────────────────────────────────

const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: isoTime,
  endTime: isoTime,
  isActive: z.boolean(),
});

export const updateAvailabilityBody = z.object({
  schedule: z.array(scheduleEntrySchema).length(7),
  /**
   * How many appointments the business can run concurrently. Was hardcoded to 1
   * in the public slot query, so a three-person team could sell one hour at a
   * time through the portal (BOOK-28).
   */
  slotCapacity: z.coerce.number().int().min(1).max(50).optional(),
});

export const createScheduleOverrideBody = z.object({
  overrideDate: isoDate,
  isAvailable: z.boolean(),
  startTime: isoTime.optional(),
  endTime: isoTime.optional(),
  reason: boundedText(200).optional(),
});
