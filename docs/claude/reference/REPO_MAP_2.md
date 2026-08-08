# REPO_MAP — Part 2: Packages, Database, Auth, Build Progress

> **Part 2 of 2** — Packages, database schema, auth architecture, build progress
> - [[REPO_MAP_1|Part 1]]: Root config, API routes, web app structure, components
> - [[REPO_MAP_2|Part 2]]: Packages, database schema, auth architecture, build progress *(this file)*
## Packages

### `packages/database/` — Drizzle ORM + Supabase Client

```
packages/database/
+-- package.json              # @hvac-saas/database — drizzle-orm, postgres, @supabase/supabase-js
+-- tsconfig.json
+-- drizzle.config.ts         # Schema location, migration output, dotenv for DATABASE_URL
+-- src/
    +-- index.ts              # Barrel: getDb, closeDb, getSupabaseClient, getSupabaseAdmin, all schema
    +-- client.ts             # Drizzle client (lazy singleton via postgres driver)
    +-- schema/
        +-- index.ts              # Barrel re-export of all tables, enums, relations
        +-- enums.ts              # 14 pgEnum definitions (incl. serviceFrequencyEnum, expenseCategoryEnum)
        +-- auth.ts               # Better Auth tables: user, session, account, verification, organization, member, invitation
        +-- tenants.ts            # tenants table (with organizationId FK)
        +-- users.ts              # users table (replaced by Better Auth user + member)
        +-- admin.ts              # adminAuditLog, adminImpersonationSessions, platformEvents
        +-- subscriptions.ts      # tenantSubscriptions (Lemon Squeezy fields)
        +-- customers.ts          # customers table
        +-- customer-notes.ts     # customerNotes table
        +-- customer-activities.ts # customerActivities table
        +-- calendar-events.ts    # calendarEvents table
        +-- catalog.ts            # catalogItems table (unitCost — nullable, never defaulted to 0)
        +-- equipment.ts          # equipment, refrigerantLogs tables (jobId FK to jobs)
        +-- maintenance.ts        # maintenanceContracts table (with frequency column)
        +-- bookings.ts           # bookings table
        +-- jobs.ts               # jobs, jobLineItems, jobPhotos tables (status is text, equipmentId FK).
        |                         # jobs.actualHours + jobs.laborCostRate (snapshotted, so a raise does
        |                         # not rewrite old margins); jobLineItems.unitCost + generated costTotal
        +-- costing.ts            # jobExpenses, tenantMemberRates tables
        +-- job-activities.ts     # jobActivities table
        +-- invoices.ts           # invoices, invoiceLineItems, invoicePayments tables
        +-- quotes.ts             # quotes, quoteLineItems tables
        +-- quote-activities.ts   # quoteActivities table
        +-- schedule.ts           # availabilitySchedules, scheduleOverrides tables
        +-- checklists.ts         # checklistTemplates, checklistItems, jobChecklistCompletions tables
        +-- pipelines.ts           # pipelines table (id, tenant_id, name, label, is_default)
        +-- pipeline-stages.ts    # jobPipelineStages table (per-tenant Kanban config)
        +-- notifications.ts      # notifications, notification_reads, notification_channel_config, notification_deliveries tables
        +-- tags.ts               # tags, customerTags tables
        +-- relations.ts          # All Drizzle relations() for query builder joins
```

### `packages/types/` — Shared TypeScript Types

Types inferred from Drizzle schema (`$inferSelect` / `$inferInsert`).

