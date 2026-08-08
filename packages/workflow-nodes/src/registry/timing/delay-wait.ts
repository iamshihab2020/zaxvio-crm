import type { NodeDefinition } from "../../node-definition.js";

/**
 * Pause the automation, then carry on.
 *
 * The most-wanted node in a service business and the reason the E-12 review
 * request exists as a hand-rolled cron: "three days after the job, ask for a
 * review" had no other way to be expressed.
 *
 * A pause is **durable**, not a timer. The run is written to the database with
 * a `resume_at` and its whole context serialised, and a worker picks it up
 * later — so it survives a deploy, a restart and a crash. Nothing is held in
 * memory, because a three-day wait outlives every process that could hold it.
 *
 * It also resumes on the version it **started** on. Publishing v2 while a run
 * is paused inside v1 must not drop that run into a graph whose next node may
 * no longer exist, which is the whole reason versions are snapshots.
 */
export default {
  node: "delay.wait",
  version: 1,
  displayName: "Wait",
  description: "Pause, then carry on with the rest of the steps.",
  howItWorks:
    "The automation stops here and picks up again later — it does not run the " +
    "rest in the meantime. Waits survive restarts, so a three-day wait really " +
    "does wait three days.",
  icon: "IconClock",
  category: "logic",
  subcategory: "logic.timing",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  // Re-entering a wait that has already elapsed is harmless; it recalculates
  // and continues. Nothing is sent and nothing is written.
  sideEffect: "none",

  properties: [
    {
      displayName: "Wait",
      name: "mode",
      type: "options",
      required: true,
      default: "for",
      options: [
        { name: "for a length of time", value: "for" },
        {
          name: "until a specific date",
          value: "until",
          description: "A fixed point, not relative to when the run reaches here.",
        },
      ],
    },
    {
      displayName: "How long",
      name: "duration",
      type: "duration",
      required: true,
      description: "Counted from the moment the automation reaches this step.",
      default: { amount: 3, unit: "days" },
      typeOptions: { units: ["minutes", "hours", "days", "weeks"] },
      displayOptions: { show: { mode: ["for"] } },
    },
    {
      // Only offered for a relative wait. "Until 1 September at 6pm" is the
      // author naming a moment, and quietly moving that to 8am the next morning
      // would override an explicit instruction — whereas "in 3 days" says
      // nothing about the hour, which is exactly where a 2am send comes from.
      displayName: "Resume",
      name: "resumeDuring",
      type: "options",
      default: "businessHours",
      description:
        "Working hours come from Settings → Scheduling, so a day you are closed is a day this does not resume.",
      options: [
        {
          name: "during your working hours",
          value: "businessHours",
          description: "Holds until you open, rather than acting overnight.",
        },
        {
          name: "as soon as the wait is up",
          value: "anytime",
          description: "Any hour, any day — right for internal steps.",
        },
      ],
      displayOptions: { show: { mode: ["for"] } },
    },
    {
      displayName: "Date",
      name: "untilDate",
      type: "date",
      required: true,
      description: "Read in your business's timezone, not the customer's.",
      displayOptions: { show: { mode: ["until"] } },
    },
    {
      displayName: "Time",
      name: "untilTime",
      type: "time",
      default: "09:00",
      description: "Leave at 09:00 to resume first thing that morning.",
      displayOptions: { show: { mode: ["until"] } },
    },
    {
      displayName: "notice",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "info",
        noticeMessage:
          "A date that has already passed resumes straight away rather than being skipped.",
      },
      displayOptions: { show: { mode: ["until"] } },
    },
  ],
} satisfies NodeDefinition;
