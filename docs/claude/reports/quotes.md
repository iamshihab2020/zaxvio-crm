# Quotes — Page Report

> Related: [[reports/README|Page Reports]] | [[invoices]] | [[jobs]] | [[customers]] | [[bookings-calendar]] | [[dashboard]] | [[reports-page]] | [[strict-rules]] | [[api-rules]] | [[security-rules]] | [[todo]]

**Audited:** 2026-08-01
**Scope:** `/quotes`, `/quotes/[id]`, the quote detail sheet, `/settings/quotes`, the public `/quote/[token]` acceptance portal, `routes/quotes` (19 endpoints), `routes/public/quote.ts` (3 endpoints), the quote PDF, `lib/quote-to-job.ts`, and the E-13 email path.
**Findings:** 35 — 4 critical (P1), 12 high (P2), 13 medium (P3), 6 low (P4).
**Status: all 35 fixed (2026-08-01).** Remediation record in §8.

> **Method note.** Unlike [[invoices]], this audit *was* verified by execution: 24
> checks against the live Neon database plus Zod and JS probes. 6 pass, 18 fail —
> and a fail confirms the finding, because every check asserts the correct
> behaviour. Three checks initially reported a false **pass**: the fixture
> `customerId` was `00000000-…-0001`, which Zod's `.uuid()` rejects (version
> nibble `0`), so the probe died on the customer field and never reached the date
> field it was testing. Re-run with a real v4 UUID, all three fail. §6 records the
> corrected results.

---

## 1. Scope & method

| Layer | Files |
|---|---|
| Routes | `app/(dashboard)/quotes/{page,quotes-page-client,loading}.tsx`, `[id]/{page,quote-detail-client,loading}.tsx`, `app/(dashboard)/settings/quotes/*`, `app/quote/[token]/{page,layout,quote-acceptance-client}.tsx` |
| Components | `components/dashboard/quotes/` — 11 files (table, create dialog, detail sheet, header, 2 tabs, info/sidebar/tabs panels, activity tab, status badge); `components/quote-portal/` — 4 files |
| Data layer | `hooks/queries/use-quotes.ts` (13 hooks), `actions/quotes.ts` (19 actions), `actions/public-quote.ts` (3), `lib/query-keys.ts` |
| API | `apps/api/src/routes/quotes/index.ts` (19 handlers, 1447 lines), `routes/public/quote.ts` (3 handlers, 411 lines) |
| Schemas | `lib/schemas/quotes.ts`, `lib/schemas/public-quote.ts`, `lib/schemas/common.ts`, `lib/schemas/bulk.ts` |
| Shared | `lib/quote-to-job.ts`, `lib/pdf/{quote-pdf.tsx,generate-quote-pdf.ts}`, `lib/line-items.ts`, `lib/search.ts`, `packages/email/src/templates/e13-quote.tsx` |
| Database | `packages/database/src/schema/{quotes,quote-activities,tenants,jobs}.ts` |
| Docs | `api-docs/API_DOCUMENTATION_2.md` §Quotes, `reference/REPO_MAP_*`, `lib/chatbot/knowledge-base.ts` |

Method: read every file end to end, cross-check the layers against each other,
then **verify the load-bearing claims by execution** against the live Neon
database (tenant *Shihab Housing*, `America/Chicago`). All writes were wrapped in
a transaction that rolled back; the harness was deleted after the run. 24 checks.
See §6.

---

## 2. What has been built — and what is good

The quote domain is the only place in the product where an **unauthenticated
stranger changes the state of a tenant's record**, and a lot of it is handled
carefully.

| Area | Shipped |
|---|---|
| **List** | Search, 5 status tabs, Active/Archived tabs, sort popover (6 keys), pagination + next-page prefetch, bulk archive/restore/delete, 4 KPI cards that double as filters, deep link via `?quoteId=`, dual view (sheet / full page) with a persisted preference, live SSE refresh when a customer responds |
| **Detail** | Sheet (Details · Line Items) and a three-panel full page (info · tabs · sidebar), inline line-item editing gated to drafts, send, accept, decline, convert-to-job with stage picker, PDF |
| **API** | 19 authenticated endpoints + 3 public; activity timeline written on 8 event types |
| **Portal** | Branded review → respond → confirmation flow, expired view, already-responded view, decline-with-reason, post-acceptance booking hand-off |
| **Settings** | Three auto-saving toggles (online acceptance, post-acceptance scheduling, auto-convert) with a sensible cascade — turning acceptance off turns the dependent two off |

Five things are genuinely well done:

1. **`lib/quote-to-job.ts` is a real shared implementation.** One transaction,
   `SELECT … FOR UPDATE` on the quote, an `ALREADY_CONVERTED` sentinel, used by
   both the authenticated and the public path. This is the shape the
   [[bookings-calendar]] audit asked for, and it is the reason the accept race in
   QUO-03 produces duplicate *notifications* rather than duplicate *jobs*.
2. **The SSRF guard on the PDF logo propagated.** `withSafeLogo` is applied at
   both PDF call sites (`routes/quotes/index.ts:909`, `:1066`) with a comment
   naming INV-05. The invoices audit said it covered quotes as well; it does.
3. **`escapeLike` propagated.** `containsPattern` is used on all four search
   columns (`:177-180`). No unescaped `ilike` here.
4. **`lineItemDescription` propagated**, and the comment in `common.ts:88` records
   that quotes was the domain that had accepted an unbounded description.
   `resolveLineItemDescription` means a priced line never renders blank on the PDF.
5. **The portal renders dates correctly** — `new Date(dateStr + "T00:00:00")`
   (`quote-review-card.tsx:53`) is the local-midnight form. It is the *dashboard*
   that gets this wrong (QUO-10), which is the more unusual failure direction.

---

## 3. Findings

**Severity:** `P1` breaks correctness or availability · `P2` wrong or inconsistent
numbers · `P3` waste, drift, or a noticeable UX defect · `P4` polish.

