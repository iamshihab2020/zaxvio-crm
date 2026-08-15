/**
 * Customer operations — one definition of tagging, untagging and editing.
 *
 * ## Why this exists
 *
 * Two reasons that happen to point the same way.
 *
 * [[wf-12-phases|P7]] scoped `services/customers/` as paying down
 * [[architecture|ARC-05]] — `routes/customers/index.ts` is 1,316 lines. True,
 * and the weaker reason. The stronger one is [[wf-00-decisions|D-17]]: an
 * executor may not write a table directly, because *"an executor containing an
 * `UPDATE` has, by definition, a second opinion about a business rule"*. The
 * `customer.addTag` node had no service to call, so it either could not ship or
 * would ship as that second opinion — which is exactly how `job.moveStage`
 * became the third implementation of a stage move.
 *
 * ## The rule that is easy to lose here
 *
 * **Tagging somebody twice must not enrol them twice.** The insert is
 * `onConflictDoNothing`, and a no-op returns no row — so no activity, and
 * critically **no event**. An automation on `trigger.customer.tagAdded` fires on
 * a tag going *on*, not on somebody pressing the button again. The route already
 * had this; a hand-written executor would have had to rediscover it, and the
 * failure would be silent and duplicated per customer.
 */

import {
  customerActivities,
  customerTags,
  customers,
  tags,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import {
  emitCustomerTagAddedEvent,
  emitCustomerTagRemovedEvent,
  emitCustomerUpdatedEvent,
} from "./customer-events.service.js";
import { actorMetadata, actorUserId, describeActor, type Actor } from "../actor.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;
type CustomerRow = typeof customers.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

export type TagCustomerFailure =
  | "customer_not_found"
  | "tag_not_found"
  | "already_tagged"
  | "not_tagged";

export type TagCustomerResult =
  | { ok: true; tagId: string; tagName: string }
  | { ok: false; reason: TagCustomerFailure; message: string };

export interface TagCustomerArgs {
  tenantId: string;
  customerId: string;
  /** By id when a picker chose it; by name when a template or filter names it. */
  tagId?: string;
  tagName?: string;
  actor: Actor;
}

/**
 * Resolve a tag by id **or** name, both tenant-scoped.
 *
 * By name matters more than it looks. A uuid in a saved automation is
 * unverifiable by eye and unportable — a template carrying one silently matches
 * nothing in the workspace that installs it, and the author has no way to see
 * why. Every template that touches a tag names it.
 */
async function resolveTag(
  db: Db,
  tenantId: string,
  args: { tagId?: string; tagName?: string },
): Promise<{ id: string; name: string } | null> {
  if (args.tagId) {
    const [row] = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.tenantId, tenantId), eq(tags.id, args.tagId)));
    return row ?? null;
  }
  if (args.tagName) {
    const [row] = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.tenantId, tenantId), eq(tags.name, args.tagName.trim())));
    return row ?? null;
  }
  return null;
}

async function loadCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
  return row ?? null;
}

export async function addCustomerTag(
  db: Db,
  args: TagCustomerArgs,
): Promise<TagCustomerResult> {
  const { tenantId, customerId, actor } = args;

  if (!(await loadCustomer(db, tenantId, customerId))) {
    return { ok: false, reason: "customer_not_found", message: "Customer not found" };
  }

  const tag = await resolveTag(db, tenantId, args);
  if (!tag) {
    return {
      ok: false,
      reason: "tag_not_found",
      message: args.tagName
        ? `No tag called "${args.tagName}" in this workspace.`
        : "Tag not found",
    };
  }

  const written = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customerTags)
      .values({ customerId, tagId: tag.id })
      .onConflictDoNothing()
      .returning();

    // Already tagged. No row, no activity, and — the point — **no event**:
    // tagging somebody `vip` twice must not enrol them in the VIP automation
    // twice. Reported to the caller so a run log can say so rather than
    // claiming a change that did not happen.
    if (!row) return null;

    await tx.insert(customerActivities).values({
      tenantId,
      customerId,
      type: "tag.assigned",
      description: describeActor(actor, `Tagged as "${tag.name}"`),
      metadata: { tagId: tag.id, tagName: tag.name, ...actorMetadata(actor) },
      performedBy: actorUserId(actor),
    });

    await emitCustomerTagAddedEvent(tx, {
      tenantId,
      actorUserId: actorUserId(actor),
      customerId,
      tag: { id: tag.id, name: tag.name },
    });

    return row;
  });

  if (!written) {
    return {
      ok: false,
      reason: "already_tagged",
      message: `That customer already has the "${tag.name}" tag.`,
    };
  }

  return { ok: true, tagId: tag.id, tagName: tag.name };
}

