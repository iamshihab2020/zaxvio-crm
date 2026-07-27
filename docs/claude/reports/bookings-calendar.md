# Page Report — Bookings & Calendar

> Related: [[README|Reports Index]] | [[dashboard|/dashboard report]] | [[reports-page|/reports report]] | [[deferred-fixes/bookings|deferred-fixes/bookings]] | [[security-rules]] | [[api-rules]] | [[strict-rules]] | [[booking-availability]] | [[todo]]

**Audited** 2026-07-27 · **Auditor** senior engineer + product design pass
**Status** ✅ `ALL FIXED` 2026-07-27 — 34 findings (4 critical, 9 high, 14 medium, 7 low)

**Verdict** This is the widest surface audited so far and the only one that faces the
public internet. The internals are in better shape than `/reports` was — the
convert-to-job transaction takes a real row lock, booking drag is correctly blocked on
the calendar, and the 26 fixes from the [[deferred-fixes/bookings|April audit]] are mostly
real. But four things are seriously wrong: converting an already-converted booking
**emails the customer a second confirmation** and logs a job that was never created; one
load of the public booking portal consumes **51% of the production rate-limit budget**;
three tenant-scoped writes have no `tenantId` in their `WHERE`; and while the *public*
booking schema was hardened in April, the *authenticated* one was not — it accepts
`bookingDate: "infinity"`.

---

## Remediation — 2026-07-27

All 34 fixed. The structural change is `services/availability.service.ts`: one resolver
answering *"is the business open then, and is that slot free?"*, now used by the public
portal, the internal calendar and dashboard rescheduling. Four findings (`BOOK-09`,
`BOOK-10`, `BOOK-21`, `BOOK-23`) were three surfaces disagreeing about the same
question; they collapse into one implementation. Alongside it,
`services/bookings.service.ts` holds the single status-transition table that `PATCH` and
`bulk-status-update` now share.

**Verified by execution — 105 checks, 105 passing:**

| Exercise | Result |
|---|---|
| Slot generation + occupancy (`generateTimeSlots`, `countOverlapping`) | 20/20 |
| Control flow of both error paths, OLD vs NEW | 19/19 |
| Status machine — all 12 transition pairs, single vs bulk | 10/10 |
| Zod probes: every value the audit found accepted | 56/56 |
| Tenant-filter scan of every `UPDATE`/`DELETE` in `routes/` | 0 remaining |
| `tsc --noEmit`, api + web | exit 0, exit 0 |

**Caught by the verification, not by review:** my first `generateTimeSlots` fix still
dropped the 17:00 slot for a 17:30 close — it required the whole hour to *fit* before
closing. The rule is that a slot is sellable if it *starts* before closing. The harness
failed on `09:00–17:30`, which is exactly the case `BOOK-23` was about.

**Scope note.** The sweep flagged in `BOOK-03` is done too: `checklists` items,
`customer_notes`, `jobs` checklist completions, `quote_line_items` and the invoice
review-request write all take `tenantId` now. `customer_tags` was left alone with a
comment — it is a pure join table with no `tenant_id` column, scoped transitively
through a `customerId` the handler has already verified.

**Not covered.** Nothing here has run against real data — Neon still has no tenants
(see [[todo]]). The migration is written and idempotent but unapplied.

---

## 1. Scope & method

| Layer | Files |
|-------|-------|
| Public portal | `app/book/[slug]/{page,booking-form-client}.tsx`, `app/book/[slug]/status/[id]/*`, `components/booking-portal/*` (7 files) |
| Dashboard bookings | `app/(dashboard)/bookings/{page,bookings-page-client,loading}.tsx`, `components/dashboard/bookings/*` (3 files) |
| Calendar | `app/(dashboard)/schedule/*`, `components/dashboard/schedule/*` (8 files) |
| Availability settings | `app/(dashboard)/settings/bookings/*`, `components/dashboard/settings/availability-*` (3 files) |
| Client state | `hooks/queries/{use-bookings,use-calendar}.ts`, `actions/{bookings,calendar-events}.ts` |
| API | `routes/public/booking.ts`, `routes/bookings/index.ts`, `routes/availability/index.ts`, `routes/calendar-events/index.ts` |
| Schemas | `lib/schemas/{public-booking,bookings,availability,calendar-events}.ts` |
| Shared | `lib/timezone.ts`, `lib/notifications.ts`, `lib/platform-events.ts`, `lib/job-helpers.ts` |
| DB | `schema/{bookings,booking-activities,calendar-events}.ts`, `availability_schedules`, `schedule_overrides` |
| Prior audit | [[deferred-fixes/bookings]] — 26 issues, all marked `FIXED` |

**Verified by execution, not by reading:** `BOOK-01`, `BOOK-05` (control-flow harness),
`BOOK-02` (request arithmetic), `BOOK-03` (AST-ish scan of every route file), `BOOK-04`
(Zod probes + the accepted values run against Neon), `BOOK-14` (grep of emitters vs reader).

**Re-checked the April audit's claims.** 25 of 26 hold up. One does not — see `BOOK-06`.

---

## 2. What has been built

```
PUBLIC                             DASHBOARD                    SETTINGS
/book/[slug]                       /bookings                    /settings/bookings
  5-step form                        list + stats + bulk          weekly editor (7 days)
  → /book/[slug]/status/[id]         detail sheet                 date overrides
                                     convert → job
                                   /schedule
                                     month / week / day
                                     jobs + bookings + events
                                     drag to reschedule
```