```
packages/types/
+-- package.json              # @hvac-saas/types — depends on @hvac-saas/database
+-- tsconfig.json
+-- src/
    +-- index.ts              # Barrel re-export
    +-- enums.ts              # Const arrays + union types for all enums
    +-- tenant.ts             # Tenant, TenantInsert, TenantUpdate
    +-- costing.ts            # JobExpense, TenantMemberRate + the DERIVED contracts: CostCoverage
    |                         # (what the margin doesn't know), JobCostSummary, ProfitabilityRow,
    |                         # ProfitabilitySection
    +-- user.ts               # User, UserInsert
    +-- customer.ts           # Customer, CustomerInsert, CustomerUpdate
    +-- customer-note.ts      # CustomerNote types
    +-- customer-activity.ts  # CustomerActivity types
    +-- job.ts                # Job, JobInsert, JobUpdate, JobLineItem, JobPhoto
    +-- job-activity.ts       # JobActivity types
    +-- invoice.ts            # Invoice, InvoiceInsert, InvoiceUpdate, InvoiceLineItem, InvoicePayment
    +-- quote.ts              # Quote, QuoteInsert, QuoteUpdate, QuoteLineItem
    +-- booking.ts            # Booking, BookingInsert, BookingUpdate
    +-- catalog.ts            # CatalogItem, CatalogItemInsert, CatalogItemUpdate
    +-- checklist.ts          # ChecklistTemplate, ChecklistItem, JobChecklistCompletion
    +-- equipment.ts          # Equipment, EquipmentInsert, EquipmentUpdate, RefrigerantLog, RefrigerantLogInsert
    +-- maintenance-contract.ts  # MaintenanceContract, MaintenanceContractInsert, MaintenanceContractUpdate
    +-- schedule.ts           # AvailabilitySchedule, ScheduleOverride
    +-- pipeline.ts            # Pipeline, PipelineInsert types
    +-- pipeline-stage.ts     # PipelineStage, PipelineStageInsert
    +-- tag.ts                # Tag, CustomerTag types
    +-- dashboard.ts          # DashboardStats + related metric interfaces
    +-- subscription.ts       # TenantSubscription, TenantSubscriptionInsert
    +-- notification.ts       # Notification, NotificationRead, NotificationChannelConfig, NotificationDelivery, NotificationWithReadStatus
    +-- admin.ts              # AdminAuditLog, AdminImpersonationSession, PlatformEvent
```

### `packages/workflow-nodes/` — The automation node contract

Deliberately a **data** package: plain objects and pure functions, no React and
no Drizzle, because the API and the browser both import it. A node definition is
one declaration consumed three ways — the builder renders its form from
`properties[]`, the engine dispatches on `node`, and the validator reads the
same fields to block a bad publish. That is why adding a node is "write a
definition, write an executor" rather than touching six files.

```
packages/workflow-nodes/
+-- package.json              # @hvac-saas/workflow-nodes
+-- src/
    +-- node-definition.ts    # THE contract. `node` is a permanent public API — every
    |                         # saved automation stores the string, so a rename orphans
    |                         # somebody's work. Output `id` and `label` are SEPARATE:
    |                         # the reference impl. put the label in `sourceHandle`, so
    |                         # renaming "Found" to "Match" broke routing everywhere
    +-- active-nodes.ts       # The ship gate. A definition may land before its executor;
    |                         # this list is what stops the palette offering a node that
    |                         # would fail at run time. RELEASED_NODE_IDS only ever grows
    +-- execution-context.ts  # What a node can read. The customer resolves for EVERY
    |                         # subject type, and nothing in it is a Date — the context
    |                         # round-trips through jsonb across a delay
    +-- conditions.ts         # 22 operators in ONE closed set, shared by trigger filters
    |                         # and condition.if. An unresolvable variable FAILS its rule;
    |                         # `isUnset` is load-bearing because the builder persists
    |                         # every property, so an unconfigured filter is
    |                         # present-but-empty, and 0/false are values
    +-- naming.ts             # DEFAULT_WORKFLOW_NAME + isNamedWorkflow
    +-- graph/
    |   +-- validate.ts       # Every structural publish rule, PURE so the browser runs
    |                         # the same code the server does. 19 issue codes in a closed
    |                         # union. Tenant ownership is the one rule that cannot be
    |                         # pure and lives in services/workflow/graph/ instead
    +-- registry/
        +-- index.ts          # EXPLICIT STATIC IMPORTS ONLY — never a glob. The reference
        |                     # impl. records an OOM in Next's "Collecting page data" from
        |                     # exactly that. A test walks the directory and fails if a
        |                     # file here is not imported, so the rule is enforced without
        |                     # using the thing it forbids
        +-- triggers/         # manual · job.completed · invoice.paid · invoice.overdue ·
        |                     # quote.accepted · booking.created · customer.created
        +-- communication/    # email.send · notification.internal
        +-- actions/          # customer.addNote · job.moveStage · job.assign
        +-- timing/           # delay.wait — durable pause, working-hours aware
        +-- logic/            # condition.if · logic.merge (the ONLY AND join) · logic.stop
```

