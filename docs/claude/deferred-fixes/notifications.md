# Deferred Fixes: Notifications & Email

> **Last audited:** 2026-08-07
> **Flow:** Notification fan-out → channel config → Resend → `notification_deliveries`; plus every
> customer-facing send (E-01 … E-15) and the two email crons.
> Related: [[README|Deferred Fixes]] | [[todo]] | [[security-rules]] | [[features-misc]] |
> [[workflow-automation/wf-PROGRESS|wf-PROGRESS]] | [[workflow-automation/wf-01-gap-analysis|wf-01-gap-analysis]]

Opened by the workflow-automation audit (2026-08-07), which had to read the whole delivery path
before it could send anything from a workflow. Three defects were found and fixed on the spot; two
gaps remain and are recorded here because both are **blocking for automated sending** and neither is
blocking for anything shipping today.

Cross-referenced as F-01 … F-08 in [[workflow-automation/wf-PROGRESS|wf-PROGRESS §Findings]].

---

## Fixed

### DF-NOT-01: No customer email opt-out exists anywhere `FIXED` 🔴

- **Severity:** CRITICAL — was blocking for [[workflow-automation/wf-12-phases|P3]]
- **Trigger:** had to be fixed **before** any workflow node could send to a customer
- **Files:**
  - `packages/database/src/schema/customers.ts` — 13 columns, none of them consent
  - `apps/api/src/lib/cron/email-cron.ts:231` (E-12 review requests), `:293` (E-09 renewals)
  - `packages/email/src/templates/*` — no template renders an unsubscribe link except the new
    `e15-notification.tsx`, and its `unsubscribeUrl` prop currently has no producer
- **Problem:** A customer has no way to stop receiving email, and the product has no way to record
  that they asked. There is no column, no token, no route, no footer link, and no suppression check
  in front of any `sendEmail()` call.

  Today's exposure is defensible but not zero: most sends are transactional (a quote you requested,
  an invoice you owe), and a transactional message does not need consent. But **E-12 review requests
  and E-09 renewal reminders are neither requested nor transactional** — they are automated
  commercial mail on a cron, and they are the two that a recipient would most want to stop.

  Workflow automation makes it indefensible rather than borderline. The entire point of the feature
  is unattended multi-step sequences; a tenant will build a five-email nurture and there will be no
  mechanism by which a recipient can leave it. One angry customer with no unsubscribe link is a
  deliverability problem for **every** tenant on the shared sending domain, because complaints score
  against the domain, not the sender.
