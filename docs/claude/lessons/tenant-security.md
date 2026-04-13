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
