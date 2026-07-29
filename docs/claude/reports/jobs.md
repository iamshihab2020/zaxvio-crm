# Jobs — Page Audit

> Related: [[reports/README|Reports Index]] | [[customers]] | [[bookings-calendar]] | [[dashboard]] | [[reports-page]] | [[jobs-customers]] | [[strict-rules]] | [[api-rules]] | [[security-rules]] | [[todo]]

**Date:** 2026-07-29
**Scope:** `/jobs` (board · list · table), `/jobs/[id]`, the job detail sheet, `/settings/pipelines`, the pipeline-stage editor, and the jobs half of `checklists` / `catalog` / `job-attachments`.
**Excluded:** `/invoices` and `/quotes` beyond their FK relationship to a job.
**Findings:** 42 — 5 critical (JOB-01..05), 9 high (06..14), 20 medium (15..34), 8 low (35..42).
Plus **6 found during remediation** (§8) — 48 distinct in total.
**Status:** ✅ **All 48 fixed and verified** (2026-07-29). Final cross-phase harness: 45/45 by
execution against Neon; `tsc` clean on all three packages.

> *Count correction (2026-07-29):* this header originally read "38 — 5 critical, 9 high, **16
> medium**, 8 low". The medium section actually holds **20** findings (JOB-15 … JOB-34), so the
> audit undercounted itself by four and every later summary inherited the error. §8 lists 7 IDs
> but JOB-47 is a rediscovery of JOB-34, so 6 are genuinely new. 42 + 6 = **48**.

---

## 1. What has been built

The largest surface audited so far: **27 API endpoints** in a single 2,189-line route file, **30 React components**, three view modes, and a detail page that duplicates the detail sheet.

| Area | State |
|---|---|
| Kanban board | dnd-kit drag/drop, per-stage columns, optimistic move with snapshot revert, compact density, configurable card fields |
| List + Table views | Table has sorting, pagination, prefetch-next-page, row selection, bulk bar, Active/Archived tabs |
| Multi-pipeline | Per-tenant pipelines, per-pipeline stages, URL + localStorage persistence, lazy auto-seed of defaults |
| Detail | 5-tab sheet **and** a separate 3-panel full page, switchable via a stored preference |
| Line items | Catalog auto-fill, generated `total` column, server-side total recalculation |
| Checklists | Template auto-attach by service type, completion gate on job completion, catalog-linked items auto-add line items |
| Attachments | Photo + document upload, before/after tags, lightbox, compare view |
| Assignees | Org-member picker, avatar on card, validated against the Better Auth org |
| Bulk ops | archive / restore / delete / status-update, all returning `{succeeded, failed, errors}` |
| Activity log | 12 event types written to `job_activities` |

The breadth is real and most of it is well-factored. The problems are concentrated in one place: **what `status` actually means.**

---

## 2. The central defect

`jobs.status` is `text` (verified: `information_schema` reports `udt_name = text`, **not** `job_status`) — `packages/database/src/schema/jobs.ts:57`. The `jobStatusEnum` exists at `enums.ts:3` and is **not used by the jobs table**.

That is deliberate: a stage's `name` *is* the status. `GET /pipeline-stages` counts jobs with `jobs.status = job_pipeline_stages.name` (`routes/pipeline-stages/index.ts:150`), and renaming a stage rewrites `jobs.status` for every job in that pipeline (`:341`).

But **every schema that writes a status hard-codes the four canonical values**:

| Schema | File:line | Accepts |
|---|---|---|
| `updateJobStatusBody` | `schemas/jobs.ts:92` | `scheduled·in_progress·completed·cancelled` |
| `reorderBody.items[].status` | `schemas/jobs.ts:101` | same four |
| `bulkJobStatusBody` | `schemas/jobs.ts:158` | same four |

Meanwhile `POST /pipeline-stages` sets `name = slugify(body.label)` (`routes/pipeline-stages/index.ts:193`) — arbitrary text.

So the data model supports custom stages, the UI creates and renders them, and **all three write paths reject them**. Findings JOB-01, JOB-02, JOB-03 and JOB-06 are all consequences of this one unresolved question.

---

## 3. Findings

Severity: `P1` breaks correctness or availability · `P2` wrong or inconsistent behaviour · `P3` waste, drift, or UX defect · `P4` polish.
Every row was read in source; rows marked **verified** were additionally proven by execution (§6).

### Critical

