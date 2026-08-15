import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { loadEditableJob } from "../../lib/job-guards.js";
import {
  resolveOrgRole,
  canSeeLaborRates,
} from "../../lib/tenant-guards.js";
import {
  listTimeEntries,
  getRunningTimer,
  startTimer,
  stopTimer,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from "../../services/jobs/time.service.js";
import {
  idParam,
  timeEntryParams,
  startTimerBody,
  stopTimerBody,
  createTimeEntryBody,
  updateTimeEntryBody,
} from "../../lib/schemas/job-time.js";

/**
 * Job time tracking.
 *
 * A sibling plugin under the same `/jobs` prefix, for the reason `costing.ts`
 * is one: `routes/jobs/index.ts` is still ~1,862 lines and is ARC-05's target.
 * New surface area goes in new files.
 *
 * Handlers are thin by api-rules §1 — resolve the caller's role, call the
 * service, map its result union onto a status code. The service returns
 * refusals as values precisely so this file can do that without a try/catch
 * that would also swallow real faults.
 *
 * ## Who sees what
 *
 * Everyone in the workspace can read a job's entries and record their own time.
 * Only owners and admins see `hourlyCostRate` and per-entry `cost`, or touch
 * somebody else's entry — a per-person hourly rate is payroll data, which is why
 * `tenant_member_rates` is already gated on `requireOrgRole(["owner","admin"])`.
 * The gate is resolved per request rather than declared as a preHandler because
 * these routes stay open to members and merely show them less; `requireOrgRole`
 * refuses, which is the wrong shape for that.
 */
const jobTimeRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /jobs/time-entries/running
   *
   * Declared before `/:id/...` deliberately: `time-entries` would otherwise be
   * a candidate for the `:id` parameter, and a uuid schema turning a real route
   * into a 400 is a genuinely confusing way to lose an endpoint.
   */
  fastify.get(
    "/time-entries/running",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const data = await getRunningTimer(db, tenantId, request.authUser.userId);
      return reply.send({ data });
    },
  );

  /** GET /jobs/:id/time-entries — newest first, the order a timesheet is read. */
  fastify.get(
    "/:id/time-entries",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      const data = await listTimeEntries(
        db,
        tenantId,
        id,
        canSeeLaborRates(role),
      );
      return reply.send({ data });
    },
  );

  /** POST /jobs/:id/time-entries/start */
  fastify.post(
    "/:id/time-entries/start",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: startTimerBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Archived jobs refuse new work, and `loadEditableJob` is what makes the
      // job's tenant ownership and its archived state one decision rather than
      // two things every handler has to remember.
      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const result = await startTimer(db, {
        tenantId,
        jobId: id,
        userId: request.authUser.userId,
        note: request.body.note,
      });
      if (!result.ok) {
        return reply.status(result.status).send({ message: result.message });
      }
      return reply.status(201).send({ data: result.data });
    },
  );

  /**
   * POST /jobs/:id/time-entries/stop
   *
   * The job id is in the path for symmetry and for the activity row, but the
   * service stops whichever timer *this user* has running. Scoping the stop to
   * the path's job would leave a timer running forever the moment someone
   * navigated away from the job they clocked into — and the shell bar, which is
   * the whole point of the feature, offers Stop from every page.
   */
  fastify.post(
    "/:id/time-entries/stop",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: stopTimerBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const result = await stopTimer(db, {
        tenantId,
        userId: request.authUser.userId,
        note: request.body.note,
      });
      if (!result.ok) {
        return reply.status(result.status).send({ message: result.message });
      }
      return reply.send({ data: result.data });
    },
  );

  /** POST /jobs/:id/time-entries — a manual entry, or one logged for a tech. */
  fastify.post(
    "/:id/time-entries",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: createTimeEntryBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      const result = await createTimeEntry(db, {
        tenantId,
        jobId: id,
        actorId: request.authUser.userId,
        canManageOthers: canSeeLaborRates(role),
        ...request.body,
      });
      if (!result.ok) {
        return reply.status(result.status).send({ message: result.message });
      }
      return reply.status(201).send({ data: result.data });
    },
  );

  /** PATCH /jobs/:id/time-entries/:entryId */
  fastify.patch(
    "/:id/time-entries/:entryId",
    {
      preHandler: [requireTenant],
      schema: { params: timeEntryParams, body: updateTimeEntryBody },
    },
    async (request, reply) => {
      const { id, entryId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      const result = await updateTimeEntry(db, {
        tenantId,
        jobId: id,
        entryId,
        actorId: request.authUser.userId,
        canManageOthers: canSeeLaborRates(role),
        ...request.body,
      });
      if (!result.ok) {
        return reply.status(result.status).send({ message: result.message });
      }
      return reply.send({ data: result.data });
    },
  );

  /** DELETE /jobs/:id/time-entries/:entryId */
  fastify.delete(
    "/:id/time-entries/:entryId",
    {
      preHandler: [requireTenant],
      schema: { params: timeEntryParams },
    },
    async (request, reply) => {
      const { id, entryId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      const result = await deleteTimeEntry(db, {
        tenantId,
        jobId: id,
        entryId,
        actorId: request.authUser.userId,
        canManageOthers: canSeeLaborRates(role),
      });
      if (!result.ok) {
        return reply.status(result.status).send({ message: result.message });
      }
      return reply.send({ data: result.data });
    },
  );
};

export default jobTimeRoutes;
