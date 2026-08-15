/**
 * The event taxonomy — every event the system can produce, in one table.
 *
 * ## What this file is defending against
 *
 * The single most expensive defect in the system this was ported from:
 * `services/leads.ts` spread a raw database row into a `lead.status.changed`
 * payload (`pipeline_stage_id`, snake_case); the goal listener read `stageId`
 * (camelCase); the trigger service hand-mapped a **third** spelling. All three
 * sides were typed `Record<string, unknown>`, so it compiled, and every
 * stage-filtered goal node was silently dead in production for months. The unit
 * test passed the whole time — it hand-wrote a camelCase fixture that
 * production never emitted.
 *
 * Four mechanisms close that, and it takes all four:
 *
 * 1. A Zod schema per event, `.strict()` — an extra or misspelled key throws.
 * 2. `emitWorkflowEvent()` parses **before** the insert, the worker parses
 *    **again** after the read — so a payload that changed shape between write
 *    and read is caught rather than silently half-read.
 * 3. Test fixtures are generated **from** these schemas (`fixtures.ts`), so a
 *    hand-written fixture cannot pass while production emits something else.
 * 4. Exactly one producer helper per event, and object spread is banned inside
 *    that file, so no row can leak its column names into a payload.
 *
 * This repo has its own version of the same scar: QUO-02, a second writer with
 * its own idea of the shape, four days of every quote-created job sitting
 * outside the stage model.
 */

import { z } from "zod";
import type { SubjectType } from "../node-definition.js";
import {
  customerCreatedPayload,
  customerTagAddedPayload,
  customerTagRemovedPayload,
  customerUpdatedPayload,
} from "./customer.js";
import {
  jobAssignedPayload,
  jobCancelledPayload,
  jobCompletedPayload,
  jobCreatedPayload,
  jobMarginBelowPayload,
  jobScheduledPayload,
  jobStageChangedPayload,
  jobUpdatedPayload,
} from "./job.js";
import {
  bookingCancelledPayload,
  bookingConfirmedPayload,
  bookingConvertedPayload,
  bookingCreatedPayload,
  bookingRescheduledPayload,
} from "./booking.js";
import {
  quoteAcceptedPayload,
  quoteCreatedPayload,
  quoteDeclinedPayload,
  quoteViewedPayload,
  quoteExpiredPayload,
  quoteSentPayload,
} from "./quote.js";
import {
  invoiceCreatedPayload,
  invoiceOverduePayload,
  invoicePaidPayload,
  invoicePaymentRecordedPayload,
  invoiceSentPayload,
  invoiceVoidedPayload,
} from "./invoice.js";
import {
  contractExpiringPayload,
  contractVisitDuePayload,
  equipmentCreatedPayload,
  equipmentWarrantyExpiringPayload,
} from "./assets.js";
import { messageReceivedPayload } from "./messaging.js";
import {
  manualRunPayload,
  scheduleDailyPayload,
  scheduleWeeklyPayload,
  webhookReceivedPayload,
} from "./system.js";

// ── Shape ────────────────────────────────────────────────────────────────────

