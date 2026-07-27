# Page Report — Customers

> Related: [[README|Reports Index]] | [[dashboard|/dashboard report]] | [[reports-page|/reports report]] | [[bookings-calendar|Bookings & Calendar report]] | [[strict-rules]] | [[api-rules]] | [[security-rules]] | [[jobs-customers]] | [[deferred-fixes/README|Deferred Fixes]] | [[todo]]

**Audited** 2026-07-27 · **Auditor** senior engineer + product design pass
**Status** ✅ `ALL FIXED` 2026-07-27 — 35 findings (3 critical, 9 high, 16 medium, 7 low)

**Naming.** The request was for "contacts". There is no `/contacts` route — the entity is
**Customers** (`customers` table, `/customers`, sidebar label "Customers"). This report
covers `/customers`, `/customers/[id]` and everything hanging off them. Job internals were
excluded as requested; the customer→job *seams* are in scope and two findings land there.

---

## Verdict

The customers surface is the oldest code on the platform and it shows. It was built first,
then everything else grew around it — and the fixes that landed on newer pages were never
walked back to it. Three of the four remediation patterns from the previous audits are
missing here: the tenant-timezone plumbing from [[dashboard]], the "an error must not
render as empty" rule from [[reports-page]], and the TanStack Query migration that every
other list page completed. What's here works for the happy path and is genuinely pleasant
to use; it fails quietly and in ways the user cannot see.

Three things are seriously wrong:

1. **Deleting a customer silently destroys their archived jobs.** The guard that refuses
   the delete counts only *non-archived* jobs, and the FK is `ON DELETE CASCADE`. Archive a
   job, delete the customer, and the job — with its line items, photos and checklist —
   is gone, with the UI reporting success. Verified against Neon.
2. **A failed request renders as "No outstanding invoices."** The whole detail page has no
   error state. This is [[reports-page|REP-01]] verbatim, on a screen where the empty state
   reads as a factual claim about the customer's account.
3. **Bulk delete lies.** The API refuses to delete customers that have jobs or invoices and
   reports them in `errors`; the frontend toasts `"Customers deleted"` regardless. Select
   five, have three blocked, and nothing on screen says so.

The most interesting *product* finding isn't a bug: **tags are fully built and completely
unreachable.** You can create them, colour them, assign them, and see them on the detail
header — and there is no way to filter, group, sort or search by one. The feature has a
back end, a UI, and no purpose.

---

## Remediation — 2026-07-27

All 35 fixed. Four changes are structural rather than local:

| Change | Replaces | Closes |
|---|---|---|
| `apps/web/src/lib/phone.ts` | four divergent copies, two behaviours | CUST-07, CUST-08, CUST-31 |
| `apps/web/src/lib/bulk-toast.ts` | `res.message ?? "…"` in 23 hooks across 8 domains | CUST-03 |
| `GET /customers/:id/summary` | five list fetches reduced in the browser | CUST-05, part of CUST-15 |
| `apps/api/src/lib/search.ts` | `escapeLike` private to `routes/jobs` | CUST-16 |

**CUST-03 was fixed on the frontend on purpose.** 22 endpoints across 7 domains
return `{succeeded, failed, errors}` and none has ever returned `message`. Fixing
the single place the toast is rendered corrects all of them at once and needs no
new server contract; fixing 22 handlers would have corrected one domain per commit
and left the rest lying. `bulkResult()` in the customers route still supplies a
server-authored `message` where the wording benefits from knowing the verb, and
`bulkToast` prefers it when present.

**Verified by execution — 28 checks, 28 passing.** DB probes ran against Neon
(tenant *Shihab Housing*) inside transactions that always roll back; schema and
formatter probes execute the source verbatim.

| Exercise | Result |
|---|---|
| CUST-01 — archived job now blocks single + bulk delete | 3/3 |
| CUST-04 — stats reconcile with the Active tab; `''` address excluded | 2/2 |
| CUST-16 — `%` matched literally; full-name search hits | 2/2 |
| CUST-12 — `?tagId=` returns exactly the tagged customer | 1/1 |
| CUST-05 — 25 unpaid invoices total `2500.00`, not page one's `2000.00` | 2/2 |
| CUST-07/08 — both write paths agree; `+44…` keeps all 12 digits | 6/6 |
| CUST-09/11 — bad email rejected, lengths bounded, `''` → `NULL` | 7/7 |
| CUST-03 — partial/total/clean bulk wording | 3/3 |
| CUST-29 — `?showArchived=false` parses to `false` | 2/2 |
| `tsc --noEmit`, api + web | exit 0, exit 0 |

**Two things worth flagging in the fix rather than the finding.**

*Deletion still isn't in the activity log, and can't be.*
`customer_activities.customer_id` is `ON DELETE CASCADE`, so a `customer.deleted`
row would be destroyed by the operation it documents. Archive, restore, tag
assign/remove and note update/delete are all logged now; deletion needs a
tenant-scoped audit log, which is out of scope. Documented rather than silently
left undone.

*`unpaid` was added to the invoice list endpoint.* CUST-05 needed the database to
answer "which invoices still owe money". The route already modelled `overdue` as a
derived pseudo-status, so `unpaid` (`sent` | `overdue` | `partially_paid`) follows
the precedent in that file instead of inventing a second mechanism.

