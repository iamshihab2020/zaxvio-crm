/**
 * The shape a variable resolves against.
 *
 * It lives in the package rather than in the engine because **both sides need
 * it**: the engine builds one per run, and the browser's variable picker builds
 * a fake one to render sample values. If the picker's idea of the context and
 * the engine's ever diverged, the sample shown next to a variable would stop
 * being a promise about what the email will say — which is the one thing a
 * picker is for.
 *
 * Everything here is a **plain JSON shape**. No `Date`, no `Decimal`, no ORM
 * row: the whole context is serialised into `workflow_executions.waiting_context`
 * when a delay pauses a run, and comes back out of `jsonb` weeks later. A `Date`
 * that goes in comes out a string, so declaring one would guarantee a mismatch
 * between a fresh run and a resumed one. Same rule the event payloads follow.
 */

import type { SubjectType } from "./node-definition.js";

/** Always resolved when the run has a subject — every subject table has one. */
export interface CustomerContext {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  fullAddress: string;
  notes: string | null;
  /** True when they have asked to stop receiving non-transactional email. */
  isOptedOut: boolean;
}

export interface JobContext {
  id: string;
  number: string;
  title: string;
  description: string | null;
  serviceType: string;
  priority: string;
  status: string;
  stageName: string | null;
  stageLifecycle: string | null;
  pipelineName: string | null;
  /** `YYYY-MM-DD`. A `date` column has no timezone; see `format/`. */
  scheduledDate: string | null;
  /** `HH:MM:SS` wall-clock in the tenant's zone. */
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  /** Decimal strings, exactly as `numeric` columns arrive. Never floats. */
  subtotal: string;
  taxAmount: string;
  total: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  completedAt: string | null;
  actualHours: string | null;
  /**
   * Null when the job is not costed, **not zero**. An unknown margin makes a
   * figure incomplete rather than lower, and zero reads as break-even — the
   * distinction the whole costing feature rests on.
   */
  marginPercent: number | null;
  /** `complete` · `partial` · `none` — how much of the cost side is known. */
  costCoverage: string;
}

export interface InvoiceContext {
  id: string;
  number: string;
  status: string;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  daysOverdue: number | null;
  paymentTerms: string | null;
  publicUrl: string | null;
}

export interface QuoteContext {
  id: string;
  number: string;
  status: string;
  issueDate: string | null;
  expiryDate: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  publicUrl: string | null;
  acceptUrl: string | null;
}

export interface BookingContext {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  serviceType: string;
  status: string;
  source: string;
  notes: string | null;
}

export interface EquipmentContext {
  id: string;
  name: string;
  type: string;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  installDate: string | null;
  warrantyExpiresAt: string | null;
  location: string | null;
}

export interface ContractContext {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  annualPrice: string;
  visitsPerYear: number | null;
  frequency: string | null;
  nextVisitDue: string | null;
}

export interface TenantContext {
  businessName: string;
  ownerName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  fullAddress: string;
  logoUrl: string | null;
  licenseNumber: string | null;
  bookingUrl: string | null;
  googleReviewUrl: string | null;
  timezone: string;
}

export interface MemberContext {
  id: string;
  name: string;
  email: string | null;
}

export interface LoopContext {
  item: unknown;
  index: number;
  total: number;
}

export interface ExecutionContext {
  // ── identity — set once, never read from user data (wf-00 D-16) ───────────
  tenantId: string;
  /** workflow zone → tenant zone → `America/Chicago`. **Never the server's.** */
  timezone: string;
  workflowId: string;
  workflowName: string;
  versionId: string;
  executionId: string;
  /**
   * Is this a test run rather than a real one?
   *
   * `manual.run`'s payload has carried this since P3 — *"a test run writes logs
   * and refuses external side effects; a real one does not"* — and nothing ever
   * lifted it onto the context, so no executor could act on it.
   *
   * P10 gives it a consumer with teeth: `http.request` puts the response body
   * into the run log **only** on a test run, because a body on a live run is
   * whatever a remote server chose to send, stored for ninety days and readable
   * by anyone with run-history access ([[wf-10-security|§10.5]]).
   *
   * Defaults to `false` at every construction site. A test flag that defaults to
   * true is a production run behaving like a test.
   */
  isTest: boolean;

  // ── the subject and everything hanging off it ─────────────────────────────
  subject: { type: SubjectType; id: string } | null;
  /** Always present when a subject exists (wf-00 D-02). */
  customer: CustomerContext | null;
  job?: JobContext;
  invoice?: InvoiceContext;
  quote?: QuoteContext;
  booking?: BookingContext;
  equipment?: EquipmentContext;
  contract?: ContractContext;
  tenant: TenantContext;
  assignee?: MemberContext;

  // ── what started it ───────────────────────────────────────────────────────
  trigger: { event: string | null; payload: Record<string, unknown> };

  // ── accumulated during the run ────────────────────────────────────────────
  /** Keyed by node id, and also reachable by node label — see `interpolate`. */
  nodeOutputs: Record<string, unknown>;
  /** Node labels → ids, so `{{previous.Send Email.messageId}}` resolves. */
  nodeLabels: Record<string, string>;
  /** Written by `data.setFields`. */
  vars: Record<string, unknown>;
  loop?: LoopContext;
}