**JOB-01 · P1 · Custom pipeline stages cannot receive jobs — verified — FIXED (2026-07-29)**
`reorderBody`, `bulkJobStatusBody` and `updateJobStatusBody` reject any stage name outside the four canonical values. Dragging a card into a custom column sends `status: "awaiting_parts"` (`kanban-board.tsx:301`) and gets a **400 from Zod before the handler runs**. The bulk bar has the same problem — it renders one button per stage and calls `handleBulkStatusUpdate(stage.name)` (`jobs-page-client.tsx:992`).
Custom Pipeline Stages and Multi-Pipeline are both marked **Done** in [[todo]]. Stage creation, colours, reordering and rename all work; the one thing you cannot do is move a job into one.
*Also:* `VALID_TRANSITIONS` (`routes/jobs/index.ts:74`) is keyed by the same four names, so even past Zod, `VALID_TRANSITIONS["awaiting_parts"]` is `undefined` → skipped.

**JOB-02 · P1 · Reordering within a column never persists — verified — FIXED (2026-07-29)**
`kanban-board.tsx:277` sends `status: overStage` for **every** card in a within-column reorder — i.e. the status each card already has. The handler looks up `VALID_TRANSITIONS[currentStatus]`, which never contains `currentStatus` itself, so it `continue`s — **skipping the `sortOrder` write too** (`routes/jobs/index.ts:1013-1017`). Simulation of the exact loop persisted **zero** of three cards.
The client checks only `result.error`; the response is `200 {success:true, skipped:[...]}`, so no error appears. The new order holds until refresh, then reverts.

**JOB-03 · P1 · Dragging to "Completed" bypasses every completion rule — verified — FIXED (2026-07-29)**
`PATCH /jobs/:id/status` refuses completion while required checklist items are open (`:809-831`), sets `completedAt`, logs `job.status_changed`, dispatches a notification and sends the E-05 customer email. `PATCH /jobs/reorder` — the endpoint the kanban actually uses for status changes — does **none of it** except `completedAt`.
A tech drags a card to Completed: no checklist enforcement, no customer email, no notification, no activity row. The same job completed from the detail sheet does all four. This is the April lesson *"Bulk endpoints must mirror single-endpoint safety checks"* ([[jobs-customers]]) — `/reorder` is a bulk endpoint and was never covered.

**JOB-04 · P1 · Job photo upload is impossible for any real photo — FIXED (2026-07-29)**
`POST /jobs/:id/upload` accepts base64 and checks a 20 MB (photo) / 50 MB (document) ceiling (`routes/jobs/index.ts:1483`). The upload modal states "Max 20MB" (`job-photo-upload-modal.tsx:191`). **No `bodyLimit` is configured anywhere in `apps/api`**, so Fastify's 1 MB default applies and rejects the request with `FST_ERR_CTP_BODY_TOO_LARGE` before the handler runs. Base64 inflates by ~33%, so the real ceiling is ≈**786 KB** — below almost any phone photo.
The Job Photo & File Attachment System is marked **Done** (2026-04-05). This will read as an R2 misconfiguration once R2 is provisioned; it is not.

**JOB-05 · P1 · `initialData` is seeded into every query key — FIXED (2026-07-29)**
`boardJobsQuery` (`jobs-page-client.tsx:331`) and `stagesQuery` (`:307`) both pass `initialData` while their keys vary by `pipelineId`, `search`, `priority` and `serviceType`. TanStack Query applies `initialData` to **whichever key is currently mounted**, marked fresh at *now*, so:
- switching pipeline renders the **previous pipeline's jobs and columns** for `staleTime` (10 s / 15 s) with no refetch;
- typing a search shows the unfiltered SSR list for 10 s.

This is the dashboard critical verbatim — *"`initialData` seeded every query key so changing the date range showed stale data and never refetched"* ([[dashboard]]). The fix there was `setQueryData(key, value, { updatedAt })`; it never reached this page.

### High

**JOB-06 · P2 · "Add job to this column" discards the column — verified — FIXED (2026-07-29)**
`openCreateDialogForStage(stageName)` stores `initialStatus` and `handleSave` sends `status: data.status` (`jobs-page-client.tsx:633`). `createJobBody` has **no `status` field**, and Zod objects strip unknown keys silently — confirmed: `status` is absent from the parsed output. The insert never sets it, so the column default `"scheduled"` wins. Every job created from a column header lands in Scheduled.

**JOB-07 · P2 · `/jobs/[id]` shows the wrong pipeline's stages — FIXED (2026-07-29)**
`page.tsx:14` calls `getPipelineStages()` with **no argument**; the route then resolves the tenant's *default* pipeline (`routes/pipeline-stages/index.ts:126-130`). A job on any non-default pipeline gets the default pipeline's stage list in its status selector — offering stages it cannot be in, and omitting the one it is in.