| ID | Sev | Finding | Where |
|---|---|---|---|
| QUO-01 | P1 | `bulk-status-update` bypasses the whole status machine and permanently bricks quotes | `routes/quotes:1430` |
| QUO-02 | P1 | Jobs created from quotes sit outside the stage model — `stage_id` never written | `lib/quote-to-job.ts:128` |
| QUO-03 | P1 | Public accept/decline is an unserialised read-then-write; accept+decline race creates a job for a declined quote | `routes/public/quote.ts:224` |
| QUO-04 | P1 | `quoteOnlineAcceptanceEnabled` is never enforced on the public routes | `routes/public/quote.ts:35` |
| QUO-05 | P2 | No error state on the list or the KPIs — a 500 renders "No quotes yet" | `quotes-page-client.tsx:197` |
| QUO-06 | P2 | Detail sheet swallows the fetch error; `EntityDetailShell.loadError` unused | `quote-detail-sheet.tsx:95` |
| QUO-07 | P2 | Portal calls `notFound()` on a 500 or network error — the customer is told the estimate does not exist | `app/quote/[token]/page.tsx:29` |
| QUO-08 | P2 | `GET /quotes/stats` counts archived quotes the list hides | `routes/quotes:266` |
| QUO-09 | P2 | Auto-expire runs in UTC and writes on every read | `routes/quotes:55` |
| QUO-10 | P2 | Dashboard renders `date` columns in browser time — Jul 31 where the portal says Aug 1 | `quote-table.tsx:46` +2 |
| QUO-11 | P2 | Subtotal sums raw `quantity × unit_price`; the UI shows per-row rounded totals | `routes/quotes:99` |
| QUO-12 | P2 | No route-level rate limits on the three public endpoints | `routes/public/quote.ts` |
| QUO-13 | P2 | PDF opened as a raw API URL instead of a server action | `actions/quotes.ts:201` |
| QUO-14 | P2 | Server-rendered quotes, pagination and stats are passed and never used | `quotes-page-client.tsx:110` |
| QUO-15 | P2 | `useQuote` + 5 mutation hooks have 0 callers; every mutation bypasses the cache | `use-quotes.ts:38` |
| QUO-16 | P2 | Deep link to `/quotes/[id]` bounces back to the list (JOB-38 verbatim) | `quote-detail-client.tsx:27` |
| QUO-17 | P3 | `issuedDate` / `expiryDate` accept `infinity`, `today`, `2026-02-30` | `schemas/quotes.ts:24` |
| QUO-18 | P3 | Line-item numerics unvalidated — `1e15`, `-5`, `abc` all reach Postgres | `schemas/quotes.ts:42` |
| QUO-19 | P3 | `PATCH` line-item accepts any `itemType`; `POST` guards it | `routes/quotes:735` |
| QUO-20 | P3 | `notes` unbounded on both verbs | `schemas/quotes.ts:28` |
| QUO-21 | P3 | `acceptQuoteBody.scheduledDate` is regex-only — `2026-13-45` passes | `schemas/public-quote.ts:8` |
| QUO-22 | P3 | `equipmentId` is never validated as belonging to the tenant | `routes/quotes:442` |
| QUO-23 | P3 | Archived quotes stay fully editable, sendable and acceptable | `routes/quotes:471` |
| QUO-24 | P3 | `access_token`: no index, no unique constraint, never rotated or revoked | `schema/quotes.ts:53` |
| QUO-25 | P3 | `quote_line_items` has no index at all; `quotes` has none on `archived_at` | `schema/quotes.ts:73` |
| QUO-26 | P3 | Customer scheduling is built end-to-end on the server and unreachable in the portal | `quote-acceptance-client.tsx:97` |
| QUO-27 | P3 | `pipelineStageId` is not checked against the job's own pipeline | `lib/quote-to-job.ts:91` |
| QUO-28 | P3 | No transactions on create, line-item write + recalculation, or send | `routes/quotes:431` |
| QUO-29 | P3 | Bulk endpoints report `ids.length`, not rows affected; `bulkToast` is defeated by the server `message` | `routes/quotes:1350` |
| QUO-30 | P3 | No service layer — 1447 lines of business logic in the route file ([[api-rules]] §1) | `routes/quotes/index.ts` |
| QUO-31 | P3 | Public portal is indexable — the root layout sets `robots: index` and nothing overrides it | `app/layout.tsx:47` |
| QUO-32 | P4 | Create re-fetches a row `RETURNING` already carried | `routes/quotes:447` |
| QUO-33 | P4 | `getQuotePdfUrl` is a server action that concatenates a string | `actions/quotes.ts:201` |
| QUO-34 | P4 | Portal fetches the quote twice per page load | `app/quote/[token]/page.tsx:12` |
| QUO-35 | P4 | `as never` × 13 across the route file and `as never[]` in `page.tsx` ([[strict-rules]] §4) | `routes/quotes:62` |
| QUO-36 | P4 | 7 of 22 endpoints undocumented; customer PII in the booking prefill query string | `api-docs/API_DOCUMENTATION_2.md` |

### 3.1 Critical (P1)

#### QUO-01 · `bulk-status-update` bypasses the status machine and bricks quotes `P1`

`POST /quotes/bulk-status-update` (`routes/quotes/index.ts:1430-1445`) is four
lines: one `UPDATE` setting any of the five statuses on any set of ids. It checks
no current status, no transition, no archived flag, and writes no activity row and
no notification.

Every single-quote transition is guarded — `draft → sent` only via `/send`
(`:852`), `sent → accepted` (`:1104`), `sent → declined` (`:1158`). The bulk
endpoint reaches all of them for free.

The damage is not that a status is wrong; it is that **`sent` is not just a
status**. `/send` is what generates the PDF, uploads it, mints the `access_token`
and emails the customer (`:899-977`). A quote flipped to `sent` by the bulk
endpoint has `access_token = NULL` and `pdf_storage_path = NULL` — and `/send`
now refuses it, because `/send` only accepts drafts. `PATCH` refuses it too, for
the same reason. The quote can no longer be edited, sent, or given a portal link.
The only recovery is to delete it — and `DELETE` also only accepts drafts. It
cannot be deleted either. **Verified (C6).**

The endpoint has no caller in the UI (`bulkUpdateQuoteStatus` in
`actions/quotes.ts:481` is dead code), which is why this has not been reported.
It is reachable by any authenticated user of any tenant.

#### QUO-02 · Jobs created from quotes sit outside the stage model `P1`

The [[jobs]] audit's Phase 1 split `jobs.status` into a validated pointer and a
denormalised name: `job_pipeline_stages.lifecycle` says which of the four real
statuses a stage represents, **`jobs.stage_id` is the pointer**, and `jobs.status`
is only ever written from a stage resolved through
`services/job-stages.service.ts` — "the one place a job changes column".

`lib/quote-to-job.ts:128-143` inserts a job with `status: jobStatus` and **no
`stage_id` at all**. It never calls the service. `jobStatus` is a bare string,
defaulted to the literal `"scheduled"` (`:90`) and overwritten with a stage
*name* read directly from the table (`:102`, `:111`).

`grep -l stageId apps/api/src` returns six files. `quote-to-job.ts` is not one of
them. Both conversion entry points — authenticated `POST /quotes/:id/convert` and
the public auto-convert on accept — go through it. **Verified (C4): `stage_id=null`.**

Consequences, in order of how quickly a tenant meets them:

- **The pipeline stage counts undercount.** `/settings/pipelines` counts jobs with
  `WHERE j.stage_id = job_pipeline_stages.id` (`routes/pipeline-stages/index.ts:196`
  — the query JOB-28 was written to fix). Every quote-converted job counts as
  zero. **Verified (C5): stage-keyed count = 0 for a freshly converted job.**
- **The lifecycle filter never matches them.** `GET /jobs?lifecycle=…` resolves
  through `inArray(jobs.stageId, …)` (`routes/jobs/index.ts:249-267`). A converted
  job matches no lifecycle filter, ever.
- **Deleting a stage strands them.** Stage deletion rehomes jobs by `stage_id`
  (`routes/pipeline-stages/index.ts:383`), so a converted job is not rehomed — but
  it still carries the deleted stage's *name* in `status`, and the board groups by
  `j.status === stage.name` (`kanban-board.tsx:79`). The job renders in no column.
- **With no default pipeline it is born stranded**: `pipelineId` is `null` and
  `status` is the literal `"scheduled"`, which is a *lifecycle* value, not
  necessarily any stage name this tenant has.

#### QUO-03 · Public accept/decline is an unserialised read-then-write `P1`

`POST /public/quote/:token/accept` (`routes/public/quote.ts:224-317`) resolves the
quote, checks `status !== "sent"`, then updates — with no transaction and no row
lock. Decline (`:334-407`) is the same shape. Four separate operations follow the
check: the status update, the activity insert, the notification, and the
auto-convert.

