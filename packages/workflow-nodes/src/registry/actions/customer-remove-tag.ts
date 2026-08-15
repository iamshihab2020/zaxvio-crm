import type { NodeDefinition } from "../../node-definition.js";

/**
 * Take a tag off the customer.
 *
 * The step that ends a sequence cleanly. A chase automation that tags somebody
 * `chasing` and never removes it leaves a workspace where the tag means "was
 * chased once, at some point" — which is not a segment anybody can act on.
 *
 * Removing a tag they do not have is refused rather than performed, for the same
 * reason adding a duplicate is: `customer.tag_removed` firing for a removal that
 * did not happen is an automation triggered by nothing.
 */
export default {
  node: "customer.removeTag",
  version: 1,
  displayName: "Remove a Tag",
  description: "Take a tag off the customer this automation is running for.",
  howItWorks:
    "Use it to close out a sequence - remove the tag that started it, so the " +
    "tag keeps meaning what it says. Removing one they do not have does nothing.",
  icon: "IconTagOff",
  category: "crm",
  subcategory: "crm.customer",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["customer", "job", "invoice", "quote", "booking", "equipment", "maintenance_contract"],
  mutates: ["customer"],
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Tag",
      name: "tagId",
      type: "tagSelect",
      required: true,
      description: "The tag to take off.",
      ownership: "tag",
    },
  ],
} satisfies NodeDefinition;
