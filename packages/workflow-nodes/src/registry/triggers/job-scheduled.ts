import type { NodeDefinition } from "../../node-definition.js";

/**
 * A job got a date, or moved to a different one.
 *
 * `rescheduled` on the payload is the field that makes this one node rather than
 * two. A customer hears something different for "you are booked for Tuesday"
 * than for "we have moved you to Thursday", and a single trigger with a filter
 * lets one automation send each without the author wiring two graphs.
 *
 * Fires on the **date or window changing**, not on every edit — `job.updated` is
 * the catch-all. So a job whose title changed does not reach an automation built
 * to confirm an appointment.
 */
export default {
  node: "trigger.job.scheduled",
  version: 1,
  displayName: "Job Scheduled",
  description: "Runs when a job is booked in, or moved to a new date.",
  howItWorks:
    "Fires whenever a job's date or time window changes. Use the filter to " +
    "tell a first booking apart from a reschedule - they need different words.",
  icon: "IconCalendarPlus",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.scheduled"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Which of these",
      name: "rescheduled",
      type: "options",
      default: "__any__",
      options: [
        { name: "Booked in or moved", value: "__any__" },
        { name: "Only when first booked in", value: false },
        { name: "Only when moved to a new date", value: true },
      ],
      filter: { path: "rescheduled", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
