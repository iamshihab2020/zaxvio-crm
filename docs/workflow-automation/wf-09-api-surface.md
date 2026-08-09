# WF-09 — API Surface

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-03-data-model]] | [[wf-08-builder-frontend]] | [[wf-10-security]] | [[api-rules]] | [[API_DOCUMENTATION_1|API Docs]] | [[decisions|ADR-002]]

**26 endpoints** across four route files plus one public receiver. Every one is a
`FastifyPluginAsyncZod` handler with a Zod schema in `apps/api/src/lib/schemas/workflows.ts`
([[api-rules|§2]]) — no exceptions, no `as` casts on request data ([[security-rules|§2, §12]]).

---

## 9.1 Route files

| Prefix | File | Endpoints | Auth |
|---|---|---|---|
| `/workflows` | `routes/workflows/index.ts` | 11 | `requireTenant` |
| `/workflows` | `routes/workflows/runs.ts` | 8 | `requireTenant` |
| `/workflows` | `routes/workflows/testing.ts` | 3 | `requireTenant` |
| `/workflows` | `routes/workflows/builder-context.ts` | 1 | `requireTenant` |
| `/webhooks/w` | `routes/webhooks/workflow.ts` | 2 | **public** — per-workflow auth |
| `/admin/workflows` | `routes/admin/workflows.ts` | 1 | `requireAdminTier(["super_admin"])` |

Sibling plugins under one prefix, the pattern `routes/jobs/costing.ts` established — new surface area
goes in new files rather than growing a 2,500-line index.

---

## 9.2 CRUD & lifecycle — `routes/workflows/index.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/workflows` | List. `?folderId&isActive&search&page&limit&showArchived` |
| POST | `/workflows` | Create — blank, or `?fromTemplate=<key>`, or `?duplicateOf=<id>` |
| GET | `/workflows/:id` | One automation **with its draft graph** and version summary |
| PATCH | `/workflows/:id` | Metadata only — name, description, folder, timezone mode |
| **PUT** | **`/workflows/:id/graph`** | **The builder's save.** Whole draft graph + `expectedUpdatedAt` |
| POST | `/workflows/:id/publish` | Snapshot the draft into a new version, point `active_version_id` at it |
| GET | `/workflows/:id/versions` | Version history |
| POST | `/workflows/:id/versions/:versionId/restore` | Copy an old version back into the draft |
| POST | `/workflows/:id/activate` · `/deactivate` | `is_active` — activate 409s with no published version |
| DELETE | `/workflows/:id` | Archive (soft). Running executions are left to finish; waiting ones are cancelled |
| POST | `/workflows/bulk-archive` · `/bulk-restore` · `/bulk-delete` | The repo's bulk contract: `{succeeded, failed, errors}` |

### `PUT /:id/graph` — the save contract

```jsonc
// request
{
  "expectedUpdatedAt": "2026-08-07T18:22:41.113Z",
  "nodes": [
    { "id": "…uuid (client-minted)", "nodeType": "trigger.job.completed",
      "nodeConfig": { "label": "Job Completed", "parameters": { … } },
      "positionX": 120, "positionY": 80 }
  ],
  "edges": [
    { "id": "…uuid", "sourceNodeId": "…", "sourceHandle": "main", "targetNodeId": "…" }
  ]
}
// 200 → { data: { updatedAt, nodeCount, edgeCount, validation: { errors: [], warnings: [] } } }
// 409 → { message: "This automation was changed by someone else.", data: { updatedAt } }
```

The server diffs by id and applies in one transaction ([[wf-03-data-model|§3.10]]). The 409 is
[[10-audit-findings|B-10]] closed at the contract, on day one, rather than after two people have
clobbered each other.

Validation runs on save and returns errors **without blocking** — a half-drawn automation must be
saveable. Publish is where errors block.

### `POST /:id/publish`

```jsonc
// request  { "note": "chase at 7 days instead of 3" }
// 200      { data: { versionId, version: 4, publishedAt } }
// 422      { message: "…", data: { errors: [{ nodeId, field, message }] } }
```

---

## 9.3 Runs & observability — `routes/workflows/runs.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/workflows/runs` | Org-wide feed. `?status&workflowId&from&to&subjectType&subjectId&page` |
| GET | `/workflows/:id/runs` | This automation's runs |
| GET | `/workflows/runs/:runId` | One run + every node log, ordered by sequence |
| GET | `/workflows/runs/:runId/nodes/:nodeId` | Resolved parameters, output, and the context snapshot where stored |
| POST | `/workflows/:id/runs` | **Manual run** for a subject. Accepts `Idempotency-Key` |
| POST | `/workflows/:id/runs/bulk` | Run for many subjects. Counts against the tenant's daily quota up front |
| POST | `/workflows/runs/:runId/cancel` | Cancel one |
| POST | `/workflows/:id/runs/cancel-all` | Cancel every running/waiting run of this automation |
| POST | `/workflows/runs/:runId/replay-from/:nodeId` | Fork a new run seeded with the stored context, linked by `parent_execution_id` |
| GET | `/workflows/:id/enrollments` | Who is in this automation right now, and at which node |
| GET | `/workflows/:id/evaluations` | The last 50 trigger evaluations — matched **and skipped, with the reason** ([[wf-06-triggers-and-events\|§6.8]]) |

