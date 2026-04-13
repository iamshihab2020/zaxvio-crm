# Deferred Fixes: Tenants

> **Last audited:** 2026-04-13
> **Flows audited:** Tenant initialization (POST /tenants/initialize + afterCreate hook) | Tenant settings (PATCH /tenants/current) | Slug management | Logo upload | requireTenant middleware

---

## High — Data Integrity / Security

### DF-TEN-01: Race condition in /tenants/initialize — no conflict guard `DEFERRED`

- **Severity:** HIGH (concurrent calls cause 500 DB unique constraint violation)
- **File:** `apps/api/src/routes/tenants/index.ts` lines ~237-282
- **Problem:** The initialize route checks for existing tenant at line ~238, then inserts at ~273 without `onConflictDoNothing`. Two simultaneous calls (e.g., sign-up callback + manual retry) both pass the existence check, both attempt INSERT → unique constraint violation on `organizationId` or `slug` → 500 error.
- **Contrast:** The `afterCreate` hook in `auth.ts` line ~98 correctly uses `.onConflictDoNothing()`.
- **Fix:** Add `.onConflictDoNothing()` to the tenant insert, and return 200 if nothing was inserted.

---

### DF-TEN-02: Admin slug update has no uniqueness check `DEFERRED`

- **Severity:** HIGH (500 error instead of graceful 409 on slug conflict)
- **File:** `apps/api/src/routes/admin/tenants.ts` lines ~370-399
- **Problem:** The admin PATCH endpoint allows updating `slug` but does not check if the new slug is already taken. The DB unique constraint fires → unhandled 500.
- **Fix:** Before update, check: `const existing = await db.select().from(tenants).where(and(eq(tenants.slug, newSlug), ne(tenants.id, id))).limit(1)`. If found, return 409.

---

### DF-TEN-03: Divergent seeding — afterCreate hook never seeds availability schedules `DEFERRED`

- **Severity:** HIGH (tenants created without availability → public booking portal shows no available dates)
- **File:** `apps/api/src/lib/auth.ts` lines ~110-122 vs. `apps/api/src/routes/tenants/index.ts` lines ~310-319
- **Problem:** Two initialization code paths:
  - `afterCreate` hook: seeds 4 pipeline stages only. No availability schedules.
  - `/tenants/initialize` route: seeds pipeline stages AND availability schedules (Mon-Fri 8am-5pm).
  
  If org is created and the `afterCreate` hook runs successfully, the frontend calls `initializeTenant()` which hits `/tenants/initialize` and sees the tenant already exists → returns 200 early, skipping the availability seeding. Result: tenant with no availability schedule → public booking portal shows zero available dates.
- **Fix:** Make `/tenants/initialize` idempotent per-resource: always check and seed each child resource (pipeline stages, availability) independently, regardless of whether the tenant row already existed.

---

### DF-TEN-04: Incomplete idempotency — retry after partial failure skips child seeding `DEFERRED`

- **Severity:** MEDIUM (tenant stuck with missing pipeline stages or availability after failed init)
- **File:** `apps/api/src/routes/tenants/index.ts` lines ~237-246
- **Problem:** If initialization fails after the tenant row is created but before pipeline stages or availability are seeded, a retry hits the "tenant already exists" early return (line ~244-246) and skips all child seeding. The tenant is stuck in a broken state.
- **Fix:** Separate existence check from child-seeding logic. After finding the tenant exists, still run `INSERT ... onConflictDoNothing` for pipeline stages and availability schedules.

---

## Medium — Validation Gaps / Security

### DF-TEN-05: No max length on any text fields in updateTenantBody `DEFERRED`

- **Severity:** MEDIUM (DoS via megabyte-length strings in business name, invoice terms, etc.)
- **File:** `apps/api/src/lib/schemas/tenants.ts` lines ~3-25
- **Problem:** Fields like `businessName` (min 1), `ownerName`, `address`, `invoiceTermsConditions`, `invoicePaymentInstructions`, `invoiceFooterMessage`, `quoteFooterMessage`, `quoteTermsConditions` have no upper bound. The DB column type is `text` (unlimited).
- **Fix:** Add reasonable `.max()` limits:
  - Names/short strings: `.max(100)`
  - Terms/conditions: `.max(5000)`
  - Footer messages: `.max(500)`

---

### DF-TEN-06: No HTML/script sanitization on fields that render in emails and PDFs `DEFERRED`

- **Severity:** MEDIUM (stored HTML/script injection in invoice/quote emails and PDFs)
- **File:** `apps/api/src/lib/schemas/tenants.ts` lines ~3-25
- **Problem:** Fields like `businessName`, `invoiceFooterMessage`, `quoteTermsConditions`, `invoicePaymentInstructions` are inserted into React Email templates and PDF renders. If these contain `<script>`, HTML tags, or `javascript:` URIs, they could be rendered as HTML in email clients. The `googleReviewUrl` validates `.url()` but not against `javascript:` protocol.
- **Fix:**
  - Sanitize text fields by stripping HTML tags server-side (use `he.decode()` + strip tags, or validate with `.regex(/^[^<>]*$/)` for single-line fields).
  - For URL fields: validate protocol is `https:` only.

