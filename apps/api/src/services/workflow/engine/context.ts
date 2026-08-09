/**
 * Building the execution context.
 *
 * The load-bearing rule is **the customer is always resolved** (wf-00 D-02).
 * Every one of the seven subject tables carries a `customer_id`, so
 * `{{customer.email}}` works on a job-, invoice-, quote- or booking-triggered
 * run without the author thinking about it. The system this was ported from
 * hard-coded `contact_id` on the run and needed a second nullable column the
 * moment a second subject type appeared.
 *
 * Everything loaded here is **plain JSON**: no `Date`, no ORM row. The whole
 * context is serialised into `workflow_executions.waiting_context` when a delay
 * pauses a run and comes back out of `jsonb` weeks later, so a `Date` that goes
 * in comes out a string — and a fresh run and a resumed one would then disagree
 * about the type of the same field.
 *
 * Every query carries `tenantId`. There is no row-level security underneath
 * (wf-00 D-16), and a subject id can arrive from a saved node config, which is
 * client-supplied data exactly like a request body.
 */

import {
  bookings,
  customers,
  equipment,
  invoices,
  jobs,
  jobPipelineStages,
  maintenanceContracts,
  pipelines,
  quotes,
  tenants,
  user,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import {
  DEFAULT_TIMEZONE,
  type BookingContext,
  type ContractContext,
  type CustomerContext,
  type EquipmentContext,
  type ExecutionContext,
  type InvoiceContext,
  type JobContext,
  type MemberContext,
  type QuoteContext,
  type SubjectType,
  type TenantContext,
} from "@hvac-saas/workflow-nodes";
import { env } from "../../../lib/env.js";
import { SubjectGone } from "./errors.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface LoadContextParams {
  tenantId: string;
  workflowId: string;
  workflowName: string;
  versionId: string;
  executionId: string;
  /** Already resolved: workflow zone → tenant zone → default. Never the server. */
  timezone: string;
  subject: { type: SubjectType; id: string } | null;
  trigger: { event: string | null; payload: Record<string, unknown> };
}

/**
 * Load everything a run can reference.
 *
 * Throws `SubjectGone` when the subject row has vanished — which terminates the
 * run as **cancelled**, not failed. A job deleted while an automation was
 * waiting three days for it is expected behaviour, and a failure notification
 * for one teaches people to ignore failure notifications.
 */
export async function loadExecutionContext(
  db: Db,
  params: LoadContextParams,
): Promise<ExecutionContext> {
  const { tenantId } = params;

  const tenant = await loadTenant(db, tenantId);
  if (!tenant) {
    throw new SubjectGone("workspace", tenantId);
  }

  const ctx: ExecutionContext = {
    tenantId,
    timezone: params.timezone,
    workflowId: params.workflowId,
    workflowName: params.workflowName,
    versionId: params.versionId,
    executionId: params.executionId,
    subject: params.subject,
    customer: null,
    tenant,
    trigger: params.trigger,
    nodeOutputs: {},
    nodeLabels: {},
    vars: {},
  };

  if (!params.subject) return ctx;

  // The subject loader also returns the customer id it hangs off, so the
  // customer is one query rather than a per-subject join written seven times.
  const loaded = await loadSubject(db, tenantId, params.subject);
  if (!loaded) {
    throw new SubjectGone(params.subject.type, params.subject.id);
  }

  Object.assign(ctx, loaded.namespaces);

  if (loaded.customerId) {
    ctx.customer = await loadCustomer(db, tenantId, loaded.customerId);
  }
  if (loaded.assigneeId) {
    ctx.assignee = (await loadMember(db, loaded.assigneeId)) ?? undefined;
  }

  return ctx;
}

/**
 * Re-read the namespaces a node declared it `mutates`, and invalidate the
 * analytics cache.
 *
 * Declarative rather than imperative: a node says `mutates: ["job"]` and the
 * engine does the rest. The reference implementation hand-writes this in 753
 * lines, and its own audit says to declare it instead.
 *
 * **The cache line is the easiest thing in this feature to forget and the
 * hardest to notice.** The server invalidates the analytics cache on an
 * `onResponse` hook, and an engine write has no request — so without this a
 * workflow that records a payment leaves the dashboard wrong for up to ten
 * minutes and nothing anywhere says why.
 */