Two concurrent requests both read `sent` and both proceed. The realistic
sequences:

- **Double-click Accept** → two `quote.accepted` activity rows, two
  `quote_accepted` notifications, and two `convertQuoteToJob` calls. Only one job
  is created — `quote-to-job.ts` holds a `FOR UPDATE` lock and throws
  `ALREADY_CONVERTED` — but that error is caught and only `console.error`d
  (`:306-308`), so the second response still returns `200` with
  `jobCreated: false` while the first says `true`. The customer's screen shows
  whichever landed last.
- **Decline then Accept from two tabs** (or a mis-click corrected immediately).
  Both pass the `sent` check. If the accept commits its update first and the
  decline second, the quote ends as **`declined`** — but the accept path already
  ran `convertQuoteToJob`, so there is now a scheduled job, a `job.created`
  activity, and a checklist for a quote the record says the customer refused.
  Nothing reconciles them.

The fix is the one already written for this exact class in
`lib/quote-to-job.ts`: one transaction, `SELECT … FOR UPDATE`, re-read the status
inside the lock. The [[bookings-calendar]] audit fixed the same shape on the
public booking submit; the pattern did not reach here.

#### QUO-04 · The online-acceptance toggle is not enforced on the public routes `P1`

`tenants.quoteOnlineAcceptanceEnabled` is consulted in exactly one place in the
codebase: building the email link (`routes/quotes/index.ts:941`). Grep confirms
one non-settings consumer.

`resolveQuoteByToken` (`routes/public/quote.ts:35-87`) selects
`quotePostAcceptanceScheduling` and `quoteAutoConvertToJob` but **not**
`quoteOnlineAcceptanceEnabled`, and neither `GET`, `accept` nor `decline` checks
it. So turning the toggle off stops *new* emails carrying a link and changes
nothing else: every previously-issued link keeps rendering the quote and keeps
accepting responses.

The settings UI makes the intent unambiguous — switching it off force-disables
the two dependent toggles and persists them (`quote-settings-client.tsx:73-97`).
A tenant who turns off online acceptance because a price was wrong has been told
the door is shut. It is not.

### 3.2 High (P2)

#### QUO-05 · No error state on the list or the KPI cards `P2`

`quotes-page-client.tsx` never reads `quotesQuery.isError` or
`statsQuery.isError`. `quotes` falls back to `[]` (`:197`) and `stats` to
`{draft: 0, sent: 0, accepted: 0, declined: 0}` (`:201`). A failed request
therefore renders the `EmptyState` — *"No quotes yet — Create your first estimate"*
— or, if a filter is active, *"No quotes found for this filter"*, with four
zeroed KPI cards above it.

This is the finding fixed on [[dashboard]], [[reports-page]], [[customers]] and
[[invoices]]. `LoadErrorState` exists in `components/reusable/` and has zero
imports on this page.

#### QUO-06 · The detail sheet swallows its fetch error `P2`

`quote-detail-sheet.tsx:95-99`:

```ts
getQuote(quoteId).then((res) => {
  if (res.data) setQuote(res.data as QuoteDetail);
  setLoading(false);
});
```

No `.catch`, no error branch, and `res.error` is discarded. On a 500 the sheet
sets `hasData={false}` and renders the shell's empty path. The [[jobs]] audit
added `loadError` / `onRetry` to `EntityDetailShell` precisely because *"a shared
component, so all four detail sheets opened blank on a 500"*. The quote sheet
passes neither prop. The `/quotes/[id]` page has the same gap: `getQuote` is
called in the RSC and a failure produces a bare `notFound()`.

#### QUO-07 · The portal reports a server error as "Estimate Not Found" `P2`

`app/quote/[token]/page.tsx:29-31` calls `notFound()` whenever `result.data` is
falsy. `getPublicQuote` returns `{data: null}` for a 404, a 500 *and* a caught
network error (`actions/public-quote.ts:11-20`) — the three are indistinguishable
by the time the page sees them.

So when the API is down, a customer holding a valid link is told their estimate
does not exist. On a page whose entire purpose is to make a stranger trust the
document in front of them, "not found" is the worst available lie: it reads as
withdrawn. This is the 404-vs-500 split (`JobLoadError`, INV-11) on the one
surface where the reader is a paying customer rather than the operator.

#### QUO-08 · Stats count archived quotes the list hides `P2`

`GET /quotes/stats` (`routes/quotes/index.ts:266-292`) filters on `tenantId`
alone. `GET /quotes` filters on `archived_at IS NULL` unless `showArchived`
(`:172`). The KPI cards double as filters, so clicking *Sent: 3* can produce a
list of two. **Verified (C8): stats=1 vs list=0 after archiving the only sent quote.**

The stats endpoint also does not run the auto-expire pass that both list and
detail run, so a quote past its expiry is counted as `sent` in the cards and
displayed as `expired` in the row beneath them. And there is no `expired` count
at all, although `expired` is one of the five status tabs.

This is the uniform-`archived_at` rule from [[reports-page]] and the derived-status
rule from [[dashboard]], neither of which reached this endpoint. It is also
already an open verification item in [[todo]] for other pages.

#### QUO-09 · Auto-expire runs in UTC, and writes on every read `P2`

`autoExpireQuotes` (`routes/quotes/index.ts:55-70`) computes
`new Date().toISOString().split("T")[0]` — the **UTC** date — and expires every
`sent` quote whose `expiry_date` is earlier. `tenants.timezone` is not consulted;
`routes/public/quote.ts:100` repeats the same line.

**Verified (C3b)** at a fixed instant, `2026-08-02 02:00 UTC`: UTC date is
`2026-08-02`, Chicago date is `2026-08-01`; a quote expiring `2026-08-01` is
`expired_by_utc = true`, `expired_by_tenant = false`. For the tenant's evening —
6pm to midnight Central, which is when a homeowner actually sits down with an
estimate — a quote valid until today is already dead. The customer opens the link
and gets the expired view.

Separately, this is a write on a read path. It runs at the top of `GET /quotes`
(`:164`) and `GET /:id` (`:307`), so every list render and every detail open
issues an `UPDATE` against the whole tenant's quote table. The [[jobs]] audit
removed exactly this from `GET /pipeline-stages`. It belongs in the existing cron
alongside the overdue-invoice sweep, which already claims rows with
`UPDATE … RETURNING`.

#### QUO-10 · The dashboard and the portal print different dates for the same field `P2`

`quote-table.tsx:46`, `quote-info-panel.tsx:20`, `quote-detail-tab.tsx:31` and
`quote-activity-tab.tsx:54` all call `new Date(val).toLocaleDateString(...)` on a
bare `YYYY-MM-DD` from a Postgres `date` column. JS parses that form as **UTC
midnight**, so every negative-offset timezone renders the previous day.

Proven by execution with `TZ=America/Chicago` and `expiry_date = 2026-08-01`:

| Surface | Renders |
|---|---|
| Dashboard table / info panel / detail tab | **Jul 31, 2026** |
| Public portal (`quote-review-card.tsx:53`) | **Aug 1, 2026** |
| E-13 email (server-rendered, UTC) | Aug 1, 2026 |

The operator sees one expiry date; the customer and the emailed PDF see another.
`lib/tenant-time.ts` exists and `formatDateOnly` exists — `grep` finds **zero**
uses of either in `components/dashboard/quotes/` or `components/quote-portal/`,
and `formatMoney` is used by the invoices components only.

