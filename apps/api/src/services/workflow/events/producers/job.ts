/**
 * Job producers.
 *
 * `jobStageChanged` is the load-bearing one. It is called from the single place
 * a job's stage is written, so a drag on the board, a bulk status update, a
 * quote conversion and a direct API call all produce the same event. Emitting
 * from the route instead would reproduce the bulk-status-update bug this repo
 * already had, where the bulk path skipped the completion email the single path
 * sent — the same divergence, one layer down.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import {
  isoDate,
  isoDateTime,
  isoTime,
  money,
  type CustomerArgs,
  type ProducerContext,
} from "./shared.js";

type Lifecycle = "scheduled" | "in_progress" | "completed" | "cancelled";
type ServiceType =
  | "installation"
  | "repair"
  | "maintenance"
  | "inspection"
  | "emergency"
  | "consultation"
  | "other";
type Priority = "standard" | "urgent" | "emergency";

/** What every job producer needs in hand. */
export interface JobArgs {
  id: string;
  jobNumber: string;
  title: string;
  serviceType: ServiceType;
  priority: Priority;
  pipelineId: string | null;
  assigneeId: string | null;
  totalAmount: string | number | null;
  scheduledDate: Date | string | null;
}

export interface StageArgs {
  id: string;
  name: string;
  lifecycle: Lifecycle;
}

/** The nine fields every job payload shares, written once per producer. */
interface JobBaseFields {
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  jobId: string;
  jobNumber: string;
  title: string;
  serviceType: ServiceType;
  priority: Priority;
  pipelineId: string | null;
  assigneeId: string | null;
  totalAmount: string;
  scheduledDate: string | null;
}

/**
 * The one mapping from `(job, customer)` to the shared payload fields.
 *
 * This is a named function returning an explicitly-written object, not a spread
 * of a row — the distinction the whole directory turns on. One implementation
 * of one shape is the goal; the thing being avoided is *two* implementations
 * that drift, and a row spread that silently gains a column.
 */
function jobBase(job: JobArgs, customer: CustomerArgs): JobBaseFields {
  return {
    customerId: customer.id,
    customerFirstName: customer.firstName,
    customerLastName: customer.lastName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    jobId: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    serviceType: job.serviceType,
    priority: job.priority,
    pipelineId: job.pipelineId,
    assigneeId: job.assigneeId,
    totalAmount: money(job.totalAmount),
    scheduledDate: isoDate(job.scheduledDate),
  };
}

export interface JobCreatedArgs extends ProducerContext {
  job: JobArgs & { createdAt: Date | string };
  customer: CustomerArgs;
  stage: StageArgs | null;
  origin: "manual" | "quote" | "booking" | "api";
  originId: string | null;
}

export function jobCreated(db: EmitDb, args: JobCreatedArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.created",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      origin: args.origin,
      originId: args.originId,
      stageId: args.stage?.id ?? null,
      stageName: args.stage?.name ?? null,
      lifecycle: args.stage?.lifecycle ?? "scheduled",
      createdAt: isoDateTime(args.job.createdAt),
    },
  });
}

export interface JobUpdatedArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  changedFields: string[];
}

export function jobUpdated(db: EmitDb, args: JobUpdatedArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.updated",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      changedFields: args.changedFields,
    },
  });
}

export interface JobStageChangedArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  from: StageArgs | null;
  to: StageArgs;
  /** True when the move came from a bulk action. */
  bulk: boolean;
}

export function jobStageChanged(db: EmitDb, args: JobStageChangedArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.stage_changed",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      fromStageId: args.from?.id ?? null,
      fromStageName: args.from?.name ?? null,
      fromLifecycle: args.from?.lifecycle ?? null,
      toStageId: args.to.id,
      toStageName: args.to.name,
      toLifecycle: args.to.lifecycle,
      bulk: args.bulk,
    },
  });
}

export interface JobCompletedArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  stage: StageArgs;
  completedAt: Date | string;
  hasLineItems: boolean;
}

export function jobCompleted(db: EmitDb, args: JobCompletedArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.completed",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      stageId: args.stage.id,
      stageName: args.stage.name,
      completedAt: isoDateTime(args.completedAt),
      hasLineItems: args.hasLineItems,
    },
  });
}

export interface JobCancelledArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  fromStageName: string | null;
  cancelledAt: Date | string;
}

export function jobCancelled(db: EmitDb, args: JobCancelledArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.cancelled",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      fromStageName: args.fromStageName,
      cancelledAt: isoDateTime(args.cancelledAt),
    },
  });
}

export interface JobAssignedArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  from: { id: string; name: string } | null;
  to: { id: string; name: string } | null;
}

export function jobAssigned(db: EmitDb, args: JobAssignedArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.assigned",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      toAssigneeId: args.to?.id ?? null,
      toAssigneeName: args.to?.name ?? null,
      fromAssigneeId: args.from?.id ?? null,
      fromAssigneeName: args.from?.name ?? null,
    },
  });
}

export interface JobScheduledArgs extends ProducerContext {
  job: JobArgs;
  customer: CustomerArgs;
  fromDate: Date | string | null;
  toDate: Date | string | null;
  startTime: string | null;
  endTime: string | null;
}

export function jobScheduled(db: EmitDb, args: JobScheduledArgs) {
  const base = jobBase(args.job, args.customer);
  return emitWorkflowEvent(db, {
    type: "job.scheduled",
    tenantId: args.tenantId,
    subject: { type: "job", id: args.job.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: base.customerId,
      customerFirstName: base.customerFirstName,
      customerLastName: base.customerLastName,
      customerEmail: base.customerEmail,
      customerPhone: base.customerPhone,
      jobId: base.jobId,
      jobNumber: base.jobNumber,
      title: base.title,
      serviceType: base.serviceType,
      priority: base.priority,
      pipelineId: base.pipelineId,
      assigneeId: base.assigneeId,
      totalAmount: base.totalAmount,
      scheduledDate: base.scheduledDate,
      fromDate: isoDate(args.fromDate),
      toDate: isoDate(args.toDate),
      startTime: isoTime(args.startTime),
      endTime: isoTime(args.endTime),
      // A job that had no date is being scheduled; one that had a different
      // date is being *re*scheduled, and the customer gets a different sentence.
      rescheduled: args.fromDate !== null && args.fromDate !== undefined,
    },
  });
}
