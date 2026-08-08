import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `booking.created`.
 *
 * The `source` filter is the point of this trigger, not a refinement of it. A
 * request that arrives through the public portal has nobody on the other end;
 * one typed at the desk has the customer on the phone as it is entered. An
 * auto-acknowledgement is right for the first and redundant for the second.
 */
export default {
  node: "trigger.booking.created",
  version: 1,
  displayName: "Booking Requested",
  description: "Runs when someone requests an appointment.",
  howItWorks:
    "Fires when a booking request comes in — before you confirm it. Use it to " +
    "acknowledge the request straight away; confirming is a separate trigger.",
  icon: "IconBell",
  category: "trigger",
  subcategory: "trigger.booking",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["booking.created"],
  requiresSubject: ["booking"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only requests from",
      name: "source",
      type: "multiOptions",
      description: "Leave empty for all of them.",
      // Mirrors `bookingCreatedPayload.source`.
      options: [
        { name: "Your booking page", value: "portal" },
        { name: "Entered by your team", value: "dashboard" },
        { name: "The API", value: "api" },
      ],
      filter: { path: "source", operator: "inList" },
    },
  ],
} satisfies NodeDefinition;
