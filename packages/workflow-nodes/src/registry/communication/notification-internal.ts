import type { NodeDefinition } from "../../node-definition.js";

/**
 * Notify the team.
 *
 * Goes through `deliverNotification()`, so channel preferences, dedup and the
 * SSE bell all work already — three behaviours this node would otherwise have
 * re-implemented, and re-implemented slightly differently.
 *
 * Everyone in the workspace receives it, subject to their own settings. There
 * is no per-node recipient list, because "who should be told" is a preference
 * that belongs to the person being told, not to whoever drew the automation.
 */
export default {
  node: "notification.internal",
  version: 1,
  displayName: "Notify the Team",
  description: "Raise an in-app notification for your team.",
  howItWorks:
    "Appears in the notification bell for everyone in your workspace who has " +
    "Automation Alerts switched on in their settings. It links back to whatever " +
    "record this automation is running for.",
  icon: "IconBell",
  category: "communication",
  subcategory: "communication.internal",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  // Idempotent rather than at-most-once: the dispatcher dedups on a key built
  // from the run and the node, so a re-entry after a crash rings nothing twice.
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Title",
      name: "title",
      type: "string",
      required: true,
      placeholder: "{{job.number}} needs a follow-up",
      description: "Short — this is the line in the bell.",
      encoding: "none",
    },
    {
      displayName: "Details",
      name: "description",
      type: "text",
      typeOptions: { rows: 3 },
      placeholder: "{{customer.fullName}} hasn't replied in 3 days.",
      encoding: "none",
    },
  ],
} satisfies NodeDefinition;
