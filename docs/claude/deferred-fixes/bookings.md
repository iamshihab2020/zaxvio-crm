# Deferred Fixes: Bookings

> **Last audited:** 2026-04-13
> **Flows audited:** Public Booking Submit → Customer → Tenant | Booking → Job Conversion | Schedule/Availability → Tenant | Frontend Booking Form (5 steps)

---

## Critical — Fix Immediately

### DF-BK-01: DELETE /bookings/:id missing tenantId in UPDATE WHERE clause `FIXED 2026-04-14`

- **Severity:** CRITICAL (defense-in-depth violation, TOCTOU risk)
- **File:** `apps/api/src/routes/bookings/index.ts` lines 582-586
- **Problem:** The cancel-booking UPDATE only uses `eq(bookings.id, id)` with no `eq(bookings.tenantId, tenantId)`. The existence check above verifies ownership, but the write query does not — violating defense-in-depth. Any TOCTOU race between check and write could cancel another tenant's booking.
- **Fix:** Add tenant filter to the update:
  ```typescript
  .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
  ```

---

### DF-BK-02: Hardcoded "America/Chicago" in availability routes `FIXED 2026-04-14`

- **Severity:** CRITICAL (wrong behavior for non-Central-timezone tenants)
- **File:** `apps/api/src/routes/availability/index.ts` lines ~64 and ~150
- **Problem:** `GET /availability` and `POST /availability/overrides` use `getTenantToday("America/Chicago")` instead of the tenant's actual timezone. Tenants in NY, LA, or UTC will get wrong "today" calculations for the past-date guard and override filtering.
- **Fix:** Load tenant timezone from DB and pass it:
  ```typescript
  const tenant = await db.select({ timezone: tenants.timezone })
    .from(tenants).where(eq(tenants.id, tenantId)).then(r => r[0]);
  const today = getTenantToday(tenant?.timezone ?? "America/Chicago");
  ```

---

### DF-BK-03: Pipeline stage name used as job status in convert-to-job `NOT A BUG`

- **Severity:** CRITICAL (data corruption — arbitrary strings as job status)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~391-407
- **Problem:** The conversion sets `status = selectedStage.name` where the stage name could be "Awaiting Parts" or "Initial Consultation" — any free-text string. Job status is supposed to be a predefined enum value (`scheduled`, `in_progress`, etc.). This breaks filtering, reporting, and status-machine guards throughout the app.
- **Fix:** Map to a fixed default status (e.g., `"scheduled"`) for newly-converted jobs. The pipeline stage is already stored on the job separately — no need to conflate status and stage name.

---

### DF-BK-04: Wrong platform event type on booking→job conversion `FIXED 2026-04-14`

- **Severity:** HIGH (bad analytics — every conversion counted as a new booking)
- **File:** `apps/api/src/routes/bookings/index.ts` line ~524
- **Problem:** After converting a booking to a job, the code emits `emitPlatformEvent(tenantId, "booking_received", userId)` instead of `"job_created"`. Pollutes analytics dashboards.
- **Fix:** Change to `emitPlatformEvent(tenantId, "job_created", userId)`.

---

## High — Data Integrity / Security

### DF-BK-05: Case-sensitive email matching in public booking submit `FIXED 2026-04-14`

- **Severity:** HIGH (duplicate customer records for same person)
- **File:** `apps/api/src/routes/public/booking.ts` lines ~409-415
- **Problem:** Customer lookup uses `eq(customers.email, trimmedEmail)` which is case-sensitive in PostgreSQL. `John@Example.com` won't match `john@example.com`, creating duplicate customer records.
- **Contrast:** `bookings/index.ts` convert-to-job correctly uses `eq(sql\`lower(${customers.email})\`, booking.customerEmail.toLowerCase())`.
- **Fix:** Use case-insensitive match: `eq(sql\`lower(${customers.email})\`, body.customerEmail.toLowerCase())`

---

### DF-BK-06: Customer OR-match allows phone to shadow email match `FIXED 2026-04-14`

