/**
 * `job.create` — raise a job.
 *
 * Through `createJob()`, so an automation's job is a real job: the checklist is
 * attached, both activity rows are written, and `job.created` is raised — which
 * is what lets work an automation created trigger another automation. An
 * executor doing its own `INSERT` would produce a row on the board with no
 * checklist for the tech to work from and no event behind it.
 *
 * ## The customer comes from the run, not from a picker
 *
 * There is no customer field on this node, deliberately. A run is *about* a
 * record, and every subject this node accepts resolves to a customer —
 * `restoreContext` has already done that work and done it tenant-scoped. Adding
 * a picker would let an author create a job for one customer while the run is
 * about another, which is expressible, always a mistake, and impossible to spot
 * in the run history afterwards.
 *
 * ## `at-most-once` is the whole safety story
 *
 * Two runs of this is two jobs on the board, each with a job number, a checklist
 * and a place in the pipeline — indistinguishable from real work until somebody
 * drives to an address twice. The engine writes a `running` node-log row before
 * invoking an `at-most-once` executor, and a resume that finds one refuses
 * rather than repeating it.
 */

import { createJob, type CreateJobFailure } from "../../../jobs/jobs.service.js";
import { createJobBody } from "../../../../lib/schemas/jobs.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

/**
 * Refusals that are the author's problem, not the day's.
 *
 * All of them name something the automation was configured with that the
 * workspace does not have — a pipeline that was deleted, a stage that never
 * existed, a teammate who left. Each is fixable by opening the step, which is
 * the test for `NodeFailure` rather than `skipped`.
 *
 * `customer_not_found` is absent on purpose: a customer deleted between the
 * trigger firing and this step running is a race, and there is nothing to fix.
 */
const CONFIG_FAILURES: ReadonlySet<CreateJobFailure> = new Set([
  "pipeline_not_found",
  "no_such_stage",
  "pipeline_has_no_stages",
  "not_a_member",
  "bad_reference",
]);

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const jobCreate: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.customer) {
    return {
      skipped:
        "This automation isn't running for a customer, so there was nobody to raise the job for.",
    };
  }

  const title = str(params.title);
  const scheduledDate = str(params.scheduledDate);
  const serviceType = str(params.serviceType);

  // Required by the definition, so an empty one here means every variable in it
  // resolved to nothing — which is a config problem the author can see and fix.
  if (!title || !scheduledDate || !serviceType) {
    throw new NodeFailure(
      `job.create missing required config on ${node.id}`,
      `The "${node.label}" step is missing a title, a service type or a date. If you used variables in them, they may have come out blank — check them against what this automation's trigger provides.`,
    );
  }

  // Parsed through the **same schema the HTTP route uses**, not cast into it.
  //
  // `params` is `Record<string, unknown>` — a saved config, which is
  // client-authored data exactly like a request body. A cast would let a
  // `serviceType` of "reppair" reach the insert and fail as a Postgres enum
  // error nobody can act on; parsing turns it into a sentence naming the step.
  // It also means a field the schema tightens later tightens here for free,
  // rather than the node quietly staying on the old rules.
  const parsed = createJobBody.safeParse({
    customerId: ctx.customer.id,
    title,
    serviceType,
    scheduledDate,
    priority: str(params.priority),
    description: str(params.description),
    pipelineId: str(params.pipelineId),
    assigneeId: str(params.assigneeId),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new NodeFailure(
      `job.create invalid config on ${node.id}: ${first?.path.join(".")}`,
      `The "${node.label}" step could not create a job: ${first?.message ?? "one of its settings is not valid"}. Open the step and check ${first?.path.join(".") || "its settings"}.`,
    );
  }

  const result = await createJob(db, {
    tenantId: ctx.tenantId,
    input: parsed.data,
    actor: {
      kind: "workflow",
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
  });

  if (!result.ok) {
    if (CONFIG_FAILURES.has(result.reason)) {
      throw new NodeFailure(`job.create refused: ${result.reason}`, result.message);
    }
    return { skipped: result.message };
  }

  return {
    output: {
      jobId: result.job.id,
      jobNumber: result.job.jobNumber,
      title: result.job.title,
      scheduledDate: result.job.scheduledDate,
    },
  };
};

export default jobCreate;