#### QUO-11 · Subtotal disagrees with the line totals the customer is shown `P2`

`recalculateQuoteTotals` sums `quantity * unit_price` raw
(`routes/quotes/index.ts:99`). Every UI surface renders `quote_line_items.total`,
a generated column typed `numeric(10,2)`, so Postgres rounds it **per row**.

Sum-of-rounded ≠ rounded-sum. **Verified (C1)**: two lines of `1.5 × 10.33` give
`SUM(quantity*unit_price) = 30.9900` against `SUM(total) = 31.00`. The quote shows
two lines of $15.50 above a subtotal of $30.99.

`quantity` is `numeric(10,2)`, so any fractional quantity — half an hour of
labour, 2.5 units of material — reaches three or four decimal places and triggers
this. The invoice service rounds at each step (`round2(subtotal)`,
`round2(subtotal * taxRate)`, `round2(...)` — `invoices.service.ts:95-99`);
quotes calls `.toFixed(2)` once at write time on three independently computed
floats. This is a money-model divergence between two documents that convert into
one another.

#### QUO-12 · The three public endpoints carry no route-level rate limit `P2`

`routes/public/booking.ts` sets `config: { rateLimit: … }` on five routes —
`READ_LIMIT`, `SUBMIT_LIMIT`, `STATUS_LIMIT` — with a comment explaining the
entropy/rate-limit reasoning for its own token route (`:494`). `routes/public/quote.ts`
sets none, on any of the three.

They inherit the global 100/min bucket (`server.ts:110`), so this is throttling,
not absence of throttling — but the two unauthenticated *mutations* in the
product sit at the same limit as a dashboard page load, and the same tightening
pass that produced BOOK's limits walked past this file. [[security-rules]] §4:
*"All public endpoints … MUST have rate limits via route-level config."*

#### QUO-13 · The PDF is opened as a raw API URL `P2`

`getQuotePdfUrl` returns `` `${API_URL}/quotes/${id}/pdf` `` (`actions/quotes.ts:201`)
and both the sheet and the header do `window.open(url)`
(`quote-detail-sheet.tsx:124`, `quote-detail-header.tsx:82`). The browser then
requests the API directly, cross-origin, and the session cookie does not ride
along under any normal cookie policy — the user gets a 401 body in a new tab.

Invoices fixed this (INV-41): `downloadInvoicePdf` is a server action that
fetches with the cookie header and hands back the bytes
(`actions/invoices.ts:264`, used by `invoice-detail-header.tsx:84` and the sheet).
Quotes was not migrated.

#### QUO-14 · The server-rendered payload is fetched, passed, and never used `P2`

`app/(dashboard)/quotes/page.tsx:12-25` awaits `getQuotes`, `getTenant` and
`getQuoteStats`, then passes `initialQuotes`, `initialPagination` and
`initialStats` into the client. The client destructures all three
(`quotes-page-client.tsx:110-115`) and **references none of them** — `quotes`
comes from `quotesQuery.data` (`:197`), `pagination` from the same (`:198`),
`stats` from `statsQuery.data` (`:200`). Only `defaultTaxRate` is used.

So every visit fetches the list and the stats twice and still renders
`TableSkeleton` while the client copy loads. This is INV-15 verbatim, which was
itself the [[jobs]] Phase 2 `initialData` finding. The fix there was to seed
`initialData` for the exact key the server rendered, with an honest
`initialDataUpdatedAt`.

#### QUO-15 · Six query hooks have no callers; every mutation bypasses the cache `P2`

`use-quotes.ts` defines `useQuote`, `useSendQuote`, `useAcceptQuote`,
`useUpdateQuote` and `useConvertQuoteToJob`. `grep` finds **zero** callers for
`useQuote` repo-wide, and the send/accept/decline/convert paths in both the sheet
(`:110-162`) and the header (`:68-115`) call the raw server actions instead.

The consequences are the ones the hooks exist to prevent:

- The sheet keeps the quote in `useState` and refetches by hand (`:101-105`); the
  `/quotes/[id]` page does the same (`quote-detail-client.tsx:40-44`). Opening the
  same quote five times is five fetches.
- `useConvertQuoteToJob` invalidates `jobs.all` and `dashboard.all` (`:146-148`).
  The code that actually converts invalidates nothing and navigates straight to
  `/jobs/[id]`. Return to `/jobs` and the board is stale — the new job is missing
  from the very list the user was sent to.
- On `/quotes/[id]` there is no `onDataChange` at all, so send/accept/decline
  there update nothing outside the page.

This is INV-17 (`useInvoice`, 0 callers) recurring with five more hooks.

#### QUO-16 · Deep-linking to `/quotes/[id]` bounces back to the list `P2`

`quote-detail-client.tsx:27-38` is two effects racing on one value: the first sets
the view preference to `"page"`, the second pushes to `/quotes?quoteId=…`
whenever the preference is not `"page"`. On mount both run in the same commit and
the second reads the pre-update value, so a user whose stored preference is the
sheet is redirected off the page immediately.

This is JOB-38, and the fix is in the tree three directories away:
`job-detail-client.tsx:51-68` guards both effects with an `adoptedPageMode` ref
and carries a comment explaining the race. The quotes copy was never updated.

### 3.3 Medium (P3)

**QUO-17 · Dates accept anything Postgres will parse.** `issuedDate` and
`expiryDate` are `z.string().optional()` on both create and update
(`schemas/quotes.ts:24-25`, `:35-36`). **Verified (A1/A2)**: `infinity`,
`-infinity`, `today`, `epoch`, `now`, `2026-02-30` and `2026-13-45` are all
accepted, on both verbs. **Verified (C2)**: `infinity` stores successfully in the
`date` column, after which the quote never expires (`lt(expiryDate, today)` is
never true) and renders as `Invalid Date` everywhere. `isoDate` exists in
`common.ts:45` with a comment describing this exact failure from BOOK-04;
`schemas/quotes.ts` imports `idParam`, `paginationQuery` and
`lineItemDescription` from that file and not `isoDate`.

**QUO-18 · Line-item numerics are unvalidated.** `quantity` and `unitPrice` are
optional bare strings (`schemas/quotes.ts:46-47`). **Verified (A4/A5/A8)**:
`1e15`, `-5` and `abc` all pass the schema. `1e15` overflows `numeric(10,2)` and
`abc` is not a number — both surface as a 500 rather than a 400. A negative
quantity is accepted all the way to the total.

**QUO-19 · `PATCH` on a line item accepts any `itemType`.** `POST` resolves it
through `isItemType` and 400s (`routes/quotes:659`). `PATCH` copies whatever is in
the body straight into the update (`:735-749`). **Verified (A6)**: the schema
accepts `"banana"`, which then hits the `item_type` pgEnum as a 500. The same
handler passes `catalogItemId` through without checking it belongs to the tenant.

**QUO-20 · `notes` is unbounded on both verbs.** **Verified (A3)**: a 100 KB
string is accepted. It renders into the PDF and the public portal.

**QUO-21 · `acceptQuoteBody.scheduledDate` is regex-only.** `^\d{4}-\d{2}-\d{2}$`
(`schemas/public-quote.ts:8`) admits `2026-13-45`. **Verified (A7).** The value is
written to `customer_scheduled_date` and then used as a job's `scheduledDate` by
`quote-to-job.ts:117`. `isoDate`'s `.refine` is the missing half.

