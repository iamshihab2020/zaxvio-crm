/**
 * `customer.removeTag` — take a tag off the customer.
 *
 * The step that ends a sequence cleanly. A chase that tags somebody `chasing`
 * and never removes it leaves a workspace where the tag means "was chased once,
 * at some point" — which is not a segment anybody can act on.
 *
 * Removing a tag they do not have is refused rather than performed, for the same
 * reason adding a duplicate is: `customer.tag_removed` firing for a removal that
 * did not happen is an automation triggered by nothing.
 */

import { removeCustomerTag } from "../../../customers/customers.service.js";
import { tagSelector, translateTagResult } from "./customer-tag-shared.js";
import type { Executor } from "./types.js";

const customerRemoveTag: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.customer) {
    return {
      skipped:
        "This automation isn't running for a customer, so there was no tag to remove.",
    };
  }

  const result = await removeCustomerTag(db, {
    tenantId: ctx.tenantId,
    customerId: ctx.customer.id,
    ...tagSelector(params),
    actor: {
      kind: "workflow",
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
  });

  return translateTagResult(result, node.label);
};

export default customerRemoveTag;
