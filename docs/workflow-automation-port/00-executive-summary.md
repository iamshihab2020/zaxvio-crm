# 00 — Executive Summary

## What SiloCRM's workflow automation actually is

**It is an n8n-style workflow builder, built into a multi-tenant CRM.** That is the most accurate
one-line description, and the most useful one for anyone porting it.

The borrowing from n8n is direct, not incidental. `NodeDefinition` in
`packages/workflow-nodes/src/node-definition.ts` mirrors n8n's `INodeTypeDescription` field for
field — `displayName`, `name`, `icon`, `properties[]`, `displayOptions.show/hide`, `typeOptions`,
`inputs`/`outputs`. Node types read as n8n's do: `IF`, `Switch`, `Merge`, `Loop`, `Wait`, `Code`,
`HTTP Request`, `Webhook`, `Schedule Trigger`. The editor is the same shape: palette → infinite
canvas → config drawer whose form is *generated from the node's JSON*.

What SiloCRM changed, and why it matters:

| | n8n | SiloCRM |
|---|---|---|
| Unit of work | an array of JSON items flowing node-to-node | **one CRM record** (contact/lead) as the subject, plus a shared execution context |
| Waits | in-process, short-horizon | **durable** — serialized to Postgres, resumed by a cron, survives deploys for weeks |
| Node library | 400+ generic third-party connectors | 156 nodes, mostly **CRM-native** (pipelines, stages, tags, custom fields, calls, appointments) |
| Field types | generic | 12 of 26 are **pickers bound to the tenant's own data** |
| Tenancy | self-hosted, single-tenant | multi-tenant SaaS: RLS, per-org scoping, quotas, approval gates |

Positioned against the two products it competes with: it has **GoHighLevel's** CRM-native actions
and contact-centric enrollment, with **n8n's** typed node registry, code blocks, HTTP nodes, and
branching/looping. That combination is the product thesis.

Users drag nodes onto a React Flow canvas, wire them together, and the backend walks the resulting
graph when a CRM event fires.

## The five subsystems

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. NODE REGISTRY  packages/workflow-nodes                           │
│    156 JSON files. One shared catalog read by BOTH the editor UI    │
│    and the backend. Declares config fields, not behaviour.          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│ 2. BUILDER UI  apps/web/src/components/automation                   │
│    React Flow canvas + dynamic config panel rendered from the       │
│    registry + Zustand store + validation + AI copilot.              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ saves graph
┌─────────────────────────────────▼───────────────────────────────────┐
│ 3. PERSISTENCE  workflows / workflow_nodes / workflow_edges         │
│    Normalized graph in Postgres. node_config is a JSON blob.        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│ 4. EVENT PIPELINE                                                   │
│    CRM code → dispatchEvent() → durable outbox table → cron worker  │
│    → trigger matcher (filters + dedup) → executeWorkflow()          │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│ 5. EXECUTION ENGINE  apps/api/src/lib/workflow/engine               │
│    BFS traversal, per-node executors, variable interpolation,       │
│    durable pause/resume for delays, goal-exit listeners, sandbox.   │
└─────────────────────────────────────────────────────────────────────┘
```

## The seven design decisions that define the system

1. **Node definitions are declarative JSON, shared across FE and BE.** A node's *config schema*
   lives in one file; the editor renders a form from it and the backend reads the same file.
   Behaviour lives separately in an executor keyed by node type. This is the single best idea in
   the system and the one most worth copying verbatim.

2. **The graph is normalized, not a JSON blob.** Nodes and edges are rows, so a single node can be
   patched, a single edge deleted, and node-level execution logs can foreign-key to a node. Only
   `node_config` (the parameter bag) is JSON.

3. **Events go through a durable transactional outbox, not an in-process emitter.** Producers call
   `dispatchEvent()` which writes to `roofsilo_event_queue`; a cron worker claims rows with
   `FOR UPDATE SKIP LOCKED` and processes them with exponential-backoff retries. Events survive
   restarts and multi-replica deploys.

4. **Delays are durable pauses, not `setTimeout`.** A delay node throws a `DelayPauseException`;
   the engine serializes the whole execution context into `waiting_context`, sets `resume_at`, and
   a once-a-minute cron resumes it. A 30-day wait survives every deploy in between.

5. **Traversal is BFS with OR-join semantics by default.** Converging branches proceed as soon as
   *any* upstream branch arrives. An explicit `logic.merge` node opts into AND-join (wait for all).
   This is the opposite of most engines' default and is a deliberate choice — see `04`.

6. **Everything is variable-interpolated at execution time.** Every string field in every node
   config goes through `interpolateVariables()`, which resolves `{{contact.email}}`,
   `{{nodeId.output}}`, `{{system.currentDate}}` etc. against the live execution context, with an
   explicit deny-list for `env.*`, `__proto__`, and `constructor`.

7. **Two builder scopes share one engine.** `scope='org'` workflows act on contacts/leads for one
   tenant. `scope='agency'` workflows are super-admin-owned, act *on organizations*, live on a
   sentinel org, and route high-blast-radius actions through an approval gate. The node registry
   marks each node `org` / `agency` / `both`.

## What a port costs

Rough effort estimate for a team building this in a comparable CRM. These are judgment calls, not
measurements.

| Phase | Scope | Est. |
|---|---|---|
| P0 Foundation | Schema, node-definition contract, 10 nodes, linear execution | 3–4 wks |
| P1 Builder | React Flow canvas, dynamic config panel, save/load, validation | 3–4 wks |
| P2 Event pipeline | Outbox table, dispatcher, cron worker, trigger matcher + filters | 2–3 wks |
| P3 Control flow | If/else, switch, delay + durable resume, loop, merge, goto, stop | 3–4 wks |
| P4 Node breadth | 40–60 CRM/comms/integration nodes | 6–10 wks |
| P5 Observability | Execution logs, replay UI, run-from-node, failure notifications | 2–3 wks |
| P6 Hardening | SSRF guard, code sandbox, rate limits, idempotency, RLS | 2–3 wks |
| **Total** | **MVP-to-parity** | **~5–8 months, 2 engineers** |

A usable MVP (P0–P3 + ~15 nodes) is roughly **10–14 weeks**.

## The single most important porting advice

**Do not start with the node catalog.** Start with the *node-definition contract* and the
*execution context contract*. SiloCRM's biggest sources of pain (documented in
[`10-audit-findings.md`](10-audit-findings.md)) all trace back to loosely-typed seams —
`event.data` typed as `unknown`, a 3,146-line `matchesTriggerFilters()` that hand-codes every
filter per event type, and a 1,000-line hand-written variable map that must be kept in sync with a
Zod schema by convention. Nail the contracts first and the catalog becomes mechanical.