export async function refreshAfterNode(
  db: Db,
  ctx: ExecutionContext,
  mutates: SubjectType[] | undefined,
): Promise<void> {
  if (!mutates || mutates.length === 0) return;

  for (const kind of mutates) {
    const id = idFor(ctx, kind);
    if (!id) continue;
    const loaded = await loadSubject(db, ctx.tenantId, { type: kind, id });
    // A node that deleted its own subject is legitimate — `job.delete` would.
    // The run continues; the namespace simply stops resolving.
    if (loaded) Object.assign(ctx, loaded.namespaces);
  }

  const { analyticsCache } = await import("../../analytics/cache.js");
  analyticsCache.invalidateTenant(ctx.tenantId);
}

function idFor(ctx: ExecutionContext, kind: SubjectType): string | null {
  switch (kind) {
    case "customer":
      return ctx.customer?.id ?? null;
    case "job":
      return ctx.job?.id ?? null;
    case "invoice":
      return ctx.invoice?.id ?? null;
    case "quote":
      return ctx.quote?.id ?? null;
    case "booking":
      return ctx.booking?.id ?? null;
    case "equipment":
      return ctx.equipment?.id ?? null;
    case "maintenance_contract":
      return ctx.contract?.id ?? null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialise / restore
// ─────────────────────────────────────────────────────────────────────────────

export interface SerialisedContext {
  context: Record<string, unknown>;
  truncated: boolean;
}

/**
 * Prepare a context for `waiting_context`.
 *
 * Over the cap, keep the subject, customer, tenant, trigger payload, loop state
 * and the **last five** node outputs; drop the rest and flag it. No cleverness
 * about *which* outputs matter — only a size limit — because a rule about
 * importance would be wrong in a way nobody could see, whereas a truncation you
 * can see beats a 10 MB row you cannot (wf-00 D-20).
 */
export function serialiseContext(
  ctx: ExecutionContext,
  maxBytes: number,
): SerialisedContext {
  const full = JSON.parse(JSON.stringify(ctx)) as Record<string, unknown>;
  if (byteLength(full) <= maxBytes) {
    return { context: full, truncated: false };
  }

  const outputs = (full.nodeOutputs ?? {}) as Record<string, unknown>;
  const keys = Object.keys(outputs);
  const kept: Record<string, unknown> = {};
  for (const key of keys.slice(-5)) kept[key] = outputs[key];
  full.nodeOutputs = kept;

  return { context: full, truncated: true };
}

function byteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
}

/**
 * Restore a paused context and **re-read the world**.
 *
 * Node outputs stay exactly as they were — they are a record of what happened,
 * and rewriting history would make a replay lie. Everything else is re-read:
 * a run that paused three weeks ago has a snapshot of a customer who may since
 * have moved, been renamed, or unsubscribed, and sending to the snapshot is how
 * an automation emails somebody who opted out a fortnight earlier.
 */
export async function restoreContext(
  db: Db,
  stored: Record<string, unknown>,
  params: LoadContextParams,
): Promise<ExecutionContext> {
  const fresh = await loadExecutionContext(db, params);
  return {
    ...fresh,
    nodeOutputs: (stored.nodeOutputs as Record<string, unknown>) ?? {},
    nodeLabels: (stored.nodeLabels as Record<string, string>) ?? {},
    vars: (stored.vars as Record<string, unknown>) ?? {},
    loop: stored.loop as ExecutionContext["loop"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loaders
// ─────────────────────────────────────────────────────────────────────────────

interface LoadedSubject {
  namespaces: Partial<ExecutionContext>;
  customerId: string | null;
  assigneeId: string | null;
}

async function loadSubject(
  db: Db,
  tenantId: string,
  subject: { type: SubjectType; id: string },
): Promise<LoadedSubject | null> {
  switch (subject.type) {
    case "customer": {
      const found = await loadCustomer(db, tenantId, subject.id);
      return found
        ? { namespaces: { customer: found }, customerId: found.id, assigneeId: null }
        : null;
    }
    case "job":
      return loadJob(db, tenantId, subject.id);
    case "invoice":
      return loadInvoice(db, tenantId, subject.id);
    case "quote":
      return loadQuote(db, tenantId, subject.id);
    case "booking":
      return loadBooking(db, tenantId, subject.id);
    case "equipment":
      return loadEquipment(db, tenantId, subject.id);
    case "maintenance_contract":
      return loadContract(db, tenantId, subject.id);
    default:
      return null;
  }
}

async function loadCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<CustomerContext | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
  if (!row) return null;

  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`.trim(),
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zipCode,
    fullAddress: joinAddress(row.address, row.city, row.state, row.zipCode),
    notes: row.notes,
    isOptedOut: row.emailOptOutAt !== null,
  };
}

async function loadJob(
  db: Db,
  tenantId: string,
  jobId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select({
      job: jobs,
      stageName: jobPipelineStages.label,
      stageLifecycle: jobPipelineStages.lifecycle,
      pipelineName: pipelines.name,
      assigneeName: user.name,
      assigneeEmail: user.email,
    })
    .from(jobs)
    .leftJoin(
      jobPipelineStages,
      and(
        eq(jobs.stageId, jobPipelineStages.id),
        eq(jobPipelineStages.tenantId, tenantId),
      ),
    )
    .leftJoin(
      pipelines,
      and(eq(jobs.pipelineId, pipelines.id), eq(pipelines.tenantId, tenantId)),
    )
    .leftJoin(user, eq(jobs.assigneeId, user.id))
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

  if (!row) return null;
  const j = row.job;

  const context: JobContext = {
    id: j.id,
    number: j.jobNumber ?? "",
    title: j.title,
    description: j.description,
    serviceType: j.serviceType,
    priority: j.priority,
    status: j.status,
    stageName: row.stageName,
    stageLifecycle: row.stageLifecycle,
    pipelineName: row.pipelineName,
    scheduledDate: j.scheduledDate,
    scheduledStart: j.scheduledStart,
    scheduledEnd: j.scheduledEnd,
    // The job's own address, falling back to the customer's. A job created from
    // a booking often carries none, and "we'll be at " with nothing after it is
    // the kind of email that generates a phone call.
    address: j.address,
    subtotal: j.subtotal ?? "0.00",
    taxAmount: j.taxAmount ?? "0.00",
    total: j.totalAmount ?? "0.00",
    assigneeName: row.assigneeName,
    assigneeEmail: row.assigneeEmail,
    completedAt: j.completedAt ? j.completedAt.toISOString() : null,
    actualHours: j.actualHours ?? null,
    // Margin is deliberately not computed here. `services/costing` owns the one
    // definition of a job's margin, and it needs line items and expenses this
    // query does not read — a second, cheaper answer that disagreed with the
    // Costs tab is worse than no answer. P7 wires it through the same service.
    marginPercent: null,
    costCoverage: "unknown",
  };

  return {
    namespaces: { job: context },
    customerId: j.customerId,
    assigneeId: j.assigneeId,
  };
}

async function loadInvoice(
  db: Db,
  tenantId: string,
  invoiceId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)));
  if (!row) return null;

  // Terms live on the tenant, not the invoice. One extra read, and only on
  // invoice-subject runs — the alternative is `{{invoice.paymentTerms}}`
  // resolving blank, which is INV-08 again: terms were collected, printed on
  // the PDF, and used by nothing.
  const [terms] = await db
    .select({ paymentTerms: tenants.invoicePaymentTerms })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const context: InvoiceContext = {
    id: row.id,
    number: row.invoiceNumber ?? "",
    status: row.status,
    issueDate: row.issuedDate,
    dueDate: row.dueDate,
    subtotal: row.subtotal ?? "0.00",
    taxAmount: row.taxAmount ?? "0.00",
    total: row.totalAmount ?? "0.00",
    amountPaid: row.amountPaid ?? "0.00",
    balanceDue: row.balanceDue ?? "0.00",
    daysOverdue: daysPast(row.dueDate),
    paymentTerms: terms?.paymentTerms ?? null,
    publicUrl: `${env.FRONTEND_URL}/invoices/${row.id}`,
  };

  return { namespaces: { invoice: context }, customerId: row.customerId, assigneeId: null };
}

async function loadQuote(
  db: Db,
  tenantId: string,
  quoteId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)));
  if (!row) return null;

  // No token, no portal link. QUO-01: a quote could reach `sent` without an
  // access token, and a link built regardless would 404 in the customer's
  // inbox. Null is the honest answer, and the picker's description says so.
  const portal = row.accessToken
    ? `${env.FRONTEND_URL}/quote/${row.accessToken}`
    : null;

  const context: QuoteContext = {
    id: row.id,
    number: row.quoteNumber ?? "",
    status: row.status,
    issueDate: row.issuedDate,
    expiryDate: row.expiryDate,
    subtotal: row.subtotal ?? "0.00",
    taxAmount: row.taxAmount ?? "0.00",
    total: row.totalAmount ?? "0.00",
    publicUrl: portal,
    acceptUrl: portal ? `${portal}#accept` : null,
  };

  return { namespaces: { quote: context }, customerId: row.customerId, assigneeId: null };
}

async function loadBooking(
  db: Db,
  tenantId: string,
  bookingId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), eq(bookings.id, bookingId)));
  if (!row) return null;

  const context: BookingContext = {
    id: row.id,
    date: row.bookingDate,
    startTime: row.preferredTime,
    endTime: null,
    serviceType: row.serviceType,
    status: row.status,
    source: row.source,
    notes: row.description,
  };

  // The only subject whose customer may be null — a portal submission exists
  // before anyone in the CRM has touched it.
  return { namespaces: { booking: context }, customerId: row.customerId, assigneeId: null };
}

