# Todo

> Related: [[workflow]] | [[planner]] | [[lessons]] | [[decisions]] | [[deferred-fixes/README|Deferred Fixes]]

Task tracking for the Zaxvio CRM project.

---

## In Progress

### Page-by-Page Audits (2026-07-27)
Reports live in [[reports/README|docs/claude/reports/]]. One file per page.
- [x] `/dashboard` — [[dashboard|report]]: 29 findings audited and **all 29 fixed** (2026-07-27)
- [x] `/reports` — [[reports-page|report]]: 28 findings audited and **all 28 fixed** (2026-07-27)
- [x] Bookings & Calendar — [[bookings-calendar|report]]: 34 findings audited and **all 34 fixed** (2026-07-27)
- [x] `/customers` — [[customers|report]]: 35 findings audited and **all 35 fixed** (2026-07-27)
- [x] Jobs — [[jobs|report]]: 42 findings audited and **all 48 fixed** (2026-07-29) — the 42 plus 6 found while fixing. (The report header had undercounted its own medium section as 16; it is 20.)
- [x] Invoices — [[invoices|report]]: 42 findings audited and **all 42 fixed** (2026-07-29)
- [ ] Next page to audit — user picks (suggested: Quotes — shares the money model and adds a public token surface)

### Invoices Remediation (2026-07-29) — COMPLETE
All 42 findings in [[invoices|the report]] are fixed; the record is [[invoices|§7]]. The headline
from [[invoices|§2]] — of 17 remediation patterns established by the previous five audits exactly
**one** had reached this page — was answered by running the sweeps repo-wide and recording the
counts, which is the process change §2 asked for.
- [x] **Phase 1 — money model** (INV-01, 02, 03, 04, 09) — done. INV-01/02/03 turned out to be *one*
      defect: status was being **assigned** rather than **derived**. `services/invoices/status.service.ts`
      computes it from the payment rows, so "delete the last payment → set sent" is no longer
      expressible — a void invoice stays void and a never-sent draft stays a draft. The transition
      table then only governs what a human legitimately chooses, which is why `paid` and
      `partially_paid` appear on no row of it. `recordPayment`/`deletePayment` are one transaction
      with `SELECT … FOR UPDATE` — the transaction alone would not have fixed the race.
      `lib/invoice-guards.ts` took the archived check from **0 of 14** mutating handlers to all of them.
- [x] **Phase 2 — criticals + overdue split** (INV-05, 06, 07, 08) — done. One `overdueCondition()`
      backs the list, the stats endpoint and the cron. INV-06 was worse than "three definitions":
      the cron restricted to `('sent','overdue')`, so a **partially_paid** invoice past its due date
      was counted as overdue everywhere in the UI and **never chased** — a customer who paid half and
      stopped was silently dropped. INV-08 made that moot for the primary flow anyway: `from-job`
      set no `dueDate` at all, so those invoices were never overdue, never aged, never dunned, and
      printed "Terms: Net 30" above a blank due date.
- [x] **Phase 3 — propagation sweep, repo-wide** (INV-10, 11, 12, 13, 17, 18, 22, 31, 32) — done, with
      counts in [[invoices|§7.3]]. `escapeLike` reached **7 more route files** (0 unescaped `ilike`
      patterns remain repo-wide); the PDF logo guard covers **quotes as well as invoices**;
      `formatMoney`/`formatDateOnly` replace **four** hand-rolled copies. `useInvoice` had **0 callers** —
      so the hover prefetch was filling a cache nothing read, and sheet mutations invalidated nothing.
- [x] **Phase 4 — medium** (INV-15, 16, 19, 20, 21, 23–30, 33, 34) — done. Server-rendered data was
      fetched, passed, destructured and **never referenced**, so every load paid twice and still showed
      a skeleton; E-12 review requests moved out of a 2-hour in-memory `setTimeout` into a column plus
      a 15-minute sweep; both crons now **claim** rows with `UPDATE … RETURNING`, so N instances split
      the work instead of duplicating it and a crash-loop stops being a mailing-loop.
- [x] **Phase 5 — low + docs** (INV-35 … 42, INV-14) — done. Sortable and keyboard-reachable rows,
      six new indexes, PDF fetched through a server action. All **22** endpoints documented (was 9,
      and the one payment endpoint that was documented was wrong three ways).
- [x] Closed the 5 entries in [[deferred-fixes/invoices]] (DF-INV-01 … 05, open since 2026-04-12),
      each with a Resolution line.
