/**
 * `customer.addTag` — put a tag on the customer.
 *
 * The other half of `trigger.customer.tagAdded`, and together they are how one
 * automation hands work to another without either knowing the other exists.
 *
 * Tagging twice writes no row, no activity and **no event** — see
 * `customer-tag-shared.ts` for why that lives in the service rather than here.
 */

import { addCustomerTag } from "../../../customers/customers.service.js";
import { tagSelector, translateTagResult } from "./customer-tag-shared.js";
import type { Executor } from "./types.js";

const customerAddTag: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.customer) {
    return {
      skipped:
        "This automation isn't running for a customer, so there was nobody to tag.",
    };
  }

  const result = await addCustomerTag(db, {
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

export default customerAddTag;
