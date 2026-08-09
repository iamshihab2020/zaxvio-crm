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
 *
 * ## Three modes, because "3 days from now" is not the only kind of waiting
 *
 * `for` is relative to arrival, `until` is a calendar date the author typed, and
 * `untilField` anchors on **a date carried by the record this run is about** —
 * the appointment, the due date, the expiry, the next service visit.
 *
 * That third one is not a variation, it is the entire appointment-reminder
 * category. "Remind the customer the day before their appointment" cannot be
 * expressed by either of the others: the booking is made at an unknown distance
 * from the appointment, so no relative duration reaches it, and the date is
 * different for every run, so no typed date reaches it either. The same shape
 * covers chasing a quote before it expires, flagging a warranty before it runs
 * out, and raising the maintenance job before the contract visit is due — every
 * one of which is a date this system already carries and could not wait for.
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
          name: "until a date on the record",
          value: "untilField",
          description:
            "The appointment, the due date, the expiry — different for every run.",
        },
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
    // ── until a date on the record ──────────────────────────────────────────
    {
      displayName: "Which date",
      name: "dateField",
      type: "dateVariable",
      required: true,
      description: "Only dates your trigger actually provides are offered.",
      // This field holds a variable *path*, not a template containing one, so
      // there is nothing here to resolve. Saying so keeps the interpolator off
      // it rather than relying on the value happening never to contain braces.
      noInterpolate: true,
      typeOptions: { variableTypes: ["date", "datetime"] },
      displayOptions: { show: { mode: ["untilField"] } },
    },
    {
      displayName: "Wait until",
      name: "offsetDirection",
      type: "options",
      required: true,
      default: "before",
      options: [
        { name: "before that date", value: "before" },
        { name: "on that date", value: "on" },
        { name: "after that date", value: "after" },
      ],
      displayOptions: { show: { mode: ["untilField"] } },
    },
    {
      displayName: "How far",
      name: "offset",
      type: "duration",
      required: true,
      default: { amount: 1, unit: "days" },
      typeOptions: { units: ["hours", "days", "weeks"] },
      displayOptions: {
        show: { mode: ["untilField"], offsetDirection: ["before", "after"] },
      },
    },
    {
      // Every anchor is reduced to a **calendar day** in the tenant's timezone
      // and this sets the hour, including for a date that carries its own time.
      // One rule with no branches beats "uses the record's time, except when it
      // hasn't got one" — and it matches how the reminder is actually described:
      // *the morning before*, not *23 hours and 12 minutes before*. An offset
      // measured from a real timestamp is what `for` is for.
      displayName: "At",
      name: "atTime",
      type: "time",
      default: "09:00",
      description:
        "The time of day to pick back up, in your timezone. Counted from here, so 2 hours before 09:00 is 07:00.",
      displayOptions: { show: { mode: ["untilField"] } },
    },
    {
      // The load-bearing choice, and the reason this mode does not simply
      // inherit `until`'s behaviour.
      //
      // "The day before the appointment" is computed per run, so it is routinely
      // already in the past — a same-day emergency call books an appointment two
      // hours out, and "the day before" was yesterday. Carrying on regardless
      // sends "your appointment is tomorrow" to someone whose engineer is on the
      // way. So the default is to stop, and continuing anyway is a decision the
      // author makes on screen rather than a rule hidden in an executor.
      displayName: "If that moment has already passed",
      name: "ifPassed",
      type: "options",
      required: true,
      default: "skip",
      options: [
        {
          name: "stop here — it is too late to be useful",
          value: "skip",
          description: "Right for reminders. The run ends and says why.",
        },
        {
          name: "carry on straight away",
          value: "resume",
          description: "Right for chasing — late is better than never.",
        },
      ],
      displayOptions: { show: { mode: ["untilField"] } },
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
