# Lessons: Features & Miscellaneous

> Related: [[API_DOCUMENTATION_4|API Docs: Equipment/Conversations]] | [[backend-stack]] | [[strict-rules]] | [[lessons]]

## Equipment/Assets & Service Agreements (2026-03-31)

- **DB schema was already ahead** — equipment, refrigerant_logs, and maintenance_contracts tables existed from initial migration but had no API routes, actions, or frontend. Lesson: always check what schema already exists before planning.
- **refrigerantLogs.jobId was NOT NULL without FK** — had to fix with migration to make nullable + add FK constraint. Check FK integrity when building on existing schemas.
- **General service industry naming** — DB tables stay as `equipment` / `maintenanceContracts` but UI labels use "Assets" / "Service Agreements". Route paths use `/assets` and `/service-agreements`. Component folders match DB names (`equipment/`, `service-agreements/`).
- **Standalone page vs customer tab** — Agreement dialog needs a CustomerPicker when opened from standalone /service-agreements page but should skip it when opened from customer detail tab (customerId pre-filled). Use a `customerId` prop to control this.
- **Pagination component requires `total` prop** — Don't forget to pass it; the reusable Pagination component renders total count text.
- **Sidebar scaling** — With 12+ nav items, collapsible groups with localStorage persistence prevents visual overload. ScrollArea wrapping ensures collapsed sidebar scrolls on small screens. Hide scrollbar in collapsed mode to avoid overlapping icons.
- **Sliding indicator + ScrollArea** — The sidebar's sliding hover indicator breaks when nav items scroll because `getBoundingClientRect()` returns visual position but the indicator is absolutely positioned on the aside. Fix: listen to the ScrollArea viewport's scroll event and recalculate indicator position. Also clip indicator opacity when item scrolls outside visible bounds.

## File Uploads (2026-04-05)

- **Use base64 JSON transport for file uploads through Fastify** — The codebase has no multipart middleware (`@fastify/multipart`). Logo upload already uses base64 JSON. Follow the same pattern: client reads `File` → `arrayBuffer()` → `Buffer.from(...).toString("base64")` → sends JSON `{ data, filename, mimeType }`. Don't install multipart for one feature.
- **`storagePath` in DB is NOT a URL** — `job_photos.storage_path` stores the relative path inside the bucket (e.g., `{tenantId}/jobs/{jobId}/photo.jpg`). To get a public URL, construct it as `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-attachments/${storagePath}`. The `getStorageUrl()` helper in `apps/web/src/lib/storage-url.ts` does this.
- **Supabase Storage bucket must be created manually** — Unlike DB tables (migrations), Supabase Storage buckets are created via the Supabase dashboard or Management API. The `job-attachments` bucket is NOT auto-created by migrations. Add this to deployment checklist.
- **ZodError has `.issues` not `.errors`** — When using `parsed.error` from `z.safeParse()`, the flat list of validation issues is at `parsed.error.issues` (array of `ZodIssue`), not `.errors`. TypeScript will catch this but worth noting since the docs sometimes use `.errors`.
- **`photo_tag` Postgres enum needs `::photo_tag` cast in raw SQL** — Drizzle handles enum comparisons natively in query builder. But if using `sql\`...\`` with raw interpolation to filter by tag, cast the value: `${tag}::photo_tag`. Otherwise Postgres may reject it as an untyped string.
- **File-size validation must run client-side too** — Even though the API validates file size, validate client-side first. A 50MB file sent base64-encoded becomes ~67MB JSON — that hits the Fastify body size limit before reaching the file size check. Set `bodyLimit` in Fastify config if needed, or keep client-side validation as the primary guard.

## Conversations / Realtime Messaging (2026-04-06)

