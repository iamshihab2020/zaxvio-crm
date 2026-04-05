import { z } from "zod";
import { idParam } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

// ── Bodies ────────────────────────────────────────────────────────────────────

const scheduleEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM"),
  isActive: z.boolean(),
});

export const updateAvailabilityBody = z.object({
  schedule: z.array(scheduleEntrySchema).length(7),
});

export const createScheduleOverrideBody = z.object({
  overrideDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  isAvailable: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:MM").optional(),
  reason: z.string().optional(),
});
