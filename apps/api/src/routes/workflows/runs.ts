/**
 * Run history — what an automation actually did.
 *
 * A third **sibling plugin** under the same `/workflows` prefix, alongside
 * `graph.ts`, for the reason recorded there: `routes/jobs/index.ts` reached
 * 2,497 lines one reasonable addition at a time ([[architecture|ARC-05]]).
 *
 * These are the first read paths this table has ever had. The engine has been
 * writing a row per run and a row per node since P3, and nothing outside a test
 * could read either — so an automation could be built, published, switched on
 * and run, with no way for its owner to find out whether it had done anything.
 *
 * Handlers stay thin ([[api-rules]] §1). Every query is in
 * `services/workflow/runs/`.
 */

import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { getDb, workflows, and, eq } from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";
import { idParam } from "../../lib/schemas/common.js";
import { runIdParam, runListQuery } from "../../lib/schemas/workflows.js";
import {
  getRun,
  getRunStats,
  listRuns,
} from "../../services/workflow/runs/runs.service.js";

const workflowRunRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /workflows/:id/runs
   *
   * The run list. Note this shares a path with `POST /:id/runs`, which starts
   * one — same resource, different verb, which is the whole point of having
   * verbs.
   */
  fastify.get(
    "/:id/runs",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: runListQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const { page, limit, status, customerId } = request.query;

      // Checked before querying rather than inferred from an empty result: a
      // workflow belonging to another tenant would otherwise return "0 runs",
      // which reads as "this automation has never run" rather than "this is not
      // yours". Same answer for missing and forbidden, so the response does not
      // confirm which ids exist.
      if (!(await ownsWorkflow(tenantId, id))) {
        return reply.status(404).send({ message: "Automation not found" });
      }

      const db = getDb();
      const [result, stats] = await Promise.all([
        listRuns(db, { tenantId, workflowId: id, page, limit, status, customerId }),
        getRunStats(db, tenantId, id),
      ]);

      return reply.send({ ...result, stats });
    },
  );

  /**
   * GET /workflows/:id/runs/:runId
   *
   * One run, with every step it took in order.
   */
  fastify.get(
    "/:id/runs/:runId",
    {
      preHandler: [requireTenant],
      schema: { params: runIdParam },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id, runId } = request.params;

      const run = await getRun(getDb(), tenantId, id, runId);
      if (!run) {
        return reply.status(404).send({ message: "Run not found" });
      }

      return reply.send({ run });
    },
  );
};

async function ownsWorkflow(tenantId: string, workflowId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.tenantId, tenantId)));
  return Boolean(row);
}

export default workflowRunRoutes;
