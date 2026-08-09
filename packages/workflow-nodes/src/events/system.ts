/**
 * System events — the ones with no domain record behind them.
 *
 * These are the only events with **no subject**. A daily schedule is not about
 * a customer or a job; whatever it acts on, it finds for itself. That makes
 * them the one case the enrollment dedup key cannot cover, which is why
 * `workflow_schedule_state` exists: "already fired today" is a table row with a
 * unique index, never a timestamp in memory.
 */

import { z } from "zod";
import { isoDateField, isoDateTimeField, userIdField, uuidField } from "./shared.js";

/**
 * P9. Fired at the configured local time in the **workflow's** zone, which is
 * not necessarily the tenant's — a tenant may run one automation on a
 * customer's schedule and another on their own.
 */
export const scheduleDailyPayload = z
  .object({
    /** The local calendar date that fired, in the workflow's zone. This is the
     *  dedup key's date component and the thing a message means by "today". */
    localDate: isoDateField,
    timezone: z.string(),
    firedAt: isoDateTimeField,
  })
  .strict();

/** P9. Same, keyed on ISO week so a restart cannot double-fire. */
export const scheduleWeeklyPayload = z
  .object({
    localDate: isoDateField,
    /** ISO-8601: `2026-W32`. Not "week of the month", which is ambiguous. */
    isoWeek: z
      .string()
      .regex(/^\d{4}-W\d{2}$/)
      .meta({ example: "2026-W32" }),
    timezone: z.string(),
    firedAt: isoDateTimeField,
  })
  .strict();

/**
 * P3. Someone pressed Run, or tested a draft.
 *
 * A manual run **may** carry a subject — running an automation against one
 * chosen customer is the normal way to test it — but it does not have to, and
 * the trigger node has no filters, because filtering a run someone explicitly
 * asked for would be a bug rather than a feature.
 */
export const manualRunPayload = z
  .object({
    triggeredByUserId: userIdField,
    triggeredByName: z.string(),
    /** Null when run without a subject. */
    subjectId: uuidField.nullable(),
    /** A test run writes logs and refuses external side effects; a real one
     *  does not. Carried on the payload so the engine cannot lose track of
     *  which kind it is halfway through. */
    isTest: z.boolean(),
    firedAt: isoDateTimeField,
  })
  .strict();