- [x] **Applied `20260729000002_invoices_audit_money_model.sql` to Neon** (2026-07-29).
      **79/79 verified by execution.** Structure 23/23 — the before-state confirmed INV-33 exactly:
      `invoice_line_items` and `invoice_payments` had **no index at all** beyond their primary keys,
      so every detail fetch and every recalculation was a sequential scan. `EXPLAIN` now shows an
      index scan. Idempotent across 4 runs (NOTICE-only; index and column sets byte-identical after
      each). The two repair `UPDATE`s matched **0 rows** because the table is empty, so they were
      exercised separately against 8 seeded corruption rows and rolled back: `paid` with zero payment
      rows → `sent`, a paid-then-edited invoice → `partially_paid` with its balance restored from the
      clamped `0.00` to `500.00`, a $50 overpayment recovered into `credit_amount` — and the negative
      cases hold, a void invoice is never re-derived out of void and a genuine draft is never promoted.
      Re-running the repair matches 0 rows, so it converges. Then 38/38 round-tripping the real
      service layer against Neon, including the exact INV-02 scenario: adding a line item to a paid
      invoice now re-derives `partially_paid` and clears the credit instead of reading **Paid** with
      $511.88 owed.

### Jobs Remediation (2026-07-29) — COMPLETE
All 48 findings in [[jobs|the report]] are fixed and verified. §5.1 answered **full split**: `job_pipeline_stages.lifecycle`
maps each stage to one of the four real statuses; `jobs.stage_id` becomes the pointer; `jobs.status`
stays as the denormalised stage name but is now always derived from a validated stage.

- [x] **Phase 1 — data model** (JOB-01, 02, 03, 06, 08, 09, 27, 28, 35) — done 2026-07-29. Applied
      `20260729000001_jobs_audit_stage_split.sql` to Neon (13/13 verified: FK enforces, re-run is a
      no-op, stage delete SET NULLs instead of cascading). New `services/job-stages.service.ts` is the
      one place a job changes column. `/reorder` no longer writes status at all — the board calls
      `PATCH /:id/status`, so a drag to Completed now hits the checklist gate, the E-05 email, the
      notification and the activity row. Verified 33/33 by execution against Neon (a custom
      `awaiting_parts` stage resolves and accepts a job) and 19/19 on the Zod probes that failed in
      the audit. **Found 3 new defects while verifying — see [[jobs|§8]].** The worst: Drizzle renders
      an embedded column inside a `` sql`…` `` template as a bare `"id"`, which Postgres binds to the
      *subquery's* table, so `/settings/pipelines` has been reporting "0 stages · 0 jobs" for every
      pipeline (measured: 4 stages and 1 job read as 0 and 0). Same bug in `/checklists` itemCount.
- [x] **Phase 2 — remaining criticals** (JOB-04, 05) — done 2026-07-29. **All 5 criticals now closed.**
      New `lib/upload-limits.ts` derives each route's `bodyLimit` from its advertised ceiling, so the
      number the handler checks and the number Fastify enforces can't drift again. Verified 9/9 by
      HTTP round trip: a 2MB photo now reaches auth instead of dying at the parser, 60MB is still
      refused, and an ordinary endpoint still enforces 1MB. `initialData` now seeds only the exact
      key the server rendered, with an honest `initialDataUpdatedAt` — verified 9/9 against a real
      QueryClient, including a BEFORE run that reproduces the stale-pipeline defect.
      **2 more new defects found by grepping the class** ([[jobs|§8]]): the tenant logo upload had
      the identical bodyLimit bug (2MB promised, ~786KB real), and the jobs page was storing a bare
      string under `queryKeys.tenant.settings()` — a key 5 other components read as `{data, error}`,
      which silently reinstated the CUST-06 timezone fallback on /invoices, /quotes and /bookings.
- [x] **Phase 3 — high** (JOB-07, 10, 11, 12, 13, 14; 08/09 landed in Phase 1) — done 2026-07-29.
      **All 9 high now closed, so every P1 and P2 on this page is fixed.** New
      `lib/job-guards.ts`: `loadEditableJob` took the archived check from **4 of 14** mutating
      handlers to all of them (you could not *add* a line item to an archived job but could edit or
      delete one — both recalculate its money), and `findForeignRef` closed the 4 FKs written
      straight from the request body. Upload got a MIME allowlist (`text/html` was servable from our
      own storage domain) and a real base64 check. Bulk-delete now cleans R2 via the same helper as
      the single delete, and both report how many invoices lose their job link. Verified 28/28
      against Neon. **2 more found by grepping the class** ([[jobs|§8]]): `EntityDetailShell`
      rendered *nothing* when a fetch failed — a shared component, so all four detail sheets opened
      blank on a 500; and deleting the `as never` in `job-helpers.ts` made the compiler surface a
      second untyped enum in `lib/quote-to-job.ts`.
