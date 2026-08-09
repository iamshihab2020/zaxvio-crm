# Lessons: Tenant Management & Security

> Related: [[security-rules]] | [[auth-flow]] | [[API_DOCUMENTATION_1|API Docs: Tenants]] | [[lessons]]

## Tenant Initialization & Settings (2026-04-13)

- **`/tenants/initialize` needs `onConflictDoNothing`** — The route checks for existing tenant then inserts — classic TOCTOU. Two concurrent calls (sign-up hook + frontend retry) cause a unique constraint 500. The insert should use `.onConflictDoNothing()` like the `afterCreate` hook does.
- **Admin slug edit must check uniqueness before update** — The DB will throw a unique constraint violation (500) instead of returning a graceful 409. Always pre-check uniqueness for admin edits on unique fields.
- **Logo upload: never trust the filename for path construction** — `ext = filename.split(".").pop()` is the only safe piece to extract from a user-supplied filename. The full filename must be discarded. Extension must be validated against an explicit allowlist (`png`, `jpg`, `jpeg`, `gif`, `webp`) — never allow SVG (can contain `<script>`) or arbitrary types.
- **Text fields in settings schemas need max length** — `updateTenantBody` had no `.max()` on any field. DB `text` columns are unbounded, so a malicious actor can store megabytes in `businessName` or `invoiceTermsConditions`. Add `.max(100)` for names, `.max(5000)` for long text, `.max(500)` for footers.
- **`z.number()` vs database `text` for numeric fields** — `defaultTaxRate` was `z.number()` in the Zod schema but stored as `text` in the DB and sent as a string from the frontend. Use `z.coerce.number()` when the value may arrive as a string (querystring, forms), and `String()` it before DB insert if the column is `text`.

## Security Hardening (2026-04-02)

- **`requireTenant` middleware does NOT verify resource ownership** — It only confirms the user belongs to a tenant. You must still query with `and(eq(table.tenantId, tenantId), eq(table.id, id))` in every endpoint that reads/modifies a specific resource. Without this, any authenticated user can access any tenant's records by guessing IDs (IDOR).
- **Rate limiting is two-tiered — global vs route-level** — Global rate limit (100 req/min) is set in `server.ts` via `@fastify/rate-limit`. Auth endpoints need stricter limits (10 req/min) set via `config.rateLimit` on the route definition. If you forget to add `config.rateLimit` to new auth routes, they silently fall back to the permissive global limit.
- **Zod validation absence is silent** — Adding `fastify-type-provider-zod` globally enables schema validation, but only for routes that define `schema: { params, body }`. Routes without schema definitions accept any input without error. There's no warning that validation is missing.
- **Sanitize user input before injecting into AI prompts** — The chatbot route was directly interpolating user params into system prompts (`${k}: ${v}`), allowing prompt injection. Use `sanitizeForPrompt()` to strip control chars and cap length. This applies to any route that builds LLM prompts from user data.

## Multi-Pipeline (2026-04-03)

- **Data backfill migrations need IS NULL guards on UPDATE** — The pipeline migration creates a default pipeline per tenant via `INSERT ... ON CONFLICT DO NOTHING` (idempotent), but the UPDATE that sets `pipeline_id` on existing jobs must use `WHERE pipeline_id IS NULL` to avoid overwriting data on re-run. INSERT idempotency alone isn't enough if the migration also does UPDATEs.
- **`isDefault` flag without unique constraint is a race condition** — The UI enforces "one default pipeline per tenant" but the DB has no partial unique index like `CREATE UNIQUE INDEX ... WHERE is_default = true`. Concurrent API calls can create multiple defaults. The job creation endpoint picks the first one arbitrarily.
- **Filtering by pipelineId returns empty, not error** — List endpoints that filter by `pipelineId` return 0 results if the param is missing or wrong, instead of erroring. This causes silent data loss on the frontend if you forget to pass it.

## Tenant-Filter Sweep + Public Rate Limiting (2026-07-27)

From the [[bookings-calendar|Bookings & Calendar audit]].

