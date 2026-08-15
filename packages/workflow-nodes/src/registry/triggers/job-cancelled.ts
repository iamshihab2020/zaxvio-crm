import type { NodeDefinition } from "../../node-definition.js";
import { SERVICE_TYPES, enumOptions } from "../../crm-enums.js";

/**
 * A job was cancelled.
 *
 * Distinct from `trigger.job.stage_changed` filtered to the cancelled lifecycle,
 * and deliberately so: this is the event a producer raises *because* the job was
 * cancelled, so it carries the cancellation's own details. Reaching the same
 * place through the stage trigger works, and hands you a stage payload where you
 * wanted a cancellation one.
 */
export default {
  node: "trigger.job.cancelled",
  version: 1,
  displayName: "Job Cancelled",
  description: "Runs when a job is cancelled.",
  howItWorks:
    "Fires when a job moves into a cancelled stage, whatever that column is " +
    "called in your pipeline. Useful for freeing the slot, or asking why.",
  icon: "IconCalendarX",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.cancelled"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only these service types",
      name: "serviceType",
      type: "multiOptions",
      description: "Leave all off to run on all of them.",
      options: enumOptions(SERVICE_TYPES),
      filter: { path: "serviceType", operator: "inList" },
    },
  ],
} satisfies NodeDefinition;