- **Supabase Realtime broadcast for custom events uses the same pattern as notifications** — See `use-notifications.ts` for the exact subscribe/cleanup pattern. Use `.channel('channel-name').on("broadcast", { event: "event-name" }, handler).subscribe()`. Always clean up with `supabase.removeChannel(channel)` in the `useEffect` return.
- **Realtime broadcast requires `getSupabaseAdmin()` on the API side** — The `getSupabaseAdmin()` from `@hvac-saas/database` uses the service role key and is allowed to send broadcasts. The browser client with the anon key can only receive. Don't mix them up.
- **Browser Notification API needs `useEffect` to sync permission state** — `Notification.permission` is a static property that's not reactive. Read it on mount with `useEffect(() => setPermission(Notification.permission), [])`. Calling `Notification.requestPermission()` returns a Promise — `await` it and update state with the result.
- **SMS placeholder pattern** — When a feature is "Coming Soon", disable it in the UI (channel selector Popover, radio buttons) with a `<Badge variant="secondary">Coming Soon</Badge>` and the `disabled` attribute. The API returns HTTP 501 for the endpoint. No Twilio package needed until the feature is built.
- **Conversations upsert on `(tenantId, customerId, channel)` unique index** — This means one email thread and one SMS thread per customer per tenant. Each has its own message history. If you want multiple independent email threads per customer, you'd need a different data model.
- **Optimistic updates must be reconciled** — When appending an optimistic message, give it a temporary `id` like `optimistic-${Date.now()}`. When the real response arrives, replace it by matching on the temp id. On failure, remove it and restore the input text.

## Bulk Operations (2026-04-10)

- **`archived_at` timestamp over boolean `isArchived`** — Provides audit trail (when archived). `NULL` = active, non-`NULL` = archived. Use partial indexes (`WHERE archived_at IS NULL`) for fast default list queries. Entities with existing `isActive` flags (catalog, service agreements) keep their pattern — don't add `archived_at` to those.
- **POST for bulk endpoints, not DELETE with body** — HTTP DELETE with request body is poorly supported by some proxies/clients. `POST /entity/bulk-delete` with `{ ids: [...] }` is the pragmatic choice, consistent with the existing `POST /jobs/reorder` pattern.
- **Filter-then-execute for bulk operations** — Don't try/catch per row. Instead: (1) `SELECT id, status FROM table WHERE tenantId AND id IN (?)`, (2) partition eligible vs ineligible, (3) single bulk `DELETE`/`UPDATE` on eligible set. More efficient (2 queries vs N) and naturally transactional.
- **`isNull` and `isNotNull` must be re-exported from `@hvac-saas/database`** — They weren't in the original operator re-exports. Added alongside `inArray` to prevent import resolution issues across the monorepo.
- **Optional checkbox props keep tables backward-compatible** — Adding `selectedIds?: Set<string>` (optional) to table component props means the same table works with or without selection. Inline detail sub-tables are unaffected.
- **Selection must clear on search/filter changes** — Selection stores IDs from the current result set. When search or filters change, the visible dataset changes semantically and stale IDs can cause confusing bulk operations. Clear in the same `useEffect` that triggers the fetch.
- **`showArchived` query param defaults to `false` via Zod** — Added to `paginationQuery` in `common.ts` as `z.coerce.boolean().default(false).optional()`. This propagates to all list endpoints automatically since they extend `paginationQuery`.
- **Max 100 IDs per bulk request** — Prevents abuse. Enforced via `z.array(z.string().uuid()).min(1).max(100)` in the shared `bulkIdsBody` schema. Typical page sizes are 15-20, so even cross-page selections stay well under.

## Project Maintenance