`replay-from` is the debugging superpower ([[10-audit-findings|A-10]]): it answers *"why did this
customer get the wrong email?"* by re-running the failing node against the real stored data, without
re-triggering the whole automation or touching anything upstream of the failure. Build it — it pays
for itself the first month.

`/evaluations` is the answer to the single most common support question this feature will generate.

---

## 9.4 Testing — `routes/workflows/testing.ts`

| Method | Path | Purpose |
|---|---|---|
| POST | `/workflows/nodes/test` | Execute **one node** with a supplied config and a chosen sample subject; returns its output without creating a run |
| POST | `/workflows/:id/test` | Test the whole draft graph against a chosen real record, in **dry-run** mode |
| GET | `/workflows/:id/sample-context` | A realistic context for this automation's trigger, from the tenant's own most recent matching record |

**Dry-run is a first-class mode**, not a flag someone remembers to check. In dry run:

- every `sideEffect: 'at-most-once'` node **describes** what it would do instead of doing it
  (*"Would email dana@example.com — subject: Your Maintenance visit on Aug 8"*)
- domain services are called with `dryRun: true` and return the computed result without writing
- delays resolve instantly and report the real `resume_at` they would have set
- nothing is persisted except the node logs, which are marked `source: 'test'`

`POST /nodes/test` is the tightest possible feedback loop while authoring — the difference between a
30-second and a 10-minute iteration ([[07-frontend-builder|§7.4]]).

---

## 9.5 `GET /workflows/:id/builder-context` — one batch read

The builder needs the graph plus every reference list its pickers bind to. Five parallel client
fetches is what the source guide recommends; five sequential server actions is what
[[decisions|ADR-002]] would produce. **One batch endpoint is better than both**
([[wf-01-gap-analysis|§6]]), and the repo already set the precedent with `GET /customers/:id/summary`.

```jsonc
{
  "data": {
    "workflow": { … },
    "graph": { "nodes": [ … ], "edges": [ … ] },
    "activeVersion": { "id": "…", "version": 3, "publishedAt": "…" },
    "isDirty": true,
    "reference": {
      "pipelines":  [{ "id", "name", "isDefault",
                       "stages": [{ "id", "label", "lifecycle", "color", "sortOrder" }] }],
      "tags":       [{ "id", "name", "color" }],
      "members":    [{ "id", "name", "email", "role" }],
      "catalogItems":[{ "id", "name", "unitPrice", "itemType" }],
      "checklists": [{ "id", "name", "itemCount" }],
      "serviceTypes": [ … ],
      "workflows":  [{ "id", "name" }],   // for workflow.run
      "tenant": { "timezone", "businessName", "reviewRequestEnabled",
                  "quoteOnlineAcceptanceEnabled", "quietHours" }
    },
    "quotas": { "dailyExecutionsUsed": 12, "dailyExecutionsLimit": 2000,
                "dailyEmailsUsed": 3,      "dailyEmailsLimit": 200 }
  }
}
```

Second-order benefit: this is the **only** source a picker draws from, so every option a tenant can
see is one they own — which is half of [[wf-10-security|the ownership problem]] solved by
construction.

---

## 9.6 Public webhook receiver — `routes/webhooks/workflow.ts`

| Method | Path | Notes |
|---|---|---|
| POST/GET/PUT | `/webhooks/w/:workflowId/:path` | Per-workflow auth, route-level rate limit, `bodyLimitFor()` |
| GET | `/webhooks/w/:workflowId/:path/test-payload` | A sample payload for this trigger's field mapping. **Requires auth** |

On the public allowlist, so it carries its own auth ([[wf-06-triggers-and-events|§6.6]]) and its own
rate limit ([[security-rules|§4]]). Never returns whether a workflow exists — an unknown workflow, an
inactive one and a wrong path all return the same 404.

---

## 9.7 Admin — `routes/admin/workflows.ts`

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/workflows/health` | Queue depth, oldest pending age, dead-letter count, executions in the last 24h by status, tenants over quota |

Super-admin only. This is the operator's view of whether the engine is alive; without it the first
sign of a stuck queue is a customer complaint.

---

## 9.8 Multi-tenancy on every route

Zaxvio's model, not the source system's ([[wf-01-gap-analysis|§1]]):

```ts
// ✅ tenant comes from the verified session, server-side
fastify.patch("/:id", {
  preHandler: [requireTenant],
  schema: { params: idParam, body: updateWorkflowBody },
}, async (request, reply) => {
  const tenantId = request.authUser.tenantId!;
  // every query: and(eq(workflows.tenantId, tenantId), eq(workflows.id, id))
});

