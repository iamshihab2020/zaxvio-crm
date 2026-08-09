import type { NodeDefinition } from "../../node-definition.js";

/**
 * Put a job in someone's name.
 *
 * `assigneeId` is a client-supplied foreign key, so it carries `ownership:
 * "member"` and is checked twice — at publish, so the author is told, and at
 * execution, because people leave the organisation between the two. That check
 * is two hops (tenant → organisation → membership) rather than a read of
 * `user`, because `user` has no tenant column and trusting the id there is what
 * makes a cross-tenant assignment possible.
 */
export default {
  node: "job.assign",
  version: 1,
  displayName: "Assign the Job",
  description: "Put the job in a teammate's name.",
  howItWorks:
    "Sets who the job belongs to. It replaces the current assignee rather than " +
    "adding to it, and it does not notify them on its own — add a Notify the Team " +
    "step after this if you want that.",
  icon: "IconUser",
  category: "crm",
  subcategory: "crm.job",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["job"],
  mutates: ["job"],
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Assign to",
      name: "assigneeId",
      type: "memberSelect",
      required: true,
      description: "Whoever should own this job.",
      ownership: "member",
    },
  ],
} satisfies NodeDefinition;
