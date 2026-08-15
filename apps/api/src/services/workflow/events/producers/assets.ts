/**
 * The three **derived** asset producers. P9.
 *
 * Every other producer in this directory is called by a domain service in the
 * same transaction as the write that caused it. These three have no such write:
 * nothing *happens* to make a warranty expire or a maintenance visit fall due
 * except a date arriving. So their caller is the schedule sweep, and they are
 * split from `misc.ts` — which holds the P2 asset producer, `equipment.created`
 * — because that file's own docblock says so:
 *
 * > *"their producers land with the schedule worker in P9 rather than here.
 * > Writing them now would mean writing them against a worker that does not
 * > exist, which is how a producer ends up emitting a shape nothing ever
 * > consumes."*
 *
 * ## Not in a transaction with anything
 *
 * The outbox's whole point is that an event commits with the change that caused
 * it. There is no change here, so there is nothing to commit with — and the
 * safety comes from somewhere else instead: the sweep claims a row in
 * `workflow_schedule_state` **before** calling these, and only the claimant
 * emits. That claim is the transaction boundary that matters.
 *
 * ## Every field is written out by name, twice, on purpose
 *
 * The two contract payloads share eleven fields and this file does **not**
 * factor them into a `...contractBase(c)` spread. `workflow-producers.test.ts`
 * forbids `...` anywhere in this directory, and the rule is deliberately blunt
 * rather than clever: a spread carries whatever the source object happens to
 * have and silently changes shape when something is added to it. The reference
 * implementation shipped `pipeline_stage_id` to a consumer reading `stageId`
 * that way and lost every stage-filtered automation for months.
 *
 * Duplication that a reader can diff beats a helper that a migration can
 * quietly widen.
 */

import type { ServiceFrequency } from "@hvac-saas/workflow-nodes";
import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import { isoDate, isoDateTime, type ProducerContext } from "./shared.js";

/** The equipment fields the sweep reads, in the payload's own vocabulary. */
export interface WarrantyEquipment {
  equipmentId: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  installDate: Date | string | null;
  warrantyExpiry: Date | string;
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
}

export interface WarrantyExpiringArgs extends ProducerContext {
  equipment: WarrantyEquipment;
  daysUntilExpiry: number;
}

export function equipmentWarrantyExpiring(
  db: EmitDb,
  args: WarrantyExpiringArgs,
) {
  const e = args.equipment;
  return emitWorkflowEvent(db, {
    type: "equipment.warranty_expiring",
    tenantId: args.tenantId,
    subject: { type: "equipment", id: e.equipmentId },
    actorUserId: args.actorUserId,
    payload: {
      customerId: e.customerId,
      customerFirstName: e.customerFirstName,
      customerLastName: e.customerLastName,
      customerEmail: e.customerEmail,
      customerPhone: e.customerPhone,
      equipmentId: e.equipmentId,
      equipmentType: e.equipmentType,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serialNumber,
      location: e.location,
      installDate: isoDate(e.installDate),
      warrantyExpiry: isoDate(e.warrantyExpiry),
      // Non-null by construction: the sweep's `WHERE` excludes a null expiry,
      // so an equipment record with no warranty date can never reach here.
      warrantyExpiryDate: isoDate(e.warrantyExpiry)!,
      daysUntilExpiry: args.daysUntilExpiry,
    },
  });
}

/** The contract fields both contract events read. */
export interface ContractRecord {
  contractId: string;
  contractName: string;
  equipmentId?: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  /**
   * The `service_frequency` enum, or null on an old row.
   *
   * Typed as the union rather than `string`: the payload schema declares a
   * closed enum, and a `string` reaching it fails the parse at emit time —
   * which drops the event silently and makes the automation never fire. The
   * sweep's SQL casts `frequency::text`, so its Zod row schema is where the
   * shape is re-established.
   */
  frequency: ServiceFrequency | null;
  visitsPerYear: number | null;
  annualPrice: string | null;
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
}

