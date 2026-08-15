import { SERVICE_TYPES, enumOptions } from "../../crm-enums.js";
import type { NodeDefinition } from "../../node-definition.js";

/**
 * A booking was cancelled.
 *
 * The slot is the perishable inventory of a service business: an hour nobody
 * fills is an hour that cannot be sold later. A cancellation is therefore the
 * one event where speed genuinely converts into money, and it is also the one
 * nobody watches, because it arrives as an absence — the calendar just gets
 * emptier.
 *
 * `reason` is free text typed by whoever cancelled, and it reaches the payload
 * unmodified. Anything putting it in an email subject must go through
 * `sanitizeSubject()` ([[security-rules]] §6); the event schema says so at the
 * field and this is the node that makes it reachable.
 */
export default {
  node: "trigger.booking.cancelled",
  version: 1,
  displayName: "Booking Cancelled",
  description: "Runs when a booking is cancelled, by you or by the customer.",
  howItWorks:
    "Fires on the cancellation itself. The slot it frees up is the thing worth " +
    "acting on — tell yourself, or follow up with the customer to rebook.",
  icon: "IconPlayerStop",
  category: "trigger",
  subcategory: "trigger.booking",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["booking.cancelled"],
  requiresSubject: ["booking"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only these service types",
      name: "serviceType",
      type: "multiOptions",
      description: "Leave all off to run on every cancellation.",
      // From `SERVICE_TYPES`, not written out. Three definitions each had their
      // own copy of this list, and a filter whose options miss the payload's
      // enum matches nothing — silently — which is the one failure the
      // declarative design exists to prevent.
      options: enumOptions(SERVICE_TYPES),
      filter: { path: "serviceType", operator: "inList" },
    },
  ],
} satisfies NodeDefinition;