export async function removeCustomerTag(
  db: Db,
  args: TagCustomerArgs,
): Promise<TagCustomerResult> {
  const { tenantId, customerId, actor } = args;

  if (!(await loadCustomer(db, tenantId, customerId))) {
    return { ok: false, reason: "customer_not_found", message: "Customer not found" };
  }

  const tag = await resolveTag(db, tenantId, args);
  if (!tag) {
    return {
      ok: false,
      reason: "tag_not_found",
      message: args.tagName
        ? `No tag called "${args.tagName}" in this workspace.`
        : "Tag not found",
    };
  }

  const removed = await db.transaction(async (tx) => {
    const rows = await tx
      .delete(customerTags)
      .where(
        and(eq(customerTags.customerId, customerId), eq(customerTags.tagId, tag.id)),
      )
      .returning();

    // The same asymmetry as the insert, in the other direction: a delete that
    // matched nothing is not a removal, and raising `customer.tag_removed` for
    // it would fire an automation for a change that did not happen. The tag
    // delete could not previously tell a real removal from a no-op.
    if (rows.length === 0) return false;

    await tx.insert(customerActivities).values({
      tenantId,
      customerId,
      type: "tag.removed",
      description: describeActor(actor, `Removed the "${tag.name}" tag`),
      metadata: { tagId: tag.id, tagName: tag.name, ...actorMetadata(actor) },
      performedBy: actorUserId(actor),
    });

    await emitCustomerTagRemovedEvent(tx, {
      tenantId,
      actorUserId: actorUserId(actor),
      customerId,
      tag: { id: tag.id, name: tag.name },
    });

    return true;
  });

  if (!removed) {
    return {
      ok: false,
      reason: "not_tagged",
      message: `That customer does not have the "${tag.name}" tag.`,
    };
  }

  return { ok: true, tagId: tag.id, tagName: tag.name };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field updates
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateCustomerFailure = "not_found" | "nothing_to_change";

export type UpdateCustomerResult =
  | { ok: true; customer: CustomerRow; changedFields: string[] }
  | { ok: false; reason: UpdateCustomerFailure; message: string };

/**
 * Columns an automation or a form may write, and what to call each to a reader.
 *
 * A closed list rather than "whatever is in the body". `tenantId`, `id` and the
 * timestamps are not editable, and an allow-list is the only version of that
 * rule that cannot be defeated by a new column being added to the table.
 */
const UPDATABLE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zipCode",
  "notes",
] as const;

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  city: "City",
  state: "State",
  zipCode: "Postcode",
  notes: "Notes",
};

/** Same rule as jobs: one spelling of empty, and it is NULL. */
const NULLABLE_TEXT = new Set([
  "email",
  "phone",
  "address",
  "city",
  "state",
  "zipCode",
  "notes",
]);

export interface UpdateCustomerArgs {
  tenantId: string;
  customerId: string;
  input: Partial<Record<(typeof UPDATABLE_FIELDS)[number], string | null>>;
  actor: Actor;
}

export async function updateCustomer(
  db: Db,
  args: UpdateCustomerArgs,
): Promise<UpdateCustomerResult> {
  const { tenantId, customerId, input, actor } = args;

  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));

  if (!existing) {
    return { ok: false, reason: "not_found", message: "Customer not found" };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const changedFields: string[] = [];

  for (const field of UPDATABLE_FIELDS) {
    if (!(field in input)) continue;
    const raw = input[field];
    const value =
      NULLABLE_TEXT.has(field) && typeof raw === "string" && raw.trim() === ""
        ? null
        : raw;
    if (String(existing[field] ?? "") !== String(value ?? "")) {
      changedFields.push(field);
    }
    updates[field] = value;
  }

  // Refused rather than performed. `emitCustomerUpdatedEvent` would otherwise
  // raise `customer.updated` for a change that did not happen — an automation
  // firing for nothing, and on a resumed run, firing again every time.
  if (changedFields.length === 0) {
    return {
      ok: false,
      reason: "nothing_to_change",
      message: "Nothing on that customer was different, so nothing was changed.",
    };
  }

  const final = await db.transaction(async (tx) => {
    await tx
      .update(customers)
      .set(updates)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));

    await tx.insert(customerActivities).values({
      tenantId,
      customerId,
      type: "customer.updated",
      description: describeActor(
        actor,
        `Updated ${changedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}`,
      ),
      metadata: { changedFields, ...actorMetadata(actor) },
      performedBy: actorUserId(actor),
    });

    await emitCustomerUpdatedEvent(tx, {
      tenantId,
      actorUserId: actorUserId(actor),
      customerId,
      changedFields,
    });

    const [row] = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
    return row;
  });

  return { ok: true, customer: final, changedFields };
}