export interface ContractExpiringArgs extends ProducerContext {
  contract: ContractRecord;
  daysUntilEnd: number;
  /** So an automation does not become the second thing to say the same
   *  sentence the E-09 renewal email already said. */
  renewalReminderSent?: boolean;
}

export function contractExpiring(db: EmitDb, args: ContractExpiringArgs) {
  const c = args.contract;
  return emitWorkflowEvent(db, {
    type: "contract.expiring",
    tenantId: args.tenantId,
    subject: { type: "maintenance_contract", id: c.contractId },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.customerId,
      customerFirstName: c.customerFirstName,
      customerLastName: c.customerLastName,
      customerEmail: c.customerEmail,
      customerPhone: c.customerPhone,
      contractId: c.contractId,
      contractName: c.contractName,
      equipmentId: c.equipmentId ?? null,
      // The column is nullable and the payload's enum is not. `annual` is the
      // schema's own default, so a row predating the column reads as what it
      // would have been rather than failing the parse — which would drop the
      // event entirely and make the automation silently never fire.
      frequency: c.frequency ?? "annual",
      visitsPerYear: c.visitsPerYear ?? 2,
      annualPrice: c.annualPrice,
      startDate: isoDate(c.startDate)!,
      endDate: isoDate(c.endDate),
      // Non-null by construction: the sweep filters on `end_date`.
      contractEndDate: isoDate(c.endDate)!,
      daysUntilExpiry: args.daysUntilEnd,
      renewalReminderSent: args.renewalReminderSent ?? false,
      detectedAt: isoDateTime(new Date()),
    },
  });
}

export interface ContractVisitDueArgs extends ProducerContext {
  contract: ContractRecord;
  visitDate: string;
  daysUntilVisit: number;
  lastVisitDate?: string | null;
}

export function contractVisitDue(db: EmitDb, args: ContractVisitDueArgs) {
  const c = args.contract;
  return emitWorkflowEvent(db, {
    type: "contract.visit_due",
    tenantId: args.tenantId,
    subject: { type: "maintenance_contract", id: c.contractId },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.customerId,
      customerFirstName: c.customerFirstName,
      customerLastName: c.customerLastName,
      customerEmail: c.customerEmail,
      customerPhone: c.customerPhone,
      contractId: c.contractId,
      contractName: c.contractName,
      equipmentId: c.equipmentId ?? null,
      frequency: c.frequency ?? "annual",
      visitsPerYear: c.visitsPerYear ?? 2,
      annualPrice: c.annualPrice,
      startDate: isoDate(c.startDate)!,
      endDate: isoDate(c.endDate),
      dueDate: args.visitDate,
      lastVisitDate: args.lastVisitDate ?? null,
      // Which visit of the year this is, so a message can say "your second of
      // four tune-ups" without the automation counting anything. Derived from
      // where the due date falls in the year rather than from a stored counter,
      // for the same reason the due date itself is derived: a stored count
      // drifts the moment somebody edits the frequency.
      visitNumber: visitNumberFor(args.visitDate, c),
    },
  });
}

/**
 * Which visit of the contract year this is, 1-based.
 *
 * Months elapsed since the start, divided by the interval between visits.
 * Clamped to at least 1 — a payload field declared `.min(1)` that could be 0
 * would fail its own parse and drop the event, which is the quietest possible
 * way to make an automation never fire.
 */
function visitNumberFor(visitDate: string, c: ContractRecord): number {
  const start = new Date(`${String(isoDate(c.startDate))}T12:00:00Z`);
  const visit = new Date(`${visitDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(visit.getTime())) return 1;

  const perYear = Math.max(c.visitsPerYear ?? 2, 1);
  const monthsBetween = 12 / perYear;
  const elapsed =
    (visit.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (visit.getUTCMonth() - start.getUTCMonth());

  // Modulo the year, so the third year's first visit is "1 of 4" rather than
  // "9 of 4" — the customer's mental model is the year, not the whole term.
  const index = Math.round(elapsed / monthsBetween) % perYear;
  return Math.max(index + 1, 1);
}
