import type { NodeDefinition } from "../../node-definition.js";

/**
 * Every week, on a day and time you choose.
 *
 * Deduped on the **ISO week** — `2026-W32` — not on "week of the month", which
 * is ambiguous at both ends of a month and disagrees between calendars. The week
 * number and the weekday together are what make a restart safe.
 */
export default {
  node: "trigger.schedule.weekly",
  version: 1,
  displayName: "Every Week",
  description: "Runs once a week on a day and time you choose.",
  howItWorks:
    "Fires on the same weekday and local time each week, once only. Good for " +
    "a Monday morning summary, or a Friday chase of everything still unpaid.",
  icon: "IconCalendarWeek",
  category: "trigger",
  subcategory: "trigger.system",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["schedule.weekly"],
  sideEffect: "none",

  properties: [
    {
      displayName: "On",
      name: "weekday",
      type: "options",
      required: true,
      default: "1",
      options: [
        { name: "Monday", value: "1" },
        { name: "Tuesday", value: "2" },
        { name: "Wednesday", value: "3" },
        { name: "Thursday", value: "4" },
        { name: "Friday", value: "5" },
        { name: "Saturday", value: "6" },
        { name: "Sunday", value: "7" },
      ],
    },
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
