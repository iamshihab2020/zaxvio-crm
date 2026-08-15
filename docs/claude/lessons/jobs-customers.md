# Lessons: Jobs, Customers & Entity Flows

> Related: [[API_DOCUMENTATION_2|API Docs: Jobs]] | [[booking-availability]] | [[api-rules]] | [[lessons]]

## Job API Audit (2026-04-12)

- **Zod enum schemas MUST match DB pgEnum exactly** — `jobPriorityEnum` is `["standard", "urgent", "emergency"]` but the Zod schema had `["low", "standard", "high", "urgent"]`. This would crash at runtime on insert. Always cross-reference `packages/database/src/schema/enums.ts` when defining Zod enums in schema files.
- **Supabase Storage `storagePath` is the path WITHIN the bucket, not including the bucket** — The delete code was splitting the storagePath on `/` and using `pathParts[0]` as the bucket name. But `storagePath` is `{tenantId}/jobs/{id}/file`, so `pathParts[0]` is the tenant UUID. The correct call is `supabase.storage.from("job-attachments").remove([storagePath])` — pass the full storagePath directly to the bucket you know.
- **Bulk endpoints must mirror single-endpoint safety checks** — `POST /jobs/bulk-status-update` skipped the checklist completion gate, didn't set `completedAt`, and logged no activities. Every bulk endpoint should replicate the same business rules as its single-entity counterpart.
- **Defense-in-depth: always include tenantId in WHERE clauses** — Even after a tenant-scoped existence check, the actual DELETE/UPDATE should still include `tenantId`. Re-fetch queries after create/update should also include `tenantId`. This protects against TOCTOU race conditions.
- **`addLineItemBody` had `z.string().optional()` for numeric fields** — The schema accepted any string for `quantity` and `unitPrice`. Changed to `z.coerce.number()` to validate at the schema level. The route handler must then `String()` the value before passing to Drizzle (DB expects string for `numeric` columns).
- **State machine for status transitions prevents invalid job lifecycle** — Without a transition map, completed jobs could be moved back to scheduled, cancelled jobs could be marked completed with `completedAt` set. The fix: a `VALID_TRANSITIONS` map checked in both single and bulk status endpoints.
- **Archived jobs need both API guards AND frontend UI** — The API `bulkArchiveJobs`/`bulkRestoreJobs` actions existed but the frontend had zero archive UI for jobs (no tabs, no row actions, no disabled editing). Dead server actions without UI = invisible feature.

## Customer-to-Job Flow (2026-04-13)

- **`onDelete: "cascade"` on FK is a silent data destroyer** — `jobs.customerId` had `onDelete: "cascade"`. Deleting a customer silently hard-deleted all their jobs, invoices, and quotes with no warning to the user. Fix: add a pre-delete guard that counts related entities and returns 400 if any exist. The cascade FK remains in DB schema but is never reached in normal operation.
  - **Correction (2026-07-27, CUST-01):** "never reached in normal operation" was wrong for fifteen weeks. The guard counted jobs with `isNull(jobs.archivedAt)`, so archiving a job removed it from the guard's view but *not* from the cascade — deleting the customer destroyed it, and the UI reported success. Archiving is presented as the safe alternative to deleting, so this was reachable by following the product's own advice. **When a guard protects a cascade, the guard's WHERE clause must be a superset of the cascade's.** Any filter you add to the guard is a hole. Verified by rollback-tested probe; the same hole existed in `bulk-delete`.
