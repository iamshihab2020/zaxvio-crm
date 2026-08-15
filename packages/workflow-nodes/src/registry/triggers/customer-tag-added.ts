import type { NodeDefinition } from "../../node-definition.js";

/**
 * A tag went on a customer.
 *
 * **The hand-start.** Every other trigger fires off something the business did;
 * this one fires off something the *owner decided*, which makes it the way to
 * put one specific customer into one specific sequence without building a filter
 * that happens to match only them.
 *
 * The filter is on `tagName`, not `tagId`. A uuid in a config is unverifiable by
 * eye and unportable between workspaces — a template carrying one would silently
 * match nothing. The payload carries the label precisely so this can read "VIP".
 */
export default {
  node: "trigger.customer.tagAdded",
  version: 1,
  displayName: "Tag Added",
  description: "Runs when a tag is put on a customer.",
  howItWorks:
    "Fires the moment you tag someone. This is the simplest way to start an " +
    "automation by hand - tag the customer and it begins.",
  icon: "IconTag",
  category: "trigger",
  subcategory: "trigger.customer",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["customer.tag_added"],
  requiresSubject: ["customer"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only this tag",
      name: "tagName",
      type: "string",
      placeholder: "VIP",
      description:
        "Leave empty to run for any tag. Matched on the tag's name, so it keeps working if the tag is recreated.",
      filter: { path: "tagName", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