- **Fix (the shape P3 assumes):**
  1. `customers.email_opt_out_at timestamptz` + `email_opt_out_source text` — a nullable timestamp,
     not a boolean. "When and how did they opt out" is the question support actually gets asked, and
     a boolean cannot answer it. Idempotent migration per [[strict-rules]] §1.
  2. A signed, non-guessable unsubscribe token per customer — derive it (HMAC of `customer.id` with
     a server secret), do not store a second column. Public `GET /public/unsubscribe/:token`, rate
     limited per [[security-rules]] §4, one-click, no login, confirmation page.
  3. **One gate, not N call sites.** A `canEmailCustomer(db, tenantId, customerId)` helper in
     `apps/api/src/lib/email-consent.ts`, called by the workflow email executor and by both crons.
     Same reasoning as `overdueCondition()` and `escapeLike` — the defect this repo keeps repeating
     is a rule applied in one place and not swept.
  4. Transactional sends stay ungated, and that exemption must be **explicit in code** (a
     `bypassOptOut: "transactional"` argument, not an omission), so the next person adding a send
     has to state which kind it is.
  5. `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every gated send — Gmail and Yahoo
     require them for bulk senders, and Resend passes headers straight through.
  6. Surface it in the UI: a badge on the customer detail page, and a filter on `/customers`, so a
     tenant can see who they can no longer reach.
- **Do not:** put the switch on the tenant. Consent belongs to the recipient — one customer may be
  reachable by tenant A and not by tenant B, and the row is per tenant already.
- **Resolution (2026-08-07):** Built as specified, all six points.
  1. `20260807000003_customer_email_opt_out.sql` — `email_opt_out_at TIMESTAMPTZ` +
     `email_opt_out_source TEXT`, plus a **partial** index on the opted-out rows only. Idempotent.
     A nullable timestamp, not a boolean, exactly as the fix shape asked.
  2. **The token is derived, not stored** — HMAC-SHA256 of `unsubscribe:<tenantId>:<customerId>`
     under `BETTER_AUTH_SECRET`, which `lib/env.ts` already validates at ≥32 chars, so **no new
     environment variable**. It covers the tenant id as well as the customer, so a token is valid
     for exactly one (tenant, customer) pair and cannot be replayed across a boundary. Rotating the
     secret invalidates every outstanding link at once.
  3. **One gate**: `canEmailCustomer()` in `apps/api/src/lib/email-consent.ts`. It returns a
     *decision* — `{allowed, reason, email}` — not a boolean, because every caller needs the address
     anyway and the **reason** is what gets written into `node_execution_logs.skip_reason`. A bare
     `false` forces each caller to invent an explanation, and invented explanations are how "email
     failed" ends up covering four unrelated situations.
  4. **The exemption is an argument**: `purpose: "marketing" | "transactional"`. A caller cannot
     omit it. Transactional sends still stop on a deleted customer or a missing address — the
     exemption is from the opt-out, not from existing.
  5. `List-Unsubscribe` **and** `List-Unsubscribe-Post` on every gated send. Both are required;
     the first alone does not satisfy the bulk-sender rule. `sendEmail()` takes an optional
     `unsubscribeUrl` and Resend passes the headers straight through.
  6. Surfaced: an **Unsubscribed** badge beside the address on the customer detail header, and an
     **Unsubscribed** tab on `/customers` backed by `?optedOut=true` (`booleanFlag`, never
     `z.coerce.boolean()` — CUST-29).
- **Three decisions worth recording, none of them in the original fix shape:**
  - **`GET` does not unsubscribe anyone.** The public route splits into a `GET` that reads and a
    `POST` that acts. Gmail, Outlook and every corporate link scanner fetch URLs in the background,
    so a `GET` that opts someone out opts out people who never clicked — and they find out weeks
    later when they wonder why the emails stopped.
  - **RFC 8058 needed a content-type parser.** This server registers no form-body plugin, and
    one-click clients post `application/x-www-form-urlencoded`. Without a parser scoped to that
    route, every mail provider would have received `415` and the Gmail unsubscribe control would
    simply never have worked. Registered **inside** the plugin so it does not teach the whole API to
    accept form posts.
  - **The footer link lives on the shared `EmailLayout`, not per template.** E-15 had rendered its
    own; that is the start of fifteen divergent copies, and this repo has already collapsed four
    phone formatters and three definitions of "overdue". One declaration, and E-12/E-09 now require
    the prop rather than accepting it optionally — a caller who has not decided cannot type the call.
  - **E-09 does not stamp `renewalReminderSentAt` when it skips.** Marking a send that never
    happened would suppress the real one if the customer resubscribes while the contract is still
    inside its 30-day window.
- **Not verified.** No typecheck, lint, test or migration run this session — the user runs those.
  The migration is written and idempotent but **has not been applied**; until it is, every read of
  `customers` will fail `42703`, because Drizzle names every schema column in its queries. That is
  the same trap `20260806000001_job_costing.sql` fell into, recorded in [[backend-stack]].

---

## Open

### DF-NOT-02: The entire email path has never delivered a message `DEFERRED` 🟠

- **Severity:** HIGH (as a verification gap — the code is believed correct, nothing proves it)
- **Trigger:** verifying a sender domain in Resend — already tracked in [[todo]] under
  *Post-Neon Cleanup*
- **Files:** `apps/api/src/lib/email.ts`, `packages/email/src/templates/` (15 templates)
- **Problem:** The Resend API key is valid, but the account has **zero verified domains** and
  `RESEND_FROM_EMAIL` is still `noreply@yourdomain.com`. Every send returns 403. So:
  - No template has ever been rendered by Resend or opened in a real client. Fifteen templates,
    zero of them seen.
  - **E-15 (`e15-notification.tsx`) is brand new** and inherits this — DF-NOT-03 below fixed the
    reason nothing sent, and the send still cannot succeed for an unrelated reason.
  - The two crons run in production and have been failing silently against 403 the whole time.
- **Why it is listed as a bug and not just an env task:** the 403 was invisible until 2026-08-07,
  because `sendEmail()` swallowed it (DF-NOT-04). It is visible now. When the domain is verified,
  **read the logs before assuming success** — a run that goes quiet is the failure mode this pair of
  defects was built to hide.
- **Fix:** verify the domain, set `RESEND_FROM_EMAIL`, then send one of each template to a real
  inbox and check rendering on mobile. Cheapest useful test: a temporary dev-only route that renders
  any template by key with fixture props.

---

## Fixed earlier the same day

### DF-NOT-03: Notification emails were never sent, and the log said they were `FIXED` 🔴

*(F-01 in wf-PROGRESS)*

- **Severity:** CRITICAL
- **File:** `apps/api/src/lib/notifications.ts:293` (pre-fix)
- **Problem:** `deliverEmail()` feature-detected its own dependency —
  `if ("sendNotificationAlertEmail" in email)` — against a function that **was exported from
  nowhere**. The check therefore failed for every notification, every time, and the `else` branch
  logged to the server console and returned. Every notification type except `booking_received`
  silently stopped at `console.log`.

  The compounding half: the caller then wrote a `notification_deliveries` row with
  `status: 'sent'` regardless (DF-NOT-05). So the audit trail — the exact table you open when a user
  says "I never got the email" — asserted delivery for messages that were never handed to Resend.

  In-app notifications were unaffected, which is why nobody noticed.
- **Resolution (2026-08-07):** Wrote the missing template (E-15,
  `packages/email/src/templates/e15-notification.tsx`), exported it from `packages/email`, and
  implemented `sendNotificationAlertEmail()` in `apps/api/src/lib/email.ts`. `deliverEmail()` now
  imports it directly — a dynamic `import()` for lazy loading, but a **destructured, type-checked**
  one, so removing the export breaks the build instead of quietly disabling the feature.
  `booking_received` is still skipped, deliberately: `routes/public/booking.ts` already sends E-03
  with far more detail, and both firing would mean two emails per booking.
- **The lesson, recorded in [[features-misc]]:** never feature-detect a dependency you own. A
  capability check is for things that might not be there — a browser API, an optional peer. Applied
  to your own module it converts a compile error into silent degradation.

---

### DF-NOT-04: `sendEmail()` reported success for refused sends `FIXED` 🔴

*(F-07 in wf-PROGRESS)*

- **Severity:** CRITICAL
- **File:** `apps/api/src/lib/email.ts:64-103`
- **Problem:** The function wrapped `resend.emails.send()` in `try/catch` and returned success on
  anything that did not throw. **Resend does not throw on rejection** — it resolves with
  `{ data: null, error: {...} }`. So a 403 from an unverified sending domain (this account's actual
  state, see DF-NOT-02) was read as a successful send. Every caller believed every email went out.
- **Resolution (2026-08-07):** `sendEmail()` now inspects `result.error` and returns a three-state
  `EmailOutcome`:
  ```typescript
  export type EmailOutcome =
    | { status: "sent" }
    | { status: "skipped"; reason: string }   // email not configured — a dev state
    | { status: "failed"; reason: string };   // provider refused it
  ```
  `skipped` and `failed` are deliberately distinct: an unconfigured local environment is not a
  delivery failure and must not be logged as one, but it must not be logged as a send either.
- **Follow-up (not blocking):** the other ~14 `send*Email()` wrappers still return `void` and
  discard the outcome. They no longer *lie* — the error is logged — but only the notification path
  records the result. Worth threading `EmailOutcome` through when P3 needs per-send status anyway.

---

### DF-NOT-05: `notification_deliveries` recorded intent, not outcome `FIXED` 🟠

*(F-08 in wf-PROGRESS)*

- **Severity:** HIGH
- **File:** `apps/api/src/lib/notifications.ts:171-233`
- **Problem:** Email delivery rows were built with a hardcoded `status: 'sent'` before the send was
  attempted, and never revised. Combined with DF-NOT-03 this meant the table was 100% wrong for the
  email channel for its entire existence.
- **Resolution (2026-08-07):** `deliverEmail()` returns `"sent" | "failed" | "skipped"` and the row
  is built from that. `skipped` writes **no row at all** — email being unconfigured is not a
  delivery event, and a row saying "skipped" in a table named `deliveries` invites the same
  misreading from the other side.
- **Note:** the in-app channel still hardcodes `status: 'sent'` at `:162` and that is correct — the
  row is written in the same transaction as the notification it describes, so there is no separate
  operation that could fail.

---

## Audited clean

Recorded so it is not re-litigated:

- **Email subject injection** — every subject that interpolates user data goes through
  `sanitizeSubject()` ([[security-rules]] §6). Verified across all senders.
- **Recipient resolution** — no send takes a free-text address from a request body. Recipients are
  resolved server-side from `customers.email` or `user.email`.
  [[workflow-automation/wf-00-decisions|D-14]] keeps it that way for workflows: the email node takes
  a *role* (customer / assignee / owner), never an address.
- **Channel preferences** — `notification_channel_config` is honoured per user with a documented
  default, and the fan-out filters on it before building recipients.