- **Bulk delete guards need per-customer entity checks** — The simple filter-then-execute bulk pattern (check existence → delete) must be extended to also check for related entities per customer. Use parallel `GROUP BY customerId` count queries, then partition into deletable vs blocked sets.
- **Drizzle transactions are compatible with helpers that accept `ReturnType<typeof getDb>`** — `attachChecklistToJob(db, ...)` accepts the Drizzle client type. Drizzle transaction callbacks pass a `tx` object of the same type, so passing `tx` in place of `db` is type-safe and wraps checklist creation in the same transaction.
- **`SELECT FOR UPDATE` inside Drizzle transactions** — Use `.for("update")` on the select query inside `db.transaction()` to acquire a row lock. This prevents concurrent booking conversions from both passing the "already converted" check simultaneously. Drizzle 0.45+ supports `.for("update")`.
- **Catch transaction errors by message string for clean HTTP responses** — When a transaction throws a sentinel error like `throw new Error("ALREADY_CONVERTED")`, catch it outside the transaction and map to the correct HTTP status code. This keeps the transaction body clean (just business logic) and the error handling at the route level.
- **Case-insensitive email match in SQL** — `eq(customers.email, email)` is case-sensitive in Postgres. Use `eq(sql\`lower(${customers.email})\`, email.toLowerCase())` for case-insensitive matching without adding a functional index (acceptable for low-frequency convert calls).
- **Lazy-fetch in customer picker** — The first `useEffect` was running `fetchCustomers("")` on every mount (every time the parent re-renders). Adding a `if (!popoverOpen) return` guard ensures the API call only fires when the user actually opens the picker, not on every page render that mounts the component.

## Jobs Page & Dual-View Audit (2026-04-13)

- **Two independent data sources = two places every mutation must refresh** — The jobs page keeps `jobs` (kanban, from `fetchJobs`) and `tableJobs` (table, from `fetchJobsForTable`) separate for performance. Every mutation handler (`handleSave`, `handleDelete`, `handleStatusChange`, `handleJobUpdate`) must call both. Pattern: create a `refreshBothViews` helper that calls `Promise.all([fetchJobs(), fetchJobsForTable()])` in table view and just `fetchJobs()` in board view.
- **Pipeline switch triggers a redundant second fetch via debounced search effect** — When `selectedPipelineId` changes, two effects fire: the pipeline effect (which fetches) and the debounced search effect (which also fires because `fetchJobs` recreates due to the new pipelineId in its closure). Fix: use a `pipelineChangingRef = useRef(false)`, set it to `true` in the pipeline effect before fetching, then at the top of the debounced search effect check `if (pipelineChangingRef.current) { pipelineChangingRef.current = false; return; }`.
- **Kanban drag snapshot must be captured BEFORE any optimistic updates** — Capturing `snapshotRef.current = [...localJobs]` in `handleDragStart` gives a clean pre-drag state. Capturing it in `handleDragEnd` (after `handleDragOver` has already mutated `localJobs`) means the "revert snapshot" already reflects the optimistic column move, making revert a no-op.
- **`useState` initialized from localStorage causes SSR hydration mismatch** — `useState(localStorage.getItem("key") ?? "default")` throws on the server. Safe pattern: initialize with the SSR-safe default, then hydrate from localStorage in a `useEffect` that runs after mount.
- **Void invoices must not block re-invoicing** — The `from-job` duplicate check was `WHERE jobId = ?` with no status filter. A voided invoice blocked creating a replacement. Always filter `WHERE status != 'void'` in duplicate-invoice guards. Return the existing invoice number and ID in the error for frontend deep-linking.
- **`window.confirm` is appropriate for low-stakes inline deletes** — For destructive actions without their own detail view (line item delete), `window.confirm` is simpler than a full dialog and acceptable. Reserve `DeleteConfirmDialog` for entity-level deletes with more consequences.

## Customers Page Audit + Remediation (2026-07-27)

See [[customers|the report]] for the full 35 findings.