- **"It's guarded by a prior ownership check" is how every one of these got written.** A
  repo-wide scan for `UPDATE`/`DELETE` with a `WHERE` but no `tenantId` found eight:
  availability overrides, calendar events (×2), checklist items (×2), customer notes (×2),
  job checklist completions, quote line items, and the invoice review-request write. Every
  one had a correct ownership `SELECT` above it. That is exactly what was said about
  `DF-BK-01` before it was fixed in April. The check and the write are separated by an
  `await`, and the next person to edit the handler will not know the guard is load-bearing.
  **The rule is `and(eq(t.id, id), eq(t.tenantId, tenantId))` unconditionally** —
  [[security-rules]] §1. Cost: one line each.
- **Run the scan, don't read for it.** All eight were found by a script walking every
  route file; none were obvious in review. Worth re-running whenever routes are added.
- **A join table with no `tenant_id` is not a violation.** `customer_tags` has only
  `customer_id` + `tag_id` and is scoped transitively through a verified customer. Left
  as-is *with a comment saying why*, so the next scan doesn't re-flag it and the next
  person doesn't "fix" it into a type error.
- **Server actions collapse every visitor into one rate-limit key.** `@fastify/rate-limit`
  defaults to `req.ip`. When the browser talks to Next and Next talks to Fastify, that IP
  is the *Next server's* — for everyone. The public booking portal, the dashboard and every
  authenticated user therefore shared one 100/min bucket, and two customers opening the
  booking page in the same minute could 429 the whole application. Fix: forward the real
  client IP and key on it — but **only when the forwarding is authenticated**
  (`INTERNAL_PROXY_SECRET`). A blindly-trusted `x-forwarded-for` lets anyone mint a fresh
  bucket per request, which is a bypass, not a fix.
- **Public endpoints need per-route limits, not just the global one.** The endpoint that
  wrote rows, created customers and sent two emails had no route-level limit at all, while
  the read-only status page had 10/min. Weight the limit by what the endpoint *costs*.
- **Write the threat model into the handler.** `GET /public/booking/:slug/status/:id`
  returns a customer's name and address to anyone holding the booking UUID. That is
  acceptable — v4 UUID, rate-limited, no data the requester didn't submit — but it was
  acceptable in nobody's head. The reasoning now sits above the route so the next person
  can re-evaluate it instead of rediscovering it.

## Where you put a guard decides who uses it (2026-08-06, security audit)

- **`ownsCustomer` lived in `job-guards.ts`, so the calendar never called it.** Importing
  "job guards" into `routes/calendar-events` reads like a mistake, so nobody did — and
  conversations, checklists and calendar events each wrote a client-supplied FK with no
  tenant check at all. Meanwhile invoices and quotes wrote their *own* copies rather than
  import from jobs. Three copies and three gaps, all from one filename. The helper now
  lives in `lib/tenant-guards.ts`, which is named after the invariant instead of the first
  domain that needed it, and `job-guards.ts` re-exports it.
- **Naming a shared module after its first caller is a load-bearing mistake**, not a
  cosmetic one. If a helper encodes a rule that applies everywhere, the name has to say so.
- **Scope the join, not just the row.** `conversations` filtered `conversations.tenantId`
  and then did `innerJoin(customers, eq(conversations.customerId, customers.id))` with no
  predicate on the joined side. The conversation being ours says nothing about the customer
  it points at — and that join chose the recipient of `POST /:id/messages`. Both halves are
  needed: validate the FK on write, scope the join on read.
- **"Unexploitable" and "correct" are different claims, and the gap between them is one
  feature.** Three of these were downgraded in review because reaching them required
  guessing a UUID the app never discloses. That is a property of today's endpoints, not of
  the code — the first page that renders a customer name next to a calendar event converts
  an integrity bug into a disclosure bug. Fixed all of them.
- **Verify findings before you fix them.** Of 7 candidates from the audit, 4 did not survive
  an adversarial second pass. The best example: a reported cross-tenant *delete* via `..` in
  an R2 storage path. S3/R2 keys are opaque strings, not filesystem paths — `a/../b` is a
  distinct key from `b`, so the delete hits nothing. The read half was real but reached only
  the tenant logo, which `GET /public/booking/:slug` already serves to anonymous visitors.