- **Severity:** HIGH (wrong customer linked to booking)
- **File:** `apps/api/src/routes/public/booking.ts` lines ~398-423
- **Problem:** The single query uses `or(eq(email), eq(phone))` with `LIMIT 1`. Row ordering is non-deterministic — a different customer matching by phone could shadow the correct email match, linking the booking to the wrong customer.
- **Fix:** Run two sequential queries — email first, fall back to phone only if no email match found:
  ```typescript
  let customer = email ? await db.select()...where(and(tenantId, lower(email))).limit(1) : null;
  if (!customer && phone) {
    customer = await db.select()...where(and(tenantId, eq(phone))).limit(1);
  }
  ```

---

### DF-BK-07: Race condition — customer creation outside transaction `FIXED 2026-04-14`

- **Severity:** HIGH (duplicate customers from concurrent submissions)
- **File:** `apps/api/src/routes/public/booking.ts` lines ~396-490
- **Problem:** Customer lookup/creation happens outside the booking insert transaction. Two concurrent submissions with the same new email: both find no customer, both create one → duplicate customers.
- **Fix:** Move customer upsert inside the transaction, or use `INSERT ... ON CONFLICT (email) DO UPDATE` to make it atomic.

---

### DF-BK-08: `convertedToJobId` never written on booking row `FIXED 2026-07-27`