- [x] **Phase 4 — medium** (JOB-15 … JOB-34) — done 2026-07-29. **All 16 medium closed.** Highlights:
      the "Today" badge compared against the **UTC** date, so a tech's board said Today on tomorrow's
      jobs from 6pm Central — `components/dashboard/jobs/` had *zero* references to `timeZone`
      despite tenant tz being plumbed for the dashboard and `lib/tenant-time.ts` written for the
      calendar; the completion email stamped the *server's* date (proved: 02:30 UTC is Aug 1 in
      Chicago and Aug 2 in UTC); `bulk-status-update` sent no completion email at all, so completing
      ten jobs at once notified nobody; un-checking a catalog checklist item left its auto-added line
      item — and its money — on the job; `POST /jobs` became one transaction (was five statements, so
      a mid-way failure left a job with no checklist); `GET /pipeline-stages` stopped writing on every
      read; a drop onto a card in another column fired **two** concurrent `/reorder` writes.
      Verified 29/29 against Neon.
- [x] **Phase 5 — low** (JOB-36 … JOB-41; 35/42 landed in Phase 1) — done 2026-07-29. Deleted a
      component with 0 importers and a byte-identical duplicate of `invalidateAll`; fixed the deep-link
      bounce (two effects raced on the view preference, so `/jobs/[id]` pushed straight back to
      `/jobs`); migrated the detail page onto `useJob()` so mutations made there invalidate the list;
      and made the **assignee filter reachable** — it was honoured by the API and `jobListQuery` all
      along, but the server action never forwarded it and no control existed.
- [x] **Phase 6 — docs + verification** — done 2026-07-29. Wrote up all **13 undocumented
      endpoints** and corrected the ones this work changed (`PATCH /jobs/:id` no longer takes
      `status`; `DELETE` reports `unlinkedInvoices`; stage `lifecycle` documented with what it
      actually controls). REPO_MAP gained `job-guards.ts`, `upload-limits.ts`,
      `job-stages.service.ts`, `job-load-error.tsx` and the migration, and lost the deleted
      component. Chatbot knowledge base now explains stage types and the completion gate.
      **Final harness: 45/45 across all six phases**, `tsc` clean on all three packages.

**Verify against real data.** The DB now has one tenant — **Shihab Housing** (`/book/shihab-housing`, `America/Chicago`, 1 user, 1 customer, 1 job, Mon–Fri 08:00–17:00 seeded). Most of this is now runnable; email delivery still isn't (no verified Resend domain).
- [x] Applied `20260727000001_booking_calendar_audit.sql` (2026-07-27) — FK + index + `booking_slot_capacity`. Verified 10/10: FK enforces (`23503` on a bogus id, rollback-tested), re-running the file is a no-op, exactly one FK. The `UPDATE` and backfill both matched 0 rows — there were no dangling links to clear.
- [ ] DASH-07 — confirm the revenue headline equals the sum of the chart across a week/month boundary
- [ ] Confirm dashboard job counts match the Jobs page after a bulk archive
- [ ] Confirm the overdue banner count equals the row count on `/invoices?status=overdue`
- [ ] REP-02 — confirm the "previous period" line on `/reports` plots the period immediately before the selected one (alignment is proven; the *numbers* have never been seen)
- [ ] Confirm `/reports` booking and customer totals now match their list pages after a bulk archive
- [ ] Walk `/book/shihab-housing` end-to-end: submit → confirm → convert → cancel. Emails will 403 until a Resend domain is verified, so check the DB rows and `booking_activities` timeline rather than the inbox
- [ ] Create a booking + a calendar event on the same day, then confirm the portal stops offering those hours (BOOK-21 — occupancy across all three sources, the finding with no data to exercise it yet)
- [ ] Raise Booking Capacity above 1 in Settings → Scheduling and confirm a slot stays sellable until that many things overlap it
- [ ] Set `INTERNAL_PROXY_SECRET` in both env files, then confirm two browsers on different IPs get separate rate-limit buckets

### Storage Buckets — Remaining (blocked on R2, see [[decisions|ADR-001]])
- [ ] Create the `quotes` prefix/bucket in Cloudflare R2 (quote PDFs)
- [ ] Create the `job-attachments` prefix/bucket in Cloudflare R2 (job photos + documents)

