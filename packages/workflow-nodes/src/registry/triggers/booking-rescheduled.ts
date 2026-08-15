import type { NodeDefinition } from "../../node-definition.js";

/**
 * A booking moved.
 *
 * The payload carries both the old and the new date, which is the whole point —
 * "we have moved you from Tuesday to Thursday" needs both, and a trigger that
 * gave only the new one would force the automation to have remembered the old.
 */
export default {
  node: "trigger.booking.rescheduled",
  version: 1,
  displayName: "Booking Moved",
  description: "Runs when a booking is moved to a different date or time.",
  howItWorks:
    "Fires on the move itself and carries both the old and the new slot, so " +
    "the message you send can name each.",
  icon: "IconCalendarRepeat",
  category: "trigger",
  subcategory: "trigger.booking",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["booking.rescheduled"],
  requiresSubject: ["booking"],
  sideEffect: "none",

  properties: [],
} satisfies NodeDefinition;