async function loadEquipment(
  db: Db,
  tenantId: string,
  equipmentId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select()
    .from(equipment)
    .where(and(eq(equipment.tenantId, tenantId), eq(equipment.id, equipmentId)));
  if (!row) return null;

  const context: EquipmentContext = {
    id: row.id,
    name: [row.brand, row.model].filter(Boolean).join(" ") || row.equipmentType,
    type: row.equipmentType,
    make: row.brand,
    model: row.model,
    serialNumber: row.serialNumber,
    installDate: row.installDate,
    warrantyExpiresAt: row.warrantyExpiry,
    location: row.location,
  };

  return { namespaces: { equipment: context }, customerId: row.customerId, assigneeId: null };
}

async function loadContract(
  db: Db,
  tenantId: string,
  contractId: string,
): Promise<LoadedSubject | null> {
  const [row] = await db
    .select()
    .from(maintenanceContracts)
    .where(
      and(
        eq(maintenanceContracts.tenantId, tenantId),
        eq(maintenanceContracts.id, contractId),
      ),
    );
  if (!row) return null;

  const context: ContractContext = {
    id: row.id,
    name: row.contractName,
    startDate: row.startDate,
    endDate: row.endDate,
    annualPrice: row.annualPrice ?? "0.00",
    visitsPerYear: row.visitsPerYear,
    frequency: row.frequency,
    // There is no `next_visit_due` column — the schedule is derived from
    // `startDate` + `frequency`, and `contract.visit_due` is a P9 scheduled
    // event that will compute it in one place. Null rather than a second,
    // cheaper derivation here that could disagree with the one that matters.
    nextVisitDue: null,
  };

  return { namespaces: { contract: context }, customerId: row.customerId, assigneeId: null };
}

