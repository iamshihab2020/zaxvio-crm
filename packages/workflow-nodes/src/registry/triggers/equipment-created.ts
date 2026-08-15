import type { NodeDefinition } from "../../node-definition.js";

/**
 * A piece of customer equipment was recorded.
 *
 * The start of an asset's life with you, and the natural place to open a service
 * agreement or schedule the first maintenance visit — while somebody is stood in
 * front of it, rather than a year later when the warranty is nearly out.
 */
export default {
  node: "trigger.equipment.created",
  version: 1,
  displayName: "Asset Added",
  description: "Runs when a piece of customer equipment is recorded.",
  howItWorks:
    "Fires when an asset is added to a customer. Its make, model, serial and " +
    "warranty date are all available to the steps below.",
  icon: "IconDeviceDesktopPlus",
  category: "trigger",
  subcategory: "trigger.asset",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["equipment.created"],
  requiresSubject: ["equipment"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only this kind of asset",
      name: "equipmentType",
      type: "string",
      placeholder: "Furnace",
      description:
        "Leave empty for any. Matched exactly against the type you typed on the asset.",
      filter: { path: "equipmentType", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
