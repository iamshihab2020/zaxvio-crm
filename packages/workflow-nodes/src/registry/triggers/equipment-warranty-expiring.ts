import type { NodeDefinition } from "../../node-definition.js";

/**
 * A warranty is about to run out.
 *
 * ## Once per asset, not once a day for sixty days
 *
 * The distinction is the whole node. A naive sweep firing every day something
 * is "within 60 days" would send sixty emails per asset, and the automation
 * would look like it was working right up until a customer replied.
 * `workflow_schedule_state` keyed on `warranty:<equipmentId>` is what makes it
 * once — and it outlives the outbox, which the retention sweep clears, so
 * dedup cannot silently expire on day 31.
 *
 * ## Why the lead time is on the trigger rather than in a Wait
 *
 * Because the warranty date is already in the past relative to when the
 * automation is built. There is no run to pause — the sweep has to *look
 * forward* and decide, which is a filter on the sweep, not a delay in a graph.
 */
export default {
  node: "trigger.equipment.warrantyExpiring",
  version: 1,
  displayName: "Warranty Expiring",
  description: "Runs when a customer's equipment warranty is nearly up.",
  howItWorks:
    "Checks once a day and fires once per asset, however long the warranty " +
    "has left. It will not chase the same asset again tomorrow.",
  icon: "IconShieldExclamation",
  category: "trigger",
  subcategory: "trigger.asset",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["equipment.warranty_expiring"],
  requiresSubject: ["equipment"],
  sideEffect: "none",

  properties: [
    {
      displayName: "How far ahead",
      name: "leadDays",
      type: "number",
      required: true,
      default: 60,
      typeOptions: { minValue: 1, maxValue: 365, step: 1 },
      description: "Days before the warranty ends.",
    },
  ],
} satisfies NodeDefinition;