---

### DF-TEN-07: Logo filename allows path separators — potential storage path injection `DEFERRED`

- **Severity:** MEDIUM (arbitrary storage path via crafted filename)
- **File:** `apps/api/src/routes/tenants/index.ts` line ~143; `apps/api/src/lib/schemas/tenants.ts` line ~30
- **Problem:** `storagePath = \`${tenantId}/logo.${ext}\`` where `ext = filename.split(".").pop()`. A filename like `logo.png/../../../other-tenant/evil.png` would yield `ext = "png"` but if Supabase Storage interprets paths without normalization, traversal could reach other paths. Also, the filename schema only checks `.min(1)` — no validation against `/`, `\`, or `..`.
- **Fix:** Validate extension against allowlist (`png`, `jpg`, `jpeg`, `gif`, `webp`) and discard the raw filename entirely — only use the extension to construct the path:
  ```typescript
  const ALLOWED_EXTS = ["png", "jpg", "jpeg", "gif", "webp"];
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTS.includes(ext)) return reply.status(400).send({ error: "Invalid file type" });
  const storagePath = `${tenantId}/logo.${ext}`;
  ```

---

### DF-TEN-08: Logo upload accepts SVG and arbitrary MIME types `DEFERRED`

- **Severity:** MEDIUM (SVG with embedded scripts served from public Supabase URL)
- **File:** `apps/api/src/routes/tenants/index.ts` line ~149; `apps/api/src/lib/schemas/tenants.ts` line ~31
- **Problem:** `mimeType` is validated as `/^image\//` (starts with "image/"). This allows `image/svg+xml`. SVG files can contain `<script>` tags and are executed as HTML in browsers when opened directly. Since the logo is served from a public Supabase URL, any visitor opening the raw URL would execute the embedded script.
- **Fix:** Explicitly allowlist: `z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"])`. Reject SVG and other types.

---

### DF-TEN-09: No slug format validation in admin edit schema `DEFERRED`

- **Severity:** MEDIUM (admin can set URL-unsafe slugs that break booking portal)
- **File:** `apps/api/src/lib/schemas/admin.ts` line ~52
- **Problem:** Admin `patchTenantBody` defines slug as `z.string().optional()` with no format. An admin could set a slug containing spaces, slashes, or special characters, breaking the `/book/:slug` URL and potentially causing path traversal issues.
- **Fix:** Add validation: `z.string().regex(/^[a-z0-9-]+$/).min(3).max(100).optional()`

---

### DF-TEN-10: `defaultTaxRate` type mismatch — Zod expects number, DB/frontend sends string `DEFERRED`

- **Severity:** LOW (potential silent validation failure for tax rate updates)
- **File:** `apps/api/src/lib/schemas/tenants.ts` line ~12 vs. `apps/web/src/actions/tenants.ts` line ~79
- **Problem:** The Zod schema defines `defaultTaxRate` as `z.number()`, but the database stores it as `text` and the frontend sends it as a string. `fastify-type-provider-zod` would reject a string for a `z.number()` field → tax rate updates silently fail.
- **Fix:** Use `z.coerce.number().min(0).max(100).optional()` in the schema, then convert to string before DB insert: `String(body.defaultTaxRate)`.

---

## Low Severity

### DF-TEN-11: Broken booking portal URLs on admin slug change — no redirect `DEFERRED`

- **Severity:** LOW (operational risk — all shared booking links break immediately)
- **File:** `apps/api/src/routes/admin/tenants.ts` lines ~370-399
- **Problem:** If a super_admin changes a tenant's slug, all existing booking portal links (`/book/old-slug`), iframe embeds, and widget scripts break with 404. No redirect mechanism exists. No warning shown in admin UI.
- **Fix options:**
  1. Store `previousSlugs` array on tenant; handle redirects in the public booking route.
  2. Warn in admin UI: "Changing the slug will break all existing booking portal links."
  3. Prevent slug changes after first public booking is received.

---

### DF-TEN-12: afterCreate hook failures are silently swallowed `DEFERRED`

- **Severity:** LOW (tenant row never created; user appears signed up but has no org context)
- **File:** `apps/api/src/lib/auth.ts` lines ~125-129
- **Problem:** All errors in the `afterCreate` callback are caught and logged with `console.error` only. If tenant creation fails (DB down, unique conflict, etc.), the user's organization exists but has no tenant. The frontend's `initializeTenant()` call serves as a fallback, but only if it is triggered.
- **Fix:** The existing fallback (calling `/tenants/initialize` from the frontend on login/dashboard load) partially mitigates this. Ensure `initializeTenant()` is always called on first dashboard load regardless of whether the hook succeeded.

---

## Fixed Issues

_(Move resolved issues here with date)_