**Scope taken beyond the report:** the four `formatPhone` copies in the invoice and
quote detail/sidebar components also route through `formatPhoneDisplay` — they
render customer phone numbers, and the stored format changed. Three inline
customer-create dialogs (job, quote, calendar event) were stripping the leading
`+` client-side before `POST /customers`; they use `normalizePhone` now.

**Not done.** `pnpm lint` is still broken repo-wide (eslint not installed) and no
build was run — both pre-existing, neither introduced here. No browser session was
exercised, so the keyboard-navigation, tab-URL and toast-copy fixes are verified by
construction and by `tsc`, not by observation.

---

## 1. Scope & method

| Layer | Files |
|---|---|
| Routes | `apps/web/src/app/(dashboard)/customers/page.tsx`, `customers-page-client.tsx`, `[id]/page.tsx`, `[id]/customer-detail-client.tsx`, `loading.tsx` |
| Components | `components/dashboard/customers/` — 18 files (table, dialog, detail-header, tabs-panel, 10 tabs, tags-input, picker, info-panel, sidebar-panel) |
| Data layer | `hooks/queries/use-customers.ts`, `lib/query-keys.ts`, `actions/customers.ts` (21 actions) |
| API | `apps/api/src/routes/customers/index.ts` (18 handlers, 942 lines) |
| Schemas | `apps/api/src/lib/schemas/customers.ts`, `lib/schemas/common.ts`, `lib/schemas/bulk.ts` |
| Database | `packages/database/src/schema/customers.ts`, `customer_notes`, `customer_activities`, `customer_tags` |
| Docs | `api-docs/API_DOCUMENTATION_1.md` §Customers, `reference/REPO_MAP_*`, `lib/chatbot/knowledge-base.ts` |

Method: read every file end to end, cross-check the three layers against each other, then
**verify the load-bearing claims by execution** against the live Neon database (tenant
*Shihab Housing*). All writes were wrapped in transactions that roll back. 13 checks, 13
confirming the finding. See §6.

---

## 2. What has been built — and what is good

Credit where it is due, because a lot of this is well made.

**The detail page is the strongest screen on the platform.** Ten tabs (Overview, Jobs,
Invoices, Quotes, Assets, Agreements, Photos, Messages, Activity, Notes), an inline-editable
header, quick-action buttons that create a job/quote/invoice with the customer pre-filled
and the tenant's default tax rate already fetched. Radix `Tabs` unmounts inactive panels, so
the ten tabs cost one request set, not ten.

**Inline editing is the right interaction.** `EditableText`
(`customer-detail-header.tsx:49`) handles Enter to commit, Escape to revert, blur to save,
and uses `onMouseDown` + `preventDefault` on the confirm button so the click lands before
the blur — a detail that is wrong in most hand-rolled implementations.

**The list page follows the Unified List Page Pattern properly** — `PageHeader`,
`StatsCards`, `StatusFilterTabs`, `SearchInput`, `TableSkeleton`, `EmptyState`,
`Pagination`, `BulkActionBar`, all from `components/reusable/`. Nothing is hand-rolled.
Search is debounced at 300ms, changing search or tab resets to page 1 *and* clears the
selection, and the next page is prefetched. That last set of details is exactly what tends
to get skipped.

**Tenant isolation is clean.** Every one of the 18 handlers filters on `tenantId`. The
sub-resource routes for tags and photos re-verify customer ownership before touching the
join table, and `customer_tags` carries an explicit comment
(`routes/customers/index.ts:867-870`) explaining why it is exempt. That comment is from the
[[bookings-calendar]] sweep and it did its job — I did not have to re-investigate it.

**The delete guard exists at all**, and covers the bulk path too. Most codebases discover
they need it after the first support ticket.

**Stats are one query, not four** (`routes/customers/index.ts:122-130`, `COUNT(*) FILTER`).

---

## 3. Findings

Severity: **P1** breaks correctness or loses data · **P2** wrong or inconsistent data ·
**P3** waste, drift, or a real UX defect · **P4** polish.