export const EVENT_CATEGORIES = [
  "customer",
  "job",
  "booking",
  "quote",
  "invoice",
  "assets",
  "messaging",
  "system",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/**
 * Where an event comes from. Not cosmetic — it decides who is allowed to emit
 * it, and the emit path asserts it.
 *
 * - `domain` — a write in a domain service, in the caller's transaction.
 * - `derived` — a schedule worker noticed a date arrived. No write caused it.
 * - `manual` — a person pressed a button.
 */
/**
 * What makes an event real.
 *
 *   domain    — a write we made raised it, in the same transaction
 *   derived   — nothing happened; a date arrived and a sweep noticed
 *   manual    — somebody pressed Run
 *   external  — something outside Zaxvio called an inbound webhook
 *
 * `external` is the P9 addition and it is genuinely a fourth kind, not a
 * relabelling of one of the others: its payload is the only one in the taxonomy
 * that is **entirely author-controlled and entirely untrusted**. Everything else
 * here is built by a producer from a row we wrote.
 */
export const EVENT_ORIGINS = ["domain", "derived", "manual", "external"] as const;

/**
 * Which phase's producer makes an event real.
 *
 * A constant rather than a union written inline, for the same reason
 * `EVENT_CATEGORIES` and `EVENT_ORIGINS` are: the registry test asserts against
 * it. `P6` was added to the inline union when the `invoice.overdue` sweep landed
 * and the test kept its own hardcoded `["P2","P3","P9"]`, so a correct entry
 * failed a stale assertion — one closed set declared in two places, which is the
 * defect this whole feature keeps rediscovering.
 */
export const EVENT_PHASES = ["P2", "P3", "P6", "P9"] as const;
export type EventPhase = (typeof EVENT_PHASES)[number];
export type EventOrigin = (typeof EVENT_ORIGINS)[number];

export interface EventDefinition {
  /** Human label for the trigger palette and the run log. */
  label: string;
  description: string;
  category: EventCategory;
  origin: EventOrigin;
  /**
   * What the event is about. Drives enrollment, the dedup key and context
   * loading. `null` only for `schedule.*`, which is about nothing.
   */
  subject: SubjectType | null;
  /**
   * The phase whose producer makes this event real.
   *
   * Not decoration: `invoice.overdue` sat here as `P9` while its **trigger node
   * was already active in the palette**, so an automation could be built on an
   * event nothing raised. This field said so the whole time and nothing read it.
   * A test now asserts the real invariant — every event an active trigger
   * declares has a producer — and this stays as documentation of intent.
   */
  phase: EventPhase;
  payload: z.ZodType;
}

// ── The table ────────────────────────────────────────────────────────────────
//
// `satisfies` rather than a type annotation, so the literal keys survive and
// `EventPayloadFor<"job.completed">` infers the real payload type instead of a
// union of all of them.

export const WORKFLOW_EVENTS = {
  // ── Customer ──
  "customer.created": {
    label: "Customer created",
    description: "A new customer record was added, by anyone or anything.",
    category: "customer",
    origin: "domain",
    subject: "customer",
    phase: "P2",
    payload: customerCreatedPayload,
  },
  "customer.updated": {
    label: "Customer updated",
    description:
      "A customer's details changed. Carries which fields changed, not what they changed to.",
    category: "customer",
    origin: "domain",
    subject: "customer",
    phase: "P2",
    payload: customerUpdatedPayload,
  },
  "customer.tag_added": {
    label: "Tag added to customer",
    description: "A tag was applied — the usual way to hand-start an automation.",
    category: "customer",
    origin: "domain",
    subject: "customer",
    phase: "P2",
    payload: customerTagAddedPayload,
  },
  "customer.tag_removed": {
    label: "Tag removed from customer",
    description: "A tag was taken off a customer.",
    category: "customer",
    origin: "domain",
    subject: "customer",
    phase: "P2",
    payload: customerTagRemovedPayload,
  },

  // ── Job ──
  "job.created": {
    label: "Job created",
    description: "A job was created, whether typed in or converted from a quote or booking.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobCreatedPayload,
  },
  "job.updated": {
    label: "Job updated",
    description: "A job's details changed. Carries which fields changed.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobUpdatedPayload,
  },
  "job.stage_changed": {
    label: "Job moved to a stage",
    description:
      "A job moved between pipeline stages. Filter on the lifecycle, not the stage name, so renaming a column cannot break the automation.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobStageChangedPayload,
  },
  "job.completed": {
    label: "Job completed",
    description: "A job entered a completed stage. Fires once per completion, not per move between completed stages.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobCompletedPayload,
  },
  "job.assigned": {
    label: "Job assigned",
    description: "A job's assignee changed, including being cleared.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobAssignedPayload,
  },
  "job.scheduled": {
    label: "Job scheduled or rescheduled",
    description: "A job's date or time window changed.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobScheduledPayload,
  },
  "job.cancelled": {
    label: "Job cancelled",
    description: "A job entered a cancelled stage.",
    category: "job",
    origin: "domain",
    subject: "job",
    phase: "P2",
    payload: jobCancelledPayload,
  },
  "job.margin_below": {
    label: "Job margin below threshold",
    description:
      "A completed job's margin fell under the configured percentage. Only ever fires for jobs whose costs are fully entered.",
    category: "job",
    origin: "derived",
    subject: "job",
    phase: "P9",
    payload: jobMarginBelowPayload,
  },

  // ── Booking ──
  "booking.created": {
    label: "Booking received",
    description: "A booking request arrived, from the public portal or from staff.",
    category: "booking",
    origin: "domain",
    subject: "booking",
    phase: "P2",
    payload: bookingCreatedPayload,
  },
  "booking.confirmed": {
    label: "Booking confirmed",
    description: "A pending booking was confirmed.",
    category: "booking",
    origin: "domain",
    subject: "booking",
    phase: "P2",
    payload: bookingConfirmedPayload,
  },
  "booking.cancelled": {
    label: "Booking cancelled",
    description: "A booking was cancelled by staff or by the customer.",
    category: "booking",
    origin: "domain",
    subject: "booking",
    phase: "P2",
    payload: bookingCancelledPayload,
  },
  "booking.rescheduled": {
    label: "Booking rescheduled",
    description: "A booking moved to a different date or time.",
    category: "booking",
    origin: "domain",
    subject: "booking",
    phase: "P2",
    payload: bookingRescheduledPayload,
  },
  "booking.converted": {
    label: "Booking converted to a job",
    description: "A booking became real work. Carries both ids.",
    category: "booking",
    origin: "domain",
    subject: "booking",
    phase: "P2",
    payload: bookingConvertedPayload,
  },

  // ── Quote ──
  "quote.created": {
    label: "Quote created",
    description: "A quote was drafted. Not the same as sent — a draft has no token and no PDF.",
    category: "quote",
    origin: "domain",
    subject: "quote",
    phase: "P2",
    payload: quoteCreatedPayload,
  },
  "quote.sent": {
    label: "Quote sent",
    description: "A quote was issued to the customer, with its portal link and PDF in place.",
    category: "quote",
    origin: "domain",
    subject: "quote",
    phase: "P2",
    payload: quoteSentPayload,
  },
  "quote.accepted": {
    label: "Quote accepted",
    description: "The customer accepted, in the portal or by staff on their behalf.",
    category: "quote",
    origin: "domain",
    subject: "quote",
    phase: "P2",
    payload: quoteAcceptedPayload,
  },
  "quote.viewed": {
    label: "Quote viewed",
    description:
      "The customer opened their quote link for the first time. Fires once per quote.",
    category: "quote",
    origin: "domain",
    subject: "quote",
    phase: "P9",
    payload: quoteViewedPayload,
  },
  "quote.declined": {
    label: "Quote declined",
    description: "The customer declined. Carries their reason when they gave one.",
    category: "quote",
    origin: "domain",
    subject: "quote",
    phase: "P2",
    payload: quoteDeclinedPayload,
  },
  "quote.expired": {
    label: "Quote expired",
    description: "A quote passed its expiry date without a response.",
    category: "quote",
    origin: "derived",
    subject: "quote",
    phase: "P2",
    payload: quoteExpiredPayload,
  },

  // ── Invoice ──
  "invoice.created": {
    label: "Invoice created",
    description: "An invoice was raised, by hand or generated from a completed job.",
    category: "invoice",
    origin: "domain",
    subject: "invoice",
    phase: "P2",
    payload: invoiceCreatedPayload,
  },
  "invoice.sent": {
    label: "Invoice sent",
    description: "An invoice was issued to the customer.",
    category: "invoice",
    origin: "domain",
    subject: "invoice",
    phase: "P2",
    payload: invoiceSentPayload,
  },
  "invoice.payment_recorded": {
    label: "Payment recorded",
    description: "Any payment landed, including partial ones.",
    category: "invoice",
    origin: "domain",
    subject: "invoice",
    phase: "P2",
    payload: invoicePaymentRecordedPayload,
  },
  "invoice.paid": {
    label: "Invoice paid in full",
    description: "The balance reached zero. Derived from the payment rows, so it cannot fire for an invoice that still owes money.",
    category: "invoice",
    origin: "domain",
    subject: "invoice",
    phase: "P2",
    payload: invoicePaidPayload,
  },
  "invoice.overdue": {
    label: "Invoice overdue",
    description: "An invoice passed its due date by a configured number of days.",
    category: "invoice",
    origin: "derived",
    subject: "invoice",
    // Raised by `services/workflow/sweeps/invoice-overdue.ts`, hourly, once per
    // invoice per TENANT day. Daily rather than once-on-transition because the
    // node filters `daysOverdue` with `equals` — a 1/7/14-day chase sequence
    // needs the event every day, carrying that day's count.
    phase: "P6",
    payload: invoiceOverduePayload,
  },
  "invoice.voided": {
    label: "Invoice voided",
    description: "An invoice was voided.",
    category: "invoice",
    origin: "domain",
    subject: "invoice",
    phase: "P2",
    payload: invoiceVoidedPayload,
  },

  // ── Assets ──
  "equipment.created": {
    label: "Equipment added",
    description: "A piece of customer equipment was recorded.",
    category: "assets",
    origin: "domain",
    subject: "equipment",
    phase: "P2",
    payload: equipmentCreatedPayload,
  },
  "equipment.warranty_expiring": {
    label: "Warranty expiring",
    description: "A warranty is within the configured lead time. Fires once, not daily.",
    category: "assets",
    origin: "derived",
    subject: "equipment",
    phase: "P9",
    payload: equipmentWarrantyExpiringPayload,
  },
  "contract.visit_due": {
    label: "Service visit due",
    description: "A maintenance contract's next visit is due, computed from its frequency and last visit.",
    category: "assets",
    origin: "derived",
    subject: "maintenance_contract",
    phase: "P9",
    payload: contractVisitDuePayload,
  },
  "contract.expiring": {
    label: "Contract expiring",
    description: "A maintenance contract ends within the configured lead time.",
    category: "assets",
    origin: "derived",
    subject: "maintenance_contract",
    phase: "P9",
    payload: contractExpiringPayload,
  },

  // ── Messaging ──
  "message.received": {
    label: "Customer replied",
    description: "An inbound message arrived from a customer. The usual way to stop a follow-up sequence.",
    category: "messaging",
    origin: "domain",
    subject: "customer",
    phase: "P2",
    payload: messageReceivedPayload,
  },

  // ── System ──
  "schedule.daily": {
    label: "Every day",
    description: "Runs at a chosen local time. Has no subject — whatever it acts on, it finds.",
    category: "system",
    origin: "derived",
    subject: null,
    phase: "P9",
    payload: scheduleDailyPayload,
  },
  "schedule.weekly": {
    label: "Every week",
    description: "Runs on a chosen weekday and local time.",
    category: "system",
    origin: "derived",
    subject: null,
    phase: "P9",
    payload: scheduleWeeklyPayload,
  },
  "webhook.received": {
    label: "Webhook received",
    description:
      "Something outside Zaxvio called one of your webhook URLs. Has no subject - the automation decides what it is about.",
    category: "system",
    origin: "external",
    subject: null,
    phase: "P9",
    payload: webhookReceivedPayload,
  },
  "manual.run": {
    label: "Run manually",
    description: "Someone pressed Run, or tested a draft.",
    category: "system",
    origin: "manual",
    subject: null,
    phase: "P3",
    payload: manualRunPayload,
  },
} as const satisfies Record<string, EventDefinition>;

// ── Derived types ────────────────────────────────────────────────────────────

export type WorkflowEventType = keyof typeof WORKFLOW_EVENTS;

/** The parsed payload type for one specific event. */
export type EventPayloadFor<T extends WorkflowEventType> = z.infer<
  (typeof WORKFLOW_EVENTS)[T]["payload"]
>;

export const EVENT_TYPES = Object.keys(WORKFLOW_EVENTS) as WorkflowEventType[];

/**
 * The envelope. One shape for every event, whatever produced it.
 *
 * `occurredAt` is a real `Date` here because this object never touches the
 * database as-is — `emitWorkflowEvent` destructures it into columns. Only
 * `payload` is stored as jsonb, and that is why only `payload` is restricted to
 * JSON-safe values.
 */
export interface WorkflowEvent<T extends WorkflowEventType = WorkflowEventType> {
  type: T;
  tenantId: string;
  /** Null for `schedule.*`, which is about nothing in particular. */
  subject: { type: SubjectType; id: string } | null;
  /** Who did it. Null for a cron, a public portal visitor, or another automation. */
  actorUserId: string | null;
  occurredAt: Date;
  payload: EventPayloadFor<T>;
  /**
   * Producer-supplied. When two code paths can produce the same logical event —
   * a status write and a bulk write touching the same job in one request — the
   * second insert is refused rather than enqueued twice.
   */
  dedupKey?: string;
}

// ── Subscribers ──────────────────────────────────────────────────────────────

/**
 * One queue row per subscriber, and that is the whole point.
 *
 * The reference implementation ran nine coupled concerns serially inside one
 * handler, so a throw in the seventh failed the event and retried the first —
 * the automation re-ran because *nurture enrollment* failed. Independent rows
 * mean independent statuses, independent retry counts, and a failure in one
 * that the other never learns about.
 */
export const EVENT_SUBSCRIBERS = ["workflow_trigger", "goal_listener"] as const;
export type EventSubscriber = (typeof EVENT_SUBSCRIBERS)[number];

// ── Lookups ──────────────────────────────────────────────────────────────────

export function isWorkflowEventType(value: string): value is WorkflowEventType {
  return Object.prototype.hasOwnProperty.call(WORKFLOW_EVENTS, value);
}

export function getEventDefinition(type: string): EventDefinition | undefined {
  return isWorkflowEventType(type) ? WORKFLOW_EVENTS[type] : undefined;
}

/**
 * Throws when the event is unknown.
 *
 * Used by the emit path and the worker, where an unknown type is a bug in this
 * repo and not something a user can cause — so failing loudly beats a silent
 * skip that leaves a queue row nothing will ever claim.
 */
export function requireEventDefinition(type: string): EventDefinition {
  const def = getEventDefinition(type);
  if (!def) {
    throw new Error(
      `Unknown workflow event type "${type}". Add it to WORKFLOW_EVENTS in ` +
        `packages/workflow-nodes/src/events/registry.ts — the registry is the ` +
        `only list, and a type that is not in it cannot be filtered, logged or replayed.`,
    );
  }
  return def;
}

/** Events that can start an automation about a given subject. */
export function getEventsForSubject(subject: SubjectType): WorkflowEventType[] {
  return EVENT_TYPES.filter((t) => WORKFLOW_EVENTS[t].subject === subject);
}

export function getEventsByCategory(category: EventCategory): WorkflowEventType[] {
  return EVENT_TYPES.filter((t) => WORKFLOW_EVENTS[t].category === category);
}

/** Events whose producers exist in a given phase — what the palette may offer. */
export function getEventsForPhase(phase: EventDefinition["phase"]): WorkflowEventType[] {
  return EVENT_TYPES.filter((t) => WORKFLOW_EVENTS[t].phase === phase);
}

/**
 * Parse a payload against its event's schema.
 *
 * Called twice per event on purpose — once by the producer before the insert,
 * once by the worker after the read. The second call is not paranoia: it is the
 * only thing that catches a producer whose shape changed after rows were
 * already sitting in the queue, which is exactly what a deploy does.
 */
export function parseEventPayload<T extends WorkflowEventType>(
  type: T,
  payload: unknown,
): EventPayloadFor<T> {
  const def = requireEventDefinition(type);
  return def.payload.parse(payload) as EventPayloadFor<T>;
}

export function safeParseEventPayload(
  type: string,
  payload: unknown,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const def = getEventDefinition(type);
  if (!def) return { ok: false, error: `Unknown event type "${type}"` };
  const result = def.payload.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}