**JOB-08 · P2 · `scheduledDate` accepts Postgres magic strings — verified — FIXED (2026-07-29)**
`createJobBody.scheduledDate` is `z.string().min(1)` (`schemas/jobs.ts:61`). All six of `infinity`, `-infinity`, `today`, `epoch`, `now` and `2026-02-30` parse successfully. `infinity` is a valid `date` in Postgres — such a job matches no range query, never appears on the calendar, and renders as `Invalid Date`. `2026-02-30` 500s at the driver.
`isoDate` and `isoTime` already exist in `lib/schemas/common.ts:45` and were written *for this exact bug* (BOOK-04). Third recurrence. `scheduledStart: "99:99"` is likewise accepted.

**JOB-09 · P2 · `serviceType` is validated as free text, not as the enum — verified — FIXED (2026-07-29)**
`z.string().min(1)` (`schemas/jobs.ts:60`) against a `serviceTypeEnum` column, then cast `as never` at the insert (`routes/jobs/index.ts:536`). An unknown value is a **500 from Postgres instead of a 400 from Zod**. The very first bullet of [[jobs-customers]] is *"Zod enum schemas MUST match DB pgEnum exactly"* — written in April about `jobPriority` on this same file. `priority` was fixed; `serviceType` beside it was not.

**JOB-10 · P2 · Errors render as definitive negative claims — FIXED (2026-07-29)**
- `/jobs/[id]/page.tsx:17` — `if (jobRes.error || !jobRes.data) notFound()`. A 500 renders **"This page could not be found"**.
- The board never inspects `boardJobsQuery.isError`; a failed fetch yields `jobs = []` and renders empty columns with no message (`showNoResults` requires an active filter, so with no filters there is not even that).
- `job-detail-client.tsx:51` and `job-detail-sheet.tsx:134` — `if (res.data) setJob(...)` with no `else`.

This is [[reports-page|REP-01]] and the customers detail-page finding again. `LoadErrorState` and `WidgetErrorBoundary` already exist in `components/reusable/`.

**JOB-11 · P2 · Bulk delete orphans every file in R2 — FIXED (2026-07-29)**
`DELETE /jobs/:id` collects photo + document storage paths and calls `deleteFiles` before the row delete (`:940-961`). `POST /jobs/bulk-delete` (`:2038`) does none of that — it deletes the rows and lets the FK cascade drop the records, leaving every object in the bucket forever, unreferenced and unbillable-to-anyone-but-you. Neither path is transactional, and neither warns that `invoices.job_id` will be nulled (verified: `ON DELETE SET NULL`) — an invoice quietly loses its job.