| ID | Sev | Finding | Where | Status |
|---|---|---|---|---|
| CUST-01 | P1 | Deleting a customer silently destroys their **archived** jobs | `routes/customers/index.ts:346,471` | FIXED |
| CUST-02 | P1 | Failed requests render as empty states across the whole detail page | `customer-overview-tab.tsx:131-171` | FIXED |
| CUST-03 | P1 | Bulk actions report success for records the server refused | `use-customers.ts:105,121,137` | FIXED |
| CUST-04 | P2 | `/customers/stats` counts archived customers the table hides | `routes/customers/index.ts:130` | FIXED |
| CUST-05 | P2 | Overview "Outstanding" is computed from the first 20 invoices only | `customer-overview-tab.tsx:124,147` | FIXED |
| CUST-06 | P2 | "Upcoming jobs" cutoff uses UTC, not the tenant timezone | `customer-overview-tab.tsx:119` | FIXED |
| CUST-07 | P2 | Phone is stored in two incompatible formats by two write paths | `customer-detail-header.tsx:260` | FIXED |
| CUST-08 | P2 | Phone input silently truncates anything past 10 digits | `customer-dialog.tsx:53` | FIXED |
| CUST-09 | P2 | No length limits and no email validation on any customer field | `lib/schemas/customers.ts:27-37` | FIXED |
| CUST-10 | P2 | Every write on the detail page fails silently | `customer-detail-header.tsx:154-164` | FIXED |
| CUST-11 | P2 | `PATCH` stores `''` where `POST` stores `NULL` | `routes/customers/index.ts:290` | FIXED |
| CUST-12 | P2 | Tags are assignable but cannot be filtered, sorted or searched | `lib/schemas/customers.ts:20` | FIXED |
| CUST-13 | P3 | The SSR prefetch is fetched, passed as props, and discarded | `customers/page.tsx:11-21` | FIXED |
| CUST-14 | P3 | Hover-prefetch fills a cache key nothing ever reads | `customer-table.tsx:105-111` | FIXED |
| CUST-15 | P3 | Every detail tab except Jobs truncates silently | 7 tab files | FIXED |
| CUST-16 | P3 | Search does not escape `%`/`_` and cannot match a full name | `routes/customers/index.ts:63-69` | FIXED |
| CUST-17 | P3 | `POST /:id/notes` does not verify the customer belongs to the tenant | `routes/customers/index.ts:589` | FIXED |
| CUST-18 | P3 | Both delete dialogs promise a cascade the API refuses to perform | `customers-page-client.tsx:315` | FIXED |
| CUST-19 | P3 | Dead code: two panels and a query hook, never imported | `customer-info-panel.tsx` +2 | FIXED |
| CUST-20 | P3 | `customers.notes` is write-only — no UI ever renders it | `schema/customers.ts:25` | FIXED |
| CUST-21 | P3 | Deleting a note has no confirmation step | `customer-notes-tab.tsx:194` | FIXED |
| CUST-22 | P3 | The detail page never adopted TanStack Query | 9 tab files | FIXED |
| CUST-23 | P3 | No single-row Restore, and archived rows look identical to active | `customer-table.tsx:169` | FIXED |
| CUST-24 | P3 | No sort UI, though the API and action support four sort columns | `customer-table.tsx:91-96` | FIXED |
| CUST-25 | P3 | Five endpoints are undocumented | `API_DOCUMENTATION_1.md` | FIXED |
| CUST-26 | P3 | Delete, archive, restore and tag changes log no activity | `routes/customers/index.ts:358` | FIXED |
| CUST-27 | P3 | Table rows are click-only — unreachable by keyboard | `customer-table.tsx:101-104` | FIXED |
| CUST-28 | P3 | No duplicate-email detection, and no unique index | `schema/customers.ts:35` | FIXED |
| CUST-29 | P4 | `z.coerce.boolean()` cannot express `false` | `lib/schemas/common.ts:7` | FIXED |
| CUST-30 | P4 | Currency is hardcoded USD and rounds cents away | `customer-overview-tab.tsx:70-78` | FIXED |
| CUST-31 | P4 | Phone formatting duplicated across four files, two behaviours | 4 files | FIXED |
| CUST-32 | P4 | Tab selection is not in the URL | `customer-tabs-panel.tsx:22` | FIXED |
| CUST-33 | P4 | Overview bypasses `jobLink()` and hardcodes the param | `customer-overview-tab.tsx:245` | FIXED |
| CUST-34 | P4 | `POST /:id/tags` returns two different shapes under `data` | `routes/customers/index.ts:839` | FIXED |
| CUST-35 | P4 | Notes/activities pagination omits `totalPages` | `routes/customers/index.ts:562` | FIXED |

---

### P1 — Critical

#### CUST-01 · Deleting a customer silently destroys their archived jobs

`routes/customers/index.ts:344-356` refuses the delete if the customer has related records.
The jobs half of that check is:

```ts
db.select({ count: count() }).from(jobs)
  .where(and(eq(jobs.tenantId, tenantId), eq(jobs.customerId, id),
             isNull(jobs.archivedAt)))          // <-- archived jobs are invisible here
```

Invoices and quotes are counted without an archive filter; jobs are not. And the FK is
`ON DELETE CASCADE` (confirmed against the live schema). So an archived job is not merely
overlooked by the guard — it is *deleted*, along with everything that cascades from a job
row. The user is told "Customer deleted".

Verified end to end: with one archived job attached, the guard returned `0`, the delete
succeeded, and the job count went to zero (§6, CUST-08 probe).

`bulk-delete` has the identical filter at line 471, so the same hole exists for a
multi-select.

This is reachable through normal use: bulk-archiving stale jobs is a documented feature
(the Active/Archived tabs on `/jobs`), and archiving is presented as the *safe* alternative
to deleting.

**Fix.** Drop `isNull(jobs.archivedAt)` from both guards so archived jobs block the delete
like everything else, and say so in the message. If archived records genuinely should not
block, that is a product decision — but then the FK must not be `CASCADE`, and the user must
be told what is about to be destroyed. Do not leave the two halves disagreeing.

#### CUST-02 · A failed request renders as an empty state

`customer-overview-tab.tsx:131-171` is five guarded blocks in a row:

```ts
if (jobsRes.data)     { ...setUpcomingJobs(...) }
if (invoicesRes.data) { ...setOutstandingInvoices(...) }
if (equipmentRes.data){ ... }
if (agreementsRes.data){ ... }
if (activityRes.data) { ... }
setLoading(false);
```

There is no `else`. The server actions return `{ data: null, error }` on a 500 or a network
failure, so a failed request leaves the initial state in place and the card renders **"No
outstanding invoices"** and **"No upcoming jobs scheduled"**, with the stat row reading
`0` / `$0`.

