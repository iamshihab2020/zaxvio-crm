# Lessons: Booking & Availability Flows

> Related: [[API_DOCUMENTATION_4|API Docs: Bookings]] | [[deferred-fixes/README|Deferred Fixes]] | [[jobs-customers]] | [[lessons]]

## Booking & Availability Flows (2026-04-13)

- **Two initialization code paths diverge silently** — The `afterCreate` hook in `auth.ts` and the `/tenants/initialize` route both seed tenant data, but the hook only seeds pipeline stages (not availability schedules). When the hook succeeds, `/initialize` returns early ("already exists") without seeding availability. Result: tenants with no public booking availability. Fix: always seed each child resource idempotently, regardless of whether the tenant row already existed.
- **Hardcoded timezone in availability routes** — `GET /availability` and `POST /availability/overrides` used `getTenantToday("America/Chicago")` instead of the tenant's actual timezone. Public booking routes correctly resolved `tenant.timezone`. Whenever using `getTenantToday()`/`getTenantTomorrow()`, load the tenant timezone from the DB — never hardcode.
- **Pipeline stage name ≠ job status** — The booking→job conversion set `job.status = selectedStage.name` (a free-text label like "Awaiting Parts"). Job status must be from the predefined enum set. When creating a job from a booking/quote, always default to a fixed status like `"scheduled"` — the pipeline stage is stored separately.
- **Wrong platform event on conversion** — `emitPlatformEvent(tenantId, "booking_received")` was emitted after a booking→job conversion instead of `"job_created"`. Always match the event type to the action that just happened, not the trigger.
- **Defense-in-depth on every write query** — `DELETE /bookings/:id` had a TOCTOU: it verified ownership via a SELECT, then did an UPDATE with only `eq(bookings.id, id)` — no tenant filter. The ownership check is insufficient; every UPDATE/DELETE must include `tenantId` in the WHERE clause.
- **Case-insensitive email matching is required in every query** — Customer lookup by email must use `lower(${customers.email})` = `email.toLowerCase()`. Plain `eq(customers.email, email)` is case-sensitive in Postgres and creates duplicate customers. Inconsistent matching between submit (case-sensitive) and convert-to-job (case-insensitive) is a common drift pattern.
- **OR-based customer matching is non-deterministic** — Using `or(eq(email), eq(phone))` with LIMIT 1 returns whichever row PostgreSQL scans first — not the "most relevant" one. Always use prioritized sequential queries: email first, phone fallback.
- **Customer creation outside transaction = duplicate customers** — The customer lookup+create in public booking submit was outside the booking INSERT transaction. Two concurrent requests for the same new customer both find no match → both create → duplicates. Move customer upsert inside the same transaction, or use `INSERT ... ON CONFLICT DO NOTHING` with a subsequent SELECT.
- **`convertedToJobId` and similar FK columns — always write them** — The bookings schema had a `convertedToJobId` column that was read during duplicate-check but never written after conversion. The column was always null, making the duplicate guard a no-op. When a conversion FK exists, write it immediately after the conversion completes.
- **`getTenantTomorrow` is server-timezone-dependent** — `new Date(todayStr)` parses the tenant-localized date string in the **server's** local timezone. On Vercel (UTC) this is fine; on a UTC+5 dev machine it produces a wrong date. Use string arithmetic to add one day rather than parsing through JavaScript's Date constructor.
- **Lazy-seeding without a unique index = duplicate rows on concurrent access** — Both the availability GET and the public booking availability GET had "if 0 rows, insert 7 default rows" logic. Two concurrent requests → 14 rows. Add a unique index on `(tenant_id, day_of_week)` and use `onConflictDoNothing` on seed inserts.
- **Bulk status endpoints must mirror single-endpoint business rules** — Bulk status update for bookings skipped the status machine guard that single PATCH had (no reverting cancelled → pending). Always replicate the same business rules in bulk endpoints.

