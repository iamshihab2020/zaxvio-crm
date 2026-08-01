import { z } from "zod";
import { idParam, paginationQuery, boundedText, lineItemDescription } from "./common.js";

// ── Stage / status ────────────────────────────────────────────────────────────
//
// A job's column is a *pipeline stage*, and tenants name stages whatever they
// like (`POST /pipeline-stages` stores `name = slugify(label)`). These schemas
// used to hardcode the four canonical lifecycle values, so any custom stage was
// unreachable — the board rendered the column and every drop into it 400'd at
// validation. `stageName` accepts a slug of any name; the handler resolves it
// against the job's pipeline and rejects anything that does not exist there.

/** The four real lifecycle values. Still an enum — these are not user data. */
export const jobLifecycleSchema = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * Mirrors of the Drizzle pgEnums (api-rules §4). `serviceType` was
 * `z.string()`, so every write site had to launder it through
 * `as never` to satisfy the column type — an unvalidated string reaching a
 * Postgres enum, which fails at the driver with a 500 instead of a 400.
 */
export const serviceTypeSchema = z.enum([
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
]);

export const jobPrioritySchema = z.enum(["standard", "urgent", "emergency"]);

/** A pipeline stage `name` — a slug, bounded, matched against the pipeline. */
export const stageNameSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9_]+$/, "Stage name must be a lowercase slug");

/** Either form of "move this job": the precise id, or the stage name. */
const stageTargetShape = {
  stageId: z.string().uuid().optional(),
  status: stageNameSchema.optional(),
};
const hasStageTarget = (v: { stageId?: string; status?: string }) =>
  Boolean(v.stageId || v.status);
const stageTargetError = { message: "Provide either stageId or status" };

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const lineItemParam = z.object({
  id: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const photoParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const photoTagParam = z.object({
  id: z.string().uuid(),
  photoId: z.string().uuid(),
});

export const documentParam = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
});

export const completionIdParam = z.object({
  id: z.string().uuid(),
  completionId: z.string().uuid(),
});

// ── Querystrings ──────────────────────────────────────────────────────────────

export const jobListQuery = paginationQuery.extend({
  // Kanban board loads all pipeline jobs at once — allow up to 500
  limit: z.coerce.number().int().min(1).max(500).default(20),
  // A stage name, not a lifecycle — filtering the board by a custom column has
  // to work. `lifecycle` is the separate, coarser filter.
  status: stageNameSchema.optional(),
  stageId: z.string().uuid().optional(),
  lifecycle: jobLifecycleSchema.optional(),
  customerId: z.string().uuid().optional(),
  serviceType: serviceTypeSchema.optional(),
  priority: jobPrioritySchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  pipelineId: z.string().uuid().optional(),
  assigneeId: z.string().optional(),
  sortBy: z
    .enum(["scheduledDate", "createdAt", "jobNumber", "status", "priority", "totalAmount"])
    .default("scheduledDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const photoListQuery = z.object({
  tag: z.enum(["before", "after", "general"]).optional(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

// `scheduled_date` is a Postgres `date` and the times are `time` columns —
// unbounded strings reached them unchecked, so "infinity" and "9999-99-99" were
// accepted at the edge and blew up in the driver. Same hardening the public
// booking schema got in April; this domain never received it.
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  // `Date.parse` is not enough: it rolls 2026-02-30 forward to March 2 rather
  // than failing. Round-tripping the parsed date back to ISO catches the
  // overflow, so a day that does not exist in that month is rejected.
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === v
    );
  }, "Invalid calendar date");

export const timeOnlySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Expected HH:MM");

/**
 * JOB-19: the create dialog validated that the end time follows the start
 * (`job-create-dialog.tsx`), and nothing on the server did — so `17:00 → 09:00`
 * was accepted from the detail sheet, the chatbot tools, or any direct caller.
 * Client-side validation is a convenience; this is the rule.
 */
const endAfterStart = (v: { scheduledStart?: string; scheduledEnd?: string }) =>
  !v.scheduledStart || !v.scheduledEnd || v.scheduledEnd > v.scheduledStart;
const endAfterStartError = {
  message: "End time must be after start time",
  path: ["scheduledEnd"],
};

export const createJobBody = z.object({
  customerId: z.string().uuid(),
  serviceType: serviceTypeSchema,
  title: boundedText(200).min(1),
  scheduledDate: dateOnlySchema,
  description: boundedText(5000).optional(),
  scheduledStart: timeOnlySchema.optional(),
  scheduledEnd: timeOnlySchema.optional(),
  address: boundedText(500).optional(),
  priority: jobPrioritySchema.optional(),
  taxRate: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  notes: boundedText(5000).optional(),
  equipmentId: z.string().uuid().optional(),
  pipelineId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  assigneeId: z.string().min(1).max(255).optional().nullable(),
  // "Add job to this column" sent `status` and this schema had no such field.
  // Zod objects strip unknown keys silently, so the column was discarded
  // without a word and every job landed in the pipeline's first stage.
  ...stageTargetShape,
})
  .refine(endAfterStart, endAfterStartError);

export const updateJobBody = z.object({
  title: boundedText(200).min(1).optional(),
  description: boundedText(5000).optional(),
  priority: jobPrioritySchema.optional(),
  serviceType: serviceTypeSchema.optional(),
  scheduledDate: dateOnlySchema.optional(),
  scheduledStart: timeOnlySchema.optional(),
  scheduledEnd: timeOnlySchema.optional(),
  address: boundedText(500).optional(),
  notes: boundedText(5000).optional(),
  taxRate: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  equipmentId: z.string().uuid().optional().nullable(),
  pipelineId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().min(1).max(255).optional().nullable(),
})
  .refine(endAfterStart, endAfterStartError);

export const updateJobStatusBody = z
  .object(stageTargetShape)
  .refine(hasStageTarget, stageTargetError);

/**
 * Positions only. `/reorder` used to accept a status too, which made it a
 * second, weaker status writer: it skipped the required-checklist gate, the
 * completion email, the notification and the activity row that
 * `PATCH /:id/status` performs. Dragging a card to Completed on the board did
 * none of those; completing the same job from the detail sheet did all four.
 * The board now calls `PATCH /:id/status` for the move and this for the order.
 */
export const reorderBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
});