**JOB-12 · P2 · Four foreign keys written without a tenant-ownership check — FIXED (2026-07-29)**
`bookingId` and `equipmentId` at `routes/jobs/index.ts:532-533` (and `equipmentId` again via `PATCH`'s `allowedFields`), `catalogItemId` at `:1134`, and `customerId` at `:1815`. `customerId` and `pipelineId` and `assigneeId` are all validated; these are not. Not a read leak — every subsequent query filters by its own `tenantId` — but a cross-tenant row can be *written*. Same shape as the customers `POST /notes` finding.
`POST /line-items` is the clearest: if the catalog item is missing or another tenant's, `if (catalogItem)` silently falls through and the unvalidated id is stored anyway.

**JOB-13 · P2 · Upload has no MIME allowlist — FIXED (2026-07-29)**
`uploadFileBody.mimeType` is `z.string().min(1).max(100)` (`schemas/jobs.ts:150`) and is passed straight to `uploadFile()` as the object's Content-Type; the response hands back `getPublicUrl(...)`. Uploading `text/html` yields a public URL serving attacker-controlled HTML from the app's storage domain. `apps/api/src/lib/schemas/tenants.ts:4` already defines an allowlist for logos (added when SVG was blocked); it was not applied here. There is also no `Buffer` validity check — malformed base64 decodes to garbage silently.

**JOB-14 · P2 · Archived-job guards cover 4 of 14 mutating handlers — FIXED (2026-07-29)**
Present on `PATCH /:id`, `PATCH /:id/status`, `POST /:id/line-items` and the bulk endpoints. **Absent** on: `PATCH`/`DELETE` line-items, `PATCH` checklist toggle, `POST`/`PATCH`/`DELETE` photos, `POST`/`DELETE` documents, `POST` upload, and `PATCH /reorder`.
So on an archived job you cannot *add* a line item but you can edit or delete one — both of which call `recalculateJobTotals` and change the job's money. Toggling a checklist item on an archived job can auto-**add** a line item, routing around the one guard that exists.

### Medium

**JOB-15 · P3 — FIXED (2026-07-29)** — `PATCH /jobs/:id` final re-fetch is `.where(eq(jobs.id, id))` with **no `tenantId`** (`:752-755`). Not exploitable (the row was already tenant-verified) but a direct [[security-rules]] §1 violation, and the April lesson says re-fetches must include it.

**JOB-16 · P3 — FIXED (2026-07-29)** — `title`, `description`, `address`, `notes` are unbounded `z.string()` on `text` columns; a 100 KB title validates. `boundedText()` exists in `common.ts:80` and is used by bookings and calendar events. Verified.

**JOB-17 · P3 — FIXED (2026-07-29)** — `POST` writes `body.description || null`; `PATCH` writes `updates[field] = body[field]`, storing `''`. One column, two spellings of empty — the customers finding exactly.

**JOB-18 · P3 — FIXED (2026-07-29)** — `addLineItemBody` bounds `unitPrice` only with `.min(0)` and `quantity` with `.positive()`, against `numeric(10,2)` columns. `1e15` validates and then 500s with SQLSTATE 22003. Verified.

**JOB-19 · P3 — FIXED (2026-07-29)** — No server-side check that `scheduledEnd > scheduledStart`. The create dialog validates it (`job-create-dialog.tsx:305`) but the API accepts `17:00 → 09:00` from any other caller. Verified.

**JOB-20 · P3 — FIXED (2026-07-29)** — The "Today" badge is computed in **UTC**: `job.scheduledDate === new Date().toISOString().split("T")[0]` (`kanban-card.tsx:141`). For `America/Chicago` the badge jumps to tomorrow's jobs at 18:00–19:00 local. Every other date uses `new Date(d + "T00:00:00")` — browser-local, not tenant-local. **Zero** references to `timeZone` exist anywhere under `components/dashboard/jobs/`, despite tenant timezone being plumbed end-to-end for the dashboard and `lib/tenant-time.ts` being created for the calendar.

**JOB-21 · P3 — FIXED (2026-07-29)** — The E-05 completion email stamps `new Date().toLocaleDateString("en-US", …)` (`routes/jobs/index.ts:894`) — the *server's* locale and timezone, in a customer-facing email.

**JOB-22 · P3 — FIXED (2026-07-29)** — `bulk-status-update` sends no completion email, while `PATCH /:id/status` does. Completing 10 jobs at once notifies nobody.

**JOB-23 · P3 — FIXED (2026-07-29)** — `escapeLike` is redefined locally at `routes/jobs/index.ts:69` and **omits the backslash escape**, unlike `apps/web/src/lib/search.ts` written during the customers audit specifically to end this duplication. A search for `\` still behaves as an escape character.

**JOB-24 · P3 — FIXED (2026-07-29)** — `PATCH /reorder` returns `{success:true, skipped:[…]}`; both call sites read only `result.error`. Every refused item is invisible. Same class as the bulk-toast finding, in an endpoint `bulkToast` does not cover.

**JOB-25 · P3 — FIXED (2026-07-29)** — The board requests `limit: 150` and discards `pagination.total`. A pipeline with more than 150 jobs silently shows a subset — no banner, no count, no way to tell. (The schema allows up to 500.)

**JOB-26 · P3 — FIXED (2026-07-29)** — `loading = (!hasServerData && boardJobsQuery.isLoading) || !selectedPipelineId` (`:410`). With **zero pipelines**, `selectedPipelineId` never resolves, so the page renders a `KanbanSkeleton` forever and the "No pipeline stages configured" empty state at `:808` is unreachable.

**JOB-27 · P3 — FIXED (2026-07-29)** — `calendar_events.job_id` has **no foreign key** and `job_documents.customer_id` has **no foreign key** (both verified: 0 constraints). Deleting a job leaves calendar events pointing at a dead id. The bookings audit added exactly this FK for `jobs.booking_id`; the reverse link was missed.

**JOB-28 · P3 — FIXED (2026-07-29)** — The stage `jobCount` subquery (`routes/pipeline-stages/index.ts:148-151`) filters on `pipeline_id` and `status` only — no `archived_at`. Column headers count archived jobs the board does not render. (Tenant isolation holds transitively via `pipeline_id`.) *Not exercised:* the database currently has one job, so the two counts are equal — this is a code reading, not a measurement.

**JOB-29 · P3 — FIXED (2026-07-29)** — `GET /pipeline-stages` **writes**: it calls `getOrCreateDefaultPipeline` and `ensureDefaultStages` (`:126-133`). A read endpoint that inserts rows is a surprise for callers, caches and concurrent requests.

**JOB-30 · P3 — FIXED (2026-07-29)** — `handleDragEnd` can fire `reorderJobs` **twice** for one drop: the within-column branch (`:263`) and the cross-column branch (`:288`) are independent `if`s, and dropping onto a *card* in another column satisfies both. Two concurrent writes, last-wins.

**JOB-31 · P3 — FIXED (2026-07-29)** — On create-with-line-items, `await Promise.all(data.lineItems.map(addJobLineItem))` (`jobs-page-client.tsx:644`) ignores every result. If three of five inserts fail the toast still says "Job created" and the totals are quietly wrong.

**JOB-32 · P3 — FIXED (2026-07-29)** — `POST /jobs` is not transactional: insert job → attach checklist → insert job activity → insert customer activity → re-fetch, as five separate statements. A failure mid-way leaves a job with no checklist and no activity trail.

**JOB-33 · P3 — FIXED (2026-07-29)** — Completing a catalog-linked checklist item auto-adds a line item; **un**-completing it does not remove it (`:1399-1448`). The charge stays on the job and in its total.

**JOB-34 · P3 — FIXED (2026-07-29)** — `queryKeys.tenant.settings()` is written with two different shapes: `useTenantSettings()` stores the full `getTenant()` response, the jobs page stores a bare `defaultTaxRate` string (`jobs-page-client.tsx:397-406`). Whichever mounts last wins, and the other reader gets the wrong type.

### Low

**JOB-35 · P4 — FIXED (2026-07-29)** — `as never` on request-derived values at `:213, :219, :222, :536, :543, :1135` and `job-helpers.ts:31`. [[strict-rules]] §4 forbids `as any`/`as unknown`; `as never` is the same suppression wearing a different hat. Most disappear once JOB-09 is fixed.

**JOB-36 · P4 — FIXED (2026-07-29)** — `components/dashboard/jobs/jobs-stats-bar.tsx` is exported and imported **nowhere** (0 importers). Dead since the toolbar redesign.

**JOB-37 · P4 — FIXED (2026-07-29)** — `invalidateAll` and `invalidateJobsAndStages` (`:414-426`) have identical bodies.

**JOB-38 · P4 — FIXED (2026-07-29)** — Landing on `/jobs/[id]` with the stored view preference set to `sheet` runs two effects in the same commit: one sets the preference to `page`, the other reads the still-stale value and `router.push`es back to `/jobs` (`job-detail-client.tsx:36-47`). Deep links bounce.

**JOB-39 · P4 — FIXED (2026-07-29)** — **13 of 27 endpoints are undocumented**: `GET /jobs/:id/line-items`, `PATCH /jobs/:id/status`, `PATCH /jobs/reorder`, `GET /jobs/:id/checklist`, `POST /jobs/:id/upload`, `PATCH /jobs/:id/photos/:photoId`, `GET`/`POST`/`DELETE /jobs/:id/documents`, and all four bulk endpoints. [[strict-rules]] §8 requires docs in the same commit.

**JOB-40 · P4 — FIXED (2026-07-29)** — `/jobs/[id]` uses `useState` + manual `getJob` refetch; the TanStack Query migration ("all 14 page-clients migrated") never reached it. Mutating from the page cannot invalidate the list.

**JOB-41 · P4 — FIXED (2026-07-29)** — Half-built features on the wire with no UI: `assigneeId` filtering is supported by `jobListQuery` and the route but the `getJobs` server action does not forward it and no control exists; `dateFrom`/`dateTo` are forwarded but unreachable; `sortBy` works in table view only. Same "you built half a feature" shape as the customers tag filter.

**JOB-42 · P4 — FIXED (2026-07-29)** — `job_line_items` has no `updatedAt`; edits are invisible to any sync or audit consumer.

---

## 4. What went wrong — the pattern

The customers audit closed with: *seven of eight remediation patterns from the previous three audits had never reached that page.* **Jobs is worse, and for a sharper reason: this page is where several of those lessons were originally written.**

| Pattern | Established | State on `/jobs` |
|---|---|---|
| Zod enums must match the pgEnum | **[[jobs-customers]], April, about this file** | `serviceType` still free text (JOB-09) |
| Bulk endpoints mirror single-endpoint checks | **[[jobs-customers]], April, about this file** | `/reorder` bypasses the checklist gate (JOB-03) |
| Re-fetches include `tenantId` | **[[jobs-customers]], April, about this file** | `PATCH /:id` re-fetch does not (JOB-15) |
| `isoDate`/`isoTime` on anything cast to `::date` | bookings (BOOK-04) | not used (JOB-08) |
| `boundedText()` on free text | bookings | not used (JOB-16) |
| An error must not render as an empty/negative state | reports (REP-01), customers | `notFound()` on a 500 (JOB-10) |
| Tenant timezone end-to-end | dashboard | zero references in the whole folder (JOB-20) |
| `initialData` must not seed every key | dashboard | seeds every key (JOB-05) |
| `escapeLike` lives in `lib/search.ts` | customers | local copy still here, missing a case (JOB-23) |
| Uniform `archived_at` filtering | reports, customers | stage counts unfiltered (JOB-28) |

Three of those were learned *on this file* and then regressed or were only half-applied at the time. The April session fixed `jobPriority` and left `serviceType` on the adjacent line; it added an archived guard to `POST /line-items` and not to `PATCH`/`DELETE` beside it; it added `tenantId` to most re-fetches and missed one.

**The failure mode is "fix the reported instance, not the class."** A finding arrives as `priority is wrong`, and the fix is to `priority`. Nobody greps the file for the other three fields with the same shape. Every audit since has re-derived this, which is why the same eight patterns keep reappearing.

The second theme is **an unresolved modelling question that nobody closed.** Custom stages were shipped (Multi-Pipeline, 2026-04-03) without deciding whether `status` is a lifecycle or a stage pointer. The DB was widened to `text` to allow stages; the API schemas were left as the four-value enum. Both halves are individually defensible; together they produce four criticals. **JOB-01/02/03/06 are not four bugs — they are one unmade decision, four times.**

---

## 5. Suggestions

**5.1 Split lifecycle from stage.** The single highest-leverage change on this page. Add `jobs.stage_id uuid REFERENCES job_pipeline_stages(id)` and reduce `jobs.status` to a real `job_status` enum, with each stage carrying a `lifecycle` column mapping it to one of the four. Then: custom stages are unrestricted, `VALID_TRANSITIONS` operates on the enum (4×4, comprehensible), the checklist gate keys off `lifecycle = completed` wherever the write comes from, and stage renames stop rewriting job rows. This dissolves JOB-01, JOB-02, JOB-03, JOB-06 and JOB-28 at once.

**5.2 One status writer.** `/reorder` writing status is the root of JOB-03. Make `/reorder` write **`sortOrder` only** and have the board call `PATCH /:id/status` for the cross-column move — which already enforces the gate, emails, notifies and logs. Mirrors the availability-service consolidation from the bookings audit.

**5.3 Use the availability service.** `services/availability.service.ts` was built during the bookings audit as the single resolver for "is this slot free." Jobs ignore it: you can schedule two jobs for the same assignee at the same hour with no warning, while the public booking portal would refuse the slot. Wire job scheduling into it and the calendar stops lying.

**5.4 A field view.** Everything here is a desktop three-column board, but the primary user of a *job* is a tech on a phone. What they need is: today's jobs, tap to open, checklist, photo capture, mark complete. That is four of the endpoints already built. The photo path (JOB-04) is the one that must work first.

**5.5 Make the board honest about scale.** Show `n of N` per column, add WIP limits and a per-column value total. Today a 200-job pipeline silently renders 150 with no indication (JOB-25).

**5.6 Close the half-built features.** Assignee filter, date-range filter and board sorting are all supported on the wire with no UI (JOB-41). "Assigned to me" is the single most requested filter in field service software and is three lines from working.

---

## 6. Verification

Run against the live Neon database (tenant *Shihab Housing*) plus direct schema probes. Every write was wrapped in a transaction that rolled back; nothing was left behind. The harness was deleted after the run.

Checks assert the **correct** behaviour, so a `FAIL` confirms the finding.

| ID | Check | Result | Finding |
|---|---|---|---|
| A1 | `reorderBody` accepts a custom stage name | rejected | JOB-01 |
| A2 | `bulkJobStatusBody` accepts a custom stage name | rejected | JOB-01 |
| A3 | `updateJobStatusBody` accepts a custom stage name | rejected | JOB-01 |
| A4 | `createJobBody` preserves `status` | **stripped** | JOB-06 |
| A5 | `scheduledDate` rejects magic dates | **all 6 accepted** (`infinity`, `-infinity`, `today`, `epoch`, `now`, `2026-02-30`) | JOB-08 |
| A6 | times rejected when malformed | `99:99` accepted | JOB-08 |
| A7 | free text bounded | 100 KB title accepted | JOB-16 |
| A8 | `serviceType` validated against the pgEnum | arbitrary string accepted | JOB-09 |
| A9 | `end > start` enforced | `17:00 → 09:00` accepted | JOB-19 |
| A10 | `jobListQuery.serviceType` bounded | 100 KB accepted | JOB-16 |
| A11 | line-item numerics bounded | `1e15` accepted vs `numeric(10,2)` | JOB-18 |
| B1 | within-column drag persists sortOrder | **0 of 3 persisted** | JOB-02 |
| B2 | cross-column drag persists the column | **1 of 3 persisted** | JOB-02 |
| B3 | `/reorder` enforces the checklist gate | no gate present | JOB-03 |
| C1 | `jobs.status` constrained by `job_status` | `udt_name = text` | JOB-01 |
| C2 | `calendar_events.job_id` has a FK | **0 constraints** | JOB-27 |
| C3 | `job_documents.customer_id` has a FK | **0 constraints** | JOB-27 |
| C4 | `invoices.job_id` delete rule | `SET NULL` (informational) | JOB-11 |
| C5 | triggers on `jobs` | 2 present (job-number generation intact) | — |
| C6 | DB rejects a custom status | **stored `awaiting_parts` successfully** | JOB-01 |
| C7 | stage count vs archived | 1 vs 1 — **inconclusive**, only one job exists | JOB-28 |

**C7 re-run after the fix (2026-07-29):** conclusive. Archiving the tenant's only job takes the
new `stage_id`-keyed count to **0** while the old `status`-keyed formula still reports **1**.

**15 findings confirmed by execution, 3 by rejection-probe, 1 inconclusive.**

Not verified by execution — read from source only: JOB-04 (needs an HTTP round trip with a >1 MB body), JOB-05/07/10/26/30/31/34/38 (need a browser), JOB-11/13 (need R2 provisioned), JOB-36/39/41 (static). No lint or build was run; `pnpm lint` remains broken repo-wide (eslint not installed).

---

## 7. Suggested fix order

1. **Decide §5.1** before writing any code — JOB-01/02/03/06/28 all depend on the answer, and fixing them individually against the current model means writing code that §5.1 deletes.
2. `bodyLimit` (JOB-04) — one line, unblocks a feature marked Done four months ago.
3. Error states (JOB-10) — `notFound()` on a 500 is the finding most likely to be reported as "the app lost my job".
4. Schema hardening in one pass: JOB-08, 09, 16, 18, 19 — all in `schemas/jobs.ts`, all using primitives that already exist.
5. Tenant-ownership checks (JOB-12) and the archived-guard sweep (JOB-14).
6. `initialData` (JOB-05), then the remaining P3s.
7. Docs housekeeping (JOB-39) plus [[strict-rules]] §8 updates for whatever changes.

**Before starting: grep the class, not the instance.** Each of these has siblings on the same lines that the April session walked past.

---

## 8. Found during remediation (2026-07-29)

Three defects that this audit missed, all surfaced by *verifying* a fix rather than by
reading code. Two are more serious than most of the original 38.

**JOB-43 · P1 · Every correlated subquery in the API silently evaluated against the wrong table — verified — FIXED (2026-07-29)**
Drizzle renders a column embedded in a `` sql`…` `` template as a **bare quoted name**
(`"id"`), not a qualified one. Inside a scalar subquery, Postgres resolves a bare name
against the *subquery's own* table before looking outward. So this:

```ts
jobCount: sql<number>`(SELECT COUNT(*)::int FROM jobs WHERE jobs.pipeline_id = ${pipelines.id})`
```

renders as `WHERE jobs.pipeline_id = "id"` and binds to **`jobs.id`** — the pipeline is
never referenced. Three live instances, all shipped:

| Site | Rendered condition | Effect |
|---|---|---|
| `routes/pipelines/index.ts:53` `stageCount` | `s.pipeline_id = s.id` | always **0** |
| `routes/pipelines/index.ts:57` `jobCount` | `jobs.pipeline_id = jobs.id` | always **0** |
| `routes/checklists/index.ts:63` `itemCount` | `ci.template_id = ci.id` | always **0** |

Measured against Neon: a tenant with **4 stages and 1 job** reported `stageCount: 0,
jobCount: 0`. `/settings/pipelines` has been showing "0 stages · 0 jobs" on every card.
The checklists case has no seeded templates to measure, so it is confirmed from the
generated SQL, not from data.

The same defect nearly went into the JOB-28 fix — it was caught because the new stage
count was verified by execution and returned 0 where the old one returned 1.
**Fix:** write outer columns out in full (`pipelines.id`) and alias the inner table.

**JOB-44 · P2 · The old stage `jobCount` ignored the pipeline entirely — verified — FIXED (2026-07-29)**
Same root cause, opposite symptom. `jobs.pipeline_id = ${jobPipelineStages.pipelineId}`
rendered as `jobs.pipeline_id = "pipeline_id"`, which bound to `jobs`' own column and was
therefore **always true**. The condition that was supposed to scope the count to one
pipeline was a no-op, so a stage named `scheduled` counted every `scheduled` job in the
tenant across *all* pipelines. Invisible while a tenant has one pipeline; wrong the moment
Multi-Pipeline is actually used — the feature it was written for.

**JOB-45 · P3 · `PATCH /pipeline-stages/:id` renamed stages by matching the old string — FIXED (2026-07-29)**
The rename updated jobs with `WHERE status = <old name>`, so any job whose `status` had
drifted from its column kept the stale name and vanished from the board. Now keyed on
`stage_id`, which cannot drift. Related: the delete guard counted only jobs matching
`status = name`; with `jobs.stage_id` now `ON DELETE SET NULL`, an archived job excluded
from that guard would have silently lost its column. Both now count via `stage_id`,
archived rows included — the same shape as the customers cascade guard.

**JOB-46 · P1 · The logo upload had the identical `bodyLimit` defect — verified — FIXED (2026-07-29)**
Found by grepping the class rather than fixing the instance. `POST /tenants/current/logo`
checks a 2 MB ceiling and the settings UI promises the same, but it inherited the 1 MB
default too, so the real ceiling was ~786 KB of image. Both routes now derive their
`bodyLimit` from the advertised limit via `bodyLimitFor()` in `lib/upload-limits.ts`,
rather than having the two numbers written down separately and drifting.
Proven by HTTP round trip through `fastify.inject()`: a 2 MB photo and a 1.5 MB logo now
reach auth (401) instead of dying at the parser (413), a 60 MB file is still refused, and
an ordinary JSON endpoint still enforces 1 MB — the control that shows the global default
is untouched.

**JOB-47 · P2 · Two different shapes stored under one query key — verified — FIXED (2026-07-29)**
*Correction: this is **the same defect as JOB-34**, which the audit had already recorded. I
rediscovered it while fixing JOB-05 and logged it as new. It is one finding, not two — the
total is 44, not 45.*
The jobs page defined its own `useQuery` on `queryKeys.tenant.settings()` returning a bare
tax-rate **string**, while the shared `useTenantSettings()` hook stores the whole
`{data, error}` result under the same key — and that hook has **five other readers**
(`/invoices`, `/quotes`, `/bookings`, customer overview) which all do
`tenantQuery.data?.data?.…`. Whichever mounted last won the cache entry, so visiting Jobs
and then Invoices inside the 5-minute `staleTime` handed those readers a string:
`("0.08").data` is `undefined`, silently reinstating the [[customers|CUST-06]] timezone
fallback that audit had just removed. The jobs page now uses the shared hook.
*This is [[strict-rules]] §11 — "import from `@/hooks/queries`, not individual files" —
and the reason the rule exists.*

**JOB-48 · P2 · The detail sheet had no failure state at all — verified — FIXED (2026-07-29)**
`EntityDetailShell` rendered `loading`, then `hasData`, and **nothing** for the third
case. A failed fetch therefore opened an empty sheet, indistinguishable from a job with
no content — the same "failed is not empty" defect as [[reports-page|REP-01]], but in a
component **shared by all four detail sheets** (jobs, invoices, quotes, bookings). Fixed in
the shell with a `loadError` + `onRetry` branch, so the other three inherit it. Wiring each
sheet to pass `loadError` is now a one-line change; only jobs is wired so far.

**JOB-49 · P3 · `as never` outside the jobs route was hiding a second untyped enum — FIXED (2026-07-29)**
Removing the `serviceType` cast in `job-helpers.ts` made the compiler flag
`lib/quote-to-job.ts`, whose `ConvertOptions.serviceType` was `string` and reached the
`jobs.serviceType` pgEnum through `as never` — so a quote converted with an unknown service
type 500'd at the driver. `convertBody` in `schemas/quotes.ts` already validated the enum,
which is the proof that the cast was pure suppression rather than a Drizzle limitation. The
`as never` on `quotes.status` in the same file was the same thing.
*Deleting one suppression found another two lines away. That is the argument for the ban.*