## Booking Portal

- **Auto-create customer at booking submission, not at convert-to-job** — When a customer submits a public booking, immediately match by email or phone to an existing customer record, or create a new one. This way the contractor sees a linked customer from day one (can view history, previous bookings). The convert-to-job flow just uses the already-linked `customerId`. Match priority: email first (most reliable), then phone. Split `customerName` into `firstName`/`lastName` on first space.
- **~~Pre-fetch all availability data on page load~~ — WRONG, reverted 2026-07-27.** This lesson said to fetch 3 months of dates *and* the time slots for every one of those dates while the customer picks a service. With the default Mon–Fri seed that is 47 slot requests, 51 in total, against a 100/min production limit — **51% of the budget for one page load**, and a 429 for the entire app after two. Worse, the requests go through Next server actions, so `@fastify/rate-limit` keys them all to the Next server's IP and every visitor shares one bucket. The correct shape: prefetch the *dates* (3 requests, drives the calendar), fetch *slots* on date-select (1 request, behind a spinner nobody notices). **A prefetch that scales with the data is not a prefetch, it is a load test you ship to customers.**
- **Lazy-seed default availability for existing tenants** — Tenants created before availability seeding was added have zero `availability_schedules` rows. Both the authenticated `GET /availability` and public `GET /public/booking/:slug/availability` endpoints must lazy-seed Mon-Fri 8am-5pm defaults if no rows exist. Without this, all calendar dates show as unavailable.

## Public Quote Acceptance (2026-04-11)

- **Token-based access, not slug-based, for sensitive data** — The booking portal uses tenant slug (public branding info). Quotes contain pricing data — use a UUID access token per quote to prevent enumeration. Token is generated at send-time and stored on the quotes table.
- **`viewQuoteUrl` was in the email template but never populated** — The `e13-quote.tsx` template had a conditional button for `viewQuoteUrl` but the send endpoint never passed it. Always check if template props are actually wired when adding email features.
- **Extract shared helpers before building public endpoints** — The convert-to-job logic was inline in the quotes route (100+ lines). Extracting `convertQuoteToJob()` first avoids duplication between internal `POST /quotes/:id/convert` and public `POST /public/quote/:token/accept` (auto-convert).
- **Explicit column selects in GET endpoints need manual updates** — The `GET /quotes/:id` endpoint uses `.select({ id: quotes.id, ... })` with explicit columns. Adding new columns to the Drizzle schema doesn't auto-include them — you must add each new field to the select. Easy to miss.
- **`updateTenant` action has a hardcoded type** — The server action's parameter type is manually defined (not inferred from schema). When adding new tenant settings columns, you must update both the API's `allowedFields` array AND the action's TypeScript interface.
- **Don't duplicate booking UX inside other portals** — Embedding `BookingStepDate`/`BookingStepTime` inside the quote acceptance portal duplicated availability fetching, error handling, and introduced stale React state bugs (setState + immediate function call). Simpler approach: link to the existing booking portal with customer data pre-filled via URL query params (`/book/[slug]?name=...&email=...&phone=...`). Less code, fewer bugs, single source of truth for scheduling.
- **React setState is async — never read state immediately after setting it** — `setScheduledTime(time); handleAccept()` reads `scheduledTime` which is still `null`. Pass values directly as function parameters instead of relying on state that hasn't re-rendered yet.

## Bookings & Calendar Audit (2026-07-27)

Full page audit + remediation — 34 findings, all fixed. See [[bookings-calendar|the report]].

- **`reply.send()` returns the reply, and a reply object is truthy.** So
  `const x = await tx().catch(err => reply.status(400).send(...))` followed by
  `if (!x) return` **never returns**. The failed path ran on: a `job_created` analytics
  event for a job that didn't exist, a notification whose `entityId` was `undefined`, and
  a second *"your booking is confirmed"* email to the customer. Destructuring instead
  (`const [row] = await tx().catch(...)`) fails differently and just as badly — a reply is
  not iterable, so it throws `TypeError` *after* the 409 is already on the wire. **Never
  return a reply from a `.catch()`.** Use `try`/`catch` around the `await` and reply
  inside the `catch`, where `return` actually returns.
