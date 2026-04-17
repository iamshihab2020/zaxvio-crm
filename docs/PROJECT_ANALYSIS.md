# Zaxvio CRM — Project Analysis & Feature Inventory

> **Generated**: 2026-04-15
> **Status**: Phase 1 Complete — All 14 core features implemented

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Feature List (Detailed)](#feature-list-detailed)
5. [User Flows](#user-flows)
6. [Database Schema](#database-schema)
7. [API Endpoints Summary](#api-endpoints-summary)
8. [Frontend Pages & Routes](#frontend-pages--routes)
9. [Email Templates](#email-templates)
10. [Admin Panel](#admin-panel)
11. [What's Pending](#whats-pending)

---

## Project Overview

Zaxvio CRM is a **multi-industry Service Management SaaS** platform. Initial target market is solo HVAC contractors and 1–3 person service teams, but the platform is designed to be **industry-agnostic** — all features work for any service business (plumbing, electrical, cleaning, landscaping, etc.).

**Business Model**: $49/month per organization via Lemon Squeezy (billing integration pending).

**Multi-Tenancy**: Shared-database, shared-schema architecture. Every tenant table has a `tenant_id` column. Application-level isolation via `tenantFilter()` helper. Better Auth organizations map to tenants.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14 (App Router) — port 3000 |
| Backend | Fastify — port 4000 |
| Database | Supabase (PostgreSQL 15) |
| ORM | Drizzle ORM |
| Auth | Better Auth (email/password, organization + admin plugins) |
| Realtime | Supabase Realtime |
| AI/Chat | Groq (llama-3.3-70b-versatile) + Vercel AI SDK v6 |
| UI Components | shadcn/ui (Radix UI primitives) + Tailwind CSS |
| Data Fetching | TanStack React Query (client) + Server Actions (gateway) |
| Charts | Recharts |
| Drag & Drop | @dnd-kit |
| Animations | motion/react (Framer Motion) |
| Email | React Email (14 templates) |
| PDF | Server-side PDF generation for invoices & quotes |
| Icons | Tabler Icons |
| Forms | React Hook Form + Zod validation |
| Toast | Sonner |

---

## Architecture

```
zaxvio-crm/
├── apps/
│   ├── api/              # Fastify REST API (port 4000)
│   │   ├── src/
│   │   │   ├── routes/         # ~31 route files, 100+ endpoints
│   │   │   ├── services/       # Business logic layer
│   │   │   ├── lib/
│   │   │   │   └── schemas/    # 22 Zod validation schema files
│   │   │   └── db/             # Database helpers
│   │   └── tests/
│   │
│   └── web/              # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/            # App Router (6 route groups, ~48 pages)
│           ├── actions/        # 20 server action files (API gateway)
│           ├── components/
│           │   ├── dashboard/  # 20+ entity component folders
│           │   └── ui/         # 33 shadcn/ui base components
│           ├── hooks/
│           │   └── queries/    # 18+ TanStack Query hook files
│           └── lib/            # Utilities, chatbot, query keys
│
└── packages/
    ├── database/          # @hvac-saas/database — Drizzle schema & clients
    ├── types/             # @hvac-saas/types — TypeScript types (inferred from Drizzle)
    └── email/             # @hvac-saas/email — 14 React Email templates
```

### Data Flow

```
Client Component
    → Server Action (apps/web/src/actions/)
        → Fastify API (apps/api/src/routes/)
            → Service Layer (apps/api/src/services/)
                → Drizzle ORM → PostgreSQL (Supabase)
```

- **Server Actions** are the ONLY gateway for frontend API calls
- **Route handlers** are thin: validate → call service → respond
- **Service layer** holds all business logic
- **TanStack React Query** manages client-side caching, prefetching, and optimistic updates

---

## Feature List (Detailed)

### 1. Authentication & Team Management

| Feature | Details |
|---|---|
| Email/password signup & login | Better Auth with password policy (12+ chars, mixed case + number) |
| Forgot password | Email-based password reset flow |
| Organization creation | Auto-creates tenant + subscription on org creation |
| Team invitations | Email invitations with accept flow at `/invite/[id]` |
| Role-based access | Owner, Admin, Member roles per organization |
| Team management | Settings page to invite, update roles, remove members |
| Session management | JWT-based sessions with impersonation support |

### 2. Customer Management (Full CRUD)

| Feature | Details |
|---|---|
| Customer list | Searchable, sortable, paginated table with bulk actions |
| Customer creation | Dialog with name, email, phone, address fields |
| Customer detail page | 3-panel layout with inline editing |
| Customer notes | Create, edit, delete notes per customer |
| Activity log | Audit trail of all changes to a customer |
| Tags | Create colored tags, assign/remove from customers |
| Customer tabs | Overview, Activities, Notes, Invoices, Quotes, Equipment, Agreements, Conversations, Photos |
| Bulk operations | Archive, restore, delete multiple customers |
| Soft delete | Archive pattern with Active/Archived filter tabs |
| Customer picker | Reusable component for selecting customers in forms |

### 3. Job Management (Kanban + Table)

| Feature | Details |
|---|---|
| Kanban board | Drag-and-drop job cards across pipeline stages (dnd-kit) |
| Table view | Alternative list view with sorting and filters |
| View toggle | Switch between Kanban and Table views (persisted preference) |
| Job creation | Dialog with customer, service type, priority, schedule date |
| Job detail panel | 5-tab sheet (Overview, Line Items, Checklist, Photos, Timeline) |
| Line items | Add labor, parts, materials with quantity and pricing |
| Status tracking | State machine: Scheduled → In Progress → Completed / Cancelled |
| Priority levels | Standard, Urgent, Emergency |
| Job assignment | Assign technician/team member to jobs |
| Photo attachments | Upload before/after/general photos with tag pills |
| Document attachments | Upload and manage job documents |
| Activity timeline | Full audit trail of job changes |
| Checklists | Attach checklist templates, track completion |
| Bulk operations | Archive, restore, delete, bulk status update |
| Multi-pipeline | Multiple pipelines per tenant, scoped views |
| Pipeline stages | Custom stages with colors, drag-to-reorder |
| Card customization | Field visibility popover for kanban cards |
| Compact cards | Optional compact card layout |

### 4. Invoicing

| Feature | Details |
|---|---|
| Invoice list | Searchable table with status filters |
| Create from job | Generate invoice from job line items |
| Manual creation | Create standalone invoices |
| Line items | Add/edit/remove with quantity, unit price, description |
| Tax & discounts | Configurable tax rate and discount amounts |
| Auto-calculation | Subtotal, tax, discount, total, balance due |
| Status flow | Draft → Sent → Paid / Partially Paid / Overdue / Void |
| Payment recording | Record payments against invoices |
| PDF generation | Server-side PDF for download/email |
| Send via email | Email invoice to customer with PDF attachment |
| Invoice settings | Customizable invoice prefix, tax rate, terms |
| Bulk operations | Archive, restore, delete, bulk status update |
| Overdue alerts | Dashboard warnings for overdue invoices |

### 5. Quote Builder

| Feature | Details |
|---|---|
| Quote list | Searchable table with status filters |
| Quote creation | Create quotes linked to customers |
| Line items | Add/edit/remove with quantity, unit price |
| Tax & discounts | Configurable per quote |
| Status flow | Draft → Sent → Accepted / Declined / Expired |
| PDF generation | Server-side PDF for download/email |
| Send via email | Email quote to customer |
| Public acceptance portal | Customer views quote at `/quote/[token]` — accept or decline without login |
| Quote → Job conversion | Accepted quotes convert to jobs |
| Auto-expiry | Bulk expire old quotes |
| Activity timeline | Full audit trail of quote changes |
| Quote settings | Expiry days, acceptance message customization |
| Bulk operations | Archive, restore, delete, bulk status update |

### 6. Booking Portal

| Feature | Details |
|---|---|
| Public booking page | Customers book at `/book/[slug]` (no login required) |
| Service type selection | Choose from tenant's active catalog items |
| Customer info collection | Name, email, phone, address, notes |
| Availability calendar | Shows available time slots based on tenant schedule |
| Booking confirmation | Status page at `/book/[slug]/status/[id]` |
| Dashboard management | List, filter, update booking status |
| Booking → Job conversion | Convert confirmed bookings to jobs (atomic transaction) |
| Booking settings | Configure available services, scheduling rules |
| Bulk operations | Bulk status update, archive, restore |

### 7. KPI Dashboard

| Feature | Details |
|---|---|
| KPI grid | Jobs Today, Revenue This Month, Outstanding Balance, Conversion Rate |
| Sparkline charts | Mini trend lines in each KPI card |
| Revenue chart | Monthly revenue trend (Recharts) |
| Job pipeline chart | Jobs by status distribution |
| Quote conversion chart | Quote accept/decline/pending funnel |
| Invoice aging chart | Outstanding invoices by age bucket |
| Today's schedule | Upcoming jobs/events for the day |
| Recent activity feed | Latest customer/job/invoice/quote activities |
| Overdue alert banner | Warning for overdue invoices or jobs |
| Quick actions | Create job, customer, invoice, quote shortcuts |
| Date range filtering | Filter all dashboard data by date range |
| Caching | In-memory TTL cache for expensive analytics queries |

### 8. Reports & Analytics

| Feature | Details |
|---|---|
| Revenue tab | Revenue trends, totals, averages, growth |
| Jobs tab | Completion rates, average duration, by service type |
| Customers tab | Acquisition, retention, lifetime value |
| Quotes/Invoices tab | Conversion funnel, payment collection rates |
| Bookings tab | Booking volume, conversion to jobs |
| CSV export | Export report data as CSV |
| Date range picker | Filter all reports by custom date range |
| Data tables | Tabular view of report metrics |

### 9. Calendar & Scheduling

| Feature | Details |
|---|---|
| Month/Week/Day views | Full calendar with view switching |
| Event creation | Create events with title, date, time, description |
| Job scheduling | Jobs appear on calendar at scheduled date |
| Booking overlay | Bookings show on calendar |
| Drag-to-reschedule | Drag events to change date/time |
| Availability management | Set weekly schedule per day (start/end times) |
| Schedule overrides | Block specific dates or set special hours |
| Filter by type | Filter calendar by jobs, events, bookings |

### 10. Equipment & Asset Management

| Feature | Details |
|---|---|
| Equipment list | Searchable, paginated table |
| Equipment CRUD | Make, model, serial number, install date, location |
| Equipment detail page | Overview + service history tabs |
| Customer linking | Equipment belongs to a customer |
| Refrigerant logs | EPA-compliant tracking (added/recovered/recycled amounts) |
| Service history | All jobs performed on this equipment |
| Bulk operations | Archive, restore |

### 11. Service Agreements / Maintenance Contracts

| Feature | Details |
|---|---|
| Contract list | Searchable, filterable table |
| Contract CRUD | Name, customer, equipment, start/renewal/expiry dates |
| Frequency settings | Weekly, biweekly, monthly, quarterly, semi-annual, annual |
| Cost tracking | Contract cost and payment method |
| Renewal reminders | Email notifications for upcoming renewals |
| Active/inactive toggle | Bulk activate/deactivate |
| Expiring contracts | API endpoint for contracts expiring soon |

### 12. Service Catalog

| Feature | Details |
|---|---|
| Catalog list | Searchable table with category filters |
| Item CRUD | Name, description, category, base price |
| Item types | Labor, Part, Material, Service Call, Other |
| Active/inactive | Toggle items on/off |
| Catalog picker | Reusable component for selecting catalog items in forms |
| Bulk toggle | Activate/deactivate multiple items |
| Settings page | Manage catalog from settings |

### 13. Checklists

| Feature | Details |
|---|---|
| Template management | Create checklist templates with items |
| Service type association | Templates tied to service types |
| Job attachment | Attach templates to jobs |
| Item completion | Check off items during job execution |
| Catalog linking | Checklist items can reference catalog items |
| User attribution | Track who completed each item |

### 14. Conversations (Email Messaging)

| Feature | Details |
|---|---|
| Two-panel layout | Conversation list + message thread |
| Email conversations | Send/receive emails with customers |
| SMS placeholder | "Coming Soon" indicator for future SMS |
| Real-time updates | Supabase Realtime for instant message delivery |
| Desktop notifications | Browser notification API for new messages |
| Notification settings | Toggle desktop notifications in settings |
| Conversation archiving | Archive old conversations |
| Customer linking | Conversations tied to customer records |

### 15. Notifications

| Feature | Details |
|---|---|
| In-app notifications | Real-time via Supabase Realtime |
| Email notifications | Configurable per notification type |
| Notification bell | Badge with unread count in sidebar |
| Notification page | Full list with read/unread state |
| Mark read | Individual and bulk mark-as-read |
| Notification types | 10 types: booking_received, job_status_changed, invoice_paid, quote_accepted, etc. |
| Channel preferences | Per-type settings for in-app, email, SMS, voice |
| Deduplication | `dedup_key` prevents duplicate notifications |

### 16. AI Help Chatbot

| Feature | Details |
|---|---|
| Floating widget | Chat panel accessible from any dashboard page |
| AI-powered | Groq LLM (llama-3.3-70b-versatile) via Vercel AI SDK v6 |
| 10 AI tools | greet, answer_help, create customer/event/job/invoice/quote/catalog_item/equipment/booking |
| Knowledge base | FAQ entries covering all platform features |
| Entity creation | Create CRM records directly from chat |
| Welcome screen | Suggested prompts for first-time users |
| Typing indicator | Visual feedback during AI response |

### 17. Settings

| Page | Features |
|---|---|
| Profile | User name, email, avatar |
| Change Password | Update password with validation |
| Business | Company name, phone, email, logo, timezone |
| Team | Invite members, manage roles, remove members |
| Notifications | Per-type notification channel preferences |
| Bookings | Availability schedule, booking portal settings |
| Catalog | Manage service catalog items |
| Checklists | Manage checklist templates |
| Invoices | Invoice prefix, tax rate, payment terms |
| Quotes | Quote expiry, acceptance settings |
| Pipelines | Create/edit/delete pipelines and stages |
| Share | Shareable booking page link |

### 18. Landing Page & Public Pages

| Page | Details |
|---|---|
| Landing page | Hero, features, pricing, FAQ, testimonials |
| Blog | Blog listing + individual post pages |
| Public booking | `/book/[slug]` — no-auth booking form |
| Public quote | `/quote/[token]` — no-auth quote acceptance |
| Booking status | `/book/[slug]/status/[id]` — booking confirmation |

---

## User Flows

### Flow 1: New User Onboarding

```
1. User visits landing page → clicks "Get Started"
2. Signup page → enters email, password, company name
3. Better Auth creates user + organization + tenant
4. Redirected to dashboard (empty state)
5. AI chatbot offers guided setup prompts
6. User configures: business settings, availability, catalog items
7. User creates first customer → first job → first invoice
```

### Flow 2: Customer Booking → Job Completion → Invoice

```
1. Customer visits /book/[slug] (public, no login)
2. Selects service type from catalog
3. Picks available date/time from calendar
4. Submits booking with contact info
5. Tenant receives booking_received notification (in-app + email)
6. Tenant reviews booking in dashboard → confirms it
7. Booking converts to Job (atomic transaction)
8. Job appears on Kanban board in "Scheduled" stage
9. Technician assigned to job
10. Day of service: tech marks job "In Progress"
11. Tech completes checklist items, uploads before/after photos
12. Tech marks job "Completed"
13. Invoice auto-generated from job line items
14. Invoice sent to customer via email (PDF attached)
15. Customer pays → payment recorded → invoice marked "Paid"
```

### Flow 3: Quote → Acceptance → Job

```
1. Tenant creates quote for customer with line items
2. Quote sent via email (includes public link)
3. Customer opens /quote/[token] (no login required)
4. Customer reviews line items, pricing
5. Customer clicks "Accept" → selects preferred date
6. Quote status → "Accepted"
7. quote_accepted notification sent to tenant
8. Tenant converts quote to job
9. Job created with quote line items pre-populated
10. Normal job workflow continues
```

### Flow 4: Daily Operations

```
1. Tenant logs in → Dashboard shows:
   - Today's jobs & schedule
   - Revenue KPIs with trends
   - Overdue invoice alerts
   - Recent activity feed
2. Checks notification bell for new bookings/messages
3. Reviews Kanban board → drags jobs between stages
4. Opens job detail → updates checklist, adds photos
5. Switches to Conversations → responds to customer emails
6. Generates report → exports CSV for accounting
```

### Flow 5: Team Collaboration

```
1. Owner goes to Settings → Team
2. Sends invitation email to new team member
3. Team member clicks invite link → creates account
4. Member joins organization with assigned role
5. Jobs can be assigned to team members
6. Notifications route to assigned team member
7. All team members share the same tenant data
```

### Flow 6: Equipment Service Tracking

```
1. Customer has equipment (e.g., AC unit) → added to their profile
2. Equipment record: make, model, serial, install date
3. Service agreement created: quarterly maintenance
4. System sends renewal reminder before expiry
5. Each service visit → job created, linked to equipment
6. Refrigerant logs tracked per visit (EPA compliance)
7. Full service history viewable on equipment detail page
```

---

## Database Schema

### Core Tables (30+)

| Category | Tables |
|---|---|
| **Auth** | user, session, account, verification, organization, member, invitation |
| **Tenant** | tenants, tenant_subscriptions |
| **Customers** | customers, customer_notes, customer_activities, customer_tags, tags |
| **Jobs** | jobs, job_line_items, job_photos, job_documents, job_activities, job_checklist_completions |
| **Invoices** | invoices, invoice_line_items, invoice_payments |
| **Quotes** | quotes, quote_line_items, quote_activities |
| **Bookings** | bookings, booking_activities |
| **Equipment** | equipment, refrigerant_logs, maintenance_contracts |
| **Scheduling** | availability_schedules, schedule_overrides, calendar_events |
| **Organization** | pipelines, job_pipeline_stages, catalog_items |
| **Checklists** | checklist_templates, checklist_items, job_checklist_completions |
| **Communication** | notifications, notification_reads, notification_channel_config, notification_deliveries, conversations, messages |
| **Admin** | admin_audit_log, admin_impersonation_sessions, platform_events, webhook_logs, cron_job_history |

### Key Enums

| Enum | Values |
|---|---|
| job_status | scheduled, in_progress, completed, cancelled |
| job_priority | standard, urgent, emergency |
| invoice_status | draft, sent, paid, partially_paid, overdue, void |
| quote_status | draft, sent, accepted, declined, expired |
| booking_status | pending, confirmed, cancelled, completed |
| service_type | installation, repair, maintenance, inspection, emergency, consultation, other |
| item_type | labor, part, material, service_call, other |
| photo_tag | before, after, general |
| conversation_channel | sms, email |
| notification_type | booking_received, booking_cancelled, job_status_changed, invoice_paid, customer_created, quote_accepted, quote_declined, invoice_overdue, team_member_joined, message_received |

---

## API Endpoints Summary

**Total: 100+ REST endpoints across 31 route files**

| Domain | Endpoints | Key Operations |
|---|---|---|
| Customers | 18 | CRUD, notes, activities, tags, photos, bulk ops |
| Jobs | 20 | CRUD, status, assignment, line items, photos, docs, checklists, bulk ops |
| Invoices | 14 | CRUD, line items, payments, PDF, send, bulk ops |
| Quotes | 15 | CRUD, line items, PDF, send, accept/decline, convert, bulk ops |
| Bookings | 8 | List, update, convert to job, bulk ops |
| Equipment | 8 | CRUD, maintenance history, bulk ops |
| Catalog | 6 | CRUD, bulk toggle |
| Checklists | 7 | CRUD, attach to job, item completion |
| Calendar Events | 5 | CRUD |
| Conversations | 6 | List, create, messages, send, archive |
| Notifications | 5 | List, unread count, mark read, preferences |
| Pipelines | 4 | CRUD |
| Pipeline Stages | 4 | CRUD, reorder |
| Tags | 4 | CRUD |
| Reports | 3 | Revenue, jobs, customer lifetime |
| Dashboard | 1 | Aggregated KPIs |
| Availability | 5 | Weekly schedule, overrides |
| Tenants | 4 | Profile, branding |
| Service Agreements | 6 | CRUD, expiring, bulk toggle |
| Public Quote | 3 | View, accept, decline (no auth) |
| Public Booking | 2 | View form, submit (no auth) |
| Admin Dashboard | 1 | Platform KPIs |
| Admin Tenants | 6 | CRUD, trial extension, subscription override |
| Admin Analytics | 3 | Revenue, churn, growth |
| Admin Audit | 2 | List, detail |
| Admin Search | 1 | Global cross-tenant search |
| Admin System | 1 | Health/status |
| Admin Admins | 4 | CRUD |
| Admin Impersonation | 2 | Start, end |

---

## Frontend Pages & Routes

### Route Groups

| Group | Purpose | Pages |
|---|---|---|
| `(auth)` | Authentication | Login, Signup, Forgot Password, Invite Accept |
| `(landing)` | Marketing | Landing page |
| `(blog)` | Content | Blog listing, Blog post |
| `(dashboard)` | Main app | 25+ pages (see below) |
| `(superadmin)` | Admin panel | 8 pages |
| Root public | No-auth portals | Booking form, Booking status, Quote acceptance |

### Dashboard Pages (25+)

| Page | Route | Features |
|---|---|---|
| Dashboard | `/dashboard` | KPI grid, charts, activity feed, schedule |
| Customers | `/customers` | Table, search, bulk actions, Active/Archived tabs |
| Customer Detail | `/customers/[id]` | 9-tab detail with inline editing |
| Jobs | `/jobs` | Kanban + Table toggle, pipeline tabs, bulk actions |
| Job Detail | `/jobs/[id]` | 5-tab detail sheet |
| Invoices | `/invoices` | Table, status filters, bulk actions |
| Invoice Detail | `/invoices/[id]` | Line items, payments, PDF |
| Quotes | `/quotes` | Table, status filters, bulk actions |
| Quote Detail | `/quotes/[id]` | Line items, activities, PDF |
| Bookings | `/bookings` | Table, convert to job |
| Assets | `/assets` | Equipment table, bulk actions |
| Asset Detail | `/assets/[id]` | Overview, service history, refrigerant logs |
| Catalog | `/catalog` | Service items table |
| Checklists | `/checklists` | Template management |
| Service Agreements | `/service-agreements` | Contracts table |
| Schedule | `/schedule` | Month/Week/Day calendar |
| Conversations | `/conversations` | Two-panel email messaging |
| Reports | `/reports` | 5-tab analytics with charts |
| Notifications | `/notifications` | Notification list |
| Settings (12 pages) | `/settings/*` | Profile, Business, Team, Notifications, Bookings, Catalog, Checklists, Invoices, Quotes, Pipelines, Share |

---

## Email Templates

| # | Template | Trigger |
|---|---|---|
| E-01 | Welcome | New user signup (deferred — needs org refactor) |
| E-02 | Booking Confirmation | Customer submits booking |
| E-03 | New Booking Notification | Internal — new booking received |
| E-04 | Booking Confirmed | Admin confirms booking |
| E-05 | Job Completion | Job marked completed |
| E-06 | Invoice | Invoice sent to customer |
| E-07 | Invoice Overdue | Cron job — overdue reminder |
| E-08 | Payment Receipt | Payment recorded |
| E-09 | Contract Renewal | Cron job — renewal approaching |
| E-10 | Trial Expiring | Cron job — trial ending soon |
| E-11 | Welcome Paid | Subscription activated (deferred — needs Lemon Squeezy) |
| E-12 | Review Request | Post-job Google review request |
| E-13 | Quote | Quote sent to customer |
| — | Team Invitation | Team member invited |

---

## Admin Panel (Super Admin)

Accessible at `/superadmin/*` for platform administrators.

| Page | Features |
|---|---|
| Dashboard | Tenant count, MRR, signups, DAU/WAU/MAU, trial metrics |
| Tenants | List, search, filter, detail view, trial extension, subscription override |
| Admins | Admin user CRUD |
| Analytics | Revenue, churn, growth metrics |
| Support | Global search across tenants |
| System | Health checks, system status |
| Affiliates | Affiliate management (placeholder) |
| Impersonation | Ghost mode — impersonate any tenant for debugging |

### Admin Capabilities
- View and manage all tenants
- Extend trial periods
- Override subscription plans
- Search across all tenant data
- Impersonate tenants (ghost + visible modes)
- Full audit logging of all admin actions

---

## What's Pending

### In Progress
- Public quote acceptance — needs Supabase Storage bucket creation
- Unified list page migration — 8 pages remaining
- AI chatbot upgrade — migration to Groq LLM in progress
- Job photo system — needs Supabase Storage bucket creation

### Backlog / Deferred
- **Billing/Subscription** — Lemon Squeezy integration not started
- **Affiliate Program** — Lemon Squeezy dependency
- **Welcome Email (E-01)** — needs org creation refactor
- **Welcome Paid Email (E-11)** — needs Lemon Squeezy webhook
- **SMS Conversations** — "Coming Soon" placeholder in UI
- **Conversations page** — TanStack Query migration deferred (Supabase Realtime architecture)

### Manual Steps Needed
- Create `quotes` Supabase Storage bucket
- Create `job-attachments` Supabase Storage bucket

---

## Summary Statistics

| Metric | Count |
|---|---|
| Total frontend pages | ~48 |
| Total API endpoints | 100+ |
| Route files (API) | 31 |
| Zod schema files | 22 |
| Database tables | 30+ |
| Database enums | 17 |
| Server action files | 20 |
| TanStack Query hook files | 18+ |
| Email templates | 14 |
| shadcn/ui components | 33 |
| Dashboard entity component groups | 20 |
| Settings pages | 12 |
| Admin pages | 8 |
| Reusable custom hooks | 30+ |