**QUO-22 · `equipmentId` is never validated.** `POST /quotes` validates
`customerId` against the tenant (`:385-398`) and writes `equipmentId` straight
from the body (`:442`); `PATCH` allows it through the allowlist (`:527`) with no
check at all. `findForeignRef` was written for this class in the [[jobs]] audit
and closes four FKs there. Equipment belongs to a customer, so a mismatched id
puts another customer's serial number on the PDF.

**QUO-23 · Archived quotes are fully live.** No handler in the file reads
`archivedAt`. An archived draft can be edited, given line items, sent — mailing
the customer a quote the tenant has filed away — and an archived quote's portal
link keeps working, because `resolveQuoteByToken` does not filter on it either.
`loadEditableJob` / `loadEditableInvoice` are the established shape; there is no
`loadEditableQuote`.

**QUO-24 · The access token is unindexed, non-unique, and permanent.** The column
is plain nullable `text` (`schema/quotes.ts:53`). **Verified (B1)**: no index —
**(C9)** the portal's lookup is a `Seq Scan on quotes`, across every tenant's
quotes, on every unauthenticated page view. **Verified (B2)**: no unique
constraint, so a collision would silently hand one customer another's quote.
The token is minted once at send (`:918`) and never rotated or cleared, so the
link keeps returning the customer's name, email, phone, address and pricing
indefinitely — long after accept, decline, expiry or archive.

**QUO-25 · `quote_line_items` has no index at all.** **Verified (B3)**: primary
key only — **(C10)** `Seq Scan on quote_line_items` for the detail fetch, the PDF,
the send path and every recalculation. This is INV-33 exactly, one table over.
`quotes` also has no index on `archived_at` (**B7**) though every list filters on
it. `quote_activities` is correctly indexed (**B4**).

**QUO-26 · Customer scheduling is built and unreachable.** The column pair, the
API body, the activity metadata, the notification text, the conversion preference
in `quote-to-job.ts:115-122` and the detail-sheet fields all exist. The portal
calls `acceptPublicQuote(token)` with **no second argument**
(`quote-acceptance-client.tsx:97`) and `onAccept={() => handleAccept()}`
(`:219`) discards anything the buttons could pass. `postAcceptanceScheduling`
gates only a booking-portal link on the confirmation screen (`:234`). So
`customer_scheduled_date` is never written from the portal, and [[todo]]'s claim
of a *"scheduling"* step in this flow is not accurate.

**QUO-27 · `pipelineStageId` is not checked against the job's pipeline.**
`quote-to-job.ts:91-102` looks the stage up by id scoped to the tenant, but the
job's `pipelineId` is set from the tenant's **default** pipeline (`:87`). Passing
a stage from a non-default pipeline produces a job in pipeline A whose status
names a column that only exists in pipeline B — invisible on the board.

**QUO-28 · No transactions on the multi-statement writes.** `POST /quotes` is
insert → re-fetch → activity (`:431-452`); each line-item verb is write →
`recalculateQuoteTotals` (itself three statements) → activity; `/send` is upload →
update → re-fetch → activity → email. A failure part-way leaves a quote whose
stored totals do not match its line items. `POST /jobs` was made one transaction
in the [[jobs]] audit for the same reason.

**QUO-29 · Bulk endpoints report the request, not the result.** `bulk-archive` and
`bulk-restore` return `count: ids.length` (`:1350`, `:1377`) regardless of how
many rows matched — `bulk-restore` even has `isNotNull(archivedAt)` in its
`WHERE`, so restoring ten already-active quotes reports ten restored. Worse,
every quote bulk endpoint returns a `message`, and `bulkToast` is written as
`toast.success(res.message ?? fallback)` (`lib/bulk-toast.ts:61`) precisely
because *no* endpoint returned one. `bulk-delete` returns
`{message: "Bulk delete complete", deleted, errors}` with no `failed` count — so
`failed = 0`, the success branch wins, and the `errors` array explaining which
non-draft quotes were skipped is dropped. Selecting ten sent quotes and pressing
Delete reports success and deletes nothing. CUST-03, reintroduced by the one
domain that supplies a `message`.

**QUO-30 · No service layer.** `routes/quotes/index.ts` is 1447 lines containing
totals recalculation, the expiry sweep, PDF generation orchestration, email
dispatch and four bulk operations. [[api-rules]] §1 requires business logic in
`services/`. `services/` contains no quotes file. This is INV-31 unchanged —
invoices got `services/invoices/` in its remediation; quotes did not.

**QUO-31 · The public portal is indexable.** `app/layout.tsx:47` sets
`robots: { index: true, follow: true }` and `app/quote/[token]/layout.tsx` is a
seven-line passthrough that overrides nothing; `generateMetadata` sets only title
and description. A page carrying a customer's name, address, phone and itemised
pricing is explicitly inviting crawlers. Discovery requires the URL to leak —
referrers, link scanners, mail-client previews — but the correct posture for a
tokenised private document is `robots: { index: false, follow: false }`, one line.

### 3.4 Low (P4)

**QUO-32 · Create re-fetches what it already has.** `POST /quotes` inserts with
`.returning()` and then selects the same row again to pick up the trigger-generated
number (`:447-450`). **Verified (C7)**: the `RETURNING` row already carries
`QT-2026-0001` — the trigger is `BEFORE INSERT`. The second query is dead weight,
and `/send` (`:931`) and `PATCH` (`:552`) repeat the pattern.

**QUO-33 · A server action that concatenates a string.** `getQuotePdfUrl`
(`actions/quotes.ts:201`) is `"use server"` and `async`, and its whole body is a
template literal. Every PDF click pays a server round trip to build a URL the
client already had the parts for. (Superseded by fixing QUO-13.)

**QUO-34 · The portal fetches the quote twice.** `generateMetadata` and the page
component each call `getPublicQuote` (`app/quote/[token]/page.tsx:12`, `:27`) with
`cache: "no-store"` and no `React.cache` wrapper — two API calls per public page
view, each a `Seq Scan` (QUO-24).