- **Audit the *pattern*, not the page. Every fix should end with a repo-wide grep.** Seven of the eight remediation patterns from the `/dashboard`, `/reports` and bookings audits had never reached `/customers`: uniform `archived_at` filtering, "an error must not render as empty", tenant-timezone plumbing, the TanStack Query migration, `boundedText()`, LIKE escaping, `entity-links.ts`. The audits kept rediscovering the same bugs because fixes landed on the page under audit rather than on the codebase. `CUST-03` is the proof: it was never a customers bug — **22 bulk endpoints across 7 domains** had it, and nobody had looked.
- **A contract documented in the rules but implemented on only one side is worse than no contract.** [[strict-rules]] §11 said "bulk action responses use `res.message`". Every frontend hook faithfully read `res.message`; **no endpoint has ever returned it**, so `res.message ?? "Customers deleted"` always took the fallback and `failed`/`errors` were discarded. A bulk delete where 3 of 5 were refused rendered as unqualified success. Fixed frontend-side (`lib/bulk-toast.ts`) precisely because that covers all 22 endpoints at once — when a contract is broken on one side across N call sites, fix the side with one implementation, not N.
- **`z.coerce.boolean()` cannot express `false`.** `Boolean("false") === true`, so `?showArchived=false` returned *archived only*. It sat latent in the shared `paginationQuery` — every list endpoint — because the one caller happened to omit the param rather than send `false`. Use `z.enum(["true","false"]).transform(v => v === "true")`. In Zod v4 `.default()` takes the **output** type, so it is `.default(false)`, not `.default("false")`.
- **Normalise on the way in, at the schema, or two UIs will store two formats.** The create dialog stripped the phone to digits; the inline header editor was seeded with the *formatted* value and saved that verbatim. One column, two representations, and a search that matches the raw column could never match both. Worse, the input formatter did `digits.slice(6, 10)` — it **truncated at ten digits**, so `+44 20 7946 0958` was stored as `4420794609`. Format for display, never for storage; put the normalisation in the Zod schema so no caller can bypass it.
- **`POST` doing `x || null` while `PATCH` does `updates[f] = body[f]` means "empty" has two spellings in one column.** That is why the stats query needed `AND email != ''` — a read-side workaround for a write-side bug. Fix the write and the special-casing disappears. (`withAddress` never got the workaround, so it counted customers whose address was `''`.)
- **Aggregates belong in SQL, and half-migrating is worse than not starting.** The customer overview fetched `limit: 20` invoices and reduced them in the browser, so "Outstanding" was the sum of whichever invoices fell on page one. The *same function* got jobs right (`pagination.total`) and assets/agreements wrong (`data.length` against `limit: 100`) — three counting strategies in one `fetchData`. Replaced with `GET /customers/:id/summary`: one round trip instead of five, exact by construction.
- **A feature with no way to reach it is not a feature.** Tags had a table, three endpoints, colour assignment and create-on-type — and no filter, no column, no `tagId` on the list query. You could apply a tag and then only ever see it again by opening that one customer. Same shape elsewhere on the page: `sortBy` supported on both sides of the wire with no UI, a `customers.notes` column no component read, a hover-prefetch writing to a cache key whose only reader was never called, and an SSR fetch passed as props the client destructured and ignored. **When you build half a feature, the other half doesn't wait for you — it rots.**
- **`useEffect` + `setState` per tab is how a detail page ends up with no error states.** Nine of ten tabs did `if (res.data) setX(res.data)` with no `else`, so every failure rendered as the empty state — "No outstanding invoices" after a 500 is a claim about the customer's account. This is [[reports-page|REP-01]] again. `LoadErrorState` and `WidgetErrorBoundary` already existed in `components/reusable/`; they just hadn't been carried over.
- **Row-click navigation with no `<Link>` makes a page unreachable by keyboard.** `<TableRow onClick={...}>` with no `tabIndex`, `role` or key handler was the *only* route to `/customers/[id]` — the action menu offered Edit and Delete but not View. Wrap the identifying cell in a real `<Link>` and keep the row click as an enhancement.
- **Deletion cannot be recorded in a table that cascades from the thing being deleted.** `customer_activities.customer_id` is `ON DELETE CASCADE`, so a `customer.deleted` row would be destroyed by the very operation it documents. Archive/restore/tag/note events are logged; deletion needs a tenant-scoped audit log, which is why it is still absent. Say so in the docs rather than leaving the gap looking like an oversight.
- **Sub-resource handlers in one file drift.** `POST /customers/:id/notes` inserted straight from the path param while the sibling tags and photos handlers both verified customer ownership first — so a note and an activity row could be written against another tenant's customer. Not a read leak (their queries filter by their own `tenantId`), but a real integrity gap. When several handlers share a path prefix, the ownership check belongs in one place.