Four tables back it: `bookings`, `booking_activities`, `calendar_events`,
`availability_schedules` + `schedule_overrides`.

| Endpoint | Auth | Notes |
|---|---|---|
| `GET /public/booking/:slug` | none | branding + service types |
| `GET /public/booking/:slug/availability?month=` | none | available dates for a month |
| `GET /public/booking/:slug/slots?date=` | none | hourly slots, minus taken ones |
| `POST /public/booking/:slug/submit` | none | ~~**no route-level rate limit**~~ → 5/min |
| `GET /public/booking/:slug/status/:id` | none | rate-limited 10/min |
| `GET/PATCH/DELETE /bookings/:id`, `GET /bookings`, `/stats` | requireTenant | |
| `POST /bookings/:id/convert-to-job` | requireTenant | row-locked transaction |
| `POST /bookings/bulk-{archive,restore,delete,status-update}` | requireTenant | |
| `GET/PUT /availability`, `POST/DELETE /availability/overrides` | requireTenant | |
| `GET/POST/PATCH/DELETE /calendar-events` | requireTenant | |

---

## 3. What went well

- **The convert-to-job transaction is properly built.** `SELECT … FOR UPDATE` on the
  booking, then a re-check for an existing job *inside* the lock, then customer resolve →
  job insert → quote line-item copy → checklist attach → status flip → activity log, all
  atomic. This is the most carefully written mutation in the codebase. (Its *error path*
  is broken — `BOOK-01` — but the happy path is right.)
- **Booking drag is correctly prevented, twice.** `draggableAccessor` excludes bookings
  *and* both `onEventDrop`/`onEventResize` early-return on them. I expected to find a bug
  here (dragging a booking would have called `updateJob` with a booking id) and there
  isn't one — the guard is deliberate and doubled.
- **The April hardening of the public submit path is real.** I re-ran the exact payloads:
  `2026-02-30`, `2026-13-45`, `99:99` and a 5,000-character name are all rejected.
  Sequential email-then-phone customer lookup, slot-alignment checks and the unique index
  on `(tenant_id, day_of_week)` with `onConflictDoNothing` are all present as documented.
- **Timezone helpers are correct.** `getTenantTomorrow` / `getMaxBookingDate` build from
  `Date.UTC(...)` on a tenant-localised date string, and `getDayOfWeek` anchors at noon
  UTC. No off-by-one remains.
- **The customer gets a status page.** `/book/[slug]/status/[id]` is more than most
  products at this price point ship, and it is rate-limited.
- **`formatDate` in the detail sheet anchors at `T12:00:00Z` and formats with
  `timeZone: "UTC"`** — the one date formatter in the feature that cannot drift.
- **Availability overrides take precedence over the weekly schedule** in
  `getAvailabilityWindow`, and an unavailable override correctly returns `null` rather
  than falling through.

---

## 4. Findings

### P1 — Critical

<a id="BOOK-01"></a>
#### BOOK-01 · A failed conversion emails the customer a second confirmation · `FIXED (2026-07-27)`

`routes/bookings/index.ts:566-614`. The transaction's `.catch` returns a **reply object**,
and the guard below tests it for falsiness:

```ts
const job = await db.transaction(async (tx) => { … }).catch((err: Error) => {
  if (err.message === "ALREADY_CONVERTED") {
    return reply.status(400).send({ message: "…already been converted…" });
  }
  …
});

if (!job) return;   // ← reply objects are truthy. This never fires.
```

`reply.send()` returns the reply, which is truthy, so execution **continues past the
guard**. Verified with a harness that reproduces the exact pattern:

```
client received: 400 {"message":"already converted"}
guard `if (!job) return` fires? false
-> DOES NOT return. Continues to run:
   emitPlatformEvent(..., "job_created", ...)   <- false analytics event
   dispatchNotification({ entityId: job.id })   <- job.id = undefined
   sendBookingConfirmedEmail(...)               <- duplicate email to the customer
   !! send() called on an already-sent reply
```

So double-clicking **Convert to Job** — or two team members converting the same booking,
or one user retrying after a slow response — produces:

1. a second **"Your booking is confirmed"** email to the customer, from a conversion that
   failed;
2. a `job_created` platform event for a job that does not exist, inflating the activity
   metrics on the super-admin dashboard;
3. a team notification whose `entityId` is `undefined`, so clicking it goes nowhere;
4. a second `reply.send()` on an already-sent reply, which Fastify logs as an error.

This is reachable by an ordinary impatient click. The customer-visible half — a duplicate
confirmation email — is the part that matters.

**Fix:** don't return the reply from the catch. Throw a typed error and map it in one
place, or set a flag:

```ts
let handled = false;
const job = await db.transaction(…).catch((err) => {
  if (err.message === "ALREADY_CONVERTED") { handled = true; reply.status(400).send({…}); return null; }
  if (err.message === "BOOKING_NOT_FOUND") { handled = true; reply.status(404).send({…}); return null; }
  throw err;
});
if (handled || !job) return reply;
```

`BOOK-05` is the same mistake in the public submit route with a different symptom.

---

<a id="BOOK-02"></a>
#### BOOK-02 · One booking-portal page load spends 51% of the API's rate limit · `FIXED (2026-07-27)`

`app/book/[slug]/booking-form-client.tsx:90-137` prefetches, on mount, before the customer
has picked anything:

- 3 months of availability (3 requests), then
- **time slots for every available date in those 3 months**, in batches of 5.

