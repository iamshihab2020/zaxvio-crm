# WF-04 — Node Catalog

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-00-decisions]] | [[wf-05-execution-engine]] | [[wf-06-triggers-and-events]] | [[wf-08-builder-frontend]] | [[wf-12-phases]] | [[REPO_MAP_1]]

The node-definition contract, and the full Zaxvio catalog: **28 triggers + 34 actions/logic/data =
62 node types** at full v1, of which **21 are the MVP**.

The contract is [[03-node-catalog|SiloCRM's]] — which is n8n's `INodeTypeDescription`, lightly
renamed — with four deliberate changes marked ➕ below. The catalog itself shares almost nothing with
the source, because the domains barely overlap ([[wf-01-gap-analysis|§2]]).

---

## 4.1 The node definition contract

`packages/workflow-nodes/src/node-definition.ts`

```ts
export interface NodeDefinition {
  /** UNIQUE, IMMUTABLE id — "job.moveStage". Persisted on every saved node.
   *  A rename breaks every stored automation. Enforced by a CI test (§4.3). */
  node: string;
  version: number;

  displayName: string;          // "Move Job Stage"
  description: string;          // shown in the palette and the config panel
  /** One or two sentences the config panel renders above the form.
   *  FE-C7: users open a panel not knowing what the node does. */
  howItWorks?: string;

  icon: string;                 // resolved via a CURATED map — never a wildcard import
  category: NodeCategory;       // trigger | communication | crm | logic | data | integration
  subcategory?: string;

  inputs: NodeInput[];          // usually [{ id: "main" }]
  /** ➕ id and label are SEPARATE. B-06 / D-07: SiloCRM stores the label in
   *  sourceHandle, so renaming "Found" breaks routing on every saved workflow. */
  outputs: NodeOutput[];        // [{ id: "found", label: "Found" }, …]

  properties: NodeProperty[];   // THE CONFIG FORM SCHEMA

  // ── runtime declarations the engine reads ────────────────────────────────
  /** ➕ What this node changes, so the engine knows what to re-read and what
   *  analytics cache to invalidate. FR-E7 / wf-01 §4b. */
  mutates?: SubjectType[];
  /** ➕ Re-run safety. 'at-most-once' makes the engine refuse to re-enter this
   *  node after a crash rather than sending twice. D-22. */
  sideEffect?: "none" | "idempotent" | "at-most-once";
  /** Which events this trigger node listens for. Trigger nodes only. */
  triggerEvents?: WorkflowEventType[];
  /** Subject types this node can operate on. Save-time validation uses it to
   *  tell the user "this action needs a job, and your trigger provides a customer". */
  requiresSubject?: SubjectType[];

  tags?: ("beta" | "new" | "deprecated" | "coming-soon")[];
  /** Hidden from the palette entirely. Dev-only nodes. */
  devOnly?: boolean;
}

export interface NodeProperty {
  displayName: string;
  name: string;                 // the key written into node_config.parameters
  type: NodePropertyType;
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  description?: string;
  hint?: string;

  options?: { name: string; value: string | number; description?: string }[];
  typeOptions?: {
    rows?: number; minValue?: number; maxValue?: number; step?: number;
    keyPlaceholder?: string; valuePlaceholder?: string; addButtonText?: string;
    noticeType?: "info" | "warning" | "error"; noticeMessage?: string;
    /** For dependent pickers: stageSelect reads the sibling pipelineId. FE-C4. */
    dependsOn?: string;
  };
  /** Conditional rendering, straight from n8n. FE-C1. */
  displayOptions?: { show?: Record<string, unknown[]>; hide?: Record<string, unknown[]> };

  // ── ➕ engine-side declarations ───────────────────────────────────────────
  /** Trigger filtering, declared not hand-coded. B-02 / D-09. */
  filter?: { path: string; operator: FilterOperator; source?: "event" | "subject" };
  /** Output encoding for interpolated values, declared with the field rather
   *  than remembered at each call site. §6.4 flags the SiloCRM version. */
  encoding?: "none" | "html" | "url";
  /** Skip {{token}} resolution for this field. D-08. */
  noInterpolate?: boolean;
  /** This value is a foreign id and must be tenant-checked at save AND at
   *  execution time. wf-01 §4 point 2. */
  ownership?: "customer" | "job" | "pipeline" | "stage" | "catalogItem"
            | "checklist" | "equipment" | "contract" | "user" | "tag" | "workflow";
}
```

### Property types — 24, in two waves

| Wave | Types | Notes |
|---|---|---|
| **P5 (11)** | `string`, `text`, `number`, `boolean`, `options`, `multiOptions`, `date`, `time`, `duration`, `keyValue`, `notice` | Covers every logic, data and communication node |
| **P7 (13) — the CRM pickers** | `customerSelect`, `jobSelect`, `pipelineSelect`, `stageSelect`, `catalogItemSelect`, `checklistSelect`, `tagSelect`, `multiTagSelect`, `memberSelect`, `serviceTypeSelect`, `emailTemplateSelect`, `workflowSelect`, `moneyInput` | **These are what make it feel native rather than an embedded Zapier** ([[11-frontend-guidelines\|§11.5]]) |

Two Zaxvio-specific additions worth calling out:

- **`stageSelect` cascades from `pipelineSelect`** via `typeOptions.dependsOn`, and it shows each
  stage's `lifecycle` chip. A tenant can name a stage anything; the automation author needs to see
  that "Awaiting Parts" means *scheduled* and "Done" means *completed*.
- **`moneyInput`** exists so a condition on money is entered and compared in integer cents through
  `services/costing/money.ts`, never as a float. The costing work established that a margin is a
  *difference of two sums*, so float error is doubled.

**Dropped from the source contract:** `optionsFrom` (unnecessary — a TS module imports the constant
directly, [[wf-00-decisions|D-23]]), `scope` ([[wf-00-decisions|D-11]]), `iconLibrary` (one icon set:
`@tabler/icons-react`, already the repo's), and every field type that depended on custom fields,
which Zaxvio does not have.

---

## 4.2 A worked example

`packages/workflow-nodes/src/registry/actions/job-move-stage.ts`

```ts
import type { NodeDefinition } from "../../node-definition.js";

export default {
  node: "job.moveStage",
  version: 1,
  displayName: "Move Job Stage",
  description: "Move the job to a different column on its pipeline.",
  howItWorks:
    "Uses the same rules as dragging the card yourself, so an illegal move " +
    "(for example reopening a completed job) fails instead of forcing it.",
  icon: "IconColumns",
  category: "crm",
  subcategory: "job",

  inputs: [{ id: "main" }],
  outputs: [
    { id: "main", label: "Moved" },
    { id: "rejected", label: "Not allowed" },
  ],

  mutates: ["job"],
  sideEffect: "idempotent",
  requiresSubject: ["job", "quote", "booking"],

  properties: [
    {
      displayName: "Pipeline", name: "pipelineId", type: "pipelineSelect",
      description: "Leave blank to use the job's current pipeline.",
      ownership: "pipeline",
    },
    {
      displayName: "Stage", name: "stageId", type: "stageSelect", required: true,
      typeOptions: { dependsOn: "pipelineId" },
      ownership: "stage",
    },
    {
      displayName: "If the move isn't allowed", name: "onRejected", type: "options",
      default: "branch",
      options: [
        { name: "Take the 'Not allowed' branch", value: "branch" },
        { name: "Stop the automation",           value: "stop" },
      ],
    },
  ],
} satisfies NodeDefinition;
```

The executor is the other half, and it is short because it delegates
([[wf-00-decisions|D-17]]):

```ts
// services/workflow/executors/job.ts
export async function moveStage({ db, ctx, params, subject }: ExecutorInput) {
  const result = await jobsService.moveStage(db, ctx.tenantId, subject.id, {
    stageId: params.stageId as string,
    pipelineId: (params.pipelineId as string) ?? null,
    actorId: null, source: "automation",
    workflowId: ctx.workflowId, executionId: ctx.executionId,
  });
  return result.ok
    ? { handle: "main",     output: { stageId: result.stage.id, stageLabel: result.stage.label } }
    : { handle: "rejected", output: { reason: result.message } };
}
```

Everything that makes a stage move correct — the lifecycle transition table, `completedAt`, the
activity row, the completion email, the notification — already lives behind that call.

---

## 4.3 Registry rules, enforced by tests

| # | Rule | How |
|---|---|---|
| N-1 | Node ids are **immutable** | CI test asserts the committed id set only ever grows (a removed id fails the build) |
| N-2 | Node ids match `^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$` | lint test. [[10-audit-findings\|B-14]]: SiloCRM froze `create_calendar_event` among dotted lowerCamel ids forever |
| N-3 | Every `node` appears exactly once | barrel test |
| N-4 | Every property `name` is unique within its node | test |
| N-5 | Every `default` is a valid value for its `type`/`options` | test |
| N-6 | Every `displayOptions` reference names a real sibling property | test |
| N-7 | Every `filter.path` resolves against a declared variable path | test, cross-checks the variable registry |
| N-8 | Every node id in `active-nodes.ts` has a definition **and** an executor | test — this is what makes the whitelist safe |
| N-9 | The barrel imports every registry file explicitly | test walks the directory and compares. **Enforces "no globs"** ([[11-frontend-guidelines\|FE-P2]]) without using one at runtime |
| N-10 | Every trigger node declares `triggerEvents`; every event type is claimed by ≥1 trigger | test |

N-9 is worth the trouble: the OOM failure it prevents ([[01-architecture|§1.1]]) only shows up in a
production Vercel build, which is the worst place to find it.

### `active-nodes.ts` — the ship gate

A flat whitelist of node ids. `getActiveNodes()` returns
`ACTIVE ∩ !devOnly`. A definition can land with its editor UI before its executor exists, and the
palette will not offer it. Nodes tagged `coming-soon` render **greyed out with a tooltip** rather
than being hidden — [[11-frontend-guidelines|FE-O3]]: it signals a roadmap and prevents "does this
tool even do X?".

That is where `sms.send` lives ([[wf-00-decisions|out of scope]]): visible, greyed, honest.

---

## 4.4 Categories

| id | Name | Colour | v1 count |
|---|---|---|---|
| `trigger` | Triggers | `#10B981` | 28 |
| `communication` | Communication | `#4F46E5` | 4 |
| `crm` | CRM Actions | `#F59E0B` | 21 |
| `logic` | Logic & Flow | `#8B5CF6` | 9 |
| `data` | Data | `#EC4899` | 3 |
| `integration` | Integrations | `#06B6D4` | 2 (Phase 10) |

Node chrome takes its colour from **subcategory → category → node** in that order
([[11-frontend-guidelines|FE-N3]]): per-node colours produce a rainbow, per-category is too coarse to
tell an email from an internal notification.

---

## 4.5 TRIGGERS — 28

**MVP** marks the 8 that ship in Phase 4. Filters listed are the `properties[].filter` declarations
the generic matcher evaluates.

### Customer — 3

| node | Display | Filters |
|---|---|---|
| `trigger.customer.created` | Customer Created | — |
| `trigger.customer.updated` | Customer Updated | `watchFields[]` (only fire when these change) |
| `trigger.customer.tagged` | Customer Tag Changed | action (added/removed), `tagIds[]` |

### Job — 7 (the centre of gravity)

| node | Display | Filters | |
|---|---|---|---|
| `trigger.job.created` | Job Created | pipeline, service type, priority, assignee | **MVP** |
| `trigger.job.stageChanged` | Job Stage Changed | pipeline, from stage, to stage, **to lifecycle** | **MVP** |
| `trigger.job.completed` | Job Completed | pipeline, service type, min total | **MVP** |
| `trigger.job.assigned` | Job Assigned | assignee (specific / anyone / unassigned) | |
| `trigger.job.scheduled` | Job Scheduled or Rescheduled | pipeline, "date moved earlier/later" | |
| `trigger.job.updated` | Job Updated | `watchFields[]` | |
| `trigger.job.marginBelow` | Job Margin Below Threshold | percent, only when cost coverage is complete | |

`trigger.job.marginBelow` has no SiloCRM analogue and is possible only because the costing work
shipped. It fires **only when `CostCoverage` is complete** — the whole feature rests on the rule that
an unknown cost makes a total *incomplete*, not lower, and an automation that fires on a
half-costed job would restate the exact error the Costs tab was built to prevent.

### Booking — 4

| node | Display | Filters | |
|---|---|---|---|
| `trigger.booking.created` | Booking Received | source (portal / manual), service type | **MVP** |
| `trigger.booking.confirmed` | Booking Confirmed | — | |
| `trigger.booking.cancelled` | Booking Cancelled | cancelled by (customer / staff) | |
| `trigger.booking.converted` | Booking Converted to Job | — | |

### Quote — 5

| node | Display | Filters | |
|---|---|---|---|
| `trigger.quote.sent` | Quote Sent | min total | **MVP** |
| `trigger.quote.accepted` | Quote Accepted | min total, accepted via (portal / staff) | **MVP** |
| `trigger.quote.declined` | Quote Declined | — | |
| `trigger.quote.expired` | Quote Expired | — | |
| `trigger.quote.viewed` | Quote Viewed | first view only | ⚠️ needs a view-tracking column on `quotes` — Phase 9 |

### Invoice — 5

| node | Display | Filters | |
|---|---|---|---|
| `trigger.invoice.sent` | Invoice Sent | min total | |
| `trigger.invoice.paid` | Invoice Paid in Full | min total, payment method | **MVP** |
| `trigger.invoice.partiallyPaid` | Partial Payment Received | — | |
| `trigger.invoice.overdue` | Invoice Overdue | **days overdue** (1 / 7 / 14 / 30 / custom) | **MVP** |
| `trigger.invoice.voided` | Invoice Voided | — | |

`trigger.invoice.overdue` is emitted by the schedule worker at a *specific* day count, so "chase at 7
days" and "escalate at 14" are two automations, not one workflow with a delay that drifts.

### Asset & contract — 4

| node | Display | Filters |
|---|---|---|
| `trigger.equipment.created` | Asset Added | equipment type |
| `trigger.equipment.warrantyExpiring` | Asset Warranty Expiring | days before (30/60/90) |
| `trigger.contract.visitDue` | Service Visit Due | days before, service frequency |
| `trigger.contract.expiring` | Service Agreement Expiring | days before |

The last two are, for an HVAC contractor, the highest-value automations in the product and have no
counterpart in the source system.

### Messaging — 1

| node | Display | Filters |
|---|---|---|
| `trigger.message.received` | Customer Replied | channel (email), keyword contains |

### System — 4

| node | Display | | |
|---|---|---|---|
| `trigger.manual` | Manual / Test Trigger | run on demand from the builder or a record | **MVP** |
| `trigger.schedule.daily` | Every Day | at a local time, in the workflow's zone | |
| `trigger.schedule.weekly` | Every Week | day + local time | |
| `trigger.webhook` | Webhook Received | path, method, auth, field mapping | Phase 9 |
| `trigger.webhook.raw` | Webhook (Raw) | whole payload at `{{webhook.body.*}}` | Phase 9 |

`trigger.webhook` + a save-to-CRM action is the highest-leverage pair in the source catalog
([[05-triggers-and-events|§5.4]]) — it turns "receive an arbitrary webhook" into "ingest it" with no
per-integration code. Zaxvio's version writes a customer and, optionally, a booking.

---

## 4.6 COMMUNICATION — 4

| node | Display | Props | Notes |
|---|---|---|---|
| `email.send` | **Send Email** | 8 | **MVP.** Recipient ∈ customer / assignee / a named member / all members. **No free-text address** ([[wf-00-decisions\|D-14]]). Subject + body + optional CTA label/URL, rendered into the E-15 template. Passes through `canEmailCustomer()`. `sideEffect: at-most-once`. |
| `notification.internal` | **Notify the Team** | 5 | **MVP.** Calls `dispatchNotification()`, so channel preferences, dedup and the SSE bell all work already. |
| `conversation.reply` | **Reply in Conversation** | 4 | Writes an outbound message into the existing `conversations` thread, so an automated reply appears where a human reply would. |
| `sms.send` | Send Text Message | — | **coming soon** — greyed in the palette. No provider is wired. |

`email.send`'s body is a textarea with variable pills, not a rich-text editor. The template does the
design ([[wf-01-gap-analysis|§7]]).

---

## 4.7 CRM ACTIONS — 21

Every one calls the domain service. Where a service does not exist yet, the phase that adds the node
extracts it first ([[wf-00-decisions|D-17]]).

### Customer — 5

`customer.update` · `customer.addNote` · `customer.addTag` · `customer.removeTag` ·
`customer.setOptOut`

`customer.addNote` writes `customer_notes` **and** a `customer_activities` row, exactly as the route
does — automations must be visible in the timeline or they read as data corrupting itself.

### Job — 9

| node | Display | Outputs | |
|---|---|---|---|
| `job.create` | Create Job | 1 | **MVP** — pipeline, first stage, service type, schedule, assignee |
| `job.update` | Update Job | 1 | |
| `job.moveStage` | Move Job Stage | 2 — Moved / Not allowed | **MVP** |
| `job.assign` | Assign Job | 1 | member, or round-robin across members |
| `job.schedule` | Schedule Job | 1 | date/time, optionally the **next free slot** via `availability.service.ts` |
| `job.addNote` | Add Job Note | 1 | writes `job_activities` |
| `job.addLineItem` | Add Line Item to Job | 1 | from the catalog or freehand; via `lib/line-items.ts` |
| `job.attachChecklist` | Attach Checklist | 1 | a checklist template |
| `job.find` | Find Job | 2 — Found / Not found | most recent job for the customer, filterable |

`job.schedule`'s "next free slot" mode is a genuine differentiator — the availability resolver
already answers "is the business open and is that slot free" across bookings, jobs and calendar
events.

### Quote — 3 · Invoice — 3 · Booking — 3 · Asset — 2

| node | Display | Notes |
|---|---|---|
| `quote.create` | Create Quote | from catalog items or from a job's line items |
| `quote.send` | Send Quote | via `services/quotes/` — mints the token and PDF; a quote cannot be "sent" any other way ([[quotes\|QUO-01]]) |
| `quote.convertToJob` | Convert Quote to Job | via `lib/quote-to-job.ts`, which resolves the stage properly |
| `invoice.createFromJob` | Create Invoice from Job | **MVP** — sets `dueDate` from tenant terms ([[invoices\|INV-08]]) |
| `invoice.send` | Send Invoice | |
| `invoice.remind` | Send Payment Reminder | reuses `sendOverdueReminder()`, which claims the row so a double-fire sends once |
| `booking.confirm` / `booking.cancel` / `booking.convertToJob` | | transitions go through the booking status table |
| `equipment.update` | Update Asset | |
| `calendar.createEvent` | Create Calendar Event | |

---

## 4.8 LOGIC & FLOW — 9

| node | Display | Outputs | Behaviour | |
|---|---|---|---|---|
| `condition.if` | **If / Otherwise** | 1 per branch | IF · ELSE IF · ELSE, each an AND/OR group of conditions | **MVP** |
| `logic.switch` | Switch | N + fallback | route by one field's value | |
| `split.branch` | Do Several Things | N | unconditional fan-out | |
| `logic.merge` | Wait for All Branches | 1 | **AND-join** — the only way to get one | |
| `delay.wait` | **Wait** | 1 | relative duration · until a date/time · until the next business hour | **MVP** |
| `logic.stop` | Stop | 0 | end as success / failed / cancelled | **MVP** |
| `logic.goto` | Go To | 0 | jump; `maxLoops` default 5. Clears the queue — the editor warns | |
| `logic.loop` | For Each | 2 — Each / Done | iterate a list; `MAX 500`; **a `delay.wait` inside is rejected at save** ([[wf-00-decisions\|D-21]]) | |
| `goal.event` | **Goal — Stop When…** | **0** | registers a goal listener; the run ends when the event fires ([[wf-00-decisions\|D-04]]) | |
| `workflow.run` | Run Another Automation | 1 | sub-automation, depth ≤ 3, with variable mapping | |

### `condition.if` operators

One closed set, shared by conditions, trigger filters and goal filters:

```
equals · notEquals · contains · notContains · startsWith · endsWith
greaterThan · greaterThanOrEqual · lessThan · lessThanOrEqual · between
isEmpty · isNotEmpty · isTrue · isFalse
inList · notInList
dateBefore · dateAfter · dateWithinNext · dateWithinLast · isToday
```

Money comparisons route through `services/costing/money.ts` (integer cents). Date comparisons resolve
in the **workflow's** timezone.

### `delay.wait` modes

| Mode | Config | Resolution |
|---|---|---|
| Relative | N minutes / hours / days | `resume_at = now + N` |
| Until a date | a variable path or a literal, plus an offset (`3 days before {{job.scheduledDate}}`) | resolved in the workflow's zone |
| Business hours | "wait 2 business hours" or "resume at the next business hour" | `services/availability.service.ts` + tenant schedule |
| Quiet-hours safe | any of the above, `+ don't deliver before 08:00` | pushes `resume_at` forward |

A delay whose computed `resume_at` is in the past resumes on the next tick rather than being skipped.

---

## 4.9 DATA — 3, and INTEGRATION — 2

| node | Display | Notes |
|---|---|---|
| `data.setFields` | Set Values | define named values for downstream nodes; the escape hatch that replaces a code node |
| `data.math` | Calculate | arithmetic on numbers/money, integer-cents for money |
| `data.format` | Format Text | join, upper/lower, truncate, format a date in the tenant's zone |
| `http.request` | HTTP Request | **Phase 10**, only with the complete SSRF validator ([[wf-00-decisions\|D-13]]) |
| `webhook.send` | Send Webhook | **Phase 10**, same validator |

---

## 4.10 MVP node set — 21, shipping across Phases 3–6

**Triggers (8):** `trigger.manual`, `job.created`, `job.stageChanged`, `job.completed`,
`booking.created`, `quote.sent`, `quote.accepted`, `invoice.paid`, `invoice.overdue`

**Actions (7):** `email.send`, `notification.internal`, `job.create`, `job.moveStage`,
`customer.addNote`, `customer.addTag`, `invoice.createFromJob`

**Logic (6):** `condition.if`, `delay.wait`, `logic.stop`, `split.branch`, `logic.merge`,
`goal.event`

Those 21 express **all ten launch templates** ([[wf-00-decisions|D-27]]). That is the test of an MVP
node set, and it is the reason to choose the templates before choosing the nodes.

---

## 4.11 Cost of a node, and what makes it cheap

Target: **≤ 1 engineer-day per node** ([[PRD|G4]]).

| Work | Files |
|---|---|
| The definition | 1 new TS module + 1 barrel line + 1 whitelist line |
| The executor | 1 function in the matching `executors/*.ts` |
| The domain call | **0 if the service exists** — this is the whole point of [[wf-00-decisions\|D-17]] |
| The form | **0** — generated from `properties[]` |
| Tests | 1 executor unit test + 1 registry assertion (automatic) |
| Docs | api-docs only if a new endpoint appears; the palette is self-documenting |

The number that decides whether this holds is "does the domain service exist". Today: invoices ✅,
quotes ✅, availability ✅, job stages ✅, costing ✅, notifications ✅, email ✅; **jobs ❌ and
customers ❌**. That is the dependency, and it is the argument for doing
[[architecture|ARC-05]] as part of Phase 7 rather than around it.