// ❌ never
request.query.organizationId        // the source system's pattern — do NOT introduce it
request.headers["x-tenant-id"]
```

Do **not** port `resolveOrganizationId(request)`. The source system reads the org from a query param
because it supports users belonging to several orgs with several browser tabs open. Zaxvio resolves
one tenant server-side from the session's `activeOrganizationId`
([[security-rules|§3]]) and adding a client-controlled tenant selector would be a downgrade.

**Mutating routes that change what runs** — publish, activate, deactivate, delete, bulk — additionally
require `requireOrgRole(["owner", "admin"])`. An automation can email every customer a business has;
that is not a member-level capability. Reading, drafting and testing are open to any member.

---

## 9.9 Frontend access

Following [[decisions|ADR-002]] exactly.

```
component → hooks/queries/use-workflows.ts → actions/workflows.ts → lib/api-fetch → Fastify
```

`actions/workflows.ts` is written on `api-fetch` from the first line — it is the seam ARC-02 built
and there is no reason a new file should start with a hand-rolled `fetch`.

### Query keys — added to `lib/query-keys.ts`

```ts
workflows: {
  all: ["workflows"] as const,
  list: (p: Record<string, unknown>) => ["workflows", "list", p] as const,
  detail: (id: string) => ["workflows", "detail", id] as const,
  builderContext: (id: string) => ["workflows", "detail", id, "builderContext"] as const,
  versions: (id: string) => ["workflows", "detail", id, "versions"] as const,
  runs: (id: string, p?: Record<string, unknown>) =>
    ["workflows", "detail", id, "runs", p ?? {}] as const,
  run: (runId: string) => ["workflows", "runs", runId] as const,
  enrollments: (id: string) => ["workflows", "detail", id, "enrollments"] as const,
  evaluations: (id: string) => ["workflows", "detail", id, "evaluations"] as const,
  feed: (p: Record<string, unknown>) => ["workflows", "feed", p] as const,
}
```

Nested under the detail key so one invalidation refreshes the whole page — the pattern
`queryKeys.jobs.costs` uses for the same reason.

### Mutation rules ([[strict-rules|§11]])

- **Never** pass a server action directly as `mutationFn`. Always
  `mutationFn: (data) => saveWorkflowGraph(data)` — TanStack's state management alters the object
  prototype and breaks React's server-action serialisation.
- All mutations go through hooks in `hooks/queries/use-workflows.ts`; hooks own the toast and the
  invalidation, pages provide per-call `onSuccess` for UI state.
- Bulk responses read `res.message` at the top level.
- Import from `@/hooks/queries`, the barrel.

**One deliberate exception to ADR-002:** the builder's graph save is high-frequency and needs the
`updatedAt` from the response to keep its optimistic-concurrency token current. It still goes through
a server action; it simply reads `res.data.updatedAt` rather than discarding it.

---

## 9.10 Response conventions

Unchanged from the rest of the API, because `lib/api-fetch.ts` depends on them:

| Shape | Used by |
|---|---|
| `{ data: T }` | single reads and writes |
| `{ data: T[], pagination: {…} }` | lists |
| `{ succeeded, failed, errors: [{id, message}] }` | bulk |
| `{ message: string }` on a non-2xx | every error |

Error messages **name the cause and the next action** ([[09-security-and-multitenancy|§9.8]]):

```
❌  { message: "Workflow validation failed" }
✅  { message: "Publish blocked: the \"Send Email\" step has no subject line.",
      data: { errors: [{ nodeId: "…", field: "subject", message: "Subject is required" }] } }
```

The error carries the node id so the builder can select it. A list of errors you cannot navigate to
is barely better than no list.

---

## 9.11 Rate limits

| Route | Limit | Why |
|---|---|---|
| `POST /webhooks/w/*` | 60/min per workflow | public surface ([[security-rules\|§4]]) |
| `POST /workflows/:id/runs` | 30/min | manual runs |
| `POST /workflows/:id/runs/bulk` | 5/min | plus the daily quota check |
| `POST /workflows/nodes/test` | 60/min | a real send in dry-run costs nothing, but the authoring loop is fast |
| `PUT /workflows/:id/graph` | 120/min | autosave |
| everything else | the global 100/min | |

Set as route-level `config.rateLimit`, using the server's existing key generator, which already
forwards the real client IP when the Next server proves itself with `INTERNAL_PROXY_SECRET`.

---

## 9.12 Documentation obligation

[[strict-rules|§8]] requires, **in the same commit** as any endpoint change:

- `docs/claude/api-docs/API_DOCUMENTATION_*.md` — method, path, auth, request and response shapes
- `docs/project_docs/REPO_MAP.md` — file entries
- `apps/web/src/lib/chatbot/knowledge-base.ts` — FAQ entries in industry-agnostic language
- `docs/claude/todo.md` — checked off
- `docs/claude/lessons/<topic>.md` — anything non-obvious

The quotes audit found **7 undocumented endpoints and 3 wrong ones** on a domain that had shipped
months earlier. 26 endpoints written up as they land is cheaper than 26 written up afterwards, and
far cheaper than 26 that are wrong.
