# Architecture Decision Records

> Related: [[architecture]] | [[REPO_MAP_1]] | [[backend-stack]] | [[tenant-security]] | [[todo]]

Standing decisions and the reasoning behind them. Read before revisiting any of these — the tradeoffs are already worked out here.

---

## ADR-001 — Drop Supabase entirely: Neon + Cloudflare R2 + SSE

**Date**: 2026-07-26
**Status**: Accepted — in progress

### Context

The original Supabase project (`crkwcuudhjmfgdgllnyl`) was deleted. Its subdomain no longer resolves in DNS, which took out three things at once: Postgres, Storage, and Realtime. Postgres was moved to Neon first; Storage and Realtime stayed pointed at the dead project.

The key discovery during the audit: **all six Realtime usages are `broadcast`, not `postgres_changes`.** Broadcast is a pure websocket relay — the API explicitly publishes a message and browsers listening on that channel receive it. It never reads the database WAL. That means Realtime was never coupled to where the data lives, and replacing it does not require a database-aware service.

### Decision

Drop Supabase completely. No component of it remains.

| Concern | Was | Now | Why |
|---|---|---|---|
| Postgres | Supabase | **Neon** | Done 2026-07-26. PostgreSQL 18.4. `prepare: false` carries over unchanged — Neon's pooled endpoint needs it the same way Supabase's transaction pooler did. |
| Object storage | Supabase Storage | **Cloudflare R2** | 10 GB free permanently vs Supabase's 1 GB, and **zero egress fees** vs a 5 GB/month cap. This app is job-photo-heavy, so egress was the binding constraint. S3-compatible, so the SDK is standard. |
| Realtime | Supabase Realtime | **SSE from Fastify** | Every usage was already fire-and-forget broadcast, and we run a long-lived Fastify process. An in-process event bus plus one `text/event-stream` endpoint replaces it with no vendor and no cost. |

### Alternatives rejected