- **Always update `docs/project_docs/REPO_MAP.md` when adding/removing/moving files** — The repo map got severely outdated (showed routes as "planned" that were done months ago). Any PR that creates new files, folders, routes, components, schema files, actions, or migrations MUST update the repo map in the same commit. Same discipline as `docs/todo.md` and `docs/lessons.md`.
- **Per-page fixes do not propagate — end every audit with a repo-wide sweep of the class you just fixed.** Measured on the invoices audit ([[invoices|§2]]): of 17 remediation patterns established by the five previous page audits, exactly **one** (`bulkToast`) had reached `/invoices`. The error-state component, the `EntityDetailShell.loadError` prop, the 404-vs-500 split, the deep-link bounce guard, `escapeLike`, `findForeignRef`, `loadEditableJob`, route-level rate limits and tenant-timezone handling had all been written and none was applied outside the page that motivated it. The one pattern that *did* hold repo-wide is the one the bookings audit explicitly swept for and reported a count on ("5 found outside scope, 0 remain"). **Extract the helper, grep for the class, fix every call site, and record the count in the report** — otherwise the same finding is re-discovered on every page and the fix cost is paid N times.
- **A shared component's new capability is opt-in, so it silently misses existing callers.** `EntityDetailShell` gained `loadError`/`onRetry` during the jobs work; the prop is optional, so the three sheets that already used the shell kept rendering blank on a 500 and the compiler said nothing. When adding a prop that fixes a bug, either make it required or audit every existing consumer in the same commit.
- **Line items are one concept with three schemas, and they had drifted.** The description field was
  `boundedText(500).optional()` on job add but `.min(1)` on job update, `.min(1).max(500)` on both
  invoice verbs, and an **unbounded** `z.string()` on quotes — the field that renders into the public
  quote portal and the quote PDF. All three now share `lineItemDescription` in `schemas/common.ts`.
- **A line item can be nothing but a price.** Requiring a description made someone name a $40 disposal
  fee before the number was accepted. The column stays `NOT NULL`: `lib/line-items.ts` resolves the
  name as typed → catalog item → item type label, so a blank one reads "Service Call" rather than
  leaving a blank cell on a customer-facing PDF, and no renderer needs a null branch.
- **The catalog price was always an override, but nothing on screen said so.** Picking a catalog item
  only prefills `unitPrice`; the field stayed editable and the API keeps whatever the client sends
  (`unitPrice ?? catalogItem.unitPrice`). Users read the prefill as fixed. `CatalogPriceHint` now
  prints the list price and the difference, so charging $50 against a $149 catalog item is visible
  rather than silent.

## Notifications & the workflow-automation audit (2026-08-07)

- **`sendNotificationAlertEmail` does not exist, and the code guards for it at runtime instead of
  importing it.** `lib/notifications.ts:293` reads `if ("sendNotificationAlertEmail" in email) { … }
  else { console.log(…) }`. It is exported from nowhere — `lib/email.ts` has 16 send functions and
  `packages/email` has 15 templates, none generic. So the `default` branch of that switch, which is
  **every notification type except `booking_received`**, logs to the server and returns. Meanwhile
  step 9 writes a `notification_deliveries` row with `status: 'sent'` regardless, so the audit trail
  says the email went out. The lesson is not "we forgot a template" — it is that a **runtime
  capability check on your own module** turns a compile error into silent nothing. If the import
  would have failed the build, this would have been caught the day it was written. Never
  feature-detect code you own.
- **A delivery log that records intent rather than outcome is worse than no log**, because it is the
  thing you check when a customer says they never got the email.
- **`pnpm test` runs a tool that is not installed.** The script has said `vitest run` since the repo
  was set up; vitest is in no `package.json` and there are zero `*.test.ts` files. A script that
  cannot run reads as coverage that does not exist. Either wire it up or delete it.
- **Automation makes every missing guardrail load-bearing.** The product has no customer email
  opt-out, no suppression list and no quiet hours — survivable only because every send today follows
  a human clicking a button. The audit for [[workflow-automation/README|workflow automation]] surfaced
  it: the moment a machine can send on a schedule, "a human decided to" stops being the control.
  Look for guardrails that are really just low volume in disguise before automating a path.

## Email consent and unsubscribe (2026-08-07)

- **A `GET` must never unsubscribe anyone.** Gmail, Outlook and every corporate link scanner fetch
  URLs in messages in the background, looking for malware. A one-URL unsubscribe that acts on `GET`
  therefore opts out people who never clicked, and they do not find out for weeks. Split it: `GET`
  reads and renders a confirmation, `POST` acts. RFC 8058 one-click is a third endpoint, and it is
  a `POST` for exactly this reason.