With the default Mon–Fri seed that is 47 dates. Counted deterministically:

```
GET /public/booking/:slug            1
GET .../availability?month=  x3      3
GET .../slots?date=          x47    47
-------------------------------------
TOTAL requests to the Fastify API:  51
Sequential batches (BATCH_SIZE=5):  10 round trips
React re-renders from batch commits: 10

Production global rate limit:       100 / minute / IP   (server.ts:93-96)
Budget consumed by ONE page load:   51%
Page loads before 429:              1.96
```

Two things make this worse than the raw number:

1. **These are Next.js server actions.** The requests reach Fastify from the *Next.js
   server*, not the customer's browser, so `@fastify/rate-limit`'s default `req.ip` key
   is the same for every visitor. The 100/min budget is shared by the booking portal,
   the dashboard, and every other authenticated user. **Two customers opening the booking
   page in the same minute can 429 the whole application.**
2. `POST /public/booking/:slug/submit` — the endpoint that writes rows, creates customers
   and sends two emails — has **no route-level rate limit at all**. Only the read-only
   status page got one ([[deferred-fixes/bookings|DF-BK-26]]). [[security-rules]] §4
   requires them on all public endpoints.

The customer only ever needs slots for **one** date. The prefetch is optimising a click
that costs one request, at the price of 47.

**Fix:** fetch slots for the selected date only (step 2 → step 3 is already a natural
loading boundary, and `refreshSlotsIfStale` already exists for exactly this). Keep the
3-month availability prefetch — that one is cheap and drives the calendar. Then add
route-level limits: `submit` at ~5/min, `slots`/`availability` at ~30/min. If the
server-action indirection is kept, forward the client IP so the limiter keys on the
customer rather than on the Next server.

---

<a id="BOOK-03"></a>
#### BOOK-03 · Three tenant-scoped writes omit `tenantId` · `FIXED (2026-07-27)`

[[security-rules]] §1: *"Every `UPDATE`, `DELETE`, and `SELECT` on tenant-scoped tables
MUST include `tenantId` in the WHERE clause. Never use only the record ID."*

A scan of every route file found three in this feature:

| File | Line | Statement |
|---|---|---|
| `routes/availability/index.ts` | 238 | `.delete(scheduleOverrides).where(eq(scheduleOverrides.id, id))` |
| `routes/calendar-events/index.ts` | 195 | `.update(calendarEvents).where(eq(calendarEvents.id, id))` |
| `routes/calendar-events/index.ts` | 231 | `.delete(calendarEvents).where(eq(calendarEvents.id, id))` |

All three are preceded by an ownership `SELECT`, so they are not *currently* exploitable —
which is exactly what was said about
[[deferred-fixes/bookings|DF-BK-01]] before it was fixed on the bookings route in April.
The rule exists because the check and the write are separated by an `await`, and because
the next person to edit the handler will not know the guard is load-bearing.

**Fix:** three one-line changes to `and(eq(table.id, id), eq(table.tenantId, tenantId))`.

> The same scan surfaced further instances outside this audit's scope — `invoices`,
> `quotes` line items, `checklists` items, `customers` notes, `jobs` checklist
> completions. Each is guarded by a prior ownership check, same as these. They deserve a
> dedicated sweep rather than being fixed blind from here; logged in [[todo]].

---

<a id="BOOK-04"></a>
#### BOOK-04 · The authenticated booking schema accepts `"infinity"` as a date · `FIXED (2026-07-27)`

The April audit hardened the **public** submit schema. The **dashboard** schemas for the
same fields were never touched. Probed both with identical payloads:

```
== PUBLIC submit schema (hardened 2026-04-13) ==
  rejected   bookingDate 2026-02-30
  rejected   bookingDate 2026-13-45
  rejected   preferredTime 99:99
  rejected   customerName 5000 chars

== DASHBOARD PATCH /bookings/:id (same fields, never hardened) ==
  ACCEPTED  bookingDate 2026-02-30        ACCEPTED  preferredTime 99:99
  ACCEPTED  bookingDate 2026-13-45        ACCEPTED  preferredTime 'noon'
  ACCEPTED  bookingDate 'tomorrow'        ACCEPTED  address     100k chars
  ACCEPTED  bookingDate ''                ACCEPTED  description 100k chars
                                          ACCEPTED  notes       100k chars

== GET /bookings list filters ==          == POST /calendar-events ==
  ACCEPTED  dateFrom 'garbage'              ACCEPTED  eventDate 'not-a-date'
  ACCEPTED  dateTo '2026-99-99'             ACCEPTED  eventDate '2026-02-30'
                                            ACCEPTED  startTime '25:99'
                                            ACCEPTED  endTime before startTime
                                            ACCEPTED  title 100k chars
```

Then ran the accepted values against Neon to see what Postgres actually does:

```
ERROR 22008  '2026-02-30'  date/time field value out of range      → HTTP 500
ERROR 22007  ''            invalid input syntax for type date      → HTTP 500
ERROR 22008  '99:99'       date/time field value out of range      → HTTP 500

ACCEPTED  'today'      -> 2026-07-26      ACCEPTED  'epoch'     -> 1970-01-01
ACCEPTED  'tomorrow'   -> 2026-07-27      ACCEPTED  'infinity'  -> infinity
ACCEPTED  'yesterday'  -> 2026-07-25      ACCEPTED  '-infinity' -> -infinity
                                          ACCEPTED  'now'::time -> 21:22:22.996673
```

Two distinct problems:

