import type { NodeDefinition } from "../../node-definition.js";
import { JOB_PRIORITIES, enumOptions } from "../../crm-enums.js";

/**
 * Change details on the job.
 *
 * Deliberately **not** the stage — that is `job.moveStage`, which runs the
 * transition table, the required-checklist gate, the completion email and the
 * notification. A generic "set any field" node that could write `status` would
 * be a fourth way to move a job, and this feature has already found three.
 *
 * Same patch semantics as the customer node: only what you fill in is written.
 */
export default {
  node: "job.update",
  version: 1,
  displayName: "Update the Job",
  description: "Change details on the job this automation is running for.",
  howItWorks:
    "Only the fields you fill in change. To move a job to a different column, " +
    "use Move Job Stage instead - that one runs your checklist rules and tells " +
    "the customer.",
  icon: "IconEdit",
  category: "crm",
  subcategory: "crm.job",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["job"],
  mutates: ["job"],
  sideEffect: "idempotent",

  properties: [
    {
      displayName: "Priority",
      name: "priority",
      type: "options",
      default: "",
      options: [{ name: "Leave as it is", value: "" }, ...enumOptions(JOB_PRIORITIES)],
    },
    {
      displayName: "Reschedule to",
      name: "scheduledDate",
      type: "date",
      description: "Leave empty to keep the current date.",
    },
    {
      displayName: "Notes",
      name: "notes",
      type: "text",
      typeOptions: { rows: 3 },
      description: "Replaces the job's notes.",
      encoding: "none",
    },
  ],
} satisfies NodeDefinition;
