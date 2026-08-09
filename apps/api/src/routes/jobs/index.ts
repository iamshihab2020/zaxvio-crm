import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  pipelines,
  jobPipelineStages,
  jobs,
  jobLineItems,
  jobPhotos,
  jobDocuments,
  jobActivities,
  jobChecklistCompletions,
  checklistTemplates,
  checklistItems,
  catalogItems,
  customers,
  customerActivities,
  equipment,
  tenants,
  user,
  member,
  organization,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
  gte,
  lte,
  isNull,
  isNotNull,
  inArray,
} from "@hvac-saas/database";
import { uploadFile, deleteFiles, getPublicUrl } from "../../lib/storage.js";
import {
  UPLOAD_LIMITS,
  base64ByteLength,
  bodyLimitFor,
  formatBytes,
  isAllowedUploadMime,
  isValidBase64,
  ALLOWED_UPLOAD_MIME,
} from "../../lib/upload-limits.js";
import {
  loadEditableJob,
  assertEditable,
  findForeignRef,
} from "../../lib/job-guards.js";
import { isOrgMember } from "../../lib/tenant-guards.js";
import {
  attachChecklistToJob,
  deleteJobAttachments,
  countLinkedInvoices,
  sendJobCompletionEmailFor,
} from "../../lib/job-helpers.js";
import {
  idParam,
  lineItemParam,
  photoParam,
  addPhotoBody,
  updatePhotoTagBody,
  photoTagParam,
  addDocumentBody,
  documentParam,
  uploadFileBody,
  updateLineItemBody,
  jobListQuery,
  photoListQuery,
  createJobBody,
  updateJobBody,
  updateJobStatusBody,
  reorderBody,
  addLineItemBody,
  toggleChecklistBody,
  completionIdParam,
  bulkJobStatusBody,
} from "../../lib/schemas/jobs.js";
import { paginationQuery } from "../../lib/schemas/common.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import { escapeLike } from "../../lib/search.js";
import { isItemType, resolveLineItemDescription } from "../../lib/line-items.js";
import { formatDateInTimezone } from "../../lib/timezone.js";
import {
  canTransition,
  getDefaultPipelineId,
  getFirstStage,
  getJobLifecycle,
  loadStagesByPipeline,
  matchStage,
  resolveStage,
  stageUpdate,
  type JobLifecycle,
} from "../../services/job-stages.service.js";
import { emitStageChangeEvents } from "../../services/jobs/stage-events.service.js";
import {
  emitJobCreatedEvent,
  emitJobUpdatedEvents,
} from "../../services/jobs/job-events.service.js";
import { moveJobStage } from "../../services/jobs/jobs.service.js";

// ========== HELPERS ==========

// `escapeLike` used to be defined here, privately, and omitted the backslash
// escape — so a search for a backslash still acted as an escape character.
// `lib/search.ts` was written during the customers audit to end exactly this
// duplication; it just never reached the file the original copy came from.

// The job state machine now lives in services/job-stages.service.ts, keyed on
// a stage's `lifecycle` rather than on `jobs.status`. The old table was keyed
// on the status string and no entry listed itself, so a same-column drag read
// as an illegal transition and the write was skipped.

// `Omit<…, "$client">` rather than the bare handle: a Drizzle transaction has
// every query method but no `$client`, so typing this as `ReturnType<typeof
// getDb>` made the function uncallable from inside a transaction. That is the
// same defect QUO-02 found in `job-stages.service.ts`, and it is why this was
// the one statement in `PATCH /jobs/:id` that could not join the others.
async function recalculateJobTotals(
  db: Omit<ReturnType<typeof getDb>, "$client">,
  jobId: string,
  tenantId: string,
) {
  // Sum all line items (quantity * unit_price since total is generated)
  const result = await db
    .select({
      subtotal: sql<string>`COALESCE(SUM(quantity * unit_price), 0)`,
    })
    .from(jobLineItems)
    .where(
      and(eq(jobLineItems.jobId, jobId), eq(jobLineItems.tenantId, tenantId)),
    );

  const subtotal = result[0]?.subtotal ?? "0";

  // Get job's tax rate
  const [job] = await db
    .select({ taxRate: jobs.taxRate })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));

  const taxRate = parseFloat(job?.taxRate ?? "0");
  const subtotalNum = parseFloat(subtotal);
  const taxAmount = subtotalNum * taxRate;
  const totalAmount = subtotalNum + taxAmount;

  await db
    .update(jobs)
    .set({
      subtotal: subtotalNum.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));
}

// ========== ROUTES ==========

const jobRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /jobs/assignees
   * List all org members available to assign to jobs.
   */
  fastify.get(
    "/assignees",
    { preHandler: [requireTenant], schema: {} },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Get the org's organizationId from the tenant row
      const tenant = await db
        .select({ organizationId: tenants.organizationId })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      const members = await db
        .select({
          id: user.id,
          name: user.name,
          image: user.image,
          email: user.email,
          role: member.role,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, tenant.organizationId));

      return reply.send({ data: members });
    },
  );

  // ===== JOBS CRUD =====

  /**
   * GET /jobs
   * List jobs with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: jobListQuery },
    },
    async (request, reply) => {
      const {
        search,
        status,
        stageId,
        lifecycle,
        customerId,
        serviceType,
        priority,
        dateFrom,
        dateTo,
        pipelineId,
        assigneeId: assigneeFilter,
        page,
        limit,
        sortBy,
        sortOrder,
        showArchived,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const offset = (page - 1) * limit;

      // Build filters
      const filters = [eq(jobs.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(jobs.archivedAt) : isNull(jobs.archivedAt));

      if (search) {
        const s = escapeLike(search);
        filters.push(
          or(
            ilike(jobs.jobNumber, `%${s}%`),
            ilike(jobs.title, `%${s}%`),
            ilike(jobs.description, `%${s}%`),
            ilike(customers.firstName, `%${s}%`),
            ilike(customers.lastName, `%${s}%`),
          )!,
        );
      }

      if (status) {
        filters.push(eq(jobs.status, status));
      }
      if (stageId) {
        filters.push(eq(jobs.stageId, stageId));
      }
      if (lifecycle) {
        // Scoped to this tenant's stages so the subquery cannot match a stage
        // belonging to someone else that happens to share a lifecycle.
        filters.push(
          inArray(
            jobs.stageId,
            db
              .select({ id: jobPipelineStages.id })
              .from(jobPipelineStages)
              .where(
                and(
                  eq(jobPipelineStages.tenantId, tenantId),
                  eq(jobPipelineStages.lifecycle, lifecycle),
                ),
              ),
          ),
        );
      }
      if (customerId) {
        filters.push(eq(jobs.customerId, customerId));
      }
      if (serviceType) {
        filters.push(eq(jobs.serviceType, serviceType));
      }
      if (priority) {
        filters.push(eq(jobs.priority, priority));
      }
      if (dateFrom) {
        filters.push(gte(jobs.scheduledDate, dateFrom));
      }
      if (dateTo) {
        filters.push(lte(jobs.scheduledDate, dateTo));
      }
      if (pipelineId) {
        filters.push(eq(jobs.pipelineId, pipelineId));
      }
      if (assigneeFilter) {
        filters.push(eq(jobs.assigneeId, assigneeFilter));
      }

      const whereClause = and(...filters);

      // Sort
      const sortColumnMap = {
        scheduledDate: jobs.scheduledDate,
        createdAt: jobs.createdAt,
        jobNumber: jobs.jobNumber,
        status: jobs.status,
        priority: jobs.priority,
        totalAmount: jobs.totalAmount,
      } as const;
      const sortCol = sortColumnMap[sortBy] ?? jobs.scheduledDate;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: jobs.id,
            tenantId: jobs.tenantId,
            customerId: jobs.customerId,
            bookingId: jobs.bookingId,
            jobNumber: jobs.jobNumber,
            status: jobs.status,
            priority: jobs.priority,
            serviceType: jobs.serviceType,
            title: jobs.title,
            description: jobs.description,
            scheduledDate: jobs.scheduledDate,
            scheduledStart: jobs.scheduledStart,
            scheduledEnd: jobs.scheduledEnd,
            address: jobs.address,
            subtotal: jobs.subtotal,
            taxRate: jobs.taxRate,
            taxAmount: jobs.taxAmount,
            totalAmount: jobs.totalAmount,
            notes: jobs.notes,
            completedAt: jobs.completedAt,
            createdAt: jobs.createdAt,
            updatedAt: jobs.updatedAt,
            equipmentId: jobs.equipmentId,
            pipelineId: jobs.pipelineId,
            equipmentType: equipment.equipmentType,
            equipmentBrand: equipment.brand,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
            assigneeId: jobs.assigneeId,
            assigneeName: user.name,
            assigneeImage: user.image,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .leftJoin(equipment, eq(jobs.equipmentId, equipment.id))
          .leftJoin(user, eq(jobs.assigneeId, user.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol), asc(jobs.sortOrder))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(whereClause),
      ]);

      const total = totalResult[0]?.total ?? 0;

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * GET /jobs/:id
   * Get a single job with customer, line items, checklist, photo count.
   */
  fastify.get(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const jobRow = await db
        .select({
          id: jobs.id,
          tenantId: jobs.tenantId,
          customerId: jobs.customerId,
          bookingId: jobs.bookingId,
          jobNumber: jobs.jobNumber,
          status: jobs.status,
          priority: jobs.priority,
          serviceType: jobs.serviceType,
          title: jobs.title,
          description: jobs.description,
          scheduledDate: jobs.scheduledDate,
          scheduledStart: jobs.scheduledStart,
          scheduledEnd: jobs.scheduledEnd,
          address: jobs.address,
          subtotal: jobs.subtotal,
          taxRate: jobs.taxRate,
          taxAmount: jobs.taxAmount,
          totalAmount: jobs.totalAmount,
          notes: jobs.notes,
          completedAt: jobs.completedAt,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt,
          equipmentId: jobs.equipmentId,
          pipelineId: jobs.pipelineId,
          equipmentType: equipment.equipmentType,
          equipmentBrand: equipment.brand,
          equipmentModel: equipment.model,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          assigneeId: jobs.assigneeId,
          assigneeName: user.name,
          assigneeImage: user.image,
        })
        .from(jobs)
        .leftJoin(customers, eq(jobs.customerId, customers.id))
        .leftJoin(equipment, eq(jobs.equipmentId, equipment.id))
        .leftJoin(user, eq(jobs.assigneeId, user.id))
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!jobRow) {
        return reply.status(404).send({ message: "Job not found" });
      }

      const [lineItems, checklist, photoCountResult] = await Promise.all([
        db
          .select()
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, id),
            ),
          )
          .orderBy(asc(jobLineItems.sortOrder)),
        db
          .select({
            id: jobChecklistCompletions.id,
            checklistItemId: jobChecklistCompletions.checklistItemId,
            isCompleted: jobChecklistCompletions.isCompleted,
            completedBy: jobChecklistCompletions.completedBy,
            completedAt: jobChecklistCompletions.completedAt,
            label: checklistItems.label,
            isRequired: checklistItems.isRequired,
            catalogItemId: checklistItems.catalogItemId,
            sortOrder: checklistItems.sortOrder,
            catalogItemName: catalogItems.name,
            catalogItemPrice: catalogItems.unitPrice,
          })
          .from(jobChecklistCompletions)
          .innerJoin(
            checklistItems,
            eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
          )
          .leftJoin(
            catalogItems,
            and(
              eq(checklistItems.catalogItemId, catalogItems.id),
              eq(catalogItems.tenantId, tenantId),
            ),
          )
          .where(
            and(
              eq(jobChecklistCompletions.tenantId, tenantId),
              eq(jobChecklistCompletions.jobId, id),
            ),
          )
          .orderBy(asc(checklistItems.sortOrder)),
        db
          .select({ total: count() })
          .from(jobPhotos)
          .where(
            and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.jobId, id)),
          ),
      ]);

      return reply.send({
        data: {
          ...jobRow,
          lineItems,
          checklist,
          photoCount: photoCountResult[0]?.total ?? 0,
        },
      });
    },
  );

  /**
   * POST /jobs
   * Create a new job. Auto-attaches checklist if template exists.
   */
  fastify.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createJobBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;

      const db = getDb();

      // Validate customer exists and belongs to tenant
      const customer = await db
        .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, body.customerId),
          ),
        )
        .then((r) => r[0]);

      if (!customer) {
        return reply.status(400).send({ message: "Customer not found" });
      }

      // `bookingId` and `equipmentId` were written straight from the body with
      // no ownership check, so a job could be linked to another tenant's
      // booking or asset. `customerId`, `pipelineId` and `assigneeId` were all
      // validated; these two sat beside them unchecked.
      const badRef = await findForeignRef(db, tenantId, {
        equipmentId: body.equipmentId,
        bookingId: body.bookingId,
      });
      if (badRef) {
        return reply.status(400).send({ message: `${badRef} not found` });
      }

      // Resolve pipeline: validate provided or fallback to default
      let pipelineId: string | null = null;
      if (body.pipelineId) {
        const pipeline = await db
          .select({ id: pipelines.id })
          .from(pipelines)
          .where(
            and(
              eq(pipelines.tenantId, tenantId),
              eq(pipelines.id, body.pipelineId),
            ),
          )
          .then((r) => r[0]);
        if (!pipeline) {
          return reply.status(400).send({ message: "Pipeline not found" });
        }
        pipelineId = pipeline.id;
      } else {
        pipelineId = await getDefaultPipelineId(db, tenantId);
      }

      // A job starts in the stage the caller asked for — "Add job to this
      // column" sends one — and otherwise in the pipeline's first stage. Either
      // way `status` is that stage's name, so a tenant who renamed "Scheduled"
      // to "Booked" sees new jobs land in the column they actually built.
      let startingStage = null;
      if (pipelineId) {
        if (body.stageId || body.status) {
          startingStage = await resolveStage(db, {
            tenantId,
            pipelineId,
            stageId: body.stageId,
            status: body.status,
          });
          if (!startingStage) {
            return reply.status(400).send({
              message: `No stage "${body.stageId ?? body.status}" in the selected pipeline`,
            });
          }
        } else {
          startingStage = await getFirstStage(db, { tenantId, pipelineId });
        }
        if (!startingStage) {
          return reply.status(400).send({
            message: "The selected pipeline has no stages. Add a stage first.",
          });
        }
      }

      // Fetch tenant for defaultTaxRate and assignee validation
      const tenantRecord = await db
        .select({ organizationId: tenants.organizationId, defaultTaxRate: tenants.defaultTaxRate })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      // Validate assignee is an org member
      if (body.assigneeId && tenantRecord) {
        const isMember = await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.userId, body.assigneeId),
              eq(member.organizationId, tenantRecord.organizationId),
            ),
          )
          .then((r) => r[0]);
        if (!isMember) {
          return reply.status(400).send({ message: "Assignee is not a member of this organization" });
        }
      }

      // Use tenant's defaultTaxRate if no taxRate provided
      const taxRate = body.taxRate || tenantRecord?.defaultTaxRate || "0";

      // One transaction. This was five separate statements — insert job,
      // attach checklist, log job activity, log customer activity, re-fetch —
      // so a failure part-way left a job with no checklist and no activity
      // trail, which is invisible until someone wonders where the checklist
      // went. The checklist is the thing techs work from; a job without one is
      // not a usable job.
      const created = await db.transaction(async (tx) => {
        const [job] = await tx
          .insert(jobs)
          .values({
            tenantId,
            customerId: body.customerId,
            bookingId: body.bookingId || null,
            equipmentId: body.equipmentId || null,
            pipelineId,
            stageId: startingStage?.id ?? null,
            jobNumber: "", // Auto-generated by DB trigger
            serviceType: body.serviceType,
            title: body.title,
            description: body.description || null,
            scheduledDate: body.scheduledDate,
            scheduledStart: body.scheduledStart || null,
            scheduledEnd: body.scheduledEnd || null,
            address: body.address || null,
            status: startingStage?.name ?? "scheduled",
            priority: body.priority ?? "standard",
            taxRate,
            notes: body.notes || null,
            assigneeId: body.assigneeId || null,
          })
          .returning();

        await attachChecklistToJob(tx, job.id, tenantId, body.serviceType, userId);

        await tx.insert(jobActivities).values({
          tenantId,
          jobId: job.id,
          type: "job.created",
          description: `Job created for ${customer.firstName} ${customer.lastName}`,
          performedBy: userId,
        });

        await tx.insert(customerActivities).values({
          tenantId,
          customerId: body.customerId,
          type: "job.created",
          description: `Job ${job.jobNumber || "new"} created`,
          metadata: { jobId: job.id },
          performedBy: userId,
        });

        // The event goes in the same transaction as the job. Outside it, a
        // failure between the two would leave a job no automation ever sees —
        // and nothing anywhere would show that anything had been missed.
        // `emitJobCreatedEvent` re-reads the row itself, so it gets the
        // trigger-issued `jobNumber` and the resolved stage without this route
        // assembling a payload.
        await emitJobCreatedEvent(tx, {
          tenantId,
          actorUserId: userId,
          jobId: job.id,
          // A job created against a booking is a conversion, whatever screen it
          // was clicked from — an automation that greets a new customer needs to
          // know they have already had a booking confirmation.
          origin: body.bookingId ? "booking" : "manual",
          originId: body.bookingId || null,
        });

        // Re-fetch inside the transaction for the trigger-generated jobNumber.
        const [row] = await tx
          .select()
          .from(jobs)
          .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, job.id)));
        return row;
      });

      emitPlatformEvent(tenantId, "job_created", userId);

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * PATCH /jobs/:id
   * Update job fields (not status — use PATCH /jobs/:id/status).
   */
  fastify.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateJobBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      const gate = assertEditable(existing);
      if (gate) {
        return reply.status(gate.status).send({ message: gate.message });
      }

      // Validate pipelineId belongs to tenant and has a stage the job can land in
      let rehomedStageId: string | undefined;
      if (body.pipelineId) {
        const pipeline = await db
          .select({ id: pipelines.id })
          .from(pipelines)
          .where(
            and(
              eq(pipelines.tenantId, tenantId),
              eq(pipelines.id, body.pipelineId),
            ),
          )
          .then((r) => r[0]);
        if (!pipeline) {
          return reply.status(400).send({ message: "Pipeline not found" });
        }

        // Moving pipelines has to move the stage pointer too, or the job keeps
        // a stage_id belonging to the pipeline it just left. The stage lookup
        // was also missing its tenant filter (security-rules §1) — it matched
        // on pipeline + name alone.
        const currentLifecycle = await getJobLifecycle(db, {
          tenantId,
          stageId: existing.stageId,
          status: existing.status,
        });
        const landing = await resolveStage(db, {
          tenantId,
          pipelineId: body.pipelineId,
          status: existing.status,
        });
        if (!landing) {
          return reply.status(400).send({
            message: `Target pipeline has no stage matching current job status "${existing.status}"`,
          });
        }
        if (landing.lifecycle !== currentLifecycle) {
          return reply.status(400).send({
            message: `Target pipeline's "${landing.label}" stage is ${landing.lifecycle.replace("_", " ")}, but this job is ${currentLifecycle.replace("_", " ")}`,
          });
        }
        rehomedStageId = landing.id;
      }

      // The schema-level refinement only sees the fields in this request, so a
      // PATCH sending just `scheduledEnd` would pass while inverting the times
      // on a job that already has a start. Check the merged result.
      const mergedStart =
        "scheduledStart" in body ? body.scheduledStart : existing.scheduledStart;
      const mergedEnd =
        "scheduledEnd" in body ? body.scheduledEnd : existing.scheduledEnd;
      if (mergedStart && mergedEnd && mergedEnd <= mergedStart) {
        return reply
          .status(400)
          .send({ message: "End time must be after start time" });
      }

      // Validate assignee is an org member. One implementation in
      // `lib/tenant-guards.ts` — this was a copy, and the old version also
      // failed **open** when the tenant had no organisation row.
      if (body.assigneeId && !(await isOrgMember(db, tenantId, body.assigneeId))) {
        return reply
          .status(400)
          .send({ message: "Assignee is not a member of this organization" });
      }

      const allowedFields = [
        "title",
        "description",
        "priority",
        "serviceType",
        "scheduledDate",
        "scheduledStart",
        "scheduledEnd",
        "address",
        "notes",
        "taxRate",
        "equipmentId",
        "pipelineId",
        "assigneeId",
      ] as const;

      const fieldLabels: Record<string, string> = {
        title: "Title",
        description: "Description",
        priority: "Priority",
        serviceType: "Service Type",
        scheduledDate: "Scheduled Date",
        scheduledStart: "Scheduled Start",
        scheduledEnd: "Scheduled End",
        address: "Address",
        notes: "Notes",
        taxRate: "Tax Rate",
        equipmentId: "Asset",
        pipelineId: "Pipeline",
        assigneeId: "Assignee",
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const changedFields: string[] = [];

      // Nullable text columns where "the user cleared this" must be one value.
      // `POST` wrote `body.x || null` while this loop wrote `body[field]`
      // verbatim, so clearing a description through the two verbs produced
      // `NULL` from one and `''` from the other — one column, two spellings of
      // empty, and every `IS NULL` check downstream disagreeing with itself.
      const nullableText = new Set([
        "description",
        "address",
        "notes",
        "scheduledStart",
        "scheduledEnd",
      ]);

      for (const field of allowedFields) {
        if (field in body) {
          const raw = body[field];
          const value =
            nullableText.has(field) && typeof raw === "string" && raw.trim() === ""
              ? null
              : raw;
          const oldVal = existing[field] ?? "";
          const newVal = value ?? "";
          if (String(oldVal) !== String(newVal)) {
            changedFields.push(field);
          }
          updates[field] = value;
        }
      }

      if (rehomedStageId) {
        updates.stageId = rehomedStageId;
      }

      // One transaction. These were four loose statements, and the events now
      // added are the reason it matters: `emitJobUpdatedEvents` reads the row
      // back to build its payload, so it must see the update, and the update
      // must not survive without it. The activity row joins them for the same
      // reason it does in `POST` — a change with no trail is invisible.
      const final = await db.transaction(async (tx) => {
        await tx
          .update(jobs)
          .set(updates)
          .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)));

        // Recalculate totals if tax rate changed
        if (changedFields.includes("taxRate")) {
          await recalculateJobTotals(tx, id, tenantId);
        }

        // Log activity
        if (changedFields.length > 0) {
          const readableFields = changedFields
            .map((f) => fieldLabels[f] ?? f)
            .join(", ");
          await tx.insert(jobActivities).values({
            tenantId,
            jobId: id,
            type: "job.updated",
            description: `Updated ${readableFields}`,
            metadata: { changedFields },
            performedBy: userId,
          });
        }

        // `job.updated`, plus `job.assigned` and `job.scheduled` when those
        // specific things moved. The previous values come from `existing`,
        // read before the update — the only place they still exist.
        await emitJobUpdatedEvents(tx, {
          tenantId,
          actorUserId: userId,
          jobId: id,
          previous: {
            assigneeId: existing.assigneeId,
            scheduledDate: existing.scheduledDate,
            scheduledStart: existing.scheduledStart,
            scheduledEnd: existing.scheduledEnd,
          },
          changedFields,
        });

        // Re-fetch after potential recalculation. Tenant-scoped like every
        // other read — this one had only the job id (security-rules §1).
        const [row] = await tx
          .select()
          .from(jobs)
          .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)));
        return row;
      });

      return reply.send({ data: final });
    },
  );

  /**
   * PATCH /jobs/:id/status
   * Status workflow: scheduled→in_progress, scheduled→cancelled,
   * in_progress→completed (requires all required checklist items),
   * in_progress→cancelled.
   */
  fastify.patch(
    "/:id/status",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateJobStatusBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { stageId, status: requestedStatus } = request.body;

      // Validate -> service -> respond (api-rules §1). Everything this handler
      // used to do inline — the archived gate, the transition table, the
      // required-checklist gate, the activity row, the stage-change events, the
      // notification and the E-05 email — lives in `moveJobStage`, because the
      // `job.moveStage` automation node needs all of it too and had none of it.
      const result = await moveJobStage(getDb(), {
        tenantId,
        jobId: id,
        stageId,
        status: requestedStatus,
        actor: { kind: "user", userId: request.authUser.userId },
      });

      if (!result.ok) {
        return reply
          .status(result.reason === "not_found" ? 404 : 400)
          .send({ message: result.message });
      }

      return reply.send({ data: result.job });
    },
  );

  /**
   * DELETE /jobs/:id
   * Hard delete a job (FK cascades clean up line items, photos, checklist, activities).
   */
  fastify.delete(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Job not found" });
      }

      // Clean up storage files before FK cascade deletes DB records
      const unlinkedInvoices = await countLinkedInvoices(db, tenantId, [id]);
      await deleteJobAttachments(db, tenantId, [id]);

      await db
        .delete(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)));

      return reply.send({
        message:
          unlinkedInvoices > 0
            ? `Job deleted. ${unlinkedInvoices} invoice(s) are no longer linked to a job.`
            : "Job deleted",
        unlinkedInvoices,
      });
    },
  );

  /**
   * PATCH /jobs/reorder
   * Card positions only — this endpoint no longer changes a job's stage.
   *
   * It used to, and that made it a second status writer that skipped the
   * required-checklist gate, the completion email, the notification and the
   * activity row. It also skipped the *entire* row — sort order included —
   * whenever a transition looked invalid, and a within-column drag always
   * looked invalid because no entry in the old transition table listed itself,
   * so dragging three cards inside one column persisted none of them.
   * `PATCH /:id/status` is now the only way a job changes stage.
   */
  fastify.patch(
    "/reorder",
    {
      preHandler: [requireTenant],
      schema: { body: reorderBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { items } = request.body;
      const db = getDb();

      // Archived jobs are not on the board, so a position for one is stale
      // client state rather than an edit worth applying.
      const live = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
            inArray(
              jobs.id,
              items.map((i) => i.id),
            ),
            isNull(jobs.archivedAt),
          ),
        );
      const liveIds = new Set(live.map((j) => j.id));

      const applicable = items.filter((i) => liveIds.has(i.id));
      const skipped = items
        .filter((i) => !liveIds.has(i.id))
        .map((i) => ({ id: i.id, reason: "Job not found or archived" }));

      await db.transaction(async (tx) => {
        for (const item of applicable) {
          await tx
            .update(jobs)
            .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
            .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, item.id)));
        }
      });

      return reply.send({ success: true, skipped });
    },
  );

  // ===== LINE ITEMS =====

  /**
   * GET /jobs/:id/line-items
   * List all line items for a job (ordered by sortOrder).
   */
  fastify.get(
    "/:id/line-items",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select()
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
          ),
        )
        .orderBy(asc(jobLineItems.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/line-items
   * Add a line item. If catalogItemId provided, auto-fill from catalog.
   */
  fastify.post(
    "/:id/line-items",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: addLineItemBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      let description = body.description;
      let unitPrice: string | number | undefined = body.unitPrice;
      // Snapshotted from the catalog below, never joined at read time: a
      // supplier price change must not move the margin on a closed job. Same
      // reasoning as `unitPrice`, which has always been copied this way.
      let unitCost: string | number | null | undefined = body.unitCost;
      let itemType = body.itemType;

      // If catalogItemId provided, auto-fill from catalog
      if (body.catalogItemId) {
        const catalogItem = await db
          .select()
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.tenantId, tenantId),
              eq(catalogItems.id, body.catalogItemId),
            ),
          )
          .then((r) => r[0]);

        // Was `if (catalogItem) { … }` with no else: a missing item, or one
        // belonging to another tenant, fell straight through and the
        // unvalidated id was still stored on the line item.
        if (!catalogItem) {
          return reply.status(400).send({ message: "Catalog item not found" });
        }
        description = description || catalogItem.name;
        unitPrice = unitPrice ?? catalogItem.unitPrice;
        // `??`, so an explicit request-supplied cost wins — including an
        // explicit null, which means "this one's cost is unknown" and must not
        // be overwritten by the catalog's figure.
        unitCost = unitCost !== undefined ? unitCost : catalogItem.unitCost;
        itemType = itemType || catalogItem.itemType;
      }

      // A description is optional: a line can be nothing but a price. What it
      // is *called* falls back to the item type, so nothing renders blank on a
      // PDF. Price and type are still required — they are the line's substance.
      if (unitPrice == null || !isItemType(itemType)) {
        return reply.status(400).send({
          message: "unitPrice and itemType are required",
        });
      }
      const resolvedDescription = resolveLineItemDescription({
        description,
        itemType,
      });

      const [lineItem] = await db
        .insert(jobLineItems)
        .values({
          tenantId,
          jobId: id,
          catalogItemId: body.catalogItemId || null,
          itemType,
          description: resolvedDescription,
          quantity: String(body.quantity ?? 1),
          unitPrice: String(unitPrice),
          unitCost: unitCost == null ? null : String(unitCost),
          sortOrder: body.sortOrder || 0,
        })
        .returning();

      await recalculateJobTotals(db, id, tenantId);

      // Log activity
      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.added",
        description: `Added line item: ${resolvedDescription}`,
        metadata: { lineItemId: lineItem.id },
        performedBy: userId,
      });

      return reply.status(201).send({ data: lineItem });
    },
  );

  /**
   * PATCH /jobs/:id/line-items/:lineItemId
   * Update a line item.
   */
  fastify.patch(
    "/:id/line-items/:lineItemId",
    {
      preHandler: [requireTenant],
      schema: { params: lineItemParam, body: updateLineItemBody },
    },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const existing = await db
        .select({ id: jobLineItems.id })
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      const allowedFields = [
        "description",
        "quantity",
        "unitPrice",
        // `unitCost` belongs in this list, not in a hand-written `if` beside
        // it: the loop's `!== undefined` test already distinguishes "field
        // absent" from an explicit `null`, so clearing a cost back to unknown
        // works without a special case.
        "unitCost",
        "sortOrder",
        "itemType",
      ] as const;
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(jobLineItems)
        .set(updates)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .returning();

      await recalculateJobTotals(db, id, tenantId);

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.updated",
        description: `Updated line item`,
        metadata: { lineItemId, changedFields: Object.keys(updates) },
        performedBy: userId,
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /jobs/:id/line-items/:lineItemId
   * Remove a line item + recalculate totals.
   */
  fastify.delete(
    "/:id/line-items/:lineItemId",
    {
      preHandler: [requireTenant],
      schema: { params: lineItemParam },
    },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const existing = await db
        .select({ id: jobLineItems.id, description: jobLineItems.description })
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      await db
        .delete(jobLineItems)
        .where(
          and(eq(jobLineItems.tenantId, tenantId), eq(jobLineItems.id, lineItemId)),
        );

      await recalculateJobTotals(db, id, tenantId);

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.removed",
        description: `Removed line item: ${existing.description}`,
        performedBy: userId,
      });

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== CHECKLIST =====

  /**
   * GET /jobs/:id/checklist
   * All completions joined with checklist items.
   */
  fastify.get(
    "/:id/checklist",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select({
          id: jobChecklistCompletions.id,
          checklistItemId: jobChecklistCompletions.checklistItemId,
          isCompleted: jobChecklistCompletions.isCompleted,
          completedBy: jobChecklistCompletions.completedBy,
          completedAt: jobChecklistCompletions.completedAt,
          label: checklistItems.label,
          isRequired: checklistItems.isRequired,
          catalogItemId: checklistItems.catalogItemId,
          sortOrder: checklistItems.sortOrder,
          catalogItemName: catalogItems.name,
          catalogItemPrice: catalogItems.unitPrice,
        })
        .from(jobChecklistCompletions)
        .innerJoin(
          checklistItems,
          eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
        )
        .leftJoin(
          catalogItems,
          eq(checklistItems.catalogItemId, catalogItems.id),
        )
        .where(
          and(
            eq(jobChecklistCompletions.tenantId, tenantId),
            eq(jobChecklistCompletions.jobId, id),
          ),
        )
        .orderBy(asc(checklistItems.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * PATCH /jobs/:id/checklist/:completionId
   * Toggle checklist item completion.
   * If completing + item has catalogItemId → auto-add line item (idempotent).
   */
  fastify.patch(
    "/:id/checklist/:completionId",
    {
      preHandler: [requireTenant],
      schema: { params: completionIdParam, body: toggleChecklistBody },
    },
    async (request, reply) => {
      const { id, completionId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      // Fetch completion with checklist item details
      const completion = await db
        .select({
          id: jobChecklistCompletions.id,
          isCompleted: jobChecklistCompletions.isCompleted,
          checklistItemId: jobChecklistCompletions.checklistItemId,
          label: checklistItems.label,
          catalogItemId: checklistItems.catalogItemId,
        })
        .from(jobChecklistCompletions)
        .innerJoin(
          checklistItems,
          eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
        )
        .where(
          and(
            eq(jobChecklistCompletions.tenantId, tenantId),
            eq(jobChecklistCompletions.jobId, id),
            eq(jobChecklistCompletions.id, completionId),
          ),
        )
        .then((r) => r[0]);

      if (!completion) {
        return reply.status(404).send({ message: "Checklist item not found" });
      }

      const isCompleted = body.isCompleted ?? !completion.isCompleted;

      await db
        .update(jobChecklistCompletions)
        .set({
          isCompleted,
          completedBy: isCompleted ? userId : null,
          completedAt: isCompleted ? new Date() : null,
        })
        .where(
          and(
            eq(jobChecklistCompletions.id, completionId),
            eq(jobChecklistCompletions.tenantId, tenantId),
          ),
        );

      // Auto-add line item from catalog if marking complete
      if (isCompleted && completion.catalogItemId) {
        // Idempotent check: does a line item from this catalog item already exist?
        const existingLineItem = await db
          .select({ id: jobLineItems.id })
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, id),
              eq(jobLineItems.catalogItemId, completion.catalogItemId),
            ),
          )
          .then((r) => r[0]);

        if (!existingLineItem) {
          const catalogItem = await db
            .select()
            .from(catalogItems)
            .where(
              and(
                eq(catalogItems.id, completion.catalogItemId),
                eq(catalogItems.tenantId, tenantId),
              ),
            )
            .then((r) => r[0]);

          if (catalogItem) {
            await db.insert(jobLineItems).values({
              tenantId,
              jobId: id,
              catalogItemId: catalogItem.id,
              itemType: catalogItem.itemType,
              description: catalogItem.name,
              quantity: "1",
              unitPrice: catalogItem.unitPrice,
            });

            await recalculateJobTotals(db, id, tenantId);

            await db.insert(jobActivities).values({
              tenantId,
              jobId: id,
              type: "line_item.added",
              description: `Auto-added line item: ${catalogItem.name} (from checklist)`,
              metadata: { catalogItemId: catalogItem.id, checklistItemLabel: completion.label },
              performedBy: userId,
            });
          }
        }
      }

      // JOB-33: un-completing removes the charge it added. Completing a
      // catalog-linked item auto-added a line item; unchecking it left the line
      // item — and its money — on the job, so a mis-tap was billable and the
      // only way back was finding the row on the Line Items tab and deleting it.
      // Scoped to a line item that still matches the catalog item exactly, so an
      // edited or manually-added row is never removed from under the user.
      if (!isCompleted && completion.catalogItemId) {
        const [autoAdded] = await db
          .select({ id: jobLineItems.id, description: jobLineItems.description })
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, id),
              eq(jobLineItems.catalogItemId, completion.catalogItemId),
            ),
          );

        if (autoAdded) {
          await db
            .delete(jobLineItems)
            .where(
              and(
                eq(jobLineItems.tenantId, tenantId),
                eq(jobLineItems.id, autoAdded.id),
              ),
            );
          await recalculateJobTotals(db, id, tenantId);

          await db.insert(jobActivities).values({
            tenantId,
            jobId: id,
            type: "line_item.removed",
            description: `Removed line item: ${autoAdded.description} (checklist item unchecked)`,
            metadata: {
              catalogItemId: completion.catalogItemId,
              checklistItemLabel: completion.label,
            },
            performedBy: userId,
          });
        }
      }

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "checklist.item_completed",
        description: `${isCompleted ? "Completed" : "Unchecked"}: ${completion.label}`,
        metadata: { checklistItemId: completion.checklistItemId, isCompleted },
        performedBy: userId,
      });

      return reply.send({ data: { id: completionId, isCompleted } });
    },
  );

  // ===== FILE UPLOAD =====

  /**
   * POST /jobs/:id/upload
   * Upload a file (photo or document) directly to R2.
   * Returns { storagePath, publicUrl, fileSize, mimeType }.
   * Body: { data: base64, filename, mimeType, tag? }
   */
  fastify.post(
    "/:id/upload",
    {
      preHandler: [requireTenant],
      // Without this the route inherited the 1 MB default and Fastify rejected
      // every real photo with FST_ERR_CTP_BODY_TOO_LARGE *before* the handler's
      // own 20 MB check could run. Derived from the document ceiling — the
      // larger of the two — with the per-type limit still enforced below.
      bodyLimit: bodyLimitFor(UPLOAD_LIMITS.document),
      schema: { params: idParam, body: uploadFileBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;

      const { data: base64, filename, mimeType } = request.body;

      // The mimeType becomes the stored object's Content-Type and the response
      // hands back a public URL, so an unrestricted value here means serving
      // attacker-controlled `text/html` from our own storage domain.
      if (!isAllowedUploadMime(mimeType)) {
        return reply.status(400).send({
          message: `Unsupported file type "${mimeType}". Allowed: ${ALLOWED_UPLOAD_MIME.join(", ")}`,
        });
      }

      // `Buffer.from(x, "base64")` never throws — it drops invalid characters —
      // so malformed input would upload silently as garbage.
      if (!isValidBase64(base64)) {
        return reply.status(400).send({ message: "File data is not valid base64" });
      }

      const isPhoto = mimeType.startsWith("image/");
      const maxBytes = isPhoto ? UPLOAD_LIMITS.photo : UPLOAD_LIMITS.document;

      // Sized from the string so an oversize payload is refused without
      // allocating a second copy of it as a Buffer.
      if (base64ByteLength(base64) > maxBytes) {
        return reply
          .status(400)
          .send({ message: `File exceeds ${formatBytes(maxBytes)} limit` });
      }

      const buffer = Buffer.from(base64, "base64");

      const db = getDb();
      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${tenantId}/jobs/${id}/${Date.now()}_${safeName}`;

      try {
        await uploadFile("job-attachments", storagePath, buffer, mimeType);
      } catch (uploadError) {
        console.error("[job-upload] Storage error:", uploadError);
        return reply.status(500).send({ message: "Failed to upload file" });
      }

      return reply.status(201).send({
        data: {
          storagePath,
          publicUrl: getPublicUrl("job-attachments", storagePath),
          fileSize: buffer.length,
          mimeType,
        },
      });
    },
  );

  // ===== PHOTOS =====

  /**
   * GET /jobs/:id/photos
   * List all photos for a job. Optional ?tag=before|after|general filter.
   */
  fastify.get(
    "/:id/photos",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: photoListQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { tag } = request.query;
      const db = getDb();

      const filters = [
        eq(jobPhotos.tenantId, tenantId),
        eq(jobPhotos.jobId, id),
      ];
      if (tag) {
        filters.push(eq(jobPhotos.tag, tag));
      }

      const data = await db
        .select({
          id: jobPhotos.id,
          jobId: jobPhotos.jobId,
          storagePath: jobPhotos.storagePath,
          caption: jobPhotos.caption,
          tag: jobPhotos.tag,
          uploadedBy: jobPhotos.uploadedBy,
          fileSize: jobPhotos.fileSize,
          takenAt: jobPhotos.takenAt,
          createdAt: jobPhotos.createdAt,
          uploaderName: user.name,
        })
        .from(jobPhotos)
        .leftJoin(user, eq(jobPhotos.uploadedBy, user.id))
        .where(and(...filters))
        .orderBy(desc(jobPhotos.createdAt));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/photos
   * Register a photo record after upload (storagePath from upload endpoint).
   */
  fastify.post(
    "/:id/photos",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: addPhotoBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      if (!body.storagePath.startsWith(`${tenantId}/`)) {
        return reply.status(400).send({ message: "Invalid storage path" });
      }

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const [photo] = await db
        .insert(jobPhotos)
        .values({
          tenantId,
          jobId: id,
          storagePath: body.storagePath,
          caption: body.caption || null,
          tag: body.tag ?? "general",
          uploadedBy: userId,
          fileSize: body.fileSize ?? null,
          takenAt: body.takenAt ? new Date(body.takenAt) : null,
        })
        .returning();

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "photo.uploaded",
        description: `Photo uploaded (${photo.tag})`,
        metadata: { photoId: photo.id, tag: photo.tag },
        performedBy: userId,
      });

      return reply.status(201).send({ data: photo });
    },
  );

  /**
   * PATCH /jobs/:id/photos/:photoId
   * Update the tag on a photo.
   */
  fastify.patch(
    "/:id/photos/:photoId",
    {
      preHandler: [requireTenant],
      schema: { params: photoTagParam, body: updatePhotoTagBody },
    },
    async (request, reply) => {
      const { id, photoId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { tag } = request.body;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const existing = await db
        .select({ id: jobPhotos.id, uploadedBy: jobPhotos.uploadedBy })
        .from(jobPhotos)
        .where(
          and(
            eq(jobPhotos.tenantId, tenantId),
            eq(jobPhotos.jobId, id),
            eq(jobPhotos.id, photoId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Photo not found" });
      }

      const [updated] = await db
        .update(jobPhotos)
        .set({ tag })
        .where(and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.id, photoId)))
        .returning();

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "photo.updated",
        description: `Photo tag changed to ${tag}`,
        metadata: { photoId, tag },
        performedBy: userId,
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /jobs/:id/photos/:photoId
   * Delete a photo from R2 + DB.
   */
  fastify.delete(
    "/:id/photos/:photoId",
    {
      preHandler: [requireTenant],
      schema: { params: photoParam },
    },
    async (request, reply) => {
      const { id, photoId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const existing = await db
        .select({
          id: jobPhotos.id,
          storagePath: jobPhotos.storagePath,
          uploadedBy: jobPhotos.uploadedBy,
        })
        .from(jobPhotos)
        .where(
          and(
            eq(jobPhotos.tenantId, tenantId),
            eq(jobPhotos.jobId, id),
            eq(jobPhotos.id, photoId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Photo not found" });
      }

      // Storage deletion is best-effort — still delete the DB record
      await deleteFiles("job-attachments", [existing.storagePath]);

      await db
        .delete(jobPhotos)
        .where(
          and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.id, photoId)),
        );

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "photo.deleted",
        description: "Photo deleted",
        performedBy: userId,
      });

      return reply.send({ message: "Photo deleted" });
    },
  );

  // ===== DOCUMENTS =====

  /**
   * GET /jobs/:id/documents
   * List all documents for a job.
   */
  fastify.get(
    "/:id/documents",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select({
          id: jobDocuments.id,
          jobId: jobDocuments.jobId,
          fileName: jobDocuments.fileName,
          storagePath: jobDocuments.storagePath,
          fileSize: jobDocuments.fileSize,
          mimeType: jobDocuments.mimeType,
          uploadedBy: jobDocuments.uploadedBy,
          createdAt: jobDocuments.createdAt,
          uploaderName: user.name,
        })
        .from(jobDocuments)
        .leftJoin(user, eq(jobDocuments.uploadedBy, user.id))
        .where(
          and(eq(jobDocuments.tenantId, tenantId), eq(jobDocuments.jobId, id)),
        )
        .orderBy(desc(jobDocuments.createdAt));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/documents
   * Register a document record after upload.
   */
  fastify.post(
    "/:id/documents",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: addDocumentBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      if (!body.storagePath.startsWith(`${tenantId}/`)) {
        return reply.status(400).send({ message: "Invalid storage path" });
      }

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const job = guard.job;

      // JOB-12: a document's `customerId` came straight from the body.
      if (body.customerId) {
        const badRef = await findForeignRef(db, tenantId, {
          customerId: body.customerId,
        });
        if (badRef) {
          return reply.status(400).send({ message: `${badRef} not found` });
        }
      }

      const [doc] = await db
        .insert(jobDocuments)
        .values({
          tenantId,
          jobId: id,
          customerId: body.customerId ?? job.customerId,
          fileName: body.fileName,
          storagePath: body.storagePath,
          fileSize: body.fileSize ?? null,
          mimeType: body.mimeType ?? null,
          uploadedBy: userId,
        })
        .returning();

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "document.uploaded",
        description: `Document uploaded: ${doc.fileName}`,
        metadata: { documentId: doc.id, fileName: doc.fileName },
        performedBy: userId,
      });

      return reply.status(201).send({ data: doc });
    },
  );

  /**
   * DELETE /jobs/:id/documents/:docId
   * Delete a document from R2 + DB.
   */
  fastify.delete(
    "/:id/documents/:docId",
    {
      preHandler: [requireTenant],
      schema: { params: documentParam },
    },
    async (request, reply) => {
      const { id, docId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const existing = await db
        .select({
          id: jobDocuments.id,
          storagePath: jobDocuments.storagePath,
          fileName: jobDocuments.fileName,
        })
        .from(jobDocuments)
        .where(
          and(
            eq(jobDocuments.tenantId, tenantId),
            eq(jobDocuments.jobId, id),
            eq(jobDocuments.id, docId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Document not found" });
      }

      // best-effort
      await deleteFiles("job-attachments", [existing.storagePath]);

      await db
        .delete(jobDocuments)
        .where(
          and(eq(jobDocuments.tenantId, tenantId), eq(jobDocuments.id, docId)),
        );

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "document.deleted",
        description: `Document deleted: ${existing.fileName}`,
        performedBy: userId,
      });

      return reply.send({ message: "Document deleted" });
    },
  );

  // ===== ACTIVITIES =====

  /**
   * GET /jobs/:id/activities
   * Paginated activity log with performer name.
   */
  fastify.get(
    "/:id/activities",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: paginationQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { page, limit } = request.query;
      const db = getDb();

      const offset = (page - 1) * limit;

      const whereClause = and(
        eq(jobActivities.tenantId, tenantId),
        eq(jobActivities.jobId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: jobActivities.id,
            jobId: jobActivities.jobId,
            type: jobActivities.type,
            description: jobActivities.description,
            metadata: jobActivities.metadata,
            performedBy: jobActivities.performedBy,
            createdAt: jobActivities.createdAt,
            performerName: user.name,
          })
          .from(jobActivities)
          .leftJoin(user, eq(jobActivities.performedBy, user.id))
          .where(whereClause)
          .orderBy(desc(jobActivities.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(jobActivities)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total: totalResult[0]?.total ?? 0,
          totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limit),
        },
      });
    },
  );

  // ===== BULK OPERATIONS =====

  /**
   * POST /jobs/bulk-archive
   */
  fastify.post(
    "/bulk-archive",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, ids), isNull(jobs.archivedAt)));

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(jobs)
          .set({ archivedAt: new Date() })
          .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, eligibleIds)));
      }

      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} job(s) already archived or not found` }]
          : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /jobs/bulk-restore
   */
  fastify.post(
    "/bulk-restore",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(eq(jobs.tenantId, tenantId), inArray(jobs.id, ids), isNotNull(jobs.archivedAt)),
        );

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(jobs)
          .set({ archivedAt: null })
          .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, eligibleIds)));
      }

      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} job(s) not archived or not found` }]
          : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /jobs/bulk-delete
   */
  fastify.post(
    "/bulk-delete",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, ids)));

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;
      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} job(s) not found` }]
          : [];

      let unlinkedInvoices = 0;
      if (eligibleIds.length > 0) {
        // The single-job delete cleaned up R2 and this did not, so deleting
        // five jobs one at a time freed their files while selecting the same
        // five and using the bulk bar left every object orphaned. Same helper
        // for both paths now.
        unlinkedInvoices = await countLinkedInvoices(db, tenantId, eligibleIds);
        await deleteJobAttachments(db, tenantId, eligibleIds);

        await db
          .delete(jobs)
          .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, eligibleIds)));
      }

      if (unlinkedInvoices > 0) {
        errors.push({
          id: "N/A",
          message: `${unlinkedInvoices} invoice(s) are no longer linked to a job`,
        });
      }

      return reply.send({
        succeeded: eligibleIds.length,
        failed: skippedCount,
        errors,
        unlinkedInvoices,
      });
    },
  );

  /**
   * POST /jobs/bulk-status-update
   */
  fastify.post(
    "/bulk-status-update",
    {
      preHandler: [requireTenant],
      schema: { body: bulkJobStatusBody },
    },
    async (request, reply) => {
      const { ids, stageId, status: requestedStatus } = request.body;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const existing = await db
        .select({
          id: jobs.id,
          status: jobs.status,
          stageId: jobs.stageId,
          pipelineId: jobs.pipelineId,
        })
        .from(jobs)
        .where(
          and(eq(jobs.tenantId, tenantId), inArray(jobs.id, ids), isNull(jobs.archivedAt)),
        );

      let eligibleIds = existing.map((r) => r.id);
      const skippedNotFound = ids.length - existing.length;
      const errors: { id: string; message: string }[] = [];

      if (skippedNotFound > 0) {
        errors.push({ id: "N/A", message: `${skippedNotFound} job(s) not found or archived` });
      }

      // Selected jobs can span pipelines, so the target stage is resolved per
      // pipeline: the same requested status lands in each pipeline's own column.
      const stagesByPipeline = await loadStagesByPipeline(
        db,
        tenantId,
        existing.map((j) => j.pipelineId ?? ""),
      );

      const targetByJob = new Map<
        string,
        NonNullable<ReturnType<typeof matchStage>>
      >();
      let unresolved = 0;
      let invalidTransitions = 0;

      for (const job of existing) {
        const stages = stagesByPipeline.get(job.pipelineId ?? "");
        const target = matchStage(stages, {
          stageId,
          status: requestedStatus,
        });
        if (!target) {
          unresolved++;
          continue;
        }
        const fromLifecycle: JobLifecycle =
          stages?.find((s) => s.id === job.stageId)?.lifecycle ??
          (["scheduled", "in_progress", "completed", "cancelled"].includes(
            job.status,
          )
            ? (job.status as JobLifecycle)
            : "scheduled");

        if (!canTransition(fromLifecycle, target.lifecycle)) {
          invalidTransitions++;
          continue;
        }
        targetByJob.set(job.id, target);
      }

      if (unresolved > 0) {
        errors.push({
          id: "N/A",
          message: `${unresolved} job(s) have no matching stage in their pipeline`,
        });
      }
      if (invalidTransitions > 0) {
        errors.push({
          id: "N/A",
          message: `${invalidTransitions} job(s) cannot transition to "${requestedStatus ?? stageId}"`,
        });
      }
      eligibleIds = [...targetByJob.keys()];

      // Every resolved target shares one lifecycle even when the stage rows
      // differ, so the completion gate can be decided once.
      const targetLifecycle =
        targetByJob.size > 0
          ? [...targetByJob.values()][0].lifecycle
          : undefined;

      // If completing, enforce checklist gate
      if (targetLifecycle === "completed" && eligibleIds.length > 0) {
        const incompleteJobs = await db
          .select({ jobId: jobChecklistCompletions.jobId })
          .from(jobChecklistCompletions)
          .innerJoin(
            checklistItems,
            eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
          )
          .where(
            and(
              eq(jobChecklistCompletions.tenantId, tenantId),
              inArray(jobChecklistCompletions.jobId, eligibleIds),
              eq(checklistItems.isRequired, true),
              eq(jobChecklistCompletions.isCompleted, false),
            ),
          );

        const blockedJobIds = new Set(incompleteJobs.map((r) => r.jobId));
        if (blockedJobIds.size > 0) {
          errors.push({
            id: "N/A",
            message: `${blockedJobIds.size} job(s) have incomplete required checklist items`,
          });
          eligibleIds = eligibleIds.filter((id) => !blockedJobIds.has(id));
        }
      }

      if (eligibleIds.length > 0) {
        const lifecycleByJob = new Map(
          existing.map((j) => [
            j.id,
            (stagesByPipeline
              .get(j.pipelineId ?? "")
              ?.find((s) => s.id === j.stageId)?.lifecycle ??
              "scheduled") as JobLifecycle,
          ]),
        );

        // Jobs can sit in different pipelines, so each lands in its own stage
        // row — one grouped UPDATE per distinct target rather than one blanket
        // write of a status string that may not exist in every pipeline.
        await db.transaction(async (tx) => {
          const byStage = new Map<string, string[]>();
          for (const [jobId, target] of targetByJob) {
            const list = byStage.get(target.id);
            if (list) list.push(jobId);
            else byStage.set(target.id, [jobId]);
          }
          for (const [, jobIds] of byStage) {
            const target = targetByJob.get(jobIds[0])!;
            // Jobs grouped here share a target stage; `completedAt` still needs
            // each job's own previous lifecycle, so split by that too.
            const byPrev = new Map<JobLifecycle, string[]>();
            for (const jobId of jobIds) {
              const prev = lifecycleByJob.get(jobId) ?? "scheduled";
              const list = byPrev.get(prev);
              if (list) list.push(jobId);
              else byPrev.set(prev, [jobId]);
            }
            for (const [prev, group] of byPrev) {
              await tx
                .update(jobs)
                .set({ ...stageUpdate(target, prev), updatedAt: new Date() })
                .where(
                  and(
                    eq(jobs.tenantId, tenantId),
                    inArray(jobs.id, group),
                  ),
                );
            }
          }

          // Same helper as the single-job path, inside the same transaction as
          // the writes. JOB-22 was exactly this divergence one layer up — the
          // bulk path skipped the completion email the single path sent — so
          // the two paths share the one implementation by construction.
          await emitStageChangeEvents(tx, {
            tenantId,
            actorUserId: userId,
            bulk: true,
            transitions: eligibleIds.map((jobId) => {
              const target = targetByJob.get(jobId)!;
              const prev = lifecycleByJob.get(jobId) ?? "scheduled";
              const job = existing.find((j) => j.id === jobId);
              return {
                jobId,
                from: job?.stageId
                  ? { id: job.stageId, name: job.status, lifecycle: prev }
                  : null,
                to: { id: target.id, name: target.name, lifecycle: target.lifecycle },
              };
            }),
          });
        });

        // Log activity for each updated job
        await db.insert(jobActivities).values(
          eligibleIds.map((jobId) => {
            const target = targetByJob.get(jobId)!;
            return {
              tenantId,
              jobId,
              type: "job.status_changed",
              description: `Status bulk-changed to ${target.label}`,
              metadata: {
                to: target.name,
                toLifecycle: target.lifecycle,
                stageId: target.id,
                bulk: true,
              },
              performedBy: userId,
            };
          }),
        );

        // Dispatch notifications for each updated job
        const updatedJobs = await db
          .select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status })
          .from(jobs)
          .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, eligibleIds)));

        for (const j of updatedJobs) {
          const target = targetByJob.get(j.id);
          // JOB-22: this sent no completion email at all, so completing ten
          // jobs from the bulk bar notified nobody while completing the same
          // ten one at a time sent ten emails.
          if (target?.lifecycle === "completed") {
            void sendJobCompletionEmailFor(db, tenantId, j.id);
          }
          dispatchNotification({
            tenantId,
            type: "job_status_changed",
            title: `Job ${j.jobNumber ?? ""} moved to ${target?.label ?? j.status}`,
            description: `Job status bulk-changed to ${target?.label ?? j.status}`,
            entityType: "job",
            entityId: j.id,
            actorId: userId,
            metadata: { jobNumber: j.jobNumber, to: j.status, bulk: true },
          });
        }
      }

      const failedCount = ids.length - eligibleIds.length;
      return reply.send({ succeeded: eligibleIds.length, failed: failedCount, errors });
    },
  );
};
export default jobRoutes;