> ⚠️ **This was marked `FIXED (pre-existing)` in April and it was not true.** The column
> stayed permanently NULL until 2026-07-27. Re-found as
> [[bookings-calendar#BOOK-06|BOOK-06]]. The lesson is in the status word, not the
> finding: *"pre-existing"* meant nobody had run it. Verify a `FIXED` claim before
> inheriting it.

- **Severity:** HIGH (data inconsistency — column exists but is always null)
- **File:** `apps/api/src/routes/bookings/index.ts`
- **Problem:** The `bookings` schema has `convertedToJobId` column but the convert-to-job handler never sets it. The list endpoint works around this by joining `jobs` on `bookingId`, but the booking record itself is incomplete. Code reads `lockedBooking.convertedToJobId` for the duplicate guard, which always passes because the field is always null.
- **Downstream:** `GET /bookings/:id` did not join `jobs`, so the detail sheet always saw
  `null` and kept offering **Convert to Job** on a booking that already had one — which
  400s and, before `BOOK-01`, emailed the customer a second confirmation.
- **Fixed by:** writing `convertedToJobId` inside the transaction, joining the job in the
  detail endpoint, gating the button on the link, and a backfill in
  `20260727000001_booking_calendar_audit.sql`. The dead `convertedToJobId` read was
  removed from `lockedBooking` — the real guard is the `existingJob` lookup on
  `jobs.bookingId`, which always worked.

---

### DF-BK-09: Bulk status update bypasses status machine guards `FIXED 2026-04-14`

- **Severity:** HIGH (invalid lifecycle transitions — cancelled booking reset to pending)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~720-756
- **Problem:** The bulk status update applies the new status to all selected bookings regardless of their current status. A `cancelled` booking can be reset to `pending`. The single PATCH endpoint has status machine validation, but bulk does not.
- **Fix:** Mirror the single-endpoint status transition logic — add a `VALID_TRANSITIONS` map and filter bookings by eligible current state before updating.

---

### DF-BK-10: Convert-to-job doesn't match customer by phone `FIXED 2026-04-14`

- **Severity:** HIGH (customer not linked when booking has phone-only)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~334-353
- **Problem:** If a booking has only a phone (no email), convert-to-job always creates a new customer even if one exists with that phone. The public submit handler at least tries phone matching.
- **Fix:** Add phone fallback in convert-to-job customer lookup, matching the public submit logic.

---

### DF-BK-11: Race condition — lazy-seeding of availability has no concurrency guard `FIXED 2026-04-14`

- **Severity:** HIGH (duplicate availability rows from concurrent requests)
- **File:** `apps/api/src/routes/availability/index.ts` (GET /availability) and `apps/api/src/routes/public/booking.ts` (GET /public/booking/:slug/availability)
- **Problem:** Both endpoints check `if (scheduleRows.length === 0)` then insert 7 default rows. Two concurrent requests both see 0 rows → both insert → 14 rows for 7 days. No unique constraint on `(tenantId, dayOfWeek)` to prevent this.
- **Fix options:**
  1. Add unique index `CREATE UNIQUE INDEX IF NOT EXISTS ON availability_schedules (tenant_id, day_of_week)` + use `onConflictDoNothing` on inserts.
  2. Move lazy-seeding inside a database transaction with `SELECT ... FOR UPDATE`.

---

## Medium — Validation Gaps

### DF-BK-12: `preferredTime` validates format but not value range `FIXED 2026-04-14`

- **Severity:** MEDIUM (accepts `99:99` or `25:61`)
- **File:** `apps/api/src/lib/schemas/public-booking.ts` line ~46
- **Problem:** Regex `/^\d{2}:\d{2}$/` accepts semantically invalid times. Downstream slot-checking string comparisons behave incorrectly with invalid values.
- **Fix:** Use `.refine()`:
  ```typescript
  z.string().regex(/^\d{2}:\d{2}$/).refine((t) => {
    const [h, m] = t.split(":").map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, "Invalid time")
  ```

---

### DF-BK-13: `bookingDate` validates format but not calendar validity `FIXED 2026-04-14`

- **Severity:** MEDIUM (accepts `2025-13-45`, `2025-02-30`)
- **File:** `apps/api/src/lib/schemas/public-booking.ts` line ~43
- **Problem:** Regex `/^\d{4}-\d{2}-\d{2}$/` accepts invalid dates. String-based comparisons like `body.bookingDate < tomorrow` behave unpredictably.
- **Fix:** Use `.refine()` with `new Date(val).getFullYear() === year` check, or use `z.coerce.date()` then convert to string.

---

### DF-BK-14: No phone format or length validation `FIXED 2026-04-14`

- **Severity:** MEDIUM (arbitrary strings accepted, including very long ones)
- **File:** `apps/api/src/lib/schemas/public-booking.ts` line ~39
- **Problem:** `customerPhone` is `z.string().optional()` — no format, no max length. Could accept megabyte-length strings or control characters.
- **Fix:** Add `.max(20).regex(/^[\d\s\+\-\(\)\.]+$/)` or similar.

---

### DF-BK-15: `customerName` has no max length `FIXED 2026-04-14`

- **Severity:** MEDIUM (DoS via very long name stored in DB + email templates)
- **File:** `apps/api/src/lib/schemas/public-booking.ts` line ~34
- **Problem:** Only `.min(2)`, no `.max()`. A megabyte-length name would be stored and potentially render in email templates, PDFs, and dashboard tables.
- **Fix:** Add `.max(100)`.

---

### DF-BK-16: No slot alignment validation on booking submit `FIXED 2026-04-14`

- **Severity:** MEDIUM (off-hour submissions like "08:37" are accepted)
- **File:** `apps/api/src/routes/public/booking.ts` line ~385
- **Problem:** The submit endpoint validates the time is within the availability window but not that it falls on a whole-hour slot boundary. The slot generator only produces on-the-hour slots, but submit doesn't enforce this.
- **Fix:** Add check: `if (preferredTime.split(":")[1] !== "00") return 400`.

---

### DF-BK-17: `generateTimeSlots` ignores minutes in start/end times `FIXED 2026-04-14`

- **Severity:** MEDIUM (first slot wrong if availability starts at :30)
- **File:** `apps/api/src/routes/public/booking.ts` lines ~104-113
- **Problem:** `const [startH] = startTime.split(":").map(Number)` discards the minutes. If availability is `08:30`-`17:00`, the first slot generated would be `08:00` (before the window opens).
- **Fix:** Round up to next whole hour if minutes > 0, or support half-hour slots.
- **Half-fixed.** April fixed the *start* and left `const [endH] = endTime.split(":")`, so
  `09:00–17:30` still stopped at 16:00 and the 17:00 slot was unsellable. Re-found as
  [[bookings-calendar#BOOK-23|BOOK-23]] and fully fixed 2026-07-27 in
  `services/availability.service.ts` — both ends now read their minutes.

---

### DF-BK-18: Month-end calculation uses server local timezone `FIXED 2026-04-14`

- **Severity:** MEDIUM (off-by-one date on non-UTC servers)
- **File:** `apps/api/src/routes/public/booking.ts` line ~172
- **Problem:** `new Date(year, monthNum, 0).toISOString().split("T")[0]` — `toISOString()` converts to UTC, so on servers with UTC+ offset the last day of month is shifted one day earlier.
- **Fix:** Calculate last-of-month purely from string arithmetic or use `date-fns`/`Temporal` with explicit timezone.

---

### DF-BK-19: `getTenantTomorrow` fragile on non-UTC developer machines `FIXED 2026-04-14`

- **Severity:** MEDIUM (silent wrong date in local dev, fine on Vercel/UTC servers)
- **File:** `apps/api/src/lib/timezone.ts` lines ~15-21
- **Problem:** `new Date(todayStr)` parses the tenant-localized date string in the **server's** local timezone, not the tenant's. On UTC this is correct; on UTC+5 it produces a date one day too early.
- **Fix:** Use `Temporal.ZonedDateTime` or construct the next day purely via string: parse year/month/day from `todayStr`, increment day, reformat.

---

## Missing Features / Low Severity

### DF-BK-20: No notification dispatched for job created via booking conversion `FIXED 2026-04-14`

- **Severity:** LOW (team members not notified of new job)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~515-530
- **Problem:** `convertQuoteToJob`/conversion calls `emitPlatformEvent` but not `dispatchNotification`. Team members get no in-app or email alert when a booking becomes a job.
- **Fix:** Add `await dispatchNotification(tenantId, { type: "job_created", entityId: job.id, ... })`.

---

### DF-BK-21: No activity log for booking status changes `FIXED 2026-04-14`

- **Severity:** LOW (no audit trail for booking status lifecycle)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~216-262 (PATCH)
- **Problem:** Status changes (pending → confirmed, confirmed → completed) are not logged anywhere. Jobs, quotes, and customers all have activity tables.
- **Fix:** Add a `bookingActivities` table (or reuse `customerActivities` with `entityType = 'booking'`) and log status transitions.

---

### DF-BK-22: No customer/team notification when booking is cancelled `FIXED 2026-04-14`

- **Severity:** LOW (customer has no way to know booking was cancelled)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~556-590
- **Problem:** The cancel endpoint updates status but sends no customer-facing email and no team in-app notification.
- **Fix:** Add `dispatchNotification` call and optionally send cancellation email (E-type template needed).
- **Half-fixed.** April added the *team* notification only — the customer, who was emailed
  when the booking was made, was still never told it was cancelled. Re-found as
  [[bookings-calendar#BOOK-24|BOOK-24]]. Fixed 2026-07-27: new **E-14** template
  (`packages/email/src/templates/e14-booking-cancelled.tsx`) with a rebook link, plus the
  response now reports any linked job so the UI can ask what to do about the work.

---

### DF-BK-23: No confirmation email when booking confirmed via PATCH `FIXED 2026-04-14`

- **Severity:** LOW (customer never knows their booking was confirmed)
- **File:** `apps/api/src/routes/bookings/index.ts` lines ~216-262
- **Problem:** Confirmation email (E-04) is only sent in convert-to-job, not when admin simply sets status to "confirmed". Most small operators confirm then later convert — the customer is left waiting.
- **Fix:** Trigger E-04 email when `status` changes to `"confirmed"`.

---

### DF-BK-24: Stale slot cache in frontend booking form `FIXED 2026-04-14`

- **Severity:** LOW (double-booking UX confusion, backend correctly rejects)
- **File:** `apps/web/src/app/book/[slug]/booking-form-client.tsx` lines ~89-130
- **Problem:** All 3 months of availability and all slot data is pre-fetched on mount and never refreshed. After 10+ minutes on the form, data is stale. The backend will correctly reject double-bookings (409), but UX is poor — user goes through the whole form only to get an error.
- **Fix:** Add a `lastFetched` timestamp; refresh slot data for the selected date if older than 5 minutes, or when reaching step 3.

---

### DF-BK-25: Frontend requires phone; API allows email-only `FIXED (pre-existing)`

- **Severity:** LOW (customers without phone cannot book despite API supporting it)
- **File:** `apps/web/src/components/dashboard/` (booking step info component)
- **Problem:** The booking form marks phone as required (`canSubmit` depends on phone). The API only requires "phone or email". Customers who want to provide only email are blocked by the frontend.
- **Fix:** Update `canSubmit` logic to accept either phone or email.

---

### DF-BK-26: Public booking status endpoint has no rate limiting `FIXED 2026-04-14`

- **Severity:** LOW (booking detail accessible to anyone with booking UUID)
- **File:** `apps/api/src/routes/public/booking.ts` (GET /public/booking/:slug/status/:bookingId)
- **Problem:** Returns `customerName`, `serviceType`, `address`, `status` for any valid UUID. No auth required, no rate limiting beyond global 100/min.
- **Fix:** Add route-level rate limit (10/min per IP) or require a confirmation token in the URL.

---

## Fixed Issues

- **DF-BK-01** (2026-04-14) — Added tenantId to cancel UPDATE WHERE clause
- **DF-BK-02** (2026-04-14) — Availability routes now load tenant timezone from DB
- **DF-BK-03** — NOT A BUG: jobs.status stores pipeline stage name by design (used for kanban matching)
- **DF-BK-04** (2026-04-14) — Changed platform event to "job_created"
- **DF-BK-05** (2026-04-14) — Case-insensitive email matching via `lower()`
- **DF-BK-06** (2026-04-14) — Sequential email-first, phone-fallback lookup
- **DF-BK-07** (2026-04-14) — Customer lookup+creation moved inside booking transaction
- **DF-BK-08** (2026-07-27) — `convertedToJobId` written in the transaction + backfilled. ⚠️ *This line previously read "(pre-existing) — is set"; it was never set. See the entry above.*
- **DF-BK-09** (2026-04-14) — Bulk status update now validates transitions via VALID_TRANSITIONS map
- **DF-BK-10** (2026-04-14) — Convert-to-job now checks phone fallback after email
- **DF-BK-11** (2026-04-14) — Added unique index on (tenant_id, day_of_week) + onConflictDoNothing
- **DF-BK-12** (2026-04-14) — preferredTime validated for 0-23h, 0-59m range
- **DF-BK-13** (2026-04-14) — bookingDate validated as real calendar date
- **DF-BK-14** (2026-04-14) — Phone format regex + max(20) length
- **DF-BK-15** (2026-04-14) — customerName max(100) added
- **DF-BK-16** (2026-04-14) — Slot alignment validation (must end in :00)
- **DF-BK-17** (2026-04-14, completed 2026-07-27) — generateTimeSlots rounds up start minutes. ⚠️ *The **end** minutes were still discarded until BOOK-23.*
- **DF-BK-18** (2026-04-14) — Month-end calculated via string arithmetic, not toISOString()
- **DF-BK-19** (2026-04-14) — getTenantTomorrow/getMaxBookingDate use Date.UTC construction
- **DF-BK-20** (2026-04-14) — dispatchNotification on booking→job conversion
- **DF-BK-21** (2026-04-14) — Booking activities table + activity logging on PATCH status change and cancel
- **DF-BK-22** (2026-04-14, completed 2026-07-27) — dispatchNotification (booking_cancelled) on cancel endpoint. ⚠️ *Team only; the **customer** was not emailed until E-14 (BOOK-24).*
- **DF-BK-23** (2026-04-14) — E-04 confirmation email sent when PATCH sets status to "confirmed"
- **DF-BK-24** (2026-04-14) — Stale slot refresh (5-min threshold) on date select in booking form
- **DF-BK-25** (pre-existing) — API validates "phone or email" correctly
- **DF-BK-26** (2026-04-14) — Rate limit (10/min) on public booking status endpoint