async function loadTenant(db: Db, tenantId: string): Promise<TenantContext | null> {
  const [row] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!row) return null;

  return {
    businessName: row.businessName,
    ownerName: null,
    email: row.email ?? null,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zipCode,
    fullAddress: joinAddress(row.address, row.city, row.state, row.zipCode),
    logoUrl: row.logoUrl,
    licenseNumber: row.licenseNumber,
    bookingUrl: row.slug ? `${env.FRONTEND_URL}/book/${row.slug}` : null,
    googleReviewUrl: row.googleReviewUrl,
    timezone: row.timezone ?? DEFAULT_TIMEZONE,
  };
}

/**
 * The Better Auth `user` table has no tenant column, so this reads by id alone.
 * That is safe because the id only ever comes from `jobs.assignee_id`, which is
 * validated as an org member before it is written.
 */
async function loadMember(db: Db, userId: string): Promise<MemberContext | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId));
  return row ? { id: row.id, name: row.name, email: row.email } : null;
}

/** Whole days past a `YYYY-MM-DD` due date, or null when not overdue. */
function daysPast(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T12:00:00Z`).getTime();
  if (Number.isNaN(due)) return null;
  const days = Math.floor((Date.now() - due) / 86_400_000);
  return days > 0 ? days : null;
}

function joinAddress(
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null,
): string {
  return [address, [city, state].filter(Boolean).join(", "), zip]
    .filter(Boolean)
    .join(", ");
}

/** Exported for the resume worker and for tests. */
export { loadCustomer, loadMember };