- **A fresh Supabase project for Storage + Realtime only** — would have been ~10 minutes with zero code changes, and Realtime would have kept working (broadcast doesn't care that data is in Neon). Rejected because the free tier caps file storage at 1 GB with 5 GB/month egress, and **free projects pause after 7 days of inactivity**, taking storage and realtime down together. Doing the migration now also costs the least it ever will: the old project is already deleted, so there is no data to migrate.
- **AWS S3** — no longer has a real free tier. Since July 2025 new accounts get a credit-based plan lasting ~6 months, after which the account closes automatically. That is a trial, not a free tier.
- **Local disk for uploads** — free and vendor-free, but most hosts wipe the filesystem on redeploy, so uploads would need a guaranteed persistent volume.
- **Polling instead of SSE** — simplest option, but impersonation approval would lag 5–15s, and it adds constant background request load.

### Consequences / constraints to remember

- **SSE works with a single API instance.** The event bus is in-process, so a second Fastify instance would not see events published by the first. Scaling horizontally requires swapping the bus for Redis pub/sub — the publish/subscribe interface is designed so only `lib/event-bus.ts` changes.
- **Two R2 buckets, not one.** Public vs private is a per-bucket setting in R2. `job-attachments` and `logos` are served by public URL; `invoices` and `quotes` PDFs are streamed through the API and must never be publicly reachable. Merging them into one public bucket would expose invoice PDFs to anyone who guesses a path.
- **All previously uploaded files are gone permanently.** Deleting the Supabase project deleted its objects. Invoice and quote PDFs self-heal — the download path falls through to on-the-fly regeneration when the stored file is missing. Job photos and tenant logos are unrecoverable.
- R2's free tier is 10 GB storage, 1M Class A (write) ops and 10M Class B (read) ops per month, unlimited egress.

### Revisit if

- A second API instance is needed → replace the in-process bus with Redis pub/sub.
- Storage exceeds 10 GB → R2 is $0.015/GB-month beyond the free tier, still with no egress charge.

---

## ADR-002 — One data-access pattern: `api-fetch` → server action → TanStack Query

**Date**: 2026-08-02
**Status**: Accepted — migration in progress

### Context

The [[architecture]] audit found **four** ways to reach the API coexisting, with
nothing naming the intended one (ARC-21):

1. Server action → TanStack Query hook (the majority)
2. Inline `useQuery` in a component, bypassing the hook layer (6 files)
3. Pure RSC — `page.tsx` awaits the action and passes props (all 7 superadmin pages)
4. A bare browser `fetch` to `NEXT_PUBLIC_API_URL` (1 component, propped up by a
   one-endpoint rewrite in `next.config.mjs`)

Underneath them sat **216 hand-written `fetch` blocks** across 20 action files,
returning four different response shapes, with `getCookieHeader()` duplicated 19
times and the string `"Network error"` written out 208 times.

That last part is the reason this ADR exists. The page audits had been finding
the same defect repeatedly — CUST-03, INV-11, QUO-07, QUO-29 are all "error
handling is wrong in one of the 216 copies". Fixing them one page at a time
could never converge, because there was no shared place for a fix to live.

### Decision

**`lib/api-fetch.ts` is the only module that may call the API.** Everything else
composes on top of it.

| Layer | Rule |
|---|---|
| `lib/api-fetch.ts` | The single `fetch`. Owns the base URL, the cookie header, timeouts, error normalisation and the `{data, error, status, notFound}` contract. |
| `actions/*.ts` | Thin. One `apiGet`/`apiSend`/`apiVoid`/`apiBulk`/`apiBinary` call each, plus the path and a fallback message. No `try/catch`, no `res.ok`, no cookie handling. |
| `hooks/queries/*.ts` | The only place components read or mutate. Owns the query key, `staleTime`, invalidation and the toast. |
| Components | Call hooks. **Never** an action directly, **never** `fetch`. |
| `page.tsx` (RSC) | May await an action for initial data, and must pass it through `seeded()` so the client consumes it instead of refetching. |

Pure RSC (pattern 3) stays legitimate for read-only screens with no client
interactivity — superadmin is the example. What is **not** legitimate is a
client component fetching directly (pattern 4, now removed) or a page inventing
its own `useQuery` (pattern 2, to be migrated).

### Why the transport stays a Server Action, for now

Reads travelling over Server Actions is a real cost (ARC-01): they are POST-only,
uncacheable, and React **serializes** them, so concurrent reads queue. That is
what made the Create Quote pickers feel slow.

The fix is known — extend the `/api/*` rewrite that already carries
`/api/auth/*` and `/events`, and let the browser call the API same-origin. It is
deliberately **not** bundled into this ADR, because it changes the rate limiter's
IP handling (`req.ip` + `INTERNAL_PROXY_SECRET` + `x-client-ip` today;
`x-forwarded-for` through a rewrite) and cannot be verified without running the
app. With `api-fetch.ts` in place it becomes a change in one file rather than
twenty, which is the point of doing this first.

### Consequences

- A fix to error handling, retries, timeouts or auth is now **one edit**.
- `status` and `notFound` come out of the transport, so the 404-vs-500 collapse
  (INV-11, QUO-07) is not expressible any more.
- Every request has a timeout. Previously a hung API hung the server action.
- Cost: 20 action files to migrate. `tags.ts` went 99 lines → 25 with no
  behaviour change; the rest are the same shape.

---

## ADR-003 — The workflow engine's standing decisions

> Related: [[wf-00-decisions]] | [[wf-02-architecture]] | [[wf-10-security]] | [[strict-rules]]

**Status**: accepted, P0–P10. Written at the end of the build rather than the
start, so every rule below has at least one defect behind it.

### Context

The automation engine touches every domain in the product and is reached from
five different directions — a person pressing Run, an event, a schedule, an
inbound webhook, and another automation. Almost every bug found during the build
was **two sides of one seam disagreeing while both type-checked**. These are the
rules that make particular classes of that unwriteable.

### 1 · A node definition is one declaration, consumed by three

The builder renders a form from `properties[]`, the engine dispatches on `node`,
and the validator runs in both. Behaviour lives in an executor keyed by the same
string. That is why adding a node is "write a definition, write one function"
rather than touching six files.

**What it cost to learn**: `serviceTypeSelect` was a declared property type with
no case in the config renderer for two phases, so any node using it drew "this
kind of field isn't available yet" — honest, and invisible until somebody opened
that exact node. There is now a test.

### 2 · An executor may not write a table

Every side effect goes through the domain service that already owns the rule.
`executors/types.ts` states it: *"An executor containing an `UPDATE` has, by
definition, a second opinion about a business rule."*

**What it cost**: `job.moveStage` was the **third** implementation of a stage
move — after `/reorder` (JOB-06) and `lib/quote-to-job.ts` (QUO-02) — and the
bulk bar was the fourth. Each skipped the archived gate, the required-checklist
gate, the activity row, the completion email and the events. An automation that
completed a job completed it in a way a person is not allowed to, and because it
raised no event it could not trigger another automation.

### 3 · Failure is a returned union, never a throw across a seam

A domain service used by both a route and an executor returns
`{ok: false, reason}`. The route maps a reason to a status code; the executor
maps it to `skipped` or `NodeFailure`. Neither vocabulary is imposed on the
other.

**Why not exceptions**: the route needs a 400 with a sentence a person reads, and
the executor needs to know whether this is *the author's problem* (fix the step)
or *the day's* (an ordinary outcome). Those are different questions and an
exception carries neither. `reply` objects are also truthy, which is how the
booking convert path ran its success branch on a failure (BOOK-01).

### 4 · Config problems fail loudly; expected outcomes do not cry wolf

`NodeFailure` emails the tenant. So it is reserved for something they can open
the automation and fix — a stage that does not exist, a teammate who left, a
variable that resolves to nothing. Everything else is `skipped` with a sentence
in the run log: an unsubscribed customer, a job already in that stage, a daily
quota reached, a wait whose date has passed.

**What it cost**: a >1-year wait horizon threw `NodeFailure` for input that is
ordinary data — a warranty ten years out, a contract booked for next spring —
and the same file's docblock advertised the case that would have tripped it.

### 5 · An event commits with the write that caused it, or not at all

The transactional outbox. A producer inserts into `workflow_event_queue` inside
the domain write's own transaction; a worker sends it. Never inline, never after
commit.

**Both alternatives have a failure this cannot have**: an email sent for a
transaction that rolled back, and a committed change whose automation was lost
because the process died in the gap. Ten handlers gained a transaction they did
not have when P2's instrumentation swept them.

### 6 · Two names for one thing across a denormalised column will drift, silently

`workflow_versions.trigger_types` is written by publish from `def.triggerEvents`
(**event names**) and was read by the matcher through `LISTENERS_BY_EVENT`
(**node ids**). Empty overlap for every trigger, so no event ever matched
anything — the whole event taxonomy, 28 producers, the outbox and P4's matching
were dead for anything but a manual run.

Nothing caught it because both sides were internally consistent, both are
`string[]` (a denormalised column has no type across its seam), the parameter was
named `nodeTypes` so the call site read as correct, and `POST /:id/runs` bypasses
the matcher — so every by-hand test exercised the one path that avoids the bug.

**The rule**: name a parameter for what it *holds*, and put a test on the seam
itself rather than on either side.

### 7 · A JS array interpolated into a `sql` template binds as one scalar

`` sql`${col} && ${eventTypes}` `` sends `job.created` where Postgres expects an
array literal — `22P02 malformed array literal`. Build `ARRAY[$1, …]::text[]`
with `sql.join`. **A `::text[]` cast does not fix it**: the value is already
malformed before the cast applies.

Found twice, four hours apart — the trigger matcher and then `getJobCostInputs`,
which showed a customer a LATERAL join. The sweep after the first fix looked for
`&&`/`@>`/`<@` and not for `ANY(...)`, and reported the class clean.

### 8 · Once-only is a row, never a timer

A three-day wait outlives every process that could hold a timer, so a pause is a
row with a `resume_at` and a compare-and-set claim. The same reasoning covers
schedules (`workflow_schedule_state`) and per-day event dedup (the outbox's
`dedup_key`) — and those two are **not** interchangeable: the queue is cleared by
the retention sweep, so a warranty reminder deduped against a queue row fires
again on day 31.

### 9 · Every compare-and-set has a loser, and the loser leaves the world alone

Proven by the P6 gate: a goal exit racing a delay resume. The goal subscriber
marked its listener `met` whether or not its CAS had actually ended the run, so
when the resume worker won, the goal had ended nothing but the watch was
disarmed — the run carried on, re-parked, and could only be freed by the 30-day
reaper.

### 10 · Dates are calendar days in the tenant's zone; hours are real hours

`(now() AT TIME ZONE t.timezone)::date`, everywhere. On Neon the server is UTC,
so without it a Chicago tenant sees an invoice go overdue six hours early — and
"overdue" is a word customers get emailed about. Across a DST boundary, 1 day
keeps 09:00 and really is 25 real hours; 24 *hours* lands at 08:00. Both proven.

### 11 · A cap that is silent reads as "we covered everything"

Every bound in the engine reports what it dropped: the loop's
`MAX_LOOP_ITERATIONS`, the sweeps' batch limits, the context serialiser's
`context_truncated`, the report row cap's `totals.truncated`. A run that
processed 500 of 900 and said "completed" is the same defect as a report that
averaged in the rows it excluded.

### 12 · The recursion guard is ambient, not a parameter

`execute()`'s depth guard read `params.depth`, which only a *direct* call passes
— so every event-triggered run started at 0 and the guard had been unreachable
since P3. Causation depth now travels on an `AsyncLocalStorage`: a producer that
forgets a parameter defaults to 0 and silently reopens the loop, while a producer
that forgets to be inside a scope is not a thing that can happen.

### Consequences

- Adding a node is two files and three one-line registrations, enforced by a test
  that walks the directory.
- A domain rule has one implementation, reachable from a route, an executor, a
  bulk endpoint and a template.
- The seams that have historically drifted — definition↔executor,
  publish↔matcher, definition↔renderer, definition↔icon-map — each have a test
  that diffs the two sides rather than checking either one.
- Cost: more indirection than a direct implementation, and a service signature
  shaped by its second caller before that caller exists.