/**
 * `numeric(10, 2)` holds at most 99,999,999.99, and `quantity` is
 * `numeric(10, 2)` too. Bounding only with `.min(0)` / `.positive()` let `1e15`
 * validate and then fail in the driver as SQLSTATE 22003 — a 500 for what is
 * plainly a 400. `.finite()` also rejects `Infinity` and `NaN`, which
 * `z.coerce.number()` happily produces from `"Infinity"` and `"abc"`.
 */
const MONEY_MAX = 99_999_999.99;

export const moneySchema = z.coerce.number().finite().min(0).max(MONEY_MAX);
export const quantitySchema = z.coerce
  .number()
  .finite()
  .positive()
  .max(MONEY_MAX);

export const addLineItemBody = z.object({
  description: lineItemDescription,
  unitPrice: moneySchema.optional(),
  itemType: z.enum(["labor", "part", "material", "service_call", "other"]).optional(),
  quantity: quantitySchema.optional(),
  catalogItemId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

export const updateLineItemBody = z.object({
  description: lineItemDescription,
  quantity: quantitySchema.optional(),
  unitPrice: moneySchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(100_000).optional(),
  itemType: z.enum(["labor", "part", "material", "service_call", "other"]).optional(),
});

export const toggleChecklistBody = z.object({
  isCompleted: z.boolean().optional(),
});

export const addPhotoBody = z.object({
  storagePath: z.string().min(1).max(500),
  caption: z.string().max(500).optional(),
  tag: z.enum(["before", "after", "general"]).optional().default("general"),
  fileSize: z.number().int().positive().optional(),
  takenAt: z.string().datetime().optional(),
});

export const updatePhotoTagBody = z.object({
  tag: z.enum(["before", "after", "general"]),
});

export const addDocumentBody = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().max(100).optional(),
  customerId: z.string().uuid().optional(),
});

export const uploadFileBody = z.object({
  data: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  tag: z.enum(["before", "after", "general"]).optional().default("general"),
});

// ── Bulk Operations ──────────────────────────────────────────────────────────

export const bulkJobStatusBody = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    ...stageTargetShape,
  })
  .refine(hasStageTarget, stageTargetError);