### Unified List Page Migration (2026-04-04)
Migrating all dashboard list pages to the Unified List Page Pattern (see `docs/design.md`).
- [x] Reusable components created: `SearchInput`, `StatusFilterTabs`, `PageHeader`
- [x] `StatsCards` updated with `filterValue` prop support
- [ ] Customers page — migrated to unified pattern
- [ ] Invoices page — migrated to unified pattern
- [ ] Quotes page — migrated to unified pattern
- [ ] Bookings page — migrated to unified pattern
- [ ] Assets page — migrated to unified pattern
- [ ] Catalog page — migrated to unified pattern
- [ ] Checklists page — migrated to unified pattern
- [ ] Service Agreements page — migrated to unified pattern

### Chatbot Upgrade to AI (2026-04-04)
- [ ] Migrated from `compromise` NLP to Groq LLM (`llama-3.3-70b-versatile`) with Vercel AI SDK v6
- [ ] 10 AI tools: greet, answer_help, create customer/event/job/invoice/quote/catalog_item/equipment/booking

### Design System Docs (2026-04-04)
- [ ] Update `docs/project_docs/REPO_MAP.md` with new files

---

## Backlog

### Post-Neon Cleanup (2026-07-26)

- [ ] **Provision Cloudflare R2 and fill in the credentials** — code is done and the API boots without it, but uploads fail until set. Create two buckets (public + private; see [[decisions|ADR-001]] for why two), then set `R2_*` in the root `.env` and `NEXT_PUBLIC_R2_PUBLIC_URL` in `apps/web/.env.local`. The startup banner reports whether it is configured.
- [ ] **Verify a real sender domain in Resend** — API key is valid but the account has zero verified domains and `RESEND_FROM_EMAIL` is still `noreply@yourdomain.com`. Every send 403s until this is done; the API startup banner warns about it.
- [ ] **Set `ADMIN_SEED_EMAIL` to a real address, then run `pnpm seed:admin`** — the Neon database has no users yet.
- [ ] **Reconcile `supabase/migrations/`** — 32 of 42 files are missing from `meta/_journal.json`, so `db:migrate` skips them. Either re-baseline the journal or move the hand-written SQL somewhere it can't be mistaken for a tracked migration. (Folder name is now a misnomer — Supabase is gone.)
- [ ] **Declare `env` keys in `turbo.json`** — no task declares any, so hosted builds (env from the platform, not a file) can cache-hit stale and inline a wrong `NEXT_PUBLIC_API_URL`.
- [ ] **End-to-end test the SSE stream with a real session** — the event bus is unit-verified (routing, tenant isolation, unsubscribe) and `/events` correctly 401s unauthenticated, but no authenticated browser round-trip has been run because the database has no users yet.

### Deferred / Blocked