**Garbage → 500.** Every malformed value becomes an unhandled Postgres error. Ugly, and
it means the reschedule form has no usable validation feedback.

**Postgres magic strings → silently wrong data.** `bookingDate: "tomorrow"` is *accepted*
and stored. Note the resolved value: `2026-07-26`, while the tenant-local date at the time
of the test was `2026-07-27` — Postgres resolves these in the **session** timezone (UTC on
Neon), the exact class of bug the [[dashboard]] pass spent a day removing. And
`bookingDate: "infinity"` stores a booking that matches no date-range query, never appears
on the calendar, cannot be filtered, and renders as `Invalid Date` in every formatter.

**Fix:** lift the public schema's validators into a shared module and apply them to
`updateBookingBody`, `bookingListQuery`, `calendarEventsQuery`, `createCalendarEventBody`
and `updateCalendarEventBody`. There is already a shared `isoDate` in
`lib/schemas/dashboard.ts` — promote it to `lib/schemas/common.ts` alongside a matching
`isoTime`, and add max lengths to every free-text field.

---

### P2 — High

<a id="BOOK-05"></a>
#### BOOK-05 · Slot-taken path throws a TypeError after replying · `FIXED (2026-07-27)`

`routes/public/booking.ts:405-507`. Same shape as `BOOK-01`, different symptom — the
result is **destructured**:

```ts
const [created] = await db.transaction(async (tx) => { … })
  .catch((err) => { if (err.message === "SLOT_TAKEN") return reply.status(409).send({…}); throw err; });
```

Verified:

```
THREW: TypeError: (intermediate value) is not iterable
client already received: 409 {"message":"slot taken"}
```

The customer does get the correct 409, so this is not user-visible — but every
double-booking race throws an unhandled `TypeError` into the Fastify error handler, which
then tries to send a 500 on an already-sent reply. On a public endpoint that is exactly
the log noise you cannot afford when you are trying to diagnose a real incident.

---

<a id="BOOK-06"></a>
#### BOOK-06 · `convertedToJobId` is never written — and the April audit says it is · `FIXED (2026-07-27)`

[[deferred-fixes/bookings|DF-BK-08]] is recorded as
*"FIXED (pre-existing) — `convertedToJobId` is set + duplicate guard via `jobs.bookingId` join"*.

The first half is false. `routes/bookings/index.ts` inserts the job with
`bookingId: booking.id` and never writes back to `bookings.convertedToJobId`. The column is
**permanently NULL**. Three consequences:

1. `GET /bookings` (list) papers over it by joining `jobs` on `bookingId` and synthesising
   the field in the response — so the *table* knows.
2. `GET /bookings/:id` (detail) does a plain `select()` and does **not** join. So the
   detail sheet always sees `convertedToJobId: null`.
3. The sheet therefore renders **Convert to Job** for a booking that already has one
   (`booking-detail-sheet.tsx:141-151`, gated only on status). Clicking it returns 400 —
   and triggers `BOOK-01`, emailing the customer again.

Line 340 also selects `convertedToJobId` into `lockedBooking` and never reads it — a dead
read that makes the code look like it guards on the column when it does not. (The real
guard, the `existingJob` lookup on `jobs.bookingId`, does work.)

**Fix:** write it inside the transaction, and have the detail endpoint return the linked
job. Then gate the button on the linked job, not on status, and show
*"Converted → Job #1043"* with a link.

---

<a id="BOOK-07"></a>
#### BOOK-07 · The booking detail sheet has no error handling and silently loses notes · `FIXED (2026-07-27)`

`components/dashboard/bookings/booking-detail-sheet.tsx` is the last detail view in the
app that never got migrated to TanStack Query — raw `useState` + `useEffect`:

```ts
getBooking(bookingId).then((res) => {
  if (res.data) { setBooking(res.data); setNotes(res.data.notes ?? ""); }
  setLoading(false);          // res.error is never read
});
```

