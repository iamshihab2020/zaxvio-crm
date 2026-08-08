/**
 * The executor contract.
 *
 * A **definition** says what a node is configured with; an **executor** says
 * what it does. The link between them is the `node` string, and that separation
 * is why adding a node is "write a definition, write one function" rather than
 * touching six files.
 *
 * Three things an executor deliberately cannot do:
 *
 * - **No HTTP.** No request, no reply, no status codes. A node that returned a
 *   reply object is how the booking convert path shipped a bug where a *failed*
 *   conversion ran the success branch — reply objects are truthy (BOOK-01).
 * - **No direct table writes** (wf-00 D-17). Every side effect goes through the
 *   domain service that already owns the rule. An executor containing an
 *   `UPDATE` has, by definition, a second opinion about a business rule.
 * - **No interpolation.** `params` arrives already resolved. A node cannot ship
 *   a field that forgot to resolve variables, because resolving is not
 *   something it does.
 */

import type { ExecutionContext } from "@hvac-saas/workflow-nodes";
import type { getDb } from "@hvac-saas/database";

export type ExecutorDb = Omit<ReturnType<typeof getDb>, "$client">;

export interface ExecutorInput {
  db: ExecutorDb;
  /** Mutable: a node may write to `ctx.vars`, and `refreshAfterNode` re-reads. */
  ctx: ExecutionContext;
  /** **Already interpolated.** Never re-resolve. */
  params: Record<string, unknown>;
  node: { id: string; type: string; label: string };
}

export interface ExecutorOutput {
  /**
   * Which output the run leaves by. Defaults to `main`.
   *
   * A **stable id**, never a label — the reference implementation stored the
   * display label in `sourceHandle`, so renaming "Found" to "Match" broke
   * routing on every saved automation (D-07).
   */
  handle?: string;
  /** Recorded on the node log and readable downstream as `{{previous.…}}`. */
  output?: Record<string, unknown>;
  /**
   * The node did nothing, on purpose, and this is why — in language the tenant
   * reads on the replay page. "This customer unsubscribed on 12 July, so we
   * didn't email them", never a code.
   */
  skipped?: string;
}

export type Executor = (input: ExecutorInput) => Promise<ExecutorOutput>;