- [ ] **E-01 Welcome Email** — needs org creation refactor
- [ ] **E-11 Welcome Paid Email** — needs Lemon Squeezy webhook
- [ ] **Billing/Subscription** — Lemon Squeezy subscription management in settings
- [ ] **Affiliate Program** (#13) — Lemon Squeezy integration, referral tracking, affiliate dashboard

### Future Ideas

_(Add items here as they come up)_

---

## Completed

- [x] **Landing Page Redesign + Navbar Rebuild** (2026-07-31) — Rebuilt `/` end-to-end and retuned the
      global colour tokens. Fixed by measurement: **491px of horizontal overflow** on a 390px viewport
      (the industry tab strip was an `overflow-x-auto` inside a grid item, which never clips because
      grid items default to `min-width: auto`); a **24px hamburger**; a **mobile scroll lock that did
      nothing** — `body { overflow: hidden }` is a no-op because globals.css makes `<html>` the
      scroller, which turned out to affect **every Dialog and Sheet in the app** and is now fixed once
      via `html:has(body[data-scroll-locked])`; and a **dark-mode elevation inversion** where `--card`
      (10%) sat below `--surface-alt` (12%), so cards sank into the sections behind them. Neutrals are
      now a warm ramp that ascends `background ≤ surface < surface-alt < card` in both themes — brand
      orange is untouched, so the dashboard stays in sync. Design: the MacBook mockup and animated
      aurora are gone (with the `react-device-frameset` dependency); the hero is a live time-ruled
      **day sheet**, and a ruled work-order header is the page's structural device. The rotating word
      left the `<h1>` (layout shift on the largest text). Rebuilt on shadcn throughout — mobile menu is
      a `Sheet` (focus trap, Escape, overlay), industries are `Tabs` (roving focus), the replacement
      costs are a real `Table` that totals. Also: scroll-reveal moved off framer-motion to CSS scoped
      to `html.js` so a slow bundle can no longer render a blank page; `scroll-margin-top` so anchors
      clear the navbar; JSON-LD rating aligned to the visible page; dead footer links removed; **5 dead
      CSS utilities deleted** (0 consumers). Page height 8532px → 7045px, horizontal overflow 491px → 0.
      `tsc` clean, production build green.
- [x] **Customers Audit + Full Remediation** (2026-07-27) — Audited `/customers` and `/customers/[id]` ([[customers|report]]), found 35 issues, fixed all 35. Critical: the delete guard counted only *non-archived* jobs while `jobs.customer_id` is `ON DELETE CASCADE`, so archiving a job — the move the product recommends as safe — hid it from the guard but not the cascade, and deleting the customer **destroyed it silently while reporting success**; the whole detail page had no error state, so a 500 rendered as "No outstanding invoices"; and every bulk action toasted success for records the server had refused. That last one was never a customers bug — **22 endpoints across 7 domains return `{succeeded, failed, errors}` and none returns the `message` all 23 hooks read**, so it was fixed once in `lib/bulk-toast.ts`. Structural: `lib/phone.ts` retires four divergent copies whose input helper truncated at ten digits and destroyed every non-NANP number (`+44 20 7946 0958` → `4420794609`); `GET /customers/:id/summary` replaces five list fetches reduced in the browser, where "Outstanding" was the sum of whichever invoices fell on page one; `lib/search.ts` carries `escapeLike` out of `routes/jobs`. Also: tags became reachable (`?tagId=`, chips in the table, click to filter) after being fully built and unusable, bounded+validated schemas on the domain that feeds every PDF and email, `''`→`NULL` on both verbs, tenant timezone on the "upcoming" cutoff, sort UI, keyboard-reachable rows, tab state in the URL, note-delete confirmation, 5 activity types that had been silent, two dead panels and a dead hook deleted. Verified 28/28 by execution against Neon, `tsc` clean on both packages. 5 endpoints were undocumented; those plus 2 new ones are now written up. §4 of the report is the finding that matters most: **seven of eight remediation patterns from the previous three audits had never reached this page.**
- [x] **Bookings & Calendar Audit + Full Remediation** (2026-07-27) — Audited `/bookings`, `/schedule`, `/settings/bookings` and the public `/book/[slug]` portal together ([[bookings-calendar|report]]), found 34 issues, fixed all 34. Critical: a failed convert-to-job returned `reply.send(...)` from a `.catch()`, and reply objects are truthy, so `if (!job) return` never fired — an impatient double-click emailed the customer a **second confirmation**, logged a `job_created` event for a job that didn't exist, and double-sent the reply (the same bug in the public submit route threw a `TypeError` after the 409 was already out); the portal prefetched slots for every open date in three months = **51 requests, 51% of the production rate limit, per page load**, all keyed to one IP because they go through server actions; three tenant-scoped writes had no `tenantId`; and the *authenticated* booking schema accepted `bookingDate: "infinity"` while the public one had been hardened in April. The structural fix is `services/availability.service.ts` — one resolver for "is the business open, is that slot free" now used by the portal, the calendar and dashboard rescheduling, collapsing four findings (portal ignored jobs and events, calendar ignored date overrides, reschedule validated nothing, end-time minutes were discarded) into one implementation. Also: `convertedToJobId` finally written + backfilled (the April log claimed it was), FK on `jobs.booking_id`, bulk-delete refuses converted bookings, one status-transition table shared by single and bulk, per-tenant slot capacity, `lib/entity-links.ts` ending the third recurrence of the `?booking=` vs `?bookingId=` mismatch, `lib/tenant-time.ts` so the calendar stops rendering in browser time, the `booking_activities` timeline that had been writing rows since April with no reader, Active/Archived tabs, E-14 cancellation email, and route-level rate limits with authenticated client-IP forwarding. Verified 105/105 by execution (slots, control flow, status machine, Zod probes, tenant-filter scan), `tsc` clean. Swept the 5 tenant-filter violations found outside scope; 0 remain repo-wide. Calendar-events endpoints were undocumented — now written up.
- [x] **Reports Audit + Full Remediation** (2026-07-27) — Audited `/reports` end-to-end ([[reports-page|report]]), found 28 issues, fixed all 28. Critical: a failed request rendered as "No data available for this period" (a 500 read as "you earned nothing this quarter"); the previous-period comparison zipped two `generate_series` results *by index* so "Last month" plotted March against January and dropped February; the CSV export was an OWASP formula-injection vector reachable from the unauthenticated booking portal (now [[security-rules]] §7). Also: new `queries/buckets.ts` gives every trend day/week/month granularity ("Last 7 days" was a one-bar chart), a bucket-aligned `compareFrom`/`compareTo` window that makes the comparison line and the KPI deltas agree, `archived_at` filters on booking/customer/invoice/quote analytics (the Jobs tab already had them, so one page applied two rules), tenant timezone in `getActiveVsInactiveCustomers` and every `created_at` boundary, the two hardcoded-zero KPI fields computed, the whole data path typed as a union discriminated on `section` (was `any` + five casts), per-card error boundaries, sr-only tables on 13 charts, SSR prefetch, a complete CSV with BOM and the range in the filename, and drill-through to `/customers/:id`. `WidgetErrorBoundary`, `ChartDataTable` and `LoadErrorState` moved to `components/reusable/`. Verified 134/134 SQL + date-maths against Neon, 31/31 CSV, 5/5 endpoint contract. The API docs for this page described six endpoints that never existed — rewritten.
- [x] **Dashboard Audit + Full Remediation** (2026-07-27) — Audited `/dashboard` end-to-end ([[dashboard|report]]), found 29 issues, fixed all 29. Critical: unhandled rejection in the analytics cache's background revalidate could kill the API process; agenda rendered every job at "12:00 AM" (`parseISO` on a Postgres `time` column); `initialData` seeded every query key so changing the date range showed stale data and never refetched. Also: tenant timezone plumbed end-to-end (was UTC everywhere despite `tenants.timezone` existing), one definition of "overdue" derived from `due_date` across dashboard + invoice list + stats, revenue chart clamped to the requested window, uniform `archived_at` filtering, priority colours keyed off the real DB enum (`emergency` had rendered identically to `standard`), query fan-out 27→21 by deleting unused payload, new `GET /dashboard/pipeline`, cache gained in-flight dedup + a size bound + write invalidation via one `onResponse` hook, per-widget error boundaries, chart a11y tables, drill-through links (which required teaching Jobs/Invoices/Quotes to read filter params, and fixed a pre-existing bug where agenda rows never opened their detail sheet). Default widget set trimmed 11→6.
- [x] **Dashboard Redesign** (2026-04-17) — New widget set (KpiPill trio, RevenueRangeChart with 1D–ALL tabs, JobsManagementPanel, RetentionChart, AgendaTimeline, RevenueByServiceChart, TopCustomersCard), CustomizeWidgetsPopover + localStorage prefs, agenda folded into `/dashboard/stats` to kill a 3-call waterfall.
- [x] **Drop Supabase: R2 Storage + SSE Realtime** (2026-07-26) — Removed Supabase entirely ([[decisions|ADR-001]]). Storage → Cloudflare R2 via `@aws-sdk/client-s3` (new `apps/api/src/lib/storage.ts`, 9 call sites across jobs/invoices/quotes/tenants, two buckets for public/private separation). Realtime → SSE: new `lib/event-bus.ts` + `GET /events`, replacing 5 broadcast senders and 6 browser listeners with a shared `EventSource` (`lib/event-stream.ts` + `hooks/use-event-stream.ts`). Deleted `packages/database/src/supabase.ts` and `apps/web/src/lib/supabase-client.ts`, dropped `@supabase/supabase-js` from both packages. Fixed two latent bugs found on the way: the impersonation indicator listened on a channel nothing published to, and Supabase channels had no authorization (any user could listen to any tenant) — `/events` now scopes by session and gates cross-tenant access to admins.
- [x] **Neon Migration + Env Audit** (2026-07-26) — Moved `DATABASE_URL` from the deleted Supabase project to Neon (PostgreSQL 18.4); `db:push` created 50 tables, then applied the 2 unjournaled trigger migrations by hand (4 functions, 12 triggers). Split env by boundary: root `.env` = backend only, `apps/web/.env.local` = frontend only; rewrote both `.env.example` files and added `apps/web/.env.example`. Added Zod env validation for web (`apps/web/src/lib/env.ts`) + `experimental.instrumentationHook` so it runs at boot. Fixed `@types/react` v19→v18 in `apps/api` (unblocked `pnpm build`/`typecheck`, 167→0 errors), `/health` returning 500 on a raw JSON Schema, `seed-admin` bypassing the shared `passwordSchema`, and the placeholder `RESEND_FROM_EMAIL` default.
- [x] **TanStack Query Migration (Phases 1-4)** (2026-04-15) — Full client-side data layer: QueryClientProvider, centralized query keys, 18 reusable hook files (queries + mutations), all 14 page-clients migrated to reusable hooks, global background refetch indicator, hover-prefetch on 4 tables, pagination prefetch on 9 pages, staleTime tuning per domain. Conversations page deferred (Supabase Realtime architecture).
- [x] **Public Quote Acceptance Portal** (2026-04-11) — DB migration, public API (3 endpoints), email template, public quote page with review/respond/scheduling/confirmation steps, server actions, settings UI, quote detail UI. Manual step remaining: create `quotes` Supabase Storage bucket.
- [x] **EntityDetailShell Refactor** (2026-04-04) — Extracted reusable entity detail shell from 4 duplicated files. Removed ~1,350 lines of duplication.
- [x] **Job Photo & File Attachment System** (2026-04-05) — Full upload UI, tag pills, lightbox, before/after comparison, customer photo timeline, invoice photo selector. Manual step remaining: create `job-attachments` Supabase Storage bucket.
- [x] **Deferred Tenant Fixes (DF-TEN-01 to 12)** (2026-04-14) — Fixed 11 of 12 deferred tenant issues: idempotent /tenants/initialize with onConflictDoNothing, admin slug uniqueness check + format validation, max lengths on all text fields, HTML tag stripping for email/PDF-rendered fields, defaultTaxRate coercion, logo MIME allowlist (blocks SVG), filename path traversal prevention. DF-TEN-11 (slug redirect warning) deferred as low-priority UI concern.
- [x] **Jobs Page & Conversion Flow Audit Fixes** (2026-04-13) — Fixed 28 bugs across 6 phases: frontend stale data (refreshBothViews helper, pipelineChangingRef guard), optimistic update snapshot timing, line item numeric validation, time ordering validation, delete confirmation, SSR hydration mismatch, loading flash, timezone normalization, empty states for 0 stages/0 pipelines, dynamic import fallback, externally-deleted-job handling in detail sheet, duplicate invoice prevention (void-aware), dead code removal in quotes route.
- [x] **Job API Route Audit Fixes** (2026-04-13) — Fixed 22 issues across 5 phases: schema enum mismatches (priority, itemType, status), status transition state machine, bulk checklist gate, assignee/pipeline tenant validation, archived job guards, storage bucket fix, LIKE escaping, reorder transaction, tenantId defense-in-depth. Frontend: Active/Archived tabs with bulk archive/restore in jobs table view.
- [x] **Bulk Actions for List Pages** (2026-04-10) — Full-stack bulk operations across all 8 list pages. DB: `archived_at` column on 6 tables (customers, jobs, invoices, quotes, bookings, equipment) with partial indexes. API: 28 new bulk endpoints (archive/restore/delete/status-update/toggle-active) with filter-then-execute pattern and partial failure reporting. Frontend: `useRowSelection` hook, `BulkActionBar` floating bar, `BulkConfirmDialog`, checkbox columns on all 8 tables, Active/Archived filter tabs. Shared Zod schemas in `apps/api/src/lib/schemas/bulk.ts`.
- [x] **Customer-to-Job Flow Fixes** (2026-04-13) — Pre-delete cascade guard (single + bulk), booking→job atomic transaction with `SELECT FOR UPDATE` row lock, case-insensitive email match, tenant ownership validation for pre-linked customerId, customer jobs tab pagination (20/page), customer picker lazy fetch.
- [x] **Conversations Page** (2026-04-06) — Chat-app-style email messaging with customers. Two-panel layout (conversation list + thread), real-time updates via Supabase Realtime, desktop browser notifications with Settings toggle, SMS placeholder ("Coming Soon"), in-app `message_received` notifications.
- [x] **Job Assignee Feature** (2026-04-07) — Full-stack: DB migration, Drizzle schema, API (GET/POST/PATCH + new GET /jobs/assignees), AssigneePicker component, kanban card avatar, create dialog, detail sheet inline picker. Fixed all 548 pre-existing TypeScript errors by migrating all 29 route files from `FastifyInstance` → `FastifyPluginAsyncZod`.
- [x] **Zod Schema Migration** (2026-04-05) — Added Zod schemas to all ~178 API route handlers across 17 domains. Created 16 schema files in `apps/api/src/lib/schemas/`. Removed all `request.body as Record<string, unknown>` casts. Updated CLAUDE.md with mandatory Zod rules.

### Phase 1 Features (Build Order)

All 14 Phase 1 features have been implemented:

| # | Feature | Status | Completed |
|---|---------|--------|-----------|
| 1 | Organization/Tenant creation flow | Done | — |
| 2 | Customer CRUD | Done | — |
| 3 | Service Catalog + Settings | Done | — |
| 4 | Job Management (Kanban) | Done | — |
| 5 | Invoicing | Done | — |
| 6 | Quote Builder | Done | — |
| 7 | KPI Dashboard | Done | — |
| 8 | Booking Portal | Done | — |
| 9 | Calendar/Schedule View | Done | — |
| 10 | Checklists | Done | — |
| 11 | Super Admin Panel (4 phases) | Done | — |
| 12 | Email Templates (14 templates) | Done | — |
| 13 | Affiliate Program | Deferred | Needs Lemon Squeezy |
| 14 | Settings Pages | Done | — |

### Recent Milestones

- [x] **Booking & Tenant Flow Audit** (2026-04-13) — Full E2E audit of public booking submit, booking→customer linking, booking→job conversion, schedule/availability, tenant init/settings/slug/logo. 38 issues logged across `deferred-fixes/bookings.md` (26 issues) and `deferred-fixes/tenants.md` (12 issues).
- [x] **Page Header + Nav Cleanup** (2026-04-04) — Added PageHeader component to all list pages, removed duplicate titles from navbar
- [x] **Performance Optimization** (2026-04-04) — Server-side prefetch, batch stats endpoints, loading skeletons, dynamic imports for heavy libs
- [x] **Jobs Kanban Board Redesign** (2026-04-04) — Full visual redesign: new pipeline-tabs, badge-forward cards, pill-style column headers, motion.div stagger, AnimatePresence cross-fade
- [x] **Reports/Analytics Page + Frontend Migration** (2026-04-03) — 5-tab reports (revenue, jobs, customers, quotes/invoices, bookings) with Recharts, CSV export, date range picker
- [x] **Multi-Pipeline Feature** (2026-04-03) — Multiple pipelines per tenant, pipeline CRUD, scoped Kanban/table views, settings management
- [x] **Job Photo & File Attachment System** (2026-04-05) — Full upload UI (photo + document), tag pills (before/after/general), lightbox, before/after comparison, customer photo timeline, invoice photo selector. Vertical-agnostic — works for every trade on the platform.
- [x] **Security Hardening** (2026-04-02) — Fixed IDOR vulnerabilities, added rate limiting, Zod validation on all inputs
- [x] **Landing Page Redesign** (2026-04-02) — Full visual overhaul
- [x] **Help Chatbot** (2026-04-02) — Floating chat widget, knowledge base, AI tool calling via Groq
- [x] **Multi-Channel Notifications** (2026-04-01) — In-app (Supabase Realtime) + email, NotificationBell UI, preferences page
- [x] **Assets & Service Agreements** (2026-04-01) — Equipment/asset CRUD, service agreements, customer tab integration, refrigerant logs
- [x] **Email Templates** (2026-03-31) — 14 React Email templates, cron jobs for overdue/renewal/trial, team invitation template
- [x] **Team Management** (2026-03-31) — Better Auth org plugin, roles (owner/admin/member), invitations, team settings page
- [x] **Super Admin Panel** (2026-03-30) — 4 phases: tenant management, analytics/dashboard, support/search/audit, system health/affiliates, ghost + visible impersonation
- [x] **Enterprise UI/UX Overhaul** (2026-03-30) — Stats card headers, grouped sidebar, action buttons in toolbars, badge system
- [x] **Calendar/Schedule View** (2026-03-29) — Month/Week/Day views, drag-to-reschedule, availability overlay, filters
- [x] **Booking Portal** (2026-03-28) — Public `/book/[slug]` portal, dashboard bookings management
- [x] **KPI Dashboard** (2026-03-27) — Revenue chart, job pipeline chart, activity feed, overdue alerts
- [x] **Quote Builder** (2026-03-26) — 13 endpoints, PDF, send/accept/decline, convert-to-job, activity timeline, 16 bug fixes
- [x] **Invoicing** (2026-03-25) — 15 endpoints, PDF generation, payments, generate-from-job
- [x] **Custom Pipeline Stages** (2026-03-24) — Per-tenant Kanban columns, color presets, drag reorder
- [x] **Job Management (Kanban)** — 15 endpoints, drag-drop, 5-tab detail sheet, line items, checklist, photos
- [x] **Service Catalog + Settings** — Catalog CRUD, settings layout, profile/password forms
- [x] **Customer Detail Page** — 3-panel layout, inline editing, tags, notes, activity log
- [x] **Customer CRUD** — API routes, server actions, dashboard table, search, pagination
- [x] **Organization/Tenant creation** — Auto-creates tenant + subscription on org creation
- [x] **Better Auth migration** — Replaced Supabase Auth with Better Auth (unified auth)
- [x] **Frontend foundation** — Next.js 14, Tailwind, shadcn/ui, auth pages, middleware
- [x] **Landing page** — Hero, features, pricing, FAQ, testimonials
- [x] **API foundation** — Fastify server, CORS, Swagger, env validation, Drizzle ORM
