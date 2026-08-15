import type { NodeDefinition } from "../../node-definition.js";
import { SERVICE_TYPES, JOB_PRIORITIES, enumOptions } from "../../crm-enums.js";

/**
 * Raise a job.
 *
 * The step that turns a signal into work: a quote accepted, a contract visit
 * due, a warranty about to lapse. Until this existed an automation could tell
 * somebody about work but not create it, so every path ended in a notification
 * a human then had to act on.
 *
 * **`at-most-once`, firmly.** Running it twice puts two jobs on the board, and
 * the second one has a job number, a checklist and a place in the pipeline —
 * indistinguishable from real work until someone drives to an address twice.
 * The engine writes a `running` log row before invoking it, and a resume that
 * finds one refuses.
 *
 * Goes through `createJob()`, so it gets the checklist, both activity rows and
 * the `job.created` event — which is what lets a job an automation raised
 * trigger another automation.
 */
export default {
  node: "job.create",
  version: 1,
  displayName: "Create a Job",
  description: "Raise a new job for this customer.",
  howItWorks:
    "Creates a real job - job number, checklist and all - on the pipeline you " +
    "choose. It shows up on the board exactly as if you had added it yourself.",
  icon: "IconClipboardPlus",
  category: "crm",
  subcategory: "crm.job",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["customer", "job", "invoice", "quote", "booking", "equipment", "maintenance_contract"],
  mutates: ["job"],
  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "Title",
      name: "title",
      type: "string",
      required: true,
      placeholder: "Annual service for {{customer.fullName}}",
      description: "What the job is. Variables work here.",
    },
    {
      displayName: "Service type",
      name: "serviceType",
      type: "options",
      required: true,
      default: "maintenance",
      options: enumOptions(SERVICE_TYPES),
    },
    {
      displayName: "Schedule it for",
      name: "scheduledDate",
      type: "date",
      required: true,
      description: "The day the work is booked in for.",
    },
    {
      displayName: "Priority",
      name: "priority",
      type: "options",
      default: "standard",
      options: enumOptions(JOB_PRIORITIES),
    },
    {
      displayName: "Pipeline",
      name: "pipelineId",
      type: "pipelineSelect",
      description: "Leave empty to use your default pipeline.",
      ownership: "pipeline",
    },
    {
      displayName: "Assign to",
      name: "assigneeId",
      type: "memberSelect",
      description: "Leave empty to leave it unassigned.",
      ownership: "member",
    },
    {
      displayName: "Description",
      name: "description",
      type: "text",
      typeOptions: { rows: 3 },
      encoding: "none",
    },
  ],
} satisfies NodeDefinition;