- **Three surfaces answering "are we open?" is three different answers.** The portal
  blocked slots only against other portal bookings; the calendar shaded hours from the
  weekly schedule and ignored date overrides; `PATCH /bookings/:id` validated nothing at
  all. So a contractor could close 25 December and still see it as a working day, and a
  day full of phone-booked jobs was still sold through the portal. One
  `services/availability.service.ts` collapsed four findings into one implementation.
  **When the same question is asked by N surfaces, the answer belongs in one function.**
- **Occupancy is intervals, not string equality.** The old check compared a slot label to
  an existing booking's `preferred_time`, so a job running 09:30–10:30 blocked nothing.
  Overlap (`a.start < b.end && a.end > b.start`) is the only correct test, and it has to
  span bookings **and** jobs **and** calendar events — the portal's entire promise is
  preventing double-booking, and it knew about a third of the calendar.
- **Hardening one schema is not hardening the field.** April validated
  `bookingDate`/`preferredTime` on the *public* submit body. The dashboard `PATCH` took
  the same two fields and accepted `"infinity"`, `"tomorrow"` and a 100 KB address.
  Postgres resolves the relative ones in the **session** timezone (UTC on Neon), and
  `infinity` stores a booking that matches no date query and renders as `Invalid Date`
  everywhere. Validators belong in `schemas/common.ts` (`isoDate`, `isoTime`, `isoMonth`,
  `boundedText`) and get applied to every schema touching that column.
- **Two half-fixes are indistinguishable from a fix in a log.** `DF-BK-17` fixed the slot
  *start* minutes and left the *end* ones. `DF-BK-22` added the *team* cancellation
  notification and not the *customer* one. Both read `FIXED` in the deferred-fixes log.
  So did `DF-BK-08`, which was never done at all. **Spot-check a `FIXED` claim before
  inheriting it** — 25/26 held up, and the one that didn't was the highest-severity.
- **Test the boundary the finding is actually about.** My first fix for the dropped
  end-minutes still dropped the 17:00 slot on a 17:30 close: I wrote "the hour must fit
  before closing" when the rule is "the slot must start before closing". It read
  correctly. The harness on `09:00–17:30` is what caught it.
- **A settings toggle that only shapes an outgoing email is not a switch.**
  `quoteOnlineAcceptanceEnabled` is read in exactly one place — deciding whether the E-13
  email carries a portal link — while the public `GET`/`accept`/`decline` routes never
  consult it. Turning it off stops new links being *sent* and leaves every previously
  issued link fully live. For any public-token surface, enforce the kill switch in the
  resolver that loads the record, not at the call site that hands the URL out.
- **Token routes need the row lock, not just the status check.** The public quote accept
  and decline both do resolve → `if (status !== "sent")` → update, with no transaction.
  Two tabs both pass the check: an accept racing a decline ends with the quote `declined`
  and a real scheduled job created by the accept path. The convert helper next door
  already had the pattern (`SELECT … FOR UPDATE` inside a transaction) — the guard belongs
  on every unauthenticated state change, not only the one that creates a row.
- **`status = 'sent'` is a side effect, not a value — do not let anything set it directly.** Sending
  a quote mints the access token, renders the PDF and emails the customer. A bulk endpoint that
  wrote the status directly produced quotes with no token and no PDF which `/send`, `PATCH` and
  `DELETE` then all refused, because all three require `draft` — unusable *and* undeletable. The
  durable fix was to leave `draft → sent` out of the transition table entirely and drop `sent` from
  the bulk schema's enum, so the illegal state is unrepresentable rather than merely guarded.
