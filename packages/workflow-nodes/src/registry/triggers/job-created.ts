import type { NodeDefinition } from "../../node-definition.js";

/**
 * A job was raised, however it was raised.
 *
 * `job.created` is emitted from one place — `createJob` — which every route
 * into a job funnels through: the New Job dialog, the quote conversion, the
 * booking conversion. So this is genuinely "a job now exists", not "somebody
 * used the button", and an automation on it cannot be bypassed by the flow
 * somebody happened to take.
 *
 * The two filters are the two axes a contractor actually triages on. Urgency
 * decides whether it interrupts them; service type decides whether it is even
 * their department.
 */
export default {
  node: "trigger.job.created",
  version: 1,
  displayName: "Job Created",
  description: "Runs when a new job is added, from anywhere.",
  howItWorks:
    "Fires for every new job — added by hand, converted from a quote, or " +
    "converted from a booking. It runs once, when the job first exists.",
  icon: "IconPlayerPlay",
  category: "trigger",
  subcategory: "trigger.job",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["job.created"],
  requiresSubject: ["job"],
  sideEffect: "none",

  properties: [
    {
      // Three values, not four. `jobPrioritySchema` is
      // `standard | urgent | emergency` — a filter offering a "Low" or "High"
      // that the payload can never contain matches nothing, silently, which is
      // the exact failure the declarative design exists to prevent.
      displayName: "Only these priorities",
      name: "priority",
      type: "multiOptions",
      description: "Leave all off to run on every new job.",
      options: [
        { name: "Standard", value: "standard" },
        { name: "Urgent", value: "urgent" },
        { name: "Emergency", value: "emergency" },
      ],
      filter: { path: "priority", operator: "inList" },
    },
    {
      // `multiOptions`, not `serviceTypeSelect`. That type is declared in
      // `NODE_PROPERTY_TYPES` and has no case in the config renderer, so it
      // draws "this kind of field isn't available yet" — a filter nobody can
      // set. The list is a closed enum anyway, so there is nothing to fetch.
      displayName: "Only these service types",
      name: "serviceType",
      type: "multiOptions",
      description: "Leave all off to run on all of them.",
      options: [
        { name: "Installation", value: "installation" },
        { name: "Repair", value: "repair" },
        { name: "Maintenance", value: "maintenance" },
        { name: "Inspection", value: "inspection" },
        { name: "Emergency", value: "emergency" },
        { name: "Consultation", value: "consultation" },
        { name: "Other", value: "other" },
      ],
      filter: { path: "serviceType", operator: "inList" },
    },
  ],
} satisfies NodeDefinition;
