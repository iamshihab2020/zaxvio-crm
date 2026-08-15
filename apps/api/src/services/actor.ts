/**
 * Who is doing this — a person, or an automation.
 *
 * ## Why a union rather than `userId: string | null`
 *
 * Null would be at least three different things: a cron sweep, the public
 * booking portal, and a workflow run. The activity row has to name which, and a
 * reader looking at "performed by: (nobody)" on their own customer's timeline
 * concludes data was lost rather than that a robot did it.
 *
 * The database already models the distinction — `customer_notes.created_by`
 * became nullable with `created_by_workflow_id` beside it, and the pair is
 * exclusive. This type is that pair, in the language the services speak.
 *
 * ## Why it lives here rather than in `jobs.service.ts`
 *
 * It was declared there first, as `JobActor`, because jobs were the first domain
 * to need it. `customers` needs the identical shape, and a second declaration
 * would be two types that are structurally compatible today and would drift the
 * first time one of them gained a field. Every domain service takes this one.
 *
 * `workflowName` and `executionId` are carried rather than looked up because the
 * activity row quotes the automation by name — "Moved by 'Chase overdue
 * invoices'" is what a timeline should say — and a reader who wants the run has
 * the execution id to open it with.
 */

export type Actor =
  | { kind: "user"; userId: string }
  | {
      kind: "workflow";
      workflowId: string;
      workflowName: string;
      executionId: string;
    };

/** The user id for columns that hold one. Null for every automation. */
export function actorUserId(actor: Actor): string | null {
  return actor.kind === "user" ? actor.userId : null;
}

/**
 * The workflow half, for an activity row's metadata.
 *
 * Spread rather than assigned — `{...actorMetadata(actor)}` adds nothing for a
 * person, so one expression covers both cases and no call site needs a
 * conditional that could be written two different ways in two places.
 */
export function actorMetadata(
  actor: Actor,
): { workflowId: string; executionId: string } | Record<string, never> {
  return actor.kind === "workflow"
    ? { workflowId: actor.workflowId, executionId: actor.executionId }
    : {};
}

/**
 * `Updated Assignee` / `Updated Assignee by "Chase overdue invoices"`.
 *
 * One helper so every service phrases attribution the same way. Two services
 * inventing their own wording is how a customer's timeline ends up reading like
 * it was written by two different products.
 */
export function describeActor(actor: Actor, description: string): string {
  return actor.kind === "workflow"
    ? `${description} by "${actor.workflowName}"`
    : description;
}
