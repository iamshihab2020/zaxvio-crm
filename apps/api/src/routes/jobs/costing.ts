import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  jobExpenses,
  jobActivities,
  eq,
  and,
  desc,
} from "@hvac-saas/database";
import { loadEditableJob } from "../../lib/job-guards.js";
import { getJobCostSummary } from "../../services/costing/index.js";
import {
  idParam,
  expenseParams,
  createJobExpenseBody,
  updateJobExpenseBody,
} from "../../lib/schemas/job-costing.js";

/**
 * Job costing: expenses and the derived cost/margin rollup. Labour lives in
 * `routes/jobs/time.ts` — it stopped being a field on the job and became rows.
 *
 * A sibling plugin under the same `/jobs` prefix rather than more lines in
 * `routes/jobs/index.ts`, which is already 2,497 lines and is the file
 * ARC-05 wants split. New surface area goes in new files.
 *
 * Every handler runs `loadEditableJob` first. That guard is what makes the
 * job's tenant ownership *and* its archived state one decision instead of two
 * things each handler has to remember — the jobs audit found the hand-written
 * version applied to 4 of 14 mutating handlers.
 */
const jobCostingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /jobs/:id/costs
   * The derived cost/margin summary. Never stored — see costing.service.ts.
   */
  fastify.get(
    "/:id/costs",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const summary = await getJobCostSummary(db, tenantId, id);
      if (!summary) {
        return reply.status(404).send({ message: "Job not found" });
      }

      return reply.send({ data: summary });
    },
  );

  /**
   * GET /jobs/:id/expenses
   * Newest spend first — the list is read while entering more of it.
   */
  fastify.get(
    "/:id/expenses",
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
        .from(jobExpenses)
        .where(
          and(eq(jobExpenses.tenantId, tenantId), eq(jobExpenses.jobId, id)),
        )
        .orderBy(desc(jobExpenses.incurredOn), desc(jobExpenses.createdAt));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/expenses
   */
  fastify.post(
    "/:id/expenses",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: createJobExpenseBody },
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

      const [expense] = await db
        .insert(jobExpenses)
        .values({
          tenantId,
          jobId: id,
          category: body.category,
          description: body.description,
          amount: body.amount,
          incurredOn: body.incurredOn,
          vendor: body.vendor ?? null,
          createdBy: userId,
        })
        .returning();

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "expense.added",
        description: `Added expense: ${body.description}`,
        metadata: { expenseId: expense.id, amount: body.amount },
        performedBy: userId,
      });

      return reply.status(201).send({ data: expense });
    },
  );

  /**
   * PATCH /jobs/:id/expenses/:expenseId
   */
  fastify.patch(
    "/:id/expenses/:expenseId",
    {
      preHandler: [requireTenant],
      schema: { params: expenseParams, body: updateJobExpenseBody },
    },
    async (request, reply) => {
      const { id, expenseId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      // tenantId AND jobId AND id: the expense must belong to this tenant *and*
      // to the job in the path. Matching on the expense id alone would let a
      // valid id from another job be edited through this route (security-rules
      // §1 — never the record id on its own).
      const [updated] = await db
        .update(jobExpenses)
        .set({
          ...(body.category !== undefined && { category: body.category }),
          ...(body.description !== undefined && {
            description: body.description,
          }),
          ...(body.amount !== undefined && { amount: body.amount }),
          ...(body.incurredOn !== undefined && { incurredOn: body.incurredOn }),
          ...(body.vendor !== undefined && { vendor: body.vendor }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobExpenses.tenantId, tenantId),
            eq(jobExpenses.jobId, id),
            eq(jobExpenses.id, expenseId),
          ),
        )
        .returning();

      if (!updated) {
        return reply.status(404).send({ message: "Expense not found" });
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /jobs/:id/expenses/:expenseId
   */
  fastify.delete(
    "/:id/expenses/:expenseId",
    {
      preHandler: [requireTenant],
      schema: { params: expenseParams },
    },
    async (request, reply) => {
      const { id, expenseId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const guard = await loadEditableJob(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const [deleted] = await db
        .delete(jobExpenses)
        .where(
          and(
            eq(jobExpenses.tenantId, tenantId),
            eq(jobExpenses.jobId, id),
            eq(jobExpenses.id, expenseId),
          ),
        )
        .returning();

      if (!deleted) {
        return reply.status(404).send({ message: "Expense not found" });
      }

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "expense.deleted",
        description: `Removed expense: ${deleted.description}`,
        metadata: { amount: deleted.amount },
        performedBy: userId,
      });

      return reply.send({ data: { id: expenseId } });
    },
  );

  /*
   * `PATCH /jobs/:id/labor` used to live here: one hours figure and one rate,
   * written straight onto the job. It is gone, replaced by `routes/jobs/time.ts`.
   *
   * Not a rename — the old endpoint made the bad state expressible. Hours typed
   * by hand had no relationship to any work anybody did, could not represent two
   * people on one job, and disagreed with nothing, so nothing could catch them
   * being wrong. This is the INV-01 fix applied a second time: derive the number
   * from the rows that produce it, and "hours that contradict the timesheet"
   * stops being something a caller can say.
   */
};

export default jobCostingRoutes;
