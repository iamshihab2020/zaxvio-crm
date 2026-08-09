import type { NodeDefinition } from "../../node-definition.js";

/**
 * A job's assignee changed.
 *
 * The point of this one is the person on the other end. A solo contractor does
 * not need it; the moment there is a second pair of hands, "you have been given
 * a job" is the message that stops work being dropped, and today it is a text
 * message somebody remembers to send.
 *
 * **It also fires on *un*assignment**, with `toAssigneeId: null` — the event
 * schema says so at the field, and it is worth automating on for the same
 * reason: a job with nobody on it is a job nobody is doing. So the filter below
 * is a filter, not a required field.
 */
export default {
  node: "trigger.job.assigned",
  version: 1,
  displayName: "Job Assigned",
  description: "Runs when a job is given to someone, or taken off them.",
  howItWorks:
    "Fires whenever a job's assignee changes, including when it is cleared. " +
    "Use it to tell whoever picked it up, or to flag work that has ended up " +
    "with nobody on it.",
  icon: "IconUser",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.assigned"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only when assigned to",
      name: "toAssigneeId",
      type: "memberSelect",
      description: "Leave empty to run whoever it goes to.",
      // A teammate id is client-supplied data exactly like a request body, and
      // there is no row-level security under it (wf-10 §10.1) — so it is
      // tenant-checked at save time and again at execution.
      ownership: "member",
      filter: { path: "toAssigneeId", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