- **RFC 8058 clients post `application/x-www-form-urlencoded`, and this server has no form-body
  parser.** Without `addContentTypeParser` on the one-click route, every mail provider gets `415`
  and the Gmail unsubscribe control silently never works. Register it **inside** the route plugin —
  Fastify encapsulates it there, so the rest of the API does not quietly start accepting form posts.
- **`List-Unsubscribe` alone does not satisfy the bulk-sender rule.** Gmail and Yahoo require
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` alongside it. One without the other is the
  same as neither.
- **Derive the unsubscribe token, don't store it.** HMAC of the id under a secret the app already
  has means no column, no backfill, nothing extra in a table dump, and secret rotation invalidates
  every outstanding link at once. Put the **tenant id inside the signature** so a token cannot be
  replayed across a tenant boundary.
- **A consent check should return a decision, not a boolean.** `{allowed, reason, email}` — the
  caller needs the address anyway, and the *reason* is what goes into a run log or a delivery row.
  A bare `false` forces every caller to invent an explanation, which is how "email failed" ends up
  covering four unrelated situations.
- **Make the exemption an argument, never an omission.** `purpose: "marketing" | "transactional"`
  as a required parameter means the next person adding a send has to state which kind it is. If
  transactional were the default, forgetting would be indistinguishable from deciding.
- **Put the footer link on the shared email layout, not in each template.** E-15 had rolled its
  own; fifteen templates each remembering is how this codebase ended up with four phone formatters
  and three definitions of "overdue".
- **A skipped send must not stamp its "already sent" marker.** E-09 sets `renewalReminderSentAt`
  after sending. Setting it when consent refused the send would record a send that never happened
  and suppress the real one if the customer resubscribes inside the contract's 30-day window.

## Workflow automation — observability

- **A table with one writer and no reader is a feature that does not exist.**
  `node_execution_logs` was designed carefully — status, resolved parameters,
  skip reason, duration, a plain-language error hint, a context snapshot on
  failure — and written on every node from P3 onwards. Nothing outside a test
  ever read a row of it, and neither did anything read `workflow_executions`.
  Six commits of engine and builder landed on top of that before an audit
  noticed. **Grep for a read path when you finish a write path**, in the same
  session: the schema being good is exactly what makes this easy to miss, because
  reviewing the code shows care everywhere and reveals nothing about reachability.
- **The audit that found it was mechanical, not clever.** Listing every exported
  hook and server action against its caller count, and every table against the
  files that touch it, took two commands. That same sweep also found three hooks
  with zero callers (`useWorkflowQuota`, `useWorkflowVersions`,
  `useWorkflowValidation`) — the recurring shape here, after `useInvoice` and six
  quote hooks. Run it *before* deciding what to build next, not after.
- **Lead a failure page with `error_hint`, never `error_message`.** The person
  opening a run is the person who has to fix the automation, and workflow
  failures are the largest support load a feature like this generates. A stack
  trace moves that load onto you; a sentence removes it. Keep the technical text
  one disclosure away so an escalation still has something to paste.
- **`waiting` is not a shade of success or of failure.** A durable pause is the
  headline feature of the engine — a run can sit waiting for three days, entirely
  healthy. Colouring it green claims it finished; colouring it amber claims
  something is wrong. It needs its own word and its own colour, and so does
  `cancelled`: a `logic.stop` set to "Stopped early" is the automation working,
  which is why the failure notification deliberately skips it.
- **Count stats in SQL, not from the page you fetched.** A tally derived from the
  current twenty rows describes the current twenty rows, and renders directly
  above a paginated list contradicting it. Same shape as REP-02 and DASH-07: two
  numbers on one screen that cannot both be right.
- **Poll only while there is something to watch.** A run list refetches every 10s
  while any run is `running` or `waiting`, and stops otherwise — finished runs do
  not change until somebody starts another. A permanent interval on an idle tab
  is a cost with no reader; no interval at all means a durable pause that resumes
  in the background never appears to.
