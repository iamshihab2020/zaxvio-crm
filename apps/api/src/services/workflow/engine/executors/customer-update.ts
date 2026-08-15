/**
 * `customer.update` — change fields on the customer.
 *
 * Through `updateCustomer()`, which owns the field allow-list, the one spelling
 * of empty, the activity row and `customer.updated`. An executor with its own
 * `UPDATE` would have a second opinion about all four.
 *
 * ## Absent is not the same as blank
 *
 * This is the load-bearing distinction in the node. Every field is optional, and
 * a step that wrote `null` for each one the author left empty would wipe a
 * customer's address, phone and notes the first time it ran. So a parameter that
 * is missing, or is the empty string after interpolation, is **not sent**.
 *
 * The second half of that matters more than the first: `{{customer.phone}}`
 * resolves to `""` when the customer has no phone, and interpolation has already
 * happened by the time an executor sees `params`. Treating an interpolated blank
 * as an instruction to clear would let one unresolved variable erase the field
 * it was reading from.
 */

import { updateCustomer } from "../../../customers/customers.service.js";
import type { Executor } from "./types.js";

/** Fields this node offers, matching the definition's properties. */
const FIELDS = ["notes", "phone", "address", "city", "zipCode"] as const;

const customerUpdate: Executor = async ({ db, ctx, params }) => {
  if (!ctx.customer) {
    return {
      skipped:
        "This automation isn't running for a customer, so there was nothing to update.",
    };
  }

  const input: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    // Blank means "leave it alone", never "clear it". See the docblock — an
    // unresolved variable arrives here as "" and would otherwise erase a column.
    if (!trimmed) continue;
    input[field] = trimmed;
  }

  if (Object.keys(input).length === 0) {
    return {
      skipped:
        "Every field on this step was empty, so there was nothing to change.",
    };
  }

  const result = await updateCustomer(db, {
    tenantId: ctx.tenantId,
    customerId: ctx.customer.id,
    input,
    actor: {
      kind: "workflow",
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
  });

  if (!result.ok) {
    // Both refusals are ordinary outcomes. "Nothing was different" is the
    // service refusing a no-op so no event fires for a change that did not
    // happen, and a customer deleted mid-run is a race, not a misconfiguration.
    return { skipped: result.message };
  }

  return {
    output: {
      customerId: result.customer.id,
      changedFields: result.changedFields,
    },
  };
};

export default customerUpdate;