### `packages/email/` — React Email Templates

```
packages/email/
+-- package.json              # @hvac-saas/email
+-- tsconfig.json
+-- src/
    +-- index.ts              # Barrel: render*Email() + props types + shared components
    +-- components/           # EmailLayout, BrandButton, DataTable, InfoRow, Heading
    +-- templates/
        +-- e01-welcome.tsx                  # Deferred — needs org-creation refactor
        +-- e02-booking-confirmation.tsx     # To customer on submit (+ status-page link)
        +-- e03-new-booking-notification.tsx # To owner on submit
        +-- e04-booking-confirmed.tsx        # To customer when staff confirm/convert
        +-- e05-job-completion.tsx
        +-- e06-invoice.tsx
        +-- e07-invoice-overdue.tsx          # Cron
        +-- e08-payment-receipt.tsx
        +-- e09-contract-renewal.tsx         # Cron
        +-- e10-trial-expiring.tsx           # Cron
        +-- e11-welcome-paid.tsx             # Deferred — needs Lemon Squeezy webhook
        +-- e12-review-request.tsx
        +-- e13-quote.tsx
        +-- e14-booking-cancelled.tsx        # To customer on cancel (added 2026-07-27 — the
        |                                    # customer was told when booked, never when cancelled)
        +-- e15-notification.tsx             # Generic notification alert. Written in P0 with
        |                                    # the fix for `sendNotificationAlertEmail`,
        |                                    # which was imported from nowhere
        +-- team-invitation.tsx
```

Senders live in `apps/api/src/lib/email.ts`; every subject goes through
`sanitizeSubject()` ([[security-rules]] §6). Sends no-op with a warning when
`RESEND_API_KEY` is unset.

### `packages/config/` — Shared Configuration

```
packages/config/
+-- package.json              # @hvac-saas/config
```

---

## Database Tables (35 total)

### Better Auth Tables (7)

| Table | Purpose |
|---|---|
| `user` | User accounts (text IDs, not UUID) |
| `session` | Active sessions |
| `account` | Auth providers |
| `verification` | Email verification tokens |
| `organization` | Better Auth organizations (map to tenants) |
| `member` | Organization membership |
| `invitation` | Org invitations |

### Business Tables (28)

