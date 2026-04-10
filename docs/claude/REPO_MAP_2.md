# REPO_MAP — Part 2: Packages, Database, Auth, Build Progress
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
    +-- supabase.ts           # Supabase client factories (tenant-scoped + admin)
    +-- schema/
        +-- index.ts              # Barrel re-export of all tables, enums, relations
        +-- enums.ts              # 13 pgEnum definitions (incl. serviceFrequencyEnum)
        +-- auth.ts               # Better Auth tables: user, session, account, verification, organization, member, invitation
        +-- tenants.ts            # tenants table (with organizationId FK)
        +-- users.ts              # users table (replaced by Better Auth user + member)
        +-- admin.ts              # adminAuditLog, adminImpersonationSessions, platformEvents
        +-- subscriptions.ts      # tenantSubscriptions (Lemon Squeezy fields)
        +-- customers.ts          # customers table
        +-- customer-notes.ts     # customerNotes table
        +-- customer-activities.ts # customerActivities table
        +-- calendar-events.ts    # calendarEvents table
        +-- catalog.ts            # catalogItems table
        +-- equipment.ts          # equipment, refrigerantLogs tables (jobId FK to jobs)
        +-- maintenance.ts        # maintenanceContracts table (with frequency column)
        +-- bookings.ts           # bookings table
        +-- jobs.ts               # jobs, jobLineItems, jobPhotos tables (status is text, equipmentId FK)
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

### `packages/ui/` — Shared UI Component Library

```
packages/ui/
+-- package.json              # @hvac-saas/ui
+-- tsconfig.json
+-- src/
    ~ index.ts                # Placeholder (export {})
```

### `packages/email/` — React Email Templates

```
packages/email/
+-- package.json              # @hvac-saas/email
+-- tsconfig.json
+-- src/
    ~ index.ts                # Placeholder (export {})
```

**Planned templates (E-01 through E-13):** See PRD for full list. Not yet implemented.

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
| `tenants` | Business accounts | business_name, slug, organizationId FK, defaultTaxRate, invoice/quote settings |
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
| `jobs` | Service jobs | customer_id, job_number (JOB-YYYY-XXXX), status (text) |
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
| `calendar_events` | Calendar entries | tenant_id, customer_id, title, start/end datetime |
| `bookings` | Online bookings | customer_id, status, booking_date, service_type |
| `availability_schedules` | Weekly availability | day_of_week, start_time, end_time |
| `schedule_overrides` | Day-off / special hours | override_date, is_available, reason |
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
