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
 * P9. Something outside the CRM called an inbound webhook.
 *
 * The only event whose payload is **entirely author-controlled and entirely
 * untrusted**. Everything else here is built by a producer from a row we wrote;
 * this is whatever somebody POSTed.
 *
 * So it is deliberately loose — `z.record` rather than a shape — and the
 * bounding happens before it ever reaches Zod: headers pass an **allowlist**
 * (never a denylist, because the header you forget to deny is the one carrying
 * a credential), and the body is capped at 64 KB and *replaced* rather than
 * truncated when it is bigger, since half a JSON object read through
 * `{{webhook.body.x}}` resolves to nothing with no sign anything was dropped.
 *
 * No subject, for the same reason `schedule.*` has none: a webhook is about
 * whatever the automation decides it is about, and guessing a record id out of
 * an untrusted body is precisely the tenant-crossing this system refuses
 * ([[wf-10-security|T-4]]).
 */
export const webhookReceivedPayload = z
  .object({
    /** Post-allowlist. `authorization`, `cookie` and friends never appear. */
    headers: z.record(z.string(), z.string()),
    body: z.unknown(),
    query: z.unknown(),
    receivedAt: isoDateTimeField,
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
