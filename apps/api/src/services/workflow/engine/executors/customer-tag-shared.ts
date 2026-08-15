/**
 * What both tag executors share.
 *
 * Split out because the ship gate asserts **one executor module per node id**
 * (`customer.addTag` → `customer-add-tag.ts`), and it is right to: "find the
 * executor for this node" should be a filename, not a grep. The shared half
 * lives here rather than being duplicated into both.
 *
 * Both route through `services/customers/customers.service.ts` rather than
 * touching `customer_tags` — [[wf-00-decisions|D-17]], and the rule it protects
 * is concrete here. The service's insert is `onConflictDoNothing` and its delete
 * checks what it matched, and **both of those decide whether an event is
 * raised**. An executor writing the row itself would tag somebody `vip` twice
 * and enrol them in the VIP automation twice, or raise `customer.tag_removed`
 * for a tag that was never on.
 */

import type { TagCustomerFailure, TagCustomerResult } from "../../../customers/customers.service.js";
import { NodeFailure } from "../errors.js";
import type { ExecutorOutput } from "./types.js";

/**
 * Which refusals are the author's problem rather than the day's.
 *
 * `customer_not_found` is deliberately absent: an automation running for a
 * record whose customer was deleted mid-run is an ordinary race, not a
 * misconfiguration, and there is nothing to open and fix.
 */
const CONFIG_FAILURES: ReadonlySet<TagCustomerFailure> = new Set(["tag_not_found"]);

/**
 * A duplicate is `skipped`, not a failure.
 *
 * "That customer already has the VIP tag" is the automation working. The whole
 * point of a tag-based hand-off is that it is safe to re-run — a retry after a
 * crash, a customer who matches two sequences — and a `NodeFailure` there would
 * email the tenant a failure notification for a correct outcome.
 */
export function translateTagResult(
  result: TagCustomerResult,
  label: string,
): ExecutorOutput {
  if (result.ok) {
    return { output: { tagId: result.tagId, tagName: result.tagName } };
  }
  if (CONFIG_FAILURES.has(result.reason)) {
    throw new NodeFailure(
      `${label}: ${result.reason}`,
      `${result.message} Open the automation and pick a tag that exists.`,
    );
  }
  return { skipped: result.message };
}

/** A picker stores an id; a template names a tag, because a uuid baked into a
 *  template matches nothing in the workspace that installs it. */
export function tagSelector(params: Record<string, unknown>) {
  return {
    tagId: typeof params.tagId === "string" ? params.tagId : undefined,
    tagName: typeof params.tagName === "string" ? params.tagName : undefined,
  };
}