This is [[reports-page|REP-01]], which was rated critical there because a 500 read as *"you
earned nothing this quarter"*. Here it reads as *"this customer owes you nothing"* — which
is worse in one specific way: the reports page is a periodic review, whereas this is the
screen someone opens while the customer is on the phone.

The same pattern is in all nine non-Jobs tabs and in the header's tag fetch
(`customer-detail-header.tsx:147-152`).

**Fix.** Reuse `LoadErrorState` and `WidgetErrorBoundary` from
`components/reusable/` — they were built for exactly this during the [[reports-page]]
remediation and are already in the tree. Distinguish "loaded, and it is empty" from
"did not load".

#### CUST-03 · Bulk actions report success for records the server refused

The API returns `{ succeeded, failed, errors }` (`routes/customers/index.ts:508`). Every
bulk hook does:

```ts
toast.success(res.message ?? "Customers deleted");   // use-customers.ts:137
```

`message` is never present, so the fallback always wins. `failed` and `errors` are dropped
on the floor. Select five customers, have three blocked because they have invoices, and the
UI says "Customers deleted" — the list refreshes, three of them are still there, and nothing
explains why.

This is not customers-specific: **22 bulk endpoints across 7 domains return
`{succeeded, failed, errors}` and not one returns `message`**, while every bulk hook reads
`res.message`. [[strict-rules]] §11 states the contract ("Bulk action responses use
`res.message`") — the frontend honours it and the backend never implemented it.

**Fix.** Two options, and the second is better. (a) Have each endpoint build a `message`.
(b) Have the hooks render from the structured fields they already receive —
`toast.success("3 archived")` / `toast.warning("2 of 5 could not be deleted")` with the
`errors` array behind a detail affordance. (b) needs no API change and produces a better
message. Then correct §11 to describe what actually exists.

---

### P2 — High

#### CUST-04 · Stats count archived customers the table hides

`routes/customers/index.ts:130` filters on `tenantId` alone. `GET /customers` defaults to
`isNull(archivedAt)`. So the "Total" card counts archived customers while the table beneath
it does not show them — archive one and the numbers stop reconciling, permanently.

Verified: three customers, one archived → `stats.total = 3`, Active tab = 2 rows.

Two smaller defects in the same query. `withAddress` uses
`address IS NOT NULL OR city IS NOT NULL` while `withEmail`/`withPhone` also test `!= ''` —
so a customer whose address was cleared through the UI still counts as having one (verified:
1 vs 0). And because the cards are used as at-a-glance data-quality indicators, that is the
one place the distinction matters.

Uniform `archived_at` filtering was the fix applied across [[dashboard]] and
[[reports-page]]. `/customers` is the page it was never applied to. [[todo]] already carries
"confirm `/reports` booking and customer totals match their list pages after a bulk
archive" — this is that item, and the answer is no.

#### CUST-05 · "Outstanding" is computed from the first 20 invoices

```ts
getInvoices({ customerId, limit: 20 })      // customer-overview-tab.tsx:124
...
const outstanding = allInvoices.filter((i) => ["sent","overdue","partially_paid"].includes(i.status));
const outstandingTotal = outstanding.reduce((sum, i) => sum + parseFloat(i.balanceDue || i.totalAmount || "0"), 0);
```

The filter runs client-side over one page. A customer with 25 invoices has the oldest five
excluded from the total — and on a list sorted newest-first, the oldest unpaid invoices are
exactly the ones that matter. The headline "Outstanding" figure understates the debt, and
"Open Invoices" undercounts it.

The same function gets this right for jobs (`jobsRes.pagination?.total`, line 136) and wrong
again for assets and agreements, which use `data.length` against `limit: 100`. Three
counting strategies in one `fetchData`.

**Fix.** These are aggregates; compute them in SQL. A `GET /customers/:id/summary` returning
job count, open-invoice count, outstanding balance, active agreements and asset count is one
round trip instead of five, correct by construction, and removes ~60 lines of client-side
reduction. Per [[api-rules]] §5 the outstanding-balance SQL should be shared with the
invoice stats endpoint rather than written twice.

#### CUST-06 · The "upcoming" cutoff is in UTC

```ts
const today = new Date().toISOString().split("T")[0];   // line 119
...filter((j) => ... && j.scheduledDate >= today)
```

`toISOString()` is UTC. For a tenant in `America/Chicago` — which is the tenant that
currently exists — after 19:00 local the UTC date has already rolled over, so *today's*
jobs stop satisfying `>= today` and vanish from "Upcoming Jobs" for the last five hours of
the working day.

[[dashboard]] plumbed `tenants.timezone` end to end precisely to kill this class of bug.
`lib/tenant-time.ts` (`tenantToday`) was written during the [[bookings-calendar]]
remediation and is sitting unused three directories away.

#### CUST-07 · Two write paths store the phone in two formats

The dialog strips to digits before saving (`customer-dialog.tsx:102`,
`stripPhone` → `5551234567`). The header's inline editor is seeded with the *formatted*
value (`customer-detail-header.tsx:260`, `value={phone}` where `phone = formatPhone(...)`)
and saves the draft verbatim → `(555) 123-4567`.

So the same column holds both representations depending on which control the user reached
for. Display survives it — `formatPhone` passes through anything it cannot parse. Search
does not: `GET /customers` matches `ilike(customers.phone, '%5551234567%')` against the raw
column, so searching the digits misses every row saved from the header, and searching the
formatted string misses every row saved from the dialog. Both verified.

**Fix.** Normalise on the way in, server-side, in the schema — one `phoneSchema` with a
transform, so it cannot depend on the caller. Formatting stays a display concern.

#### CUST-08 · The phone input truncates past 10 digits

```ts
return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
```

Anything beyond the tenth digit is discarded as you type, and `stripPhone` then persists the
truncated result. `+44 20 7946 0958` becomes `(442) 079-4609` and is stored as
`4420794609` — a number that dials nothing. Verified. `maxLength={14}` on the input
reinforces it.

The platform brief in [[CLAUDE|CLAUDE.md]] is explicit that features must work for any
service business; silently corrupting every non-NANP phone number is a hard geographic
limit baked into a formatter. It is also invisible — the field looks like it accepted the
input.

**Fix.** Format for display only, never on the way to storage; keep the raw input, store
E.164 where possible, and stop rejecting length. If US formatting is wanted as an
affordance, apply it only when the input is unambiguously a 10/11-digit NANP number.

#### CUST-09 · No length limits, no email validation

```ts
export const createCustomerBody = z.object({
  firstName: z.string().min(1),      // unbounded
  ...
  email: z.string().optional(),      // not .email()
  notes: z.string().optional(),      // unbounded
});
```

`email` accepts `"nope"`. Every text field accepts a 100 KB body. These fields are rendered
into invoice and quote PDFs (`lib/pdf/invoice-pdf.tsx`) and interpolated into customer-facing
emails.

The tenants domain was hardened for exactly this in DF-TEN-01..12 — "max lengths on all text
fields, HTML tag stripping for email/PDF-rendered fields". `boundedText()` was added to
`lib/schemas/common.ts` during [[bookings-calendar]] and is used by bookings and
calendar-events. Customers, which is the *primary* source of PDF- and email-rendered text,
was never revisited.

The browser blocks a malformed email on the dialog (`type="email"` inside a validating
form), so this is reachable via the inline header editor — which is a plain text input — and
via the API directly.

#### CUST-10 · Every write on the detail page fails silently

```ts
async function handleFieldSave(field: string, value: string) {
  const res = await updateCustomer(customer.id, { [field]: value });
  if (res.data) onUpdate(res.data);          // no else
}
async function handleDelete() {
  const res = await deleteCustomer(customer.id);
  if (!res.error) router.push("/customers"); // no else
  setDeleting(false);
}
```

Same shape in the tags input (`customer-tags-input.tsx:79-91`), all three note operations
(`customer-notes-tab.tsx:46-75`), and the three create-dialog handlers in
`customer-detail-client.tsx:79-108`.

The inline-edit case is the worst, because it *looks* like it worked and then reverts: the
editor closes, and the display falls back to the unchanged prop value. The user sees their
edit disappear with no message.

The delete case is worse in consequence: `CUST-01`'s guard returns a 400 with a precise,
useful message — *"Cannot delete customer with 2 job(s)…"* — and the detail header throws it
away, leaving the dialog open and the button un-spinning.

The list page does this correctly (the mutation hooks toast `res.error`). The detail page
predates them.

#### CUST-11 · `PATCH` stores `''` where `POST` stores `NULL`

`POST` normalises (`email: email || null`, line 165). `PATCH` assigns raw
(`updates[field] = body[field]`, line 290). Clearing a field through the edit dialog
therefore writes an empty string, and the column ends up with a mix of `NULL` and `''`
depending on how the value was cleared. Verified.

This is what makes `withEmail`'s `!= ''` guard necessary, and it is why `withAddress`
without that guard is wrong (CUST-04). Fix the write and the read-side special-casing
becomes unnecessary.

#### CUST-12 · Tags are unreachable

`customer_tags`, `tags`, three API endpoints, a full `CustomerTagsInput` with create-on-type
and colour assignment — and `customerListQuery` (`lib/schemas/customers.ts:20`) is
`paginationQuery` plus `sortBy`/`sortOrder`. There is no `tagId` filter, no tag column in
the table, no tag facet in the search.

So a tag can be applied and then only ever seen again by opening that one customer. The
entire point of tagging — *show me everyone tagged VIP / Commercial / Do-Not-Service* —
is not implemented.

**Fix.** Smallest useful version: `tagId` on the list query (`inArray` over a
`customer_tags` subquery), a tag chip row in the table, and clicking a tag on the detail
header navigates to the filtered list. That converts a decorative feature into the
segmentation primitive the rest of the CRM needs — see §5.

---

### P3 — Medium

**CUST-13 · The SSR prefetch is discarded.** `customers/page.tsx:11-14` awaits `getCustomers`
and `getCustomerStats`, then passes them to `CustomersPageClient`, which destructures
`initialCustomers` and `initialStats` (lines 58-60) **and never references them again** —
grep confirms two mentions each, both in the signature. Only `initialPagination.page`
survives, to seed `useState`. So every navigation to `/customers` pays for two API round
trips whose results are thrown away, and the user still sees a skeleton while TanStack Query
fetches the same data a second time.

This looks like fallout from the [[dashboard]] fix, which removed `initialData` because it
was seeding *every* query key and serving stale data across filter changes. The right
follow-through was `queryClient.setQueryData` on the exact key with an `updatedAt`; here the
seeding was removed and the fetch was left behind. Also note `as never[]` on line 18 —
[[strict-rules]] §4.

**CUST-14 · Hover-prefetch fills a cache nobody reads.** `customer-table.tsx:105-111`
prefetches `queryKeys.customers.detail(id)` on row hover. `useCustomer()` — the only reader
of that key — is defined in `use-customers.ts:33` and **called from nowhere**; the detail
page is server-rendered and holds the customer in `useState`. Every row hover therefore
costs one `GET /customers/:id` that is written to a cache entry and never read. Same class
as the [[bookings-calendar|BOOK-02]] prefetch waste, smaller blast radius.

**CUST-15 · Six tabs truncate silently.** Quotes 50, Invoices 50, Activity 50, Assets 100,
Agreements 100, Messages 10 — each a hard `limit` with no pagination and no indication that
more exists. Photos is worse in a different direction: `GET /customers/:id/photos` has no
limit at all and returns every photo across every job for that customer. The Jobs tab is the
only one with real pagination, added by the "customer jobs tab pagination (20/page)" fix —
which was applied to one tab out of ten.

**CUST-16 · Search does not escape `%`/`_`, and cannot match a full name.** Searching `%`
returns every customer rather than the ones containing a percent sign (verified 3 of 3), and
`ilike` never escapes user input into the pattern. Separately, the four `OR`ed columns are
matched independently, so typing "Ann Smith" — the most natural thing a user does — matches
nothing (verified). LIKE escaping was fixed for jobs in the April route audit and not
carried over. Fix both together: escape the metacharacters, and add a
`first_name || ' ' || last_name` comparison.

**CUST-17 · `POST /:id/notes` does not verify the customer.** Lines 589-597 insert straight
from the path param. The sibling handlers for tags (line 815) and photos (line 901) both
`SELECT` the customer scoped to the tenant first. So a note — and a `customer_activities`
row — can be created against a customer ID belonging to another tenant. It is not a read
leak (the other tenant's queries filter on their own `tenantId`, so they will never see it)
but it writes rows referencing a foreign customer and inflates this tenant's activity feed
with entries pointing at nothing they can open. Three handlers in one file, one of them
missing the check.

**CUST-18 · Both delete dialogs describe a cascade the API refuses.** The list page says
*"All jobs, invoices, and notes linked to this customer will also be removed."*
(`customers-page-client.tsx:315`). The detail header says *"All jobs, invoices, quotes,
assets, and agreements for this customer will be permanently deleted."*
(`customer-detail-header.tsx:314`). The API refuses outright if any job, invoice or quote
exists. So the copy is wrong, the two screens disagree with each other, and — via CUST-01 —
the one case where the promise *is* kept is the one nobody intends. Replace both with what
happens: the delete is blocked while related records exist.

**CUST-19 · Dead code.** `CustomerInfoPanel` (`customer-info-panel.tsx:113`) and
`CustomerSidebarPanel` (`customer-sidebar-panel.tsx:57`) are exported and imported nowhere;
`useCustomer` likewise. The two panels contain a *second* inline-edit implementation of the
same fields the header edits — so there are now two divergent answers to "how do you edit a
customer", one of which is invisible and will drift. Delete them, or wire them up.

**CUST-20 · `customers.notes` is write-only.** The column exists, `createCustomerBody`
accepts it, `POST`/`PATCH` persist it — and no component anywhere reads `customer.notes`
(grep: zero matches). `CustomerFormData` has no `notes` field, so the dialog cannot set it
either. Meanwhile the Notes *tab* is backed by an entirely different table
(`customer_notes`). Two things called notes, one of them unreachable. Either surface the
column as a "quick note" on the header or drop it and migrate any data into `customer_notes`.

**CUST-21 · Deleting a note has no confirmation.** `customer-notes-tab.tsx:194` calls
`handleDelete` straight from the trash button, and the row is gone. Every other destructive
action on the platform routes through `DeleteConfirmDialog` or `BulkConfirmDialog`.

**CUST-22 · The detail page never adopted TanStack Query.** Nine of ten tabs use raw
`useEffect` + server action + `useState`, so every tab switch refetches from zero with no
cache, no `staleTime`, no background refetch, no shared invalidation. Refresh-after-mutation
is a `refreshKey` counter threaded from `customer-detail-client.tsx:33` through the tabs
panel into two tabs, which forces a remount rather than invalidating a key. [[strict-rules]]
§11 requires the hooks; the [[todo]] records the migration as complete for "all 14
page-clients", which is true of the list page and not of this subtree.

**CUST-23 · No single-row restore.** In the Archived tab each row's menu still offers only
Edit and Delete — restoring one customer requires selecting its checkbox and using the bulk
bar. Archived rows are also visually identical to active ones, so a screenshot of the table
is ambiguous.

**CUST-24 · No sort UI.** `customerListQuery` supports `createdAt`, `firstName`, `lastName`,
`email`; `getCustomers` forwards `sortBy`/`sortOrder`; the table renders plain `<TableHead>`
with no affordance. Full support on both sides of the wire, no way to reach it.

**CUST-25 · Five undocumented endpoints.** `API_DOCUMENTATION_1.md` documents 13 of the 18
handlers. Missing: `GET /customers/stats`, `POST /customers/bulk-archive`,
`POST /customers/bulk-restore`, `POST /customers/bulk-delete`, `GET /customers/:id/photos`.
[[strict-rules]] §8 requires docs in the same commit. Same gap the [[bookings-calendar]]
audit found for calendar-events.

**CUST-26 · The activity timeline has holes.** `customer.created`, `customer.updated` and
`note.created` are logged. Delete, bulk-archive, bulk-restore, bulk-delete, tag assign and
tag remove are not — and note *edits* are not, though creates are. So "Activity" is a
partial record presented as a complete one, which is worse than no timeline for anyone using
it to reconstruct what happened.

**CUST-27 · Table rows are keyboard-inaccessible.** `<TableRow className="cursor-pointer"
onClick={...}>` with no `tabIndex`, no `role`, no key handler. The row is the *only* way to
open a customer — the action menu offers Edit and Delete but not View. A keyboard or
screen-reader user cannot reach `/customers/[id]` from the list at all. Wrap the name cell
in a real `<Link>`; keep the row click as an enhancement.

**CUST-28 · Duplicate emails are unconstrained and unwarned.** No unique index on
`(tenant_id, email)` — verified, only `customers_pkey` and the non-unique
`idx_customers_tenant_email` — and no duplicate check on create. The public booking flow
links a submission to an existing customer by case-insensitive email match, so duplicates
make that match ambiguous: the booking attaches to whichever row comes back first, and the
history splits across two records. Warn on create ("a customer with this email already
exists — use them instead?") rather than hard-constraining, since a shared family address is
legitimate.

---

### P4 — Low

**CUST-29 · `z.coerce.boolean()` cannot express `false`.** `common.ts:7` — `Boolean("false")`
is `true`, so `?showArchived=false` returns *archived only*. Harmless today because
`actions/customers.ts:48` only ever sets the param when true, and latent in every list
endpoint that shares `paginationQuery`. Use `z.enum(["true","false"]).transform(v => v === "true")`.

**CUST-30 · Currency is hardcoded USD and rounds cents away.** `maximumFractionDigits: 0` on
a balance-due figure displays `$1,235` for `$1,234.56`. Fine for a KPI tile, wrong for money
owed. Also `"USD"` and `"en-US"` are literals on a platform meant to be region-agnostic.

**CUST-31 · Phone formatting is duplicated four times.** `customer-dialog.tsx:48`,
`customer-picker.tsx:58`, `customer-table.tsx:33`, `customer-detail-header.tsx:130` — two
distinct behaviours (progressive input formatting vs. strict `^1?(\d{3})(\d{3})(\d{4})$`
display). CUST-07 and CUST-08 are both consequences. One `lib/phone.ts`.

**CUST-32 · Tab state is not in the URL.** `defaultValue="overview"` with no `searchParams`
sync: refresh, back-navigation and deep links all land on Overview. You cannot send someone
a link to a customer's invoices.

**CUST-33 · Overview bypasses `jobLink()`.** `customer-overview-tab.tsx:245` hardcodes
`/jobs?jobId=${job.id}`. It happens to be correct, but `lib/entity-links.ts` exists
specifically because this param name has been got wrong three times, and its docblock says
"every emitter goes through here so the name can only be wrong in one place". This is an
emitter that does not.

**CUST-34 · `POST /:id/tags` returns two shapes.** Line 839:
`data: assignment ?? { message: "Already assigned" }` — `data` is either a join row or an
object with a `message`. Return 200 with the existing assignment instead.

**CUST-35 · Notes/activities pagination omits `totalPages`.** The list endpoint returns it
(line 105); the two sub-resources return only `page`/`limit`/`total`, so any caller wanting
pagination has to recompute it. Both currently avoid the problem by not paginating at all
(CUST-15).

---

## 4. What went wrong — the pattern behind the findings

Individually these are ordinary defects. Together they have one cause: **`/customers` was
built first, and the platform-wide fixes that followed were applied everywhere except here.**

| Fix, and where it landed | Status on `/customers` |
|---|---|
| Uniform `archived_at` filtering ([[dashboard]], [[reports-page]]) | Missing — CUST-04, and CUST-01 is the destructive form |
| "An error must never render as an empty state" ([[reports-page|REP-01]]) | Missing — CUST-02 |
| Tenant timezone plumbed end to end ([[dashboard]]) | Missing — CUST-06 |
| TanStack Query hooks for all mutations ([[strict-rules]] §11) | List page only — CUST-22 |
| `boundedText()` + input hardening (DF-TEN-01..12, [[bookings-calendar]]) | Missing — CUST-09 |
| LIKE escaping (April jobs audit) | Missing — CUST-16 |
| `entity-links.ts` as the single emitter ([[bookings-calendar|BOOK-14]]) | Bypassed — CUST-33 |
| Endpoints documented in the same commit ([[strict-rules]] §8) | 5 missing — CUST-25 |

That is eight remediation patterns, seven of which never reached this page. The audits have
been finding *the same bugs* in each new surface because the fixes were applied to the
surface under audit rather than to the codebase. CUST-03 is the sharpest example: it is not
a customers bug at all — 22 endpoints across 7 domains have it — it simply had not been
looked at until now.

**The process change worth making:** when a page audit produces a fix, grep for the pattern
repo-wide before closing it. The [[bookings-calendar]] remediation did this once, for tenant
filters, and found five violations outside its own scope. That should be the default, not the
exception.

The second, smaller theme is **half-built features**: tags with no filter (CUST-12), sort
support with no UI (CUST-24), a `notes` column with no reader (CUST-20), a prefetch with no
consumer (CUST-14), an SSR fetch with no destination (CUST-13), two dead panels (CUST-19).
Each is inert today and each is a trap for whoever touches it next.

---

## 5. Product suggestions

Beyond the defects, five things would change what this page is *for*.

**1. Make tags the segmentation primitive (finishes CUST-12).** Filter the list by tag, show
tag chips in the table, click a tag to filter. Then: bulk-tag from the selection bar, and let
saved tag filters drive the things a contractor actually wants — "email everyone tagged
*Maintenance Due*", "show revenue by tag". Tagging is the cheapest way to give a
single-operator business a CRM segmentation model, and 80% of it is already written.

**2. A customer value summary in the header.** The Overview tab computes lifetime jobs, open
invoices and outstanding balance — the three numbers you want *before* you pick up the phone
— and buries them one tab deep. Move them into the header strip beside the contact chips.
The `/customers/:id/summary` endpoint proposed in CUST-05 makes this one query.

**3. "Last seen" and lapsed-customer detection.** The schema has everything needed
(`jobs.scheduled_date`, `invoices.issue_date`) and nothing surfaces it. A `Last job: 14
months ago` line on the row, plus a **Lapsed** filter tab beside Active/Archived, turns a
passive contact list into a re-marketing worklist. For a solo contractor this is the single
highest-value view the CRM could offer, and it needs no new tables.

**4. Merge duplicates (pairs with CUST-28).** Once duplicates are detected, offer a merge:
re-point jobs/invoices/quotes/notes/tags at the surviving row inside one transaction. The
public booking portal will keep creating near-duplicates from typo'd emails; without a merge
path the only remedy is the delete guard telling you that you cannot clean it up.

**5. Address as a first-class field.** It is four loose text columns
(`address/city/state/zipCode`), editable only in the dialog — the detail header renders it
read-only (`customer-detail-header.tsx:270`) while name, phone and email are all inline
editable. Service addresses are the field a dispatcher corrects most often. Make it
editable in the header, and consider a structured/geocoded representation before routing or
travel-time features arrive and force the migration anyway.

---

## 6. Verification

13 checks, 13 confirming the finding. DB writes ran against Neon (tenant *Shihab Housing*)
inside transactions that always roll back; pure-function claims were executed against the
source verbatim.

| # | Claim | Result |
|---|---|---|
| CUST-04 | `stats.total` exceeds the Active tab's row count | `3` vs `2` |
| CUST-04 | `withAddress` counts a customer whose address is `''` | as-written `1`, corrected `0` |
| CUST-16 | Searching `%` returns every customer | matched `3` of `3` |
| CUST-16 | Searching a full name matches nobody | matched `0` |
| CUST-11 | `POST` normalises `''` → `NULL` | `null` |
| CUST-11 | `PATCH` stores the raw `''` | `""` |
| CUST-29 | `?showArchived=false` parses to `true` | `true` |
| CUST-08 | A 12-digit number loses digits on save | `+44 20 7946 0958` → stored `4420794609` |
| CUST-07 | Header and dialog persist different representations | `(555) 123-4567` vs `5551234567` |
| CUST-07 | Digit search misses the header-formatted row | no substring match |
| CUST-01 | The delete guard sees `0` jobs despite one archived job | guard count `0` |
| CUST-01 | Deleting the customer destroyed the archived job | jobs remaining `0`; FK is `ON DELETE CASCADE` |
| CUST-28 | No unique index on `(tenant_id, email)` | `customers_pkey`, `idx_customers_tenant_email` |

**Not verified / not run.** No browser session was exercised — the keyboard-accessibility
(CUST-27), tab-state (CUST-32) and silent-failure (CUST-02, CUST-10) findings are read from
the source, not observed in a running app. `pnpm lint` remains broken repo-wide (eslint not
installed), and no build or typecheck was run for this audit. Nothing in this report has been
fixed; all 35 findings are `OPEN`.

---

## 7. Suggested fix order

**First — data loss and lies.** CUST-01 (archived jobs destroyed), CUST-03 (bulk actions
report false success, repo-wide), CUST-02 + CUST-10 (failures render as empty or as nothing
at all). These four are the difference between "rough edges" and "cannot be trusted".

**Second — numbers and stored data.** CUST-04, CUST-05, CUST-06, CUST-11 make displayed
figures wrong; CUST-07, CUST-08, CUST-09 corrupt or fail to constrain what gets stored. Do
CUST-11 before CUST-04, since the empty-string writes are what force the read-side
special-casing.

**Third — the structural cleanups**, which remove whole categories rather than instances:
one `lib/phone.ts` (CUST-07, CUST-08, CUST-31), a `GET /customers/:id/summary` (CUST-05,
CUST-15, and suggestion 2), and the TanStack Query migration of the detail subtree (CUST-22,
CUST-14, and the `refreshKey` remount hack).

**Fourth — the half-built features.** CUST-12 (tags) has the best value-to-effort ratio on
the page. CUST-24 (sort) and CUST-23 (restore) are small. CUST-13/19/20 are deletions.

**Throughout — close the pattern, not the instance.** Every fix above should be grepped
repo-wide before it is marked done. CUST-03 alone spans 22 endpoints.
