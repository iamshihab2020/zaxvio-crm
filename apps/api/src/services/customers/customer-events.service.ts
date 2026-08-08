/**
 * Workflow events for a customer.
 *
 * A customer is created in **four** places — `POST /customers`, the public
 * booking portal, the booking→job conversion, and (via the portal) a quote
 * acceptance — and only the first of them is in the customers route file. That
 * is the whole argument for this service: a payload assembled at each call site
 * is a payload that drifts, and the three outside `routes/customers` are exactly
 * the ones nobody thinks to update.
 *
 * Every function takes an id and reads the row. One query more than passing the
 * row in, and one shape guaranteed instead of four written by hand.
 */

import { customers, and, eq, type getDb } from "@hvac-saas/database";
import {
  customerCreated,
  customerTagAdded,
  customerTagRemoved,
  customerUpdated,
  type CustomerArgs,
} from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/** Where a customer record came from. Automations read it to avoid greeting
 *  someone twice when a booking already welcomed them. */
export type CustomerSource = "manual" | "booking" | "quote" | "import" | "api";

type CustomerContext = CustomerArgs & {
  city: string | null;
  state: string | null;
  zipCode: string | null;
  createdAt: Date;
};

async function loadCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<CustomerContext | null> {
  const [row] = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      city: customers.city,
      state: customers.state,
      zipCode: customers.zipCode,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));

  if (!row) return null;
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    zipCode: row.zipCode,
    createdAt: row.createdAt,
  };
}

export interface EmitCustomerCreatedArgs {
  tenantId: string;
  /** Null for the public portal — a visitor is not a user. */
  actorUserId: string | null;
  customerId: string;
  source: CustomerSource;
}

export async function emitCustomerCreatedEvent(
  db: Db,
  args: EmitCustomerCreatedArgs,
): Promise<void> {
  const customer = await loadCustomer(db, args.tenantId, args.customerId);
  if (!customer) return;

  await customerCreated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    customer,
    source: args.source,
  });
}

export interface EmitCustomerUpdatedArgs {
  tenantId: string;
  actorUserId: string | null;
  customerId: string;
  /**
   * The route's own diff. Passed in rather than recomputed: the route already
   * normalises `""` to null before comparing, and a second diff that did not
   * would report a change the route decided was not one.
   */
  changedFields: string[];
}

export async function emitCustomerUpdatedEvent(
  db: Db,
  args: EmitCustomerUpdatedArgs,
): Promise<void> {
  if (args.changedFields.length === 0) return;

  const customer = await loadCustomer(db, args.tenantId, args.customerId);
  if (!customer) return;

  await customerUpdated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    customer,
    changedFields: args.changedFields,
  });
}

export interface EmitCustomerTagArgs {
  tenantId: string;
  actorUserId: string | null;
  customerId: string;
  tag: { id: string; name: string };
}

/**
 * Tag events are the trigger most automations will actually use — "tag someone
 * `vip` and the workflow runs" is how a non-technical owner builds a segment
 * without a filter node. Both verbs emit, because a workflow that enrols on a
 * tag needs to know when the tag comes off as much as when it goes on.
 */
export async function emitCustomerTagAddedEvent(
  db: Db,
  args: EmitCustomerTagArgs,
): Promise<void> {
  const customer = await loadCustomer(db, args.tenantId, args.customerId);
  if (!customer) return;

  await customerTagAdded(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    customer,
    tag: args.tag,
  });
}

export async function emitCustomerTagRemovedEvent(
  db: Db,
  args: EmitCustomerTagArgs,
): Promise<void> {
  const customer = await loadCustomer(db, args.tenantId, args.customerId);
  if (!customer) return;

  await customerTagRemoved(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    customer,
    tag: args.tag,
  });
}
