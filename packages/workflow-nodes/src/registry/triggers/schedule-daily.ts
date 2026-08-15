import type { NodeDefinition } from "../../node-definition.js";

/**
 * Every day, at a time you choose.
 *
 * ## The time is local to the automation, and that is a real decision
 *
 * "9am" means 9am where the business is, across daylight saving, forever. The
 * sweep resolves the local date in the automation's zone and puts **that date**
 * in the dedup key, rather than comparing a timestamp — because deciding "which
 * day is it" from a UTC instant gives a different answer per tenant, and the
 * decision belongs to the code that knows the zone.
 *
 * ## Once only, and it survives a restart
 *
 * A row in `workflow_schedule_state` with a unique index, never a timer. A
 * process that remembers is a process that forgets on deploy — and a deploy at
 * 09:00 would either skip that day's send or repeat it, which is the failure
 * `delay.wait` was designed around and this reuses.
 *
 * ## It has no subject
 *
 * A daily schedule is not about a customer or a job. Whatever it acts on, it
 * finds — which in practice means the steps below start with a Repeat or a
 * lookup. That is why the palette groups it under Schedule rather than under a
 * record type.
 */
export default {
  node: "trigger.schedule.daily",
  version: 1,
  displayName: "Every Day",
  description: "Runs once a day at a time you choose.",
  howItWorks:
    "Fires at the same local time every day, and only once - if the system " +
    "restarts it will not run twice. It is not about any one customer or job, " +
    "so the steps below need to find whatever they act on.",
  icon: "IconCalendarTime",
  category: "trigger",
  subcategory: "trigger.system",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["schedule.daily"],
  sideEffect: "none",

  properties: [
    {
      displayName: "At",
      name: "atTime",
      type: "time",
      required: true,
      default: "09:00",
      description: "Local to this automation's timezone.",
    },
  ],
} satisfies NodeDefinition;