**QUO-35 · `as never` × 13.** Every status write in the route file launders
through `as never` (`:62`, `:186`, `:925`, `:1113`, `:1167`, `:1440`, and the
public route's `:105`, `:251`, `:361`), and `page.tsx:20-21` casts the SSR payload
to `as never[]` / `as never`. [[strict-rules]] §4 forbids this. The [[jobs]] audit
noted that deleting one such cast surfaced a second untyped enum the compiler had
been hiding.

**QUO-36 · Docs and PII in a URL.** Seven of 22 endpoints are undocumented:
`GET /quotes/stats`, all four bulk endpoints, and all three public portal
endpoints (which appear only as a row in the SSE table of
`API_DOCUMENTATION_5.md:1038`). Separately, `buildBookingUrl`
(`quote-acceptance-client.tsx:82-92`) puts the customer's name, email, phone and
address into a query string, where they land in browser history, server logs and
any onward referrer.

---

## 4. What went wrong — the pattern

[[invoices]] §2 counted how many of the previous five audits' fixes had reached
that page: **1 of 17**. Its recommendation was to stop fixing the audited page and
start sweeping the class repo-wide, and its §7 recorded the sweeps that were then
run. This page is the first test of whether that change held.

**It half held.** The fixes that were swept repo-wide reached quotes. The fixes
that were applied where they were found did not.

| Pattern | Established by | Swept repo-wide in remediation? | Reached quotes? |
|---|---|---|---|
| `escapeLike` / `containsPattern` on search | [[customers]] | ✅ yes, 7 route files | ✅ **yes** |
| PDF logo SSRF guard (`withSafeLogo`) | [[invoices]] | ✅ yes, explicitly incl. quotes | ✅ **yes** |
| `lineItemDescription` shared primitive | [[invoices]] | ✅ yes, 3 domains | ✅ **yes** |
| `bulkToast` for partial failure | [[customers]] | ✅ yes, all 23 hooks | ⚠️ called, but defeated (QUO-29) |
| `booleanFlag` for `?showArchived` | [[customers]] | ✅ yes, `common.ts` | ✅ **yes** |
| Tenant-filter on every write | [[bookings-calendar]] | ✅ yes, "0 remain" | ✅ **yes** |
| `isoDate` / `isoTime` date primitives | [[bookings-calendar]] | ❌ file-local | ❌ QUO-17, 21 |
| `LoadErrorState` on lists + KPIs | [[reports-page]], [[customers]] | ❌ | ❌ QUO-05 |
| `EntityDetailShell.loadError` / `onRetry` | [[jobs]] | ❌ | ❌ QUO-06 |
| 404-vs-500 on detail surfaces | [[jobs]], [[invoices]] | ❌ | ❌ QUO-07 |
| Uniform `archived_at` on stats | [[reports-page]], [[invoices]] | ❌ | ❌ QUO-08 |
| Tenant timezone on date boundaries | [[dashboard]] | ❌ | ❌ QUO-09 |
| `tenant-time` / `formatDateOnly` in components | [[jobs]] (JOB-15) | ❌ | ❌ QUO-10 |
| `round2` money discipline | [[invoices]] | ❌ | ❌ QUO-11 |
| Route-level rate limits on public endpoints | [[bookings-calendar]] | ❌ | ❌ QUO-12 |
| PDF through a server action | [[invoices]] (INV-41) | ❌ | ❌ QUO-13 |
| `initialData` seeded from the server render | [[jobs]], [[invoices]] | ❌ | ❌ QUO-14 |
| Detail reads through TanStack Query | [[jobs]], [[invoices]] | ❌ | ❌ QUO-15 |
| `adoptedPageMode` deep-link fix | [[jobs]] (JOB-38) | ❌ | ❌ QUO-16 |
| `findForeignRef` FK ownership | [[jobs]] | ❌ | ❌ QUO-22 |
| `loadEditable*` archived guard | [[jobs]], [[invoices]] | ❌ | ❌ QUO-23 |
| Indexes on child + filter columns | [[invoices]] (INV-33) | ❌ | ❌ QUO-25 |
| Multi-statement writes in a transaction | [[jobs]], [[invoices]] | ❌ | ❌ QUO-28 |
| Service layer | [[api-rules]] §1 | ❌ | ❌ QUO-30 |
| Removing `as never` from enum writes | [[jobs]], [[invoices]] | ❌ | ❌ QUO-35 |

**6 of 6 swept patterns arrived. 0 of 19 in-place patterns did.** The correlation
is total, and it is the same correlation [[invoices]] §2 identified — this run
just has a control group. The lesson is not "the team forgot quotes"; it is that
**a fix only propagates if the propagation is the act of fixing it**. A `grep`
run at remediation time is worth more than any number of notes telling the next
session to remember.

Two consequences specific to this page make the cost concrete:

- **QUO-02 is a regression of a fix that is three days old.** The [[jobs]] audit
  built `job-stages.service.ts` as "the one place a job changes column" on
  2026-07-29 and converted every writer it could find in `routes/jobs`. It did not
  grep for writers of `jobs.status` *outside* that directory, and
  `lib/quote-to-job.ts` writes one. The stage model was correct for four days for
  every job except the ones created from quotes.
- **QUO-29 shows a swept fix can still be defeated locally.** `bulkToast` reached
  all 23 hooks, including the quote ones. It is written around the observation
  that no endpoint returns `message` — and the quote endpoints return `message`,
  so the honest-reporting branch is bypassed on the only bulk endpoint in the
  domain that legitimately partial-fails. Sweeping the *call sites* was not enough
  because the *contract* was never made uniform.

**Recommendation.** Two process changes, both cheap:

1. **End the remediation with the grep, and paste the counts into the report.**
   [[invoices]] §7.3 did this and those are precisely the patterns that arrived.
   Make it the last checklist item of every audit, not a recommendation.
2. **Sweep by symptom, not by directory.** The three greps that would have caught
   nine of this page's findings before it was ever audited:
   `grep -rn "new Date(.*toLocaleDateString" apps/web/src/components` (QUO-10),
   `grep -rLn "isError" apps/web/src/app --include=*-page-client.tsx` (QUO-05), and
   `grep -rn "status:.*as never" apps/api/src` (QUO-01, 35 — every one of those
   sites is a status write that should be going through a guard).

---

## 5. Product suggestions

**5.1 A sent quote is a dead end, and that is the wrong model.** Once sent, a
quote cannot be edited, cannot be re-sent, cannot be deleted, and its token is
never re-minted. Every real estimating workflow needs three moves this API does
not have:

- **Re-send** — the customer says "I never got it". Today the only fix is to build
  the quote again from scratch under a new number.
- **Revise** — the customer asks for the cheaper option. A `POST /quotes/:id/revise`
  that clones to a new draft (`QT-2026-0007-R2`), links the two, and voids the
  first would keep the history that "create a second quote" throws away.
- **Reopen an expired quote.** Today, expiry is terminal and invisible until the
  customer complains: the quote auto-expires (early, per QUO-09), and `accept` then
  refuses. A customer who calls on the last day to say yes cannot be accommodated
  without a new quote.

Given QUO-01, this matters more than it looks: the API's only way to move a quote
between statuses in bulk is the endpoint that breaks it.

**5.2 There is no expiry warning to anyone.** `expiry_date` drives a status change
and nothing else. Neither the customer nor the tenant is told a quote is about to
lapse. The cron infrastructure for this already exists — E-07 dunning claims rows
with `UPDATE … RETURNING` and sweeps on a schedule. A "your estimate expires in
3 days" nudge is the single highest-value email this domain does not send, and
the same sweep should replace the read-path auto-expire in QUO-09.

**5.3 The portal collects a decline reason and nobody ever sees it.** `declineReason`
is written (`routes/public/quote.ts:362`), surfaced in the notification, and shown
on the detail page — but it is not aggregated anywhere. Five declines saying "too
expensive" is the most actionable data this product can collect about a tenant's
pricing, and it currently lives as five toast notifications.

**5.4 Convert-to-job is offered on `sent` quotes.** `POST /:id/convert` accepts
`accepted` *or* `sent` (`:1216`), and the header shows the button for both
(`quote-detail-header.tsx:60-62`). Scheduling work off an estimate the customer
has not agreed to is presumably a deliberate convenience for phone approvals, but
the conversion marks the quote `accepted` (`quote-to-job.ts:203`) with no record
that the acceptance was assumed rather than given. An `accepted_via` column
(`portal` / `staff` / `assumed`) would cost one migration and settle disputes.

---

## 6. Verification

Run against the live Neon database (tenant *Shihab Housing*, `America/Chicago`)
plus Zod probes, `EXPLAIN` plans and a `TZ`-pinned Node run. Every write was
inside a transaction that rolled back; nothing was left behind. The harness was
deleted after the run.

Checks assert the **correct** behaviour, so a `FAIL` confirms the finding.

| ID | Check | Result | Finding |
|---|---|---|---|
| A1 | `createQuoteBody` rejects magic/invalid `issuedDate` | **all 7 accepted** (`infinity`, `-infinity`, `today`, `epoch`, `now`, `2026-02-30`, `2026-13-45`) | QUO-17 |
| A2 | same for `expiryDate`, create **and** update | **all 7 accepted on both** | QUO-17 |
| A3 | `notes` is bounded | **100 KB accepted** | QUO-20 |
| A4 | `unitPrice` bounded vs `numeric(10,2)` | **`1e15` accepted** | QUO-18 |
| A5 | `quantity` rejects negatives | **`-5` accepted** | QUO-18 |
| A6 | `updateLineItemBody` validates `itemType` | **`banana` accepted** | QUO-19 |
| A7 | `acceptQuoteBody` rejects impossible dates | **`2026-13-45` accepted** | QUO-21 |
| A8 | `unitPrice` rejects non-numeric | **`abc` accepted** | QUO-18 |
| B1 | `quotes.access_token` is indexed | **0 indexes** | QUO-24 |
| B2 | `access_token` has a UNIQUE constraint | **0** | QUO-24 |
| B3 | `quote_line_items` has any non-PK index | **PK only** | QUO-25 |
| B4 | `quote_activities` is indexed | 3 indexes — pass | — |
| B5 | `quotes.status` is a real enum | `quote_status` — pass | — |
| B6 | quote-number trigger present | `trg_quotes_auto_number` — pass | — |
| B7 | `quotes` indexed on `archived_at` | **0** | QUO-25 |
| C1 | subtotal equals the sum of displayed line totals | **30.9900 vs 31.00** | QUO-11 |
| C2 | the `date` column refuses `infinity` | **stored as `infinity`** | QUO-17 |
| C3 | UTC date equals the tenant's date | pass — **but only at the hour it ran** | QUO-09 |
| C3b | same, pinned to `2026-08-02 02:00 UTC` | **UTC `08-02` vs Chicago `08-01`; expired_by_utc=true, expired_by_tenant=false** | QUO-09 |
| C4 | a converted job carries `stage_id` | **`stage_id=null`, status `"scheduled"`** | QUO-02 |
| C5 | the converted job is counted by stage-keyed counts | **count = 0** | QUO-02 |
| C6 | a quote marked `sent` has a token and a PDF | **token=NULL, pdf=NULL — `/send` now refuses it** | QUO-01 |
| C7 | `RETURNING` already carries the generated number | `QT-2026-0001` — pass (confirms QUO-32) | QUO-32 |
| C8 | stats agree with the list they filter | **stats=1 vs list=0** | QUO-08 |
| C9 | `EXPLAIN` the portal's token lookup | **`Seq Scan on quotes`** | QUO-24 |
| C10 | `EXPLAIN` the line-item fetch | **`Seq Scan on quote_line_items`** | QUO-25 |
| D1 | dashboard and portal render the same date | **`Jul 31` vs `Aug 1`** for `2026-08-01` under `TZ=America/Chicago` | QUO-10 |

**6 pass, 18 fail.**

**A correction worth recording.** A1, A2 and A3 first reported **pass**. The
fixture `customerId` was `00000000-0000-0000-0000-000000000001`, which Zod's
`.uuid()` rejects — version nibble `0` is not a valid UUID version — so every
probe failed validation on the customer field and never exercised the date field
it was testing. A passing check that asserts the correct behaviour is exactly the
result an audit wants to be suspicious of, and re-running with
`crypto.randomUUID()` flipped all three to fail. C3 has the same shape and is
reported honestly: it passes at the hour it ran and proves nothing, which is why
C3b pins the instant.

Not verified by execution — read from source only: QUO-03 (needs two concurrent
unauthenticated requests), QUO-05/06/07/14/15/16 (need a browser), QUO-12 (needs
sustained load against a non-dev limit), QUO-13 (needs a deployed cross-origin
API), QUO-26/31/33/34 (static), QUO-36 (docs). No lint or build was run;
`pnpm lint` remains broken repo-wide (eslint not installed).

---

## 7. Suggested fix order

1. **QUO-02 first, before anything else touches conversion.** It is a regression
   of a three-day-old model and the fix is to route `quote-to-job.ts` through
   `resolveStage` / `applyStage` in `services/job-stages.service.ts` rather than
   writing `status` by hand. Then backfill: `UPDATE jobs SET stage_id = …` for
   every job with `stage_id IS NULL` whose `status` matches a stage name in its
   pipeline, and report how many rows that is.
2. **QUO-01** — one guard shared with the single-quote handlers. While there,
   grep `status:.*as never` repo-wide (QUO-35): every hit is a status write that
   is bypassing something.
3. **QUO-03 and QUO-04 together** — both are in `routes/public/quote.ts` and both
   are fixed by the same restructure: one transaction with `SELECT … FOR UPDATE`
   that re-reads status *and* `quoteOnlineAcceptanceEnabled` inside the lock.
   Add QUO-12's rate limits in the same pass, copying the constants from
   `routes/public/booking.ts`.
4. **The sweeps, repo-wide, before the page-local work** — QUO-05/06/07 (error
   states), QUO-10 (`formatDateOnly` + `tenant-time` in components), QUO-17/21
   (`isoDate` in every schema file that still takes a bare date string). Each is
   a one-line grep and each retires the finding for `/assets`, `/catalog`,
   `/checklists` and the rest before those pages are audited. **Record the counts
   in this report's §8** — that is the process change [[invoices]] §2 asked for
   and this page is the evidence it works.
5. **The money and data-integrity set** — QUO-11 (adopt `round2`), QUO-08
   (archived + expiry in stats), QUO-09 (move auto-expire into the cron, in
   tenant time), QUO-23 (`loadEditableQuote`), QUO-22 (`findForeignRef`),
   QUO-28 (transactions).
6. **One migration** for QUO-24 and QUO-25: unique index on `quotes.access_token`,
   index on `quote_line_items(tenant_id, quote_id)`, partial index on
   `quotes(archived_at)`. Idempotent, per [[strict-rules]] §1.
7. **Frontend debt** — QUO-14, QUO-15, QUO-16, QUO-13 — then QUO-26 (wire the
   scheduling step that already exists on the server), QUO-31, and the P4s.
8. **Docs** — the 7 undocumented endpoints, REPO_MAP, knowledge base, and a
   `deferred-fixes/quotes.md` if anything here is deliberately postponed. There is
   no such file today, so nothing was owed to this page before the audit.

---

## 8. Remediation record — 2026-08-01

**All 35 findings fixed. Verified 32/32 by execution** against Neon (tenant
*Shihab Housing*), `tsc` clean on both packages, migration applied and confirmed
idempotent across four runs (NOTICE-only).

### 8.1 The four criticals

- **QUO-02** — `lib/quote-to-job.ts` now resolves its stage through
  `services/job-stages.service.ts` (`getDefaultPipelineId` → `resolveStage` /
  `getFirstStage`) and writes `stage_id` alongside `status`. `resolveStage`
  already refused a stage from another pipeline, so **QUO-27 was closed by the
  same change** — it now throws `INVALID_STAGE`, which the route turns into a
  400 instead of silently producing a job in the wrong pipeline.
  Verified: `stage_id` is set (was `null`), the stage-keyed pipeline count reads
  **1** (was 0), `jobs.status` equals the stage's `name`, and a foreign stage id
  is refused. The migration backfills existing rows in two passes — exact
  `name` match first, then lifecycle — and deliberately leaves anything
  ambiguous alone rather than guessing.
  One incidental fix: `job-stages.service.ts` typed its `Db` as
  `ReturnType<typeof getDb>`, which a `PgTransaction` does not satisfy, so the
  service could not be called from inside a transaction at all. Now
  `Omit<…, "$client">`, matching the invoice services.
- **QUO-01** — new `lib/quote-guards.ts` holds the transition table.
  `draft → sent` is **absent by construction**: `sent` is not an accepted value
  in `bulkQuoteStatusBody`, so the API can no longer produce a sent quote with
  no token and no PDF. `bulk-status-update` became filter-then-execute with the
  archived guard, per-id refusals, one transaction and an activity row each.
- **QUO-03** — `routes/public/quote.ts` gained `claimQuoteResponse`: one
  transaction, `SELECT … FOR UPDATE`, status re-read **inside** the lock. Accept
  and decline share it, so exactly one of N concurrent responses wins and
  auto-convert can only run for the winner.
- **QUO-04** — `quoteOnlineAcceptanceEnabled` moved into
  `resolveQuoteByToken`, so it gates the read *and* both mutations rather than
  only the email link. `archivedAt` joined it there (QUO-23's public half).

### 8.2 Sweep counts — measured, and **the sweep is not complete**

§4's finding was that in-place fixes do not propagate, and §7 step 4 asked for
repo-wide sweeps with the counts recorded here. The counts below were produced by
running the greps, not estimated — and they say plainly that **this remediation
fixed quotes, not the class**. Recording that is the point; an unmeasured claim
of "swept" is exactly the failure §4 describes.

| Sweep | Before | After | Status |
|---|---|---|---|
| `as never` on a status write in `routes/quotes` + `routes/public/quote` | 13 | **0** | ✅ done |
| Quote bulk endpoints returning `message` instead of `{succeeded,failed,errors}` | 4 | **0** | ✅ done |
| `services/` directory per money domain | 1 (invoices) | **2** (+ quotes) | ✅ done |
| Schema files taking a bare `z.string()` where a date reaches a `::date` cast | 3 (`quotes`, `public-quote`, `equipment`) | **1** (`equipment`) | ⚠️ quotes only |
| `*-page-client.tsx` with no `isError` handling | 18 | **17** | ⚠️ quotes only |
| `new Date(col).toLocaleDateString` in `components/dashboard/` | 23 | **20** | ⚠️ quotes only |

The last three rows are the honest result. Fixing 17 more page clients and 20
more date sites means touching `/assets`, `/catalog`, `/checklists`,
`/conversations`, `/service-agreements`, three settings pages and the whole
superadmin area — pages with their own audits still ahead of them, where the fix
should land alongside the rest of their findings rather than as a drive-by.

**So the outstanding sweep is now a tracked item, not a footnote.** It is in
[[todo]] under *Cross-Page Sweeps*, with these exact counts as the baseline. The
process change §4 asked for is only real when the number goes to zero and is
*re-measured*, which is what that entry exists to force.

Two caveats on the numbers themselves: `isError` is a proxy — `/dashboard`
handles failure through per-widget error boundaries instead and is not actually
broken — and three of the 20 date sites render `timestamptz` values, where
`new Date()` is correct. The real defect count is smaller than 17/20; it is not
zero.

### 8.3 The rest

- **Money (QUO-11)** — `recalculateQuoteTotals` sums the **stored** per-row
  `total` rather than re-multiplying, and rounds at each step with the invoice
  service's `round2`. Verified: subtotal `31.00` now equals `SUM(total) 31.00`
  (was `30.99` against `31.00`); tax `2.56`, total `33.56`. An over-large
  discount floors the total at `0.00` instead of printing a negative on a PDF.
- **Time (QUO-09, QUO-10)** — expiry is derived in the tenant's timezone on
  read (`displayStatus`) and swept hourly by `processQuoteExpiry` in the cron;
  the two `UPDATE`s on `GET` paths are gone. The dashboard components use the
  shared `formatDateOnly`, and a new API-side `formatDateOnly` fixes the E-13
  email, so dashboard, portal and email now print the same date.
- **Schemas (QUO-17, 18, 19, 20, 21)** — `isoDate`/`isoTime`, bounded decimal
  strings against `numeric(10,2)`, `itemTypeSchema` derived from the existing
  `ITEM_TYPES` constant rather than a fourth hand-written copy. Verified: all 7
  magic/invalid dates rejected on both verbs, `1e15` / `-5` / `abc` rejected,
  `banana` rejected while `service_call` is accepted.
  Worth noting: the audit's own probe had the item types wrong (`service`, not
  `service_call`) — deriving from the constant is what surfaced it.
- **Guards (QUO-22, 23, 28)** — `loadEditableQuote` on all 10 mutating
  handlers, equipment validated against tenant **and** customer, catalog ids
  validated (a foreign id used to fall through to an unpriced line), and the
  create / line-item / bulk paths wrapped in transactions.
- **Indexes (QUO-24, 25)** — `20260801000001_quotes_audit.sql`. Verified with
  `enable_seqscan = off`: `Index Scan using idx_quotes_access_token` and
  `idx_quote_line_items_tenant_quote`. The UNIQUE half enforces — a duplicate
  token raises `23505 idx_quotes_access_token`.
  **Honest caveat:** with 7 quotes and 18 line items on this database the
  planner still (correctly) chooses a seq scan; the first verification run
  recorded that as a failure before the check was corrected. The index is
  present, valid and usable — the plan will flip on any real dataset.
- **Frontend (QUO-05, 06, 07, 13, 14, 15, 16, 26, 31, 32, 33, 34)** —
  `LoadErrorState` on the list, `EntityDetailShell.loadError`/`onRetry` on the
  sheet, a dedicated `QuotePortalError` so a 500 no longer tells a customer
  their estimate does not exist (a genuine 404 still 404s), `initialData`
  seeded for the exact server-rendered key, all six previously-callerless hooks
  wired up, the `adoptedPageMode` ref from JOB-38, `downloadQuotePdf` through a
  server action, `robots: noindex`, and `React.cache` so the portal fetches once
  per render instead of twice.
- **QUO-26** — the scheduling step now exists: `QuoteResponseButtons` collects a
  preferred date/time (bounded to the business's today, gated on
  `postAcceptanceScheduling`) and `handleAccept` forwards it. The server side had
  been complete since April.
- **Docs (QUO-36)** — all 7 undocumented endpoints written up, plus three
  corrections to what was already there: `taxRate` was documented as a
  percentage when the API requires a 0–1 fraction, `POST /quotes` was documented
  as accepting a `lineItems` array it has never accepted, and `PATCH` did not
  mention the archived guard.

### 8.4 Left as a deliberate product decision

- **Token rotation.** QUO-24 also observed that `access_token` is never rotated
  or cleared, so the link keeps rendering the quote after a response. The index
  and uniqueness are fixed; the token is deliberately **kept** so a customer can
  re-read an estimate they accepted. Archived quotes now 404 there, which covers
  the "make it go away" case. Revisit if a "revoke link" action is ever asked
  for.
- **§5's product suggestions** (re-send, revise, reopen an expired quote,
  expiry-warning email, decline-reason reporting, `accepted_via`) are features,
  not defects, and are not part of this remediation. `expiringSoonCondition` is
  in the service ready for the warning email.