| Table | Purpose | Key Fields |
|---|---|---|
| `tenants` | Business accounts | business_name, slug, organizationId FK, timezone, booking_slot_capacity, defaultTaxRate, invoice/quote settings |
| `tenant_subscriptions` | Billing state | lemonSqueezySubscriptionId, status, planName |
| `customers` | Tenant's customers | first_name, last_name, email, phone, address, lat/lng |
| `customer_notes` | Per-customer notes | customer_id, content, author tracking |
| `customer_activities` | Activity timeline | customer_id, activity_type, metadata |
| `tags` | Tenant-level tags | tenant_id, name, color |
| `customer_tags` | Many-to-many junction | customer_id, tag_id |
| `catalog_items` | Price book | name, item_type, unit_price, unit, category |
| `equipment` | Customer equipment | customer_id, equipment_type, brand, model, serial |
| `refrigerant_logs` | EPA tracking | equipment_id, job_id, refrigerant_type, amount_lbs |
| `maintenance_contracts` | Service contracts | customer_id, status, frequency, price |
| `jobs` | Service jobs | customer_id, job_number (JOB-YYYY-XXXX), status (text), booking_id FK → bookings (set null) |
| `job_line_items` | Job charges | job_id, catalog_item_id, qty, unit_price, total (generated) |
| `job_photos` | Job site photos | job_id, storage_path, caption |
| `job_activities` | Job activity log | job_id, activity_type, metadata |
| `job_pipeline_stages` | Per-tenant Kanban config | tenant_id, name, label, color, sortOrder, isDefault |
| `invoices` | Billing documents | invoice_number (INV-YYYY-XXXX), status, total |
| `invoice_line_items` | Invoice charges | invoice_id, qty, unit_price, total (generated) |
| `invoice_payments` | Payment records | invoice_id, amount, payment_method |
| `quotes` | Estimates | quote_number (QT-YYYY-XXXX), status, expiresAt |
| `quote_line_items` | Quote charges | quote_id, qty, unit_price, total (generated) |
| `quote_activities` | Quote activity log | quote_id, activity_type, metadata |
| `calendar_events` | Calendar entries | tenant_id, customer_id, title, event_date, start/end time. **Occupy booking-portal slots** |
| `bookings` | Online bookings | customer_id, status, booking_date, preferred_time, service_type, converted_to_job_id FK, archived_at |
| `booking_activities` | Booking audit trail | booking_id, type, description, metadata, performed_by |
| `availability_schedules` | Weekly availability | day_of_week, start_time, end_time, unique (tenant_id, day_of_week) |
| `schedule_overrides` | Day-off / special hours | override_date, is_available, reason. Take precedence over the weekly schedule |
| `checklist_templates` | Per-service-type templates | service_type, name, is_active |
| `checklist_items` | Template items | template_id, label, is_required, catalog_item_id |
| `job_checklist_completions` | Per-job tracking | job_id, checklist_item_id, is_completed |
| `admin_audit_log` | Admin action log | action, target_tenant_id, metadata |
| `admin_impersonation_sessions` | Impersonation tracking | admin_user_id, tenant_id, reason |
| `platform_events` | Activity tracking | tenant_id, event_type, user_id |

---

## Authentication Architecture

### Better Auth (Unified)

```
/login (single page)
    |
    +-- signIn.email({ email, password }) via Better Auth React client
        +-- Match -> Better Auth session cookie
        |   +-- role === "admin" -> /superadmin/dashboard
        |   +-- Otherwise -> /dashboard (OrgResolver ensures tenant)
        +-- Fail -> "Invalid credentials" error
```

### Route Protection

| Path | Required Auth | Method |
|---|---|---|
| `/`, `/login`, `/signup`, `/forgot-password` | None (public) | middleware.ts |
| `/book/*`, `/ref/*` | None | middleware.ts |
| `/dashboard/*` | Better Auth session | middleware.ts + requireTenant |
| `/superadmin/*` | Better Auth session (admin role) | middleware.ts + requireAdmin |

---

## Package Dependency Graph

```
apps/api  --> @hvac-saas/database +
          --> @hvac-saas/types +

apps/web  --> @hvac-saas/types +
          --> @hvac-saas/ui ~

packages/types --> @hvac-saas/database +
```

---

## Build Order Progress (Phase 1)

| # | Feature | Status |
|---|---------|--------|
| 1 | Organization/Tenant creation flow | + Done |
| 2 | Customer CRUD | + Done |
| 3 | Service Catalog | + Done |
| 4 | Job Management (Kanban) | + Done |
| 5 | Invoicing | + Done |
| 6 | Quote Builder | + Done |
| 7 | KPI Dashboard | + Done |
| 8 | Booking Portal | + Done |
| 9 | Calendar/Schedule View | + Done |
| 10 | Checklists | + Done |
| 11 | Super Admin Panel | + Done |
| 12 | Email Templates | - Not started (blocked by #8) |
| 13 | Affiliate Program | - Not started (blocked by #11) |
| 14 | Settings | + Done (except Billing tab) |
| 15 | Equipment/Assets | + Done |
| 16 | Service Agreements | + Done |
| 17 | Team Management | + Done |
| 18 | Email Templates | + Done |
