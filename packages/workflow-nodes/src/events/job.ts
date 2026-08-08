/** Job events. Subject is always the job. */

import { z } from "zod";
import {
  changedFieldsField,
  customerRef,
  isoDateField,
  isoDateTimeField,
  isoTimeField,
  jobLifecycleSchema,
  jobPrioritySchema,
  moneyField,
  serviceTypeSchema,
  userIdField,
  uuidField,
} from "./shared.js";

/**
 * The fields every job event carries. Enough to filter on without a query, and
 * enough for a first-node email to say something specific.
 */
const jobBase = {
  ...customerRef,
  jobId: uuidField,
  jobNumber: z.string(),
  title: z.string(),
  serviceType: serviceTypeSchema,
  priority: jobPrioritySchema,
  pipelineId: uuidField.nullable(),
  assigneeId: userIdField.nullable(),
  totalAmount: moneyField,
  scheduledDate: isoDateField.nullable(),
};

export const jobCreatedPayload = z
  .object({
    ...jobBase,
    /**
     * A job typed into the CRM and a job converted from an accepted quote are
     * different business moments, and the second one must not re-trigger the
     * quote automation that created it.
     */
    origin: z.enum(["manual", "quote", "booking", "api"]),
    /** Set when `origin` explains where it came from, so the automation can
     *  reach back to the quote or booking without a lookup table. */
    originId: uuidField.nullable(),
    stageId: uuidField.nullable(),
    stageName: z.string().nullable(),
    lifecycle: jobLifecycleSchema,
    createdAt: isoDateTimeField,
  })
  .strict();

export const jobUpdatedPayload = z
  .object({
    ...jobBase,
    changedFields: changedFieldsField,
  })
  .strict();

/**
 * The load-bearing one.
 *
 * `toLifecycle` is why this exists in this shape. A tenant may name a stage
 * anything — "Awaiting parts", "Ready to invoice" — so a filter that string-
 * matches a stage name breaks the first time someone renames a column. The
 * lifecycle is the four-value truth the rest of the system reasons about, and
 * "when a job is completed" must key on it.
 *
 * Both sides of the move are carried, because the interesting automations are
 * about the *transition*, not the destination: "when a job leaves Scheduled",
 * "when a job is re-opened" (`fromLifecycle: completed`).
 */
export const jobStageChangedPayload = z
  .object({
    ...jobBase,
    fromStageId: uuidField.nullable(),
    fromStageName: z.string().nullable(),
    fromLifecycle: jobLifecycleSchema.nullable(),
    toStageId: uuidField,
    toStageName: z.string(),
    toLifecycle: jobLifecycleSchema,
    /** True when the move came from a bulk action, so "notify me per job" can
     *  opt out of a hundred emails from one drag. */
    bulk: z.boolean(),
  })
  .strict();

/**
 * Emitted alongside `job.stage_changed` when the destination lifecycle is
 * `completed`, and only on the transition into it — moving between two
 * completed stages does not re-complete a job.
 *
 * A separate event rather than a filter on the one above, because "when a job
 * is completed" is the single most common automation in this product and it
 * should not require the tenant to understand lifecycles to express it.
 */
export const jobCompletedPayload = z
  .object({
    ...jobBase,
    stageId: uuidField,
    stageName: z.string(),
    completedAt: isoDateTimeField,
    /** Straight off the job. An invoice-on-completion automation needs it and
     *  should not have to load the job to find out it is zero. */
    hasLineItems: z.boolean(),
  })
  .strict();

export const jobAssignedPayload = z
  .object({
    ...jobBase,
    /** Null when a job is *un*assigned — which is also worth automating on. */
    toAssigneeId: userIdField.nullable(),
    toAssigneeName: z.string().nullable(),
    fromAssigneeId: userIdField.nullable(),
    fromAssigneeName: z.string().nullable(),
  })
  .strict();

export const jobScheduledPayload = z
  .object({
    ...jobBase,
    fromDate: isoDateField.nullable(),
    toDate: isoDateField.nullable(),
    startTime: isoTimeField.nullable(),
    endTime: isoTimeField.nullable(),
    /** First scheduling vs a reschedule — a customer gets a different message
     *  for "you're booked for Tuesday" than for "we've moved you to Thursday". */
    rescheduled: z.boolean(),
  })
  .strict();

export const jobCancelledPayload = z
  .object({
    ...jobBase,
    fromStageName: z.string().nullable(),
    cancelledAt: isoDateTimeField,
  })
  .strict();

/**
 * P9 — from the daily schedule worker, not from a write.
 *
 * Only ever emitted for a job whose cost side is *complete*. An unknown cost
 * makes a total incomplete, not lower, and a half-costed job reads as pure
 * profit — alerting on a margin derived from it would be worse than not
 * alerting at all. Same rule the Profitability report follows when it excludes
 * incomplete jobs from aggregates rather than averaging them in.
 */
export const jobMarginBelowPayload = z
  .object({
    ...jobBase,
    revenue: moneyField,
    cost: moneyField,
    margin: moneyField,
    /** Percentage points, as a string for the same reason money is. */
    marginPercent: moneyField,
    thresholdPercent: moneyField,
  })
  .strict();
