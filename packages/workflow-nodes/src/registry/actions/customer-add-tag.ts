import type { NodeDefinition } from "../../node-definition.js";

/**
 * Put a tag on the customer.
 *
 * The other half of `trigger.customer.tagAdded`, and together they are how one
 * automation hands work to another without either knowing the other exists.
 * "Chase the quote" tags them `chasing`; "Stop chasing" watches for the tag.
 *
 * **Tagging twice is refused, not repeated.** The insert is
 * `onConflictDoNothing`, so a second attempt writes no row, no activity and — the
 * part that matters — raises no event. Otherwise re-running a sequence would
 * enrol the same customer in the tag's automation again, every time.
 */
export default {
  node: "customer.addTag",
  version: 1,
  displayName: "Add a Tag",
  description: "Put a tag on the customer this automation is running for.",
  howItWorks:
    "Tags are the simplest way to hand off between automations: one adds a " +
    "tag, another starts when it appears. Adding a tag somebody already has " +
    "does nothing, so this is safe to re-run.",
  icon: "IconTagPlus",
  category: "crm",
  subcategory: "crm.customer",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["customer", "job", "invoice", "quote", "booking", "equipment", "maintenance_contract"],
  mutates: ["customer"],
  // Idempotent for real, not by claim: the second run writes nothing at all.
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Tag",
      name: "tagId",
      type: "tagSelect",
      required: true,
      description: "The tag to add.",
      ownership: "tag",
    },
  ],
} satisfies NodeDefinition;