## Jobs Audit + Remediation, Phase 1 (2026-07-29)

See [[jobs|the report]] for the full 38 findings + 3 more found while fixing them.

- **When one column means two things, every rule you write about it is half-wrong.** `jobs.status` was both the four-value lifecycle the product reasons about (transitions, `completedAt`, the completion email, every report) and the free-text name of the Kanban column a job sits in. The DB was widened to `text` so tenants could create custom stages; the API schemas stayed as the four-value enum. Both halves are individually defensible and together they produced **four criticals** — custom stages unreachable, within-column drags never persisting, the completion gate bypassable, and "add job to this column" silently discarding the column. **These were not four bugs; they were one unmade modelling decision, four times.** The fix is a real split: `job_pipeline_stages.lifecycle` says what a stage *means*, `jobs.stage_id` is the pointer, `jobs.status` stays only as a denormalised copy of the stage name that is never written except from a resolved stage.
- **A state machine keyed on the wrong thing fails silently in the "nothing changed" case.** `VALID_TRANSITIONS[status]` never listed `status` as its own successor — correct for a lifecycle, catastrophic for a stage name, because dragging a card *within* its column is a transition from a state to itself. The handler `continue`d, which skipped the `sortOrder` write too, so a within-column reorder persisted **zero of three** cards while returning `200 {success:true}`. Any same-state move must be explicitly legal: `canTransition(a, b) => a === b || TABLE[a].includes(b)`.
- **Two endpoints that can both write the same column will not stay in sync — delete one.** `/reorder` and `PATCH /:id/status` both moved jobs between stages, but only the latter enforced the required-checklist gate, sent the E-05 completion email, dispatched the notification and wrote the activity row. The board used `/reorder`. So a tech dragging a card to Completed triggered none of it, while completing the same job from the detail sheet triggered all four. `/reorder` now writes `sortOrder` only. Same consolidation as `availability.service.ts` in the bookings audit: *one writer per fact*.
- **Zod strips unknown keys silently, so a missing field and an ignored field look identical from the client.** `handleSave` sent `status: data.status`; `createJobBody` had no `status` field; the key vanished during parse with no error and the column default won. Nothing in the request/response cycle indicated a problem. When a client sends a field the server ignores, only reading both schemas reveals it — which is an argument for keeping the action's TypeScript param type and the Zod body in the same review.
- **`ON DELETE SET NULL` changes what a delete guard has to count.** The stage-delete guard counted jobs by `status = name`, which excluded archived jobs — and once `jobs.stage_id` had an FK, deleting a stage would have quietly nulled the column of every archived job the guard ignored. Count what the *constraint* would touch, not what the UI currently shows. This is the customers cascade guard (`CUST-01`) in a new place, which is the third time this exact shape has appeared.
- **Duplicated seed data is where a new column goes missing.** The default four stages were defined in `DEFAULT_STAGES`, again inline in `POST /pipelines`, and again in the migration. Adding `lifecycle` had to reach all three; the inline copy is now gone. If a constant is spelled out twice, the second copy is a future bug with a delay fuse.
- **A guard that must be remembered is a guard that will be forgotten — make it a function, not a paragraph.** The archived-job check was written out by hand and covered **4 of 14** mutating handlers. The gaps were not random: you could not *add* a line item to an archived job, but you could edit or delete one, and both of those recalculate the job's totals. So the money on an archived job was editable through exactly the two verbs nobody had guarded, and toggling a checklist item — which can auto-add a line item — routed around the one guard that did exist. `loadEditableJob()` is two lines at a call site and cannot be half-applied. Same reasoning as `escapeLike` → `lib/search.ts` and the phone helpers → `lib/phone.ts`.
- **Validate a foreign key at the boundary that writes it, not at the one that reads it.** Four FKs (`bookingId`, `equipmentId`, `catalogItemId`, a document's `customerId`) went straight from the request body into the row while `customerId`, `pipelineId` and `assigneeId` beside them were all checked. It never leaked data — every later query filters by its own `tenantId` — which is exactly why it survived: nothing visibly broke. `POST /line-items` was the clearest, doing `if (catalogItem) { …auto-fill… }` with no `else`, so another tenant's item silently skipped the auto-fill and got stored anyway.
- **An upload endpoint's `mimeType` is a security boundary, because it becomes the stored object's Content-Type.** The handler took any string and the response handed back a public URL, so `text/html` yielded attacker-controlled markup served from the app's own storage domain — stored XSS with a link the product generated itself. An allowlist already existed for tenant logos; it was simply never applied here. `Buffer.from(x, "base64")` also never throws, so malformed input uploaded as garbage rather than erroring.
- **Deleting one type suppression finds the next one.** Removing `as never` from `serviceType` in `job-helpers.ts` made the compiler immediately flag `lib/quote-to-job.ts`, whose `ConvertOptions.serviceType` was `string` reaching a pgEnum through the same cast — a quote converted with an unknown service type 500'd at the driver. The route's Zod schema had validated that enum correctly all along, which proves the cast was never a "Drizzle limitation" as the old lesson claimed; it was hiding a real mismatch two files away.
- **When the failure state is missing from a *shared* component, it is missing everywhere at once.** `EntityDetailShell` rendered a branch for `loading` and one for `hasData` and nothing for the third case, so any failed fetch opened an empty sheet — for jobs, invoices, quotes and bookings alike. Fixing it in the shell fixed four pages; fixing it in `job-detail-sheet.tsx` would have fixed one and left the pattern in place.
- **Plumbing a cross-cutting concern to *some* components is not plumbing it.** Tenant timezone was carried end-to-end for the dashboard (2026-07-27) and `lib/tenant-time.ts` was written for the calendar, yet `components/dashboard/jobs/` contained **zero** references to `timeZone`. The Kanban "Today" badge compared `job.scheduledDate` against `new Date().toISOString().split("T")[0]` — the **UTC** date — so from 18:00 Central the badge sat on tomorrow's jobs. The same email bug: `toLocaleDateString("en-US", …)` with no `timeZone` sends the *server's* date, and on Neon that is UTC. When a concern is genuinely global, finish it with a grep for the primitive it replaces (`toISOString().split`, `toLocaleDateString`), not with the page you were asked about.
- **Two endpoints that write the same fact will diverge on side effects, not just on data.** `PATCH /:id/status` sent the completion email; `bulk-status-update` did not. Completing ten jobs one at a time sent ten emails; selecting the same ten and using the bulk bar sent none — no error, no hint. The fix is not "remember to add it": it is extracting the side effect (`sendJobCompletionEmailFor`) so both call one function. Same shape as the R2 cleanup missing from bulk-delete, in the same file, found in the same audit.
- **An auto-add with no auto-remove is a one-way charge.** Completing a catalog-linked checklist item added a line item; un-checking it left the line item and its money on the job. A mis-tap was billable and the only way back was knowing to open the Line Items tab. Whenever a toggle creates something, the other direction has to be written at the same time — and scoped tightly enough (still matching the catalog item exactly) that it never deletes a row the user edited by hand.
- **`z.coerce.number().min(0)` is not a bound.** `numeric(10,2)` tops out at 99,999,999.99, so `1e15` validated and then failed in the driver as SQLSTATE 22003 — a 500 for a plainly bad request. `z.coerce.number()` also turns `"Infinity"` into `Infinity` and `"abc"` into `NaN`, neither of which `.min(0)` rejects. Money needs `.finite().min(0).max(COLUMN_MAX)`, and the max should come from the column definition, not from taste.
- **"Half-built feature" has a specific tell: the wire supports it and nothing calls it.** `assigneeId` was in `jobListQuery`, honoured by the route, and typed into the API — but `getJobs` never put it in the query string and no control existed. Identical shape to the customers tag filter. The cheap check when finishing any feature: grep the param name across `actions/` and `components/`; if it appears only in the schema and the route, nobody can reach it.
- **Two `useEffect`s reading the same state in one commit will race, and the loser reads stale.** `/jobs/[id]` had one effect setting the view preference to `page` and another navigating away whenever the preference was not `page`. On mount with a stored `sidebar` preference the second read the pre-update value and pushed back to `/jobs`, so every deep link bounced. A `useRef` latch that records "we have arrived" separates *adopting* a mode from *reacting to a change of* mode.
- **Docs drift is measurable, so measure it.** 13 of 27 job endpoints were undocumented — including `PATCH /jobs/:id/status`, the single most important one on the page. Counting `fastify.(get|post|patch|delete)` in the route file and diffing against `###` headings in the API docs takes one line and turns "the docs feel stale" into a number you can close.
- **A stage's *lifecycle* is a marker, not a classifier — ask about the two ends only.** The first
  cut of the Manage Pipeline UI put a "Counts as: scheduled / in progress / completed / cancelled"
  select on every row, which asks four questions where two matter. A pipeline only has to declare
  which stage **completes** a job and which **cancels** it; a lead, a site visit, an appointment or
  parts-on-order are all just open work. Unmarked stages are stored as `scheduled`, any number may
  share it, and moving between same-lifecycle stages is always legal.
- **That simplification forces `scheduled → completed` to be a legal transition.** With no
  `in_progress` stage in a custom pipeline (Lead → Site visit → Quoted → Done), the old table made
  Done unreachable. It is also the normal path for a one-visit call.
- **Changing what a stage means has to reach the jobs already in it.** Marking "Done" as completed
  left its existing jobs with `completed_at = NULL`, so lifecycle-based counts and the
  `completed_at`-based reports disagreed about the same eleven jobs. `PATCH /pipeline-stages/:id`
  now stamps or clears them in bulk, the same rule `stageUpdate` applies to a single move.
- **Revenue is not tied to job completion at all.** It is `SUM(invoice_payments.amount)` by payment
  date — cash received. Completing a job stamps `completed_at`, fires the E-05 email and counts as
  finished work in reports, but money only appears once an invoice exists and a payment is recorded
  against it.
- **A one-shot `useRef` guard skips its whole body on the server-rendered path.** `/jobs` resolved the
  pipeline and wrote `?pipeline=` in the same effect, guarded by
  `useRef(initialPipelines.length > 0)` — which starts **true** whenever the server pre-rendered
  pipelines, i.e. every normal visit. So the board showed the default pipeline while the URL claimed
  no opinion, and the link could not be shared, bookmarked or reloaded onto the same board. Anything
  that must happen on *every* visit belongs in its own effect, not inside a run-once resolver.
- **One writer per URL parameter.** `?pipeline=` was written in three places (the resolver, the
  pipeline-tab handler, and nowhere for the default case, which was the bug). A single effect that
  syncs the param to the selected id covers all of them — and it must use `router.replace`, not
  `push`: a pipeline is where you are, not somewhere you navigated to, so pushing makes Back walk
  through every pipeline you looked at.
- **A "one place that writes X" rule only holds if you grep for writers outside the directory you
  are editing.** The jobs audit built `job-stages.service.ts` as the single writer of
  `jobs.status`/`stage_id` and converted every handler in `routes/jobs` — but `lib/quote-to-job.ts`
  writes a job too, and it kept setting `status` by hand with `stage_id` left NULL. For four days
  every job created from a quote counted **0** in the stage-keyed pipeline counts and matched no
  `?lifecycle=` filter, because both are keyed on `stage_id`. When you centralise a write, the
  verification step is `grep -rl "<column>" apps/api/src`, not a read of the folder you refactored.
- **Typing a service's `Db` as `ReturnType<typeof getDb>` silently forbids calling it in a
  transaction.** A `PgTransaction` has no `$client`, so it is not assignable, and the failure only
  appears the first time someone tries to compose the service into a larger atomic operation.
  `Omit<ReturnType<typeof getDb>, "$client">` is the shape every service in this repo should use.
- **The "one place that writes X" rule failed a third time, and the third writer was written after
  both fixes.** `PATCH /jobs/reorder` (JOB-06) and `lib/quote-to-job.ts` (QUO-02) each wrote
  `jobs.status` on their own and skipped the gate, the email, the notification and the activity
  row. Both were fixed by routing through the one path — and then the `job.moveStage` **automation
  node** shipped with its own `UPDATE`, skipping all of it again, because a sweep of `routes/jobs`
  does not reach `services/workflow`. The grep that would have caught it is the one the earlier
  lesson already prescribes (`grep -rl "<column>" apps/api/src`); what is new is that a *feature
  built later* becomes a new writer, so the sweep is not a one-off at centralisation time. If a
  table has a "one place", put the assertion in a test that enumerates writers, not in a habit.
- **Extracting a service "as a pure move with no behaviour change" is wrong when the point is a
  second caller.** A lifted route handler takes a request body and returns a `reply`; an executor
  cannot call it. Shape the extraction around the second caller from the start: an `actor` that is
  a person *or* an automation, and failure as a **returned union** rather than a throw — the route
  needs a 400 with a sentence and the executor needs `skipped` vs `NodeFailure`, and neither
  vocabulary can be imposed on the other.
- **A no-op write must be refused, not performed, once events hang off it.** `assignJob` returns
  `already_assigned` when the assignee is unchanged, because `emitJobUpdatedEvents` would otherwise
  raise `job.updated` for a change that did not happen — an automation firing for nothing, and on a
  resumed run, firing again every time. The general update route is protected by its field diff;
  any narrower operation extracted out of it has to re-establish that guarantee itself, because the
  diff is what it left behind.
- **A bulk endpoint that pre-filters and then writes atomically is a second implementation of the
  single-item rule, and it will drift.** `POST /jobs/bulk-status-update` resolved a target per
  pipeline, grouped the writes by stage and by previous lifecycle, and re-checked the transition
  table and the checklist gate — all correct, and all a copy. JOB-22 is what the drift looks like:
  the bulk path skipped the completion email the single path sent. It is now a loop over
  `moveJobStage`, bounded at 100 by `bulkIds`. **N transactions is the right number here**, because
  the endpoint's contract is `{succeeded, failed, errors}` — one job refusing a transition must not
  roll back the ninety-nine that were fine. The old shape reached partial success by pre-filtering;
  the loop reaches it directly, and each refusal names its own id instead of being tallied into
  `{ id: "N/A", message: "3 job(s) ..." }`, which told the caller nothing about which three.
- **A consolidation commit sweeps the handler it is reading, not the file it is in.** `assignJob`
  moved `PATCH /jobs/:id` onto the shared `isOrgMember` and its commit message said three copies
  had become one. `POST /jobs`, two hundred lines above in the *same file*, still had its own
  inline `member` lookup — carrying the identical **fail-open** shape, `if (assigneeId &&
  tenantRecord)` with no `else`, so a tenant whose organisation row is missing skipped the check
  instead of failing it. Every previous instance of this project's propagation failure crossed a
  directory boundary (`routes/jobs` → `services/workflow`, `routes/jobs` → `lib/quote-to-job.ts`);
  this one did not cross anything. **Grep the whole repo for the primitive you are replacing —
  `from(member)`, `jobs.status`, `db.execute` — and count the hits before and after. "I fixed the
  call sites I was looking at" is not a sweep, and the file you are editing is not a smaller
  search space than the repo.**
- **Assert on the row you mean, not on the first row returned.** A proof of `createJob` asserted
  "exactly one `job_activities` row" and failed: `attachChecklistToJob` writes its own
  ("Checklist X attached (6 items)"), correctly and since long before. Taking `[0]` then read the
  checklist row's `description` and `metadata` and reported three failures against working code.
  Filter by `type` — and note the assertion would have *passed* against a tenant with no checklist
  template, which is no real tenant, so the wrong version was one seeded template away from being
  a permanently green false negative.