- **A failed fetch is indistinguishable from "not found."** Same class as
  [[reports-page#REP-01|REP-01]].
- **`handleSaveNotes` ignores its result entirely** — no error check, no toast, no
  invalidation. If the save fails the spinner just stops and the user believes it saved.
- **Even on success the local `booking` is never refreshed**, so `notes !== booking.notes`
  stays true and the Save button remains in its unsaved (highlighted) state forever.
- No cache sharing with the list, so a note saved here does not update the row behind it.

---

<a id="BOOK-08"></a>
#### BOOK-08 · `GET /bookings/stats` counts archived bookings · `FIXED (2026-07-27)`

`routes/bookings/index.ts:158-184` filters on `tenantId` only. The list endpoint filters
`archivedAt` (line 61). So after any bulk archive the four stat cards permanently exceed
the table beneath them. Identical to [[reports-page#REP-04|REP-04]] and the same class as
the dashboard pass's archived-filter sweep — this endpoint was simply missed by both.

---

<a id="BOOK-09"></a>
#### BOOK-09 · Rescheduling from the dashboard skips every rule the portal enforces · `FIXED (2026-07-27)`

`PATCH /bookings/:id` puts `bookingDate` and `preferredTime` in `allowedFields`
(line 241) and then validates **nothing**. The public portal, for the same two fields,
enforces: at least 24h out, within 3 months, a real availability window exists, the time
is on the hour, the time is inside the window, and the slot is not already taken.

So the contractor can reschedule a booking into a slot the portal refuses to sell, onto a
day marked closed, into the past, or on top of an existing booking — and the portal will
keep offering that slot to the next customer, because
`GET /slots` only excludes times that exactly match an existing booking's
`preferred_time`.

**Fix:** extract the portal's guards into a shared `assertBookingSlotIsBookable(...)`
used by both paths, with an explicit `force` flag if staff need to override.

---

<a id="BOOK-10"></a>
#### BOOK-10 · The internal calendar ignores schedule overrides · `FIXED (2026-07-27)`

`GET /availability` returns `{ weeklySchedule, overrides }`. `schedule-page-client.tsx:276-283`
reads **only** `weeklySchedule`:

```ts
queryFn: async () => (await getAvailability()).data?.weeklySchedule ?? []
```

and `schedule-calendar.tsx:101-118` shades slots from that alone. So a contractor who
blocks 25 December in Settings sees the portal correctly refuse bookings, while their own
calendar shows it as a normal working day. The two surfaces disagree about when the
business is open — and the internal one is the one used to plan.

---

<a id="BOOK-11"></a>
#### BOOK-11 · The booking→job link has no foreign key; bulk-delete orphans it · `FIXED (2026-07-27)`

`schema/jobs.ts:37` — `bookingId: uuid("booking_id")` with **no `.references()`**. Meanwhile
`schema/bookings.ts:39` has `convertedToJobId` *with* a proper FK — the column that is
never written (`BOOK-06`). The one that carries the real link has no integrity constraint;
the one with the constraint carries nothing.

`POST /bookings/bulk-delete` hard-deletes bookings with no check for a linked job, so a
converted booking can be deleted out from under its job, leaving `jobs.booking_id`
pointing at nothing. The job's origin is then unrecoverable and
`booking_activities` cascades away with it. `calendar_events.jobId` has the same problem.

**Fix:** add the FK (`onDelete: "set null"`), and refuse to bulk-delete bookings that have
a linked job — offer archive instead.

---

<a id="BOOK-12"></a>
#### BOOK-12 · `/bookings` prefetches on the server and throws the result away · `FIXED (2026-07-27)`

`app/(dashboard)/bookings/page.tsx` runs three server-side fetches and passes them down:

```tsx
initialBookings={(bookingsResult.data ?? []) as never[]}
initialPagination={bookingsResult.pagination as never}
initialStats={statsResult.data ?? undefined}
```

`bookings-page-client.tsx` destructures all three props — and then never reads them.
`bookings`, `pagination` and `stats` all come from the queries only (lines 154-157). The
server work is wasted and the user still sees a skeleton on every visit. (`tenantSlug` *is*
used, so the page is not entirely pointless.)

The two `as never` casts also violate [[strict-rules]] §4.

**Fix:** seed the query cache the way [[dashboard]] and [[reports-page]] now do —
`initialData` + `initialDataUpdatedAt`, guarded so it only seeds the matching key.

---

<a id="BOOK-13"></a>
#### BOOK-13 · A failed query renders as an empty calendar · `FIXED (2026-07-27)`

`schedule-page-client.tsx:295-300` — every query is unwrapped with `?? []` and no error is
ever surfaced:

```ts
const jobs = jobsQuery.data ?? [];
const bookings = (bookingsQuery.data?.data ?? []) as BookingData[];
const calEvents = (calEventsQuery.data?.data ?? []) as CalendarEventData[];
```

An expired session, a 500 or a dropped connection paints an empty week. On a scheduling
tool that reads as *"you have nothing on"* — the same failure mode as
[[reports-page#REP-01|REP-01]], on the page where being wrong costs a missed appointment.
`LoadErrorState` already exists in `components/reusable/` from the reports pass.

---

### P3 — Medium

<a id="BOOK-14"></a>
#### BOOK-14 · `?booking=` vs `?bookingId=` — the deep link is broken again · `FIXED (2026-07-27)`

Grep of every emitter against the single reader:

```
READER   bookings-page-client.tsx:115   searchParams.get("bookingId")
emitter  agenda-timeline.tsx:86         /bookings?bookingId=…    ✓
emitter  notification-item.tsx:56       /bookings?bookingId=…    ✓
emitter  schedule-event.tsx:145         /bookings?booking=…      ✗
```

This is the **identical** defect fixed on the dashboard agenda during the
[[dashboard]] pass (`?job=` emitted, `jobId` read) — the schedule component was missed.
Clicking a booking in the calendar's hover preview lands on `/bookings` with the sheet
closed and no indication which booking was meant.

---

<a id="BOOK-15"></a>
#### BOOK-15 · Clicking a booking on the calendar navigates to an unfiltered list · `FIXED (2026-07-27)`

Separately from `BOOK-14`, the main click handler passes no id at all:

```ts
// schedule-page-client.tsx:417 and :596
} else { router.push(`/bookings`); }
```

The page supports `?bookingId=` (that is how notifications open it). Two characters of
change per call site.

---

<a id="BOOK-16"></a>
#### BOOK-16 · Every calendar navigation blanks the whole page · `FIXED (2026-07-27)`

`schedule-page-client.tsx:300` + `:669`:

```ts
const loading = jobsQuery.isLoading || bookingsQuery.isLoading || calEventsQuery.isLoading;
if (loading) return <ScheduleSkeleton />;
```

The date range is part of the query key, so clicking *next week* creates three cold keys →
`isLoading` → the toolbar, filters, sidebar and calendar are all replaced by a skeleton,
then restored. On a calendar, arrow keys are the primary interaction.
`placeholderData: (prev) => prev` fixes it, as it did on [[dashboard]] and [[reports-page]].

---

<a id="BOOK-17"></a>
#### BOOK-17 · The calendar silently truncates at 200 items · `FIXED (2026-07-27)`

Jobs, bookings and calendar events are each fetched with `limit: 200` and no indication
when the cap is hit. A busy month for a 3-person team plausibly exceeds 200 jobs; the
calendar would simply omit the overflow with no warning. Silent truncation on a scheduling
view is worse than an explicit "showing first 200".

---

<a id="BOOK-18"></a>
#### BOOK-18 · `booking_activities` is written and never read · `FIXED (2026-07-27)`

[[deferred-fixes/bookings|DF-BK-21]] added the table and the writes. Grep across the whole
repo finds exactly three references — the import and two `insert` calls, both in
`routes/bookings/index.ts`. There is **no** `GET` endpoint, no server action, no hook and
no UI. Every status change and cancellation has been silently accumulating rows nobody can
see. The detail sheet — which has the empty space for it — shows no timeline.

---

<a id="BOOK-19"></a>
#### BOOK-19 · Bookings can be archived by API but only deleted by UI · `FIXED (2026-07-27)`

The API has `bulk-archive`, `bulk-restore`, and `showArchived` on the list query. The page
has no Active/Archived tabs, no Archive bulk action, and no way to see or restore an
archived booking. What it *does* offer is **Delete** — a hard `DELETE` with
*"This action cannot be undone."*

So the destructive operation is the only one exposed, while the safe reversible one is
unreachable. The Jobs page got Active/Archived tabs during the bulk-actions work; bookings
did not. This also strands anything archived through the API (or by a future bulk flow) in
a state with no UI path back.

---

<a id="BOOK-20"></a>
#### BOOK-20 · Saving availability doesn't refresh the calendar for 5 minutes · `FIXED (2026-07-27)`

`bookings-settings-client.tsx` uses raw `useState`/`useEffect`/server actions — it is not
on TanStack Query. `schedule-page-client.tsx:276-283` caches availability under
`queryKeys.bookings.availability()` with `staleTime: 5 * 60 * 1000`. Saving a new weekly
schedule invalidates nothing, so the calendar keeps shading yesterday's hours for up to
five minutes with no way to force a refresh.

(Also `(s: any)` at `bookings-settings-client.tsx:58` — [[strict-rules]] §4.)

---

<a id="BOOK-21"></a>
#### BOOK-21 · Public slots ignore jobs and calendar events entirely · `FIXED (2026-07-27)`

`routes/public/booking.ts:317-334` blocks a slot only if another **booking** occupies it:

```ts
.from(bookings).where(and(eq(tenantId), eq(bookingDate, dateStr), inArray(status, ["pending","confirmed"])))
```

Jobs created directly (the majority — from quotes, from phone calls, from the Jobs page)
and calendar events do not block anything. A contractor with a full day of work booked
through the dashboard still shows nine open slots to the public. The portal's entire
purpose is to stop double-booking, and it only knows about a third of the calendar.

**Fix:** union the three sources when computing taken times, which is also what the
availability shading should do (`BOOK-10`).

---

<a id="BOOK-22"></a>
#### BOOK-22 · Single and bulk status updates disagree about what's legal · `FIXED (2026-07-27)`

Bulk has a real state machine (`routes/bookings/index.ts:822-826`):
`pending → confirmed|cancelled`, `confirmed → completed|cancelled`, terminals frozen.

Single `PATCH` has only *"is it already terminal?"* (line 237). So `pending → completed`
succeeds one-at-a-time and is rejected in bulk; `confirmed → pending` succeeds singly and
is rejected in bulk. [[deferred-fixes/bookings|DF-BK-09]] fixed bulk and left single as the
loose one — the asymmetry was inverted rather than removed.

---

<a id="BOOK-23"></a>
#### BOOK-23 · `generateTimeSlots` still drops the end-time minutes · `FIXED (2026-07-27)`

`routes/public/booking.ts:105-115`. [[deferred-fixes/bookings|DF-BK-17]] fixed the *start*
(rounding `08:30` up to `09:00`) but the end is still `const [endH] = endTime.split(":")`.
Availability of `09:00–17:30` yields slots through `16:00` — the `17:00` slot is silently
unsellable.

---

<a id="BOOK-24"></a>
#### BOOK-24 · Cancelling a converted booking leaves the job scheduled, and the customer uninformed · `FIXED (2026-07-27)`

`DELETE /bookings/:id` sets the booking to `cancelled`, logs an activity and notifies the
team. It does not touch the linked job, which stays on the calendar and in the pipeline.
And [[deferred-fixes/bookings|DF-BK-22]]'s fix added only the *team* notification — the
customer, who received a confirmation email when it was booked, is never told it was
cancelled. For a service business that is the single most important message in the flow.

---

<a id="BOOK-25"></a>
#### BOOK-25 · The calendar renders in browser time; everything else renders in tenant time · `FIXED (2026-07-27)`

All three converters in `schedule-page-client.tsx` (`jobToEvent`, `bookingToEvent`,
`calEventToCalendarEvent`) build dates as `new Date(\`${dateStr}T${time}\`)` — no offset,
so the browser's zone. `slotPropGetter` likewise uses `date.getDay()` / `getHours()`.

The backend was deliberately taught the tenant's timezone
([[deferred-fixes/bookings|DF-BK-02]], then the [[dashboard]] pass), and the dashboard
agenda now resolves "today" against it. The calendar does not. A laptop in the wrong zone,
or a contractor working away from home, sees a calendar that disagrees with the agenda
widget on the same data.

---

<a id="BOOK-26"></a>
#### BOOK-26 · A 409 leaves the customer looking at a stale slot list · `FIXED (2026-07-27)`

`booking-form-client.tsx:224-229` shows the error on step 4. To retry, the customer goes
back to step 3 — which reads `slotsCache.get(date)`, still containing the slot that was
just refused. `refreshSlotsIfStale` only runs on *date select*, so re-picking the same date
does nothing (it is under the 5-minute threshold). The customer can pick the taken slot
again and get the same 409.

**Fix:** on a 409, evict that date from `slotsCache`/`slotsFetchedAt` and send them to step 3.

---

<a id="BOOK-27"></a>
#### BOOK-27 · `any` casts through the booking data path · `FIXED (2026-07-27)`

[[strict-rules]] §4 forbids `as any`. Present:

| Location | Code |
|---|---|
| `routes/bookings/index.ts:60` | `const filters: any[] = [...]` |
| `routes/bookings/index.ts:64` | `eq(bookings.status, query.status as any)` |
| `bookings/page.tsx:20-21` | `as never[]`, `as never` |
| `bookings-settings-client.tsx:58` | `weeklySchedule.map((s: any) => …)` |
| `schedule-calendar.tsx:39` | `withDragAndDrop(BigCalendar as any) as any` |

The last is a genuine third-party generics problem (rule §4 allows a specific cast for
that); the first four are not. `calendar-events/index.ts:49` shows the right pattern —
`const filters: ReturnType<typeof eq>[]`.

---

### P4 — Low / polish

All `FIXED (2026-07-27)`.

| ID | Finding | Fix |
|----|---------|-----|
| BOOK-28 | One booking per hour per **tenant**, hardcoded. A 3-person team can accept one job an hour through the portal | `tenants.booking_slot_capacity`, edited in Settings → Scheduling; occupancy compares against it |
| BOOK-29 | `GET /bookings/stats` has no Zod schema — [[api-rules]] §6 | `bookingStatsQuery` (an empty object, which is the point: unknown params are stripped) |
| BOOK-30 | Two parallel timezone implementations, `lib/timezone.ts` and `services/analytics/types.ts` | One `todayInTimezone` in `lib/timezone.ts`; analytics re-exports it |
| BOOK-31 | `resizable={false}` yet `onEventResize` wired through three files — dead path that looks live | Handler and prop deleted from all three, with a comment saying what re-enabling resize requires |
| BOOK-32 | A null `organizationId` silently matched nothing, so the owner was never emailed and nothing said so | Explicit branch + `log.warn` naming which of the two cases hit |
| BOOK-33 | Public status page returns name + address for any known booking UUID | Kept, with the threat model written into the handler: v4 UUID, 10/min, UUID-shaped param, no data the requester didn't submit |
| BOOK-34 | Raw `<img>` for the tenant logo — no dimensions, shifts layout on the highest-intent page | `next/image` with `fill` in a fixed 160×56 box, `priority` |

**Checked and *not* a finding** — recorded so the next auditor doesn't re-derive them:
calendar event `color` is looked up through a fixed map (`CALENDAR_EVENT_COLORS[…]`) with a
hex fallback, so an arbitrary `color` string cannot inject CSS; `dispatchNotification` and
`emitPlatformEvent` both catch internally and cannot produce an unhandled rejection;
`new Date(year, monthNum, 0).getDate()` for month length is timezone-safe.

---

## 5. Product & design critique

**The portal is fast in the wrong direction.** It buys instant slot-picking with 51
requests, which is a bad trade even ignoring the rate limit (`BOOK-02`) — it delays first
paint, re-renders the form ten times, and optimises the one interaction the customer only
performs once. The right shape is: prefetch the *calendar* (cheap, 3 requests), fetch
*slots* on date select (1 request, with a spinner nobody notices).

**The portal cannot actually prevent double-booking.** It blocks only against other
portal bookings (`BOOK-21`), and the dashboard can reschedule on top of anything
(`BOOK-09`). For a solo contractor whose calendar is mostly filled from phone calls, the
portal will confidently sell a slot they are already working. This is the feature's core
promise and it is the thing least defended.

**Availability is a single global schedule.** One weekly pattern, one booking per hour, no
per-service duration, no buffer/travel time, no per-technician calendars, no capacity. A
90-minute install and a 20-minute filter change consume identical slots. For the stated
target (1–3 person teams) the missing piece that would matter most is *duration per service
type* — it is the difference between a schedule that works and one the contractor has to
re-do by hand every morning.

**Bookings and the calendar are two products that don't quite know about each other.**
Overrides show in one and not the other (`BOOK-10`); a booking on the calendar can't be
opened (`BOOK-14`, `BOOK-15`); jobs don't block portal slots (`BOOK-21`). The mental model
users will have — *"the calendar is the truth"* — is not implemented anywhere. One
availability resolver, used by portal slots, calendar shading and dashboard rescheduling,
would collapse four findings into one fix.

**The audit trail exists but is invisible.** `booking_activities` has been recording status
changes for months with no reader (`BOOK-18`), while the detail sheet shows a bare notes
box. Jobs, quotes and customers all have timelines. Surfacing the existing rows is a
half-day of work and immediately answers *"who confirmed this and when?"*.

**Nothing tells the customer anything after the confirmation.** No cancellation email
(`BOOK-24`), no reschedule notice, no reminder before the appointment. The status page
exists but nothing links a customer back to it after the initial redirect — it isn't in the
confirmation email. A day-before reminder is the single highest-value message a service
business sends, and the infrastructure (templates, Resend, cron) is already there.

---

## 6. What was done — 2026-07-27

Worked in the order below. All 34 shipped.

**Stopped the customer-visible and security-visible damage**
1. `BOOK-01` · `BOOK-05` — both error paths are now `try`/`catch` around the await, never
   `.catch(() => reply.send(...))`. A reply object is truthy, which is why `if (!job) return`
   never fired and a *failed* conversion emailed the customer a second confirmation.
2. `BOOK-03` — `tenantId` added to the three writes, then to the five found outside this
   scope. Zero remain across `routes/`.
3. `BOOK-02` — the portal prefetches 3 months of *dates* (3 requests) and fetches *slots*
   on date-select. **51 requests → 4.** Route limits added: 60/min reads, 5/min submit,
   10/min status. `INTERNAL_PROXY_SECRET` lets the Next server forward the visitor's IP so
   the limiter stops treating every customer as one caller.
4. `BOOK-04` — `isoDate` / `isoTime` / `isoMonth` / `boundedText` in `schemas/common.ts`,
   applied to every booking, calendar-event and availability schema.

**Correctness**
5. `BOOK-06` — `convertedToJobId` written inside the transaction, detail endpoint joins the
   job, the button is gated on the link (and shows *"Converted to job JOB-0047"* instead).
   Migration backfills the column, NULL since the feature shipped.
6. `BOOK-08` `archivedAt` on `/bookings/stats` · `BOOK-11` FK on `jobs.booking_id`
   (`ON DELETE SET NULL`) and bulk-delete refuses a converted booking, naming the job.
7. `BOOK-09` + `BOOK-10` + `BOOK-21` + `BOOK-23` — one `availability.service.ts`. Overrides
   are honoured everywhere; slots count bookings **and** jobs **and** events as intervals,
   so a 09:30–10:30 job blocks both hours; rescheduling runs the portal's rules with an
   explicit `force` override for staff.
8. `BOOK-22` one transition table in `bookings.service.ts`, used by `PATCH` and bulk.
   `BOOK-28` capacity is a tenant setting.

**Front end**
9. `BOOK-13` calendar error state (whole-page and partial) · `BOOK-07` detail sheet on
   TanStack Query with real error handling and a working Save.
10. `BOOK-16` `placeholderData` · `BOOK-12` SSR seeding into the matching key ·
    `BOOK-17` the 200-row cap is stated instead of silently truncating.
11. `BOOK-14` + `BOOK-15` — `lib/entity-links.ts` is now the only place a deep-link param
    is spelled; every emitter goes through it. `BOOK-19` Active/Archived tabs + bulk
    Archive/Restore.
12. `BOOK-18` activity timeline (endpoint + hook + component) · `BOOK-20` availability on
    TanStack Query, so saving hours refreshes the calendar immediately.
13. `BOOK-24` E-14 cancellation email · `BOOK-25` `lib/tenant-time.ts`, calendar resolves
    "today" in the tenant's zone · `BOOK-26` slot cache evicted on 409 and the customer is
    returned to step 3 · `BOOK-27` `any`s gone.

**Still product work, deliberately not attempted**
Per-service duration and buffer/travel time, per-technician calendars, and a day-before
reminder. Each is a feature, not a fix — see §5. The confirmation email now carries the
status-page link, which was the cheapest item on that list.

---

## 7. Notes for the next auditor

- **Verified by execution — the remediation:** 20/20 slot + occupancy, 19/19 control flow
  (OLD vs NEW side by side), 10/10 status machine, 56/56 Zod probes, 0 tenant-filter
  violations remaining, `tsc` clean on both apps.
- **Verified by execution — the audit:** `BOOK-01` and `BOOK-05` (control-flow harness),
  `BOOK-02` (deterministic request count), `BOOK-03` (scan of every `UPDATE`/`DELETE`),
  `BOOK-04` (Zod probes, then the accepted values executed against Neon), `BOOK-14` and
  `BOOK-18` (repo-wide grep). The rest were read.
- **Not verified:** nothing here has run against real data — Neon still has no tenants
  (see [[todo]]), and `20260727000001_booking_calendar_audit.sql` is unapplied. The FK it
  adds is the one statement that could fail on a database with existing rows; it clears
  dangling `booking_id`s first, but that path has never executed.
- **A harness caught what review didn't.** My first `generateTimeSlots` fix still dropped
  the 17:00 slot on a 17:30 close — I'd written "the hour must fit before closing" when the
  rule is "the slot must start before closing". It read correctly and was wrong. Test the
  boundary case the finding is actually about.
- **The April [[deferred-fixes/bookings|deferred-fixes log]] was 25/26 accurate.**
  `DF-BK-08` claimed `convertedToJobId` was written; it was not (`BOOK-06`) — now it is.
  `DF-BK-17` and `DF-BK-22` were fixed in one direction only (`BOOK-23`, `BOOK-24`).
  Spot-check a `FIXED` claim rather than inheriting it.
- **`BOOK-14` was the third occurrence of the same deep-link mismatch.**
  `lib/entity-links.ts` now owns every param name; a fourth occurrence means someone built
  a URL by hand. Grep for `` `/bookings?`` and `` `/jobs?`` before adding one.
