# Super Admin Panel — Comprehensive Implementation Plan

## Context

The Super Admin Panel is feature #11 in the build order — the largest remaining feature. It provides platform-level management for the HVAC SaaS CRM: tenant management with impersonation, MRR/analytics dashboards, support tools, and system health monitoring. The PRD defines 26 features (SA-01 → SA-26), of which 18 are P0 (must-have). Currently ~5% built (scaffold only — `.gitkeep` files, one stub page, auth middleware, 3 migrated DB tables).

---

## Phase 0 — Foundation (Blocks Everything)

### 0A: Schema + Auth Infrastructure

**Problem**: PRD requires 3 admin tiers (`super_admin`, `support`, `billing_admin`) but Better Auth only has a single `"admin"` role. Need to layer granular permissions on top.

**Solution**: Add `admin_tier` column to Better Auth's `user` table. Keep `role = "admin"` for Better Auth compatibility. Build `requireAdminTier()` middleware that checks the tier.

| File | Action | What |
|------|--------|------|
| `supabase/migrations/YYYYMMDD_admin_tier_and_system_tables.sql` | Create | Idempotent migration: add `admin_tier` enum + column to `user`, add `webhook_logs` + `cron_job_history` tables |
| `packages/database/src/schema/enums.ts` | Modify | Add `adminTierEnum` pgEnum |
| `packages/database/src/schema/auth.ts` | Modify | Add `adminTier` column to `user` table |
| `packages/database/src/schema/admin.ts` | Modify | Add `webhookLogs` + `cronJobHistory` tables |
| `packages/database/src/schema/index.ts` | Modify | Export new tables |
| `apps/api/src/lib/auth-middleware.ts` | Modify | Extend `AuthUser` with `adminTier`, add `requireAdminTier(tiers[])` factory function |
| `apps/api/src/lib/admin-audit.ts` | Create | Helper: `logAdminAction(adminUserId, action, targetTenantId, metadata, ipAddress)` |
| `apps/api/src/lib/plan-prices.ts` | Create | `PLAN_PRICES` map (`{ starter: 49 }`), `calculateMRR()` helper |

**Permission matrix encoded in middleware**:
```
super_admin → all actions
support     → view tenants, impersonate, extend trial, view analytics, search, audit
billing_admin → view tenants (limited), override subscription, view analytics, affiliates
```

### 0B: Superadmin Layout Shell (SA-01)

**Design**: Red-accented sidebar (per PRD — distinct from tenant dashboard's brand orange). Uses same shadcn Sidebar pattern (`SidebarProvider` → `Sidebar` → `SidebarContent`).

| File | Action | What |
|------|--------|------|
| `apps/web/src/app/(superadmin)/layout.tsx` | Create | Server layout: check session + `role === "admin"`, redirect non-admins. Render sidebar + shell + navbar |
| `apps/web/src/components/superadmin/superadmin-sidebar.tsx` | Create | Red accent sidebar with nav: Dashboard, Tenants, Analytics, Support, Affiliates, System |
| `apps/web/src/components/superadmin/superadmin-sidebar-provider.tsx` | Create | Sidebar state context (mirror existing `sidebar-provider.tsx`) |
| `apps/web/src/components/superadmin/superadmin-shell.tsx` | Create | Shell wrapper (same pattern as `DashboardShell`) |
| `apps/web/src/components/superadmin/superadmin-navbar.tsx` | Create | Navbar: page title, global search trigger (Cmd+K), admin user dropdown |

**Sidebar Nav Items**:
- Dashboard → `/superadmin/dashboard` (IconLayoutDashboard)
- Tenants → `/superadmin/tenants` (IconBuilding)
- Analytics → `/superadmin/analytics` (IconChartBar)
- Support → `/superadmin/support` (IconHeadset)
- Affiliates → `/superadmin/affiliates` (IconUsers)
- System → `/superadmin/system` (IconServer)

**Design tokens** (admin-specific):
- Sidebar bg: `bg-red-950` (dark) / `bg-red-50` (light)
- Active indicator: `bg-red-600` instead of `bg-brand`
- Accent: `text-red-500` for icons/highlights

### 0C: API Route Registration + Server Actions Base

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/index.ts` | Create | Master admin plugin, registers sub-routes with `requireAdmin` preHandler |
| `apps/api/src/routes/admin/tenants.ts` | Create | Stub file with route signatures |
| `apps/api/src/routes/admin/analytics.ts` | Create | Stub file |
| `apps/api/src/routes/admin/audit.ts` | Create | Stub file |
| `apps/api/src/routes/admin/search.ts` | Create | Stub file |
| `apps/api/src/routes/admin/system.ts` | Create | Stub file |
| `apps/api/src/server.ts` | Modify | Add `await fastify.register(adminRoutes, { prefix: "/admin" })` |
| `apps/web/src/actions/admin.ts` | Create | Server actions base with `getCookieHeader()` pattern |

---

## Phase 1 — Tenant Management (SA-05 → SA-12)

### 1A: Tenant List + Detail Pages

**API Endpoints**:
- `GET /admin/tenants` — search, page, limit, status filter, sortBy (name/mrr/createdAt)
- `GET /admin/tenants/:id` — full profile + computed stats (customerCount, jobCount, invoiceCount)

**MRR Calculation** (no `monthlyPrice` column exists):
```ts
const PLAN_PRICES = { starter: 49, pro: 99, enterprise: 199 };
// Per tenant: PLAN_PRICES[subscription.planName] || 0
// Aggregate: GROUP BY plan_name, sum counts * prices
```

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/tenants.ts` | Implement | GET /admin/tenants + GET /admin/tenants/:id with stats subqueries |
| `apps/web/src/app/(superadmin)/superadmin/tenants/page.tsx` | Create | SSR page, fetches initial data |
| `apps/web/src/app/(superadmin)/superadmin/tenants/tenants-page-client.tsx` | Create | Client component: search, filters, table, pagination |
| `apps/web/src/components/superadmin/tenants/tenant-table.tsx` | Create | Columns: Business Name, Owner, Plan, Status, MRR, Signup Date, Last Active, Actions |
| `apps/web/src/components/superadmin/tenants/tenant-status-badge.tsx` | Create | Badge: active (green), trialing (blue), cancelled (red), deactivated (gray) |
| `apps/web/src/components/superadmin/tenants/tenant-filters.tsx` | Create | Popover filters: status, plan type |
| `apps/web/src/app/(superadmin)/superadmin/tenants/[id]/page.tsx` | Create | SSR detail page |
| `apps/web/src/app/(superadmin)/superadmin/tenants/[id]/tenant-detail-client.tsx` | Create | 3-panel layout: info sidebar, tabs center, subscription card |
| `apps/web/src/components/superadmin/tenants/tenant-detail-header.tsx` | Create | Name, status badge, action buttons dropdown |
| `apps/web/src/components/superadmin/tenants/tenant-info-panel.tsx` | Create | Left panel: contact info, dates, referral source |
| `apps/web/src/components/superadmin/tenants/tenant-stats-panel.tsx` | Create | Stats cards: customers, jobs, invoices, revenue |
| `apps/web/src/components/superadmin/tenants/tenant-subscription-card.tsx` | Create | Plan, status, period, MRR |
| `apps/web/src/components/superadmin/tenants/tenant-activity-tab.tsx` | Create | Platform events feed (SA-21) |
| `apps/web/src/actions/admin.ts` | Extend | `getAdminTenants()`, `getAdminTenant(id)` |

**Page Layout — Tenant List** (follows existing list page pattern):
```
<section className="p-6">
  header: title + tenant count badge
  card: rounded-lg border border-border bg-card overflow-hidden
    filters row: border-b px-4 py-3 (search + status filter + plan filter)
    TenantTable (flush in card)
  Pagination (outside card)
</section>
```

**Page Layout — Tenant Detail** (follows existing detail page pattern):
```
flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface
  TenantDetailHeader
  flex flex-col lg:flex-row gap-4
    TenantInfoPanel (w-80 shrink-0)
    Tabs: Overview | Activity | Audit (flex-1)
    TenantSubscriptionCard (hidden xl:block w-72)
```

### 1B: Tenant Actions (SA-07 → SA-12)

**API Endpoints**:
- `POST /admin/tenants/:id/impersonate` — Body: `{ reason }`. Role: support+
- `POST /admin/tenants/:id/deactivate` — Role: super_admin
- `POST /admin/tenants/:id/activate` — Role: super_admin
- `POST /admin/tenants/:id/extend-trial` — Body: `{ days }`. Role: support+
- `POST /admin/tenants/:id/override-subscription` — Body: `{ status, planName }`. Role: billing_admin+
- `PATCH /admin/tenants/:id` — Body: partial fields. Role: super_admin (SA-11, P1)
- `DELETE /admin/tenants/:id` — Body: `{ confirmBusinessName }`. Role: super_admin (SA-12, P1)

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/tenants.ts` | Extend | All action endpoints, each logs to `adminAuditLog` |
| `apps/api/src/lib/impersonation.ts` | Create | Creates session in `adminImpersonationSessions`, uses Better Auth's `impersonateUser` API or manual session creation with `impersonatedBy` flag |
| `apps/web/src/components/superadmin/tenants/impersonate-dialog.tsx` | Create | Modal: reason textarea (required), confirm button |
| `apps/web/src/components/superadmin/tenants/deactivate-dialog.tsx` | Create | Confirm dialog |
| `apps/web/src/components/superadmin/tenants/extend-trial-dialog.tsx` | Create | Days input (7/14/30 presets + custom) |
| `apps/web/src/components/superadmin/tenants/override-subscription-dialog.tsx` | Create | Status + plan dropdowns |
| `apps/web/src/components/superadmin/tenants/edit-tenant-dialog.tsx` | Create | Full tenant edit form (P1) |
| `apps/web/src/components/superadmin/tenants/delete-tenant-dialog.tsx` | Create | 2-step: type business name to confirm (P1) |
| `apps/web/src/components/superadmin/impersonation-banner.tsx` | Create | Red banner: "Viewing as [Business Name] — [Admin Name]" + Exit button |
| `apps/web/src/app/(dashboard)/layout.tsx` | Modify | Detect `impersonatedBy` in session → render impersonation banner |
| `apps/web/src/actions/admin.ts` | Extend | All action functions |

**Impersonation Flow**:
1. Admin clicks Impersonate → dialog with reason field
2. `POST /admin/tenants/:id/impersonate` creates `adminImpersonationSessions` row + `adminAuditLog` entry
3. API uses Better Auth admin plugin's `impersonateUser` (session table has `impersonatedBy` column)
4. Frontend opens `/dashboard` — layout detects impersonation → shows red banner
5. "Exit Impersonation" → `POST /admin/impersonation/end` → clear session → redirect back to `/superadmin/tenants/:id`
6. All request during impersonation logged via `actions_taken` JSONB append

---

## Phase 2 — Analytics & Dashboard (SA-13 → SA-19)

### 2A: Admin Dashboard + MRR + Signups (SA-13, SA-14)

**API Endpoints**:
- `GET /admin/analytics/mrr` — current MRR, MRR 30d ago, delta, trend (12 months), plan breakdown
- `GET /admin/analytics/signups` — daily signups for last 90 days

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/analytics.ts` | Implement | MRR + signups endpoints |
| `apps/web/src/app/(superadmin)/superadmin/dashboard/page.tsx` | Replace | Real dashboard (replace stub) |
| `apps/web/src/app/(superadmin)/superadmin/dashboard/dashboard-page-client.tsx` | Create | Client component with charts |
| `apps/web/src/components/superadmin/analytics/admin-kpi-card.tsx` | Create | Large metric (48px), trend arrow, sparkline |
| `apps/web/src/components/superadmin/analytics/admin-kpi-grid.tsx` | Create | 4-card grid: Total Tenants, MRR, Active Users (DAT), Churn Rate |
| `apps/web/src/components/superadmin/analytics/mrr-chart.tsx` | Create | Recharts AreaChart — MRR over 12 months |
| `apps/web/src/components/superadmin/analytics/signup-chart.tsx` | Create | Recharts BarChart — signups last 90 days |
| `apps/web/src/actions/admin.ts` | Extend | `getAdminDashboard()`, `getAdminMRR()`, `getAdminSignups()` |

**Dashboard Layout**:
```
AdminKpiGrid (4 cards row)
grid grid-cols-1 lg:grid-cols-2 gap-4
  MrrChart (area)
  SignupChart (bar)
grid grid-cols-1 lg:grid-cols-2 gap-4
  TrialFunnel (from 2B)
  ChurnTable (top 5, link to full)
```

### 2B: Trial Funnel + Churn + Active Tracking (SA-15, SA-16, SA-17)

**API Endpoints**:
- `GET /admin/analytics/trial-conversion` — funnel: total trials → activated → converted → churned
- `GET /admin/analytics/churn` — churned tenants list (30/60/90d windows)
- `GET /admin/analytics/active-users` — DAT/WAT/MAT counts from `platformEvents`

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/analytics.ts` | Extend | 3 more endpoints |
| `apps/web/src/app/(superadmin)/superadmin/analytics/page.tsx` | Create | Analytics hub page |
| `apps/web/src/app/(superadmin)/superadmin/analytics/analytics-page-client.tsx` | Create | Full analytics view |
| `apps/web/src/components/superadmin/analytics/trial-funnel.tsx` | Create | Horizontal bar funnel (Recharts) |
| `apps/web/src/components/superadmin/analytics/churn-table.tsx` | Create | Table: tenant, plan, MRR lost, days active, churn date |
| `apps/web/src/components/superadmin/analytics/active-users-chart.tsx` | Create | Line chart: DAT/WAT/MAT over time |
| `apps/web/src/app/(superadmin)/superadmin/analytics/active-users/page.tsx` | Create | Dedicated active users page |
| `apps/web/src/actions/admin.ts` | Extend | `getTrialConversion()`, `getChurnList()`, `getActiveUsers()` |

### 2C: Platform Event Emission (Infrastructure — Required for 2B)

Without this, DAT/WAT/MAT and activity features have **zero data**.

| File | Action | What |
|------|--------|------|
| `apps/api/src/lib/platform-events.ts` | Create | `emitPlatformEvent(tenantId, eventType, userId, metadata)` — inserts into `platformEvents` table |
| `apps/api/src/routes/customers/index.ts` | Modify | Emit `customer_created` on POST |
| `apps/api/src/routes/jobs/index.ts` | Modify | Emit `job_created` on POST |
| `apps/api/src/routes/invoices/index.ts` | Modify | Emit `invoice_sent` on send |
| `apps/api/src/routes/bookings/index.ts` | Modify | Emit `booking_received` on POST |
| `apps/api/src/lib/auth.ts` or login handler | Modify | Emit `login` on successful auth |

### 2D: P1 Analytics (SA-18, SA-19)

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/analytics.ts` | Extend | Inactive alerts + feature adoption endpoints |
| `apps/web/src/components/superadmin/analytics/inactive-alerts.tsx` | Create | Table: tenants with no events in 14d |
| `apps/web/src/components/superadmin/analytics/feature-adoption-chart.tsx` | Create | Horizontal bar chart: % tenants using each feature |

---

## Phase 3 — Support, Search & Audit (SA-20 → SA-22)

### 3A: Global Search (SA-20)

**API Endpoint**: `GET /admin/search?q=term` — searches tenants (name, email, slug), returns categorized results

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/search.ts` | Implement | Cross-tenant `ilike` search on businessName, ownerName, email |
| `apps/web/src/components/superadmin/global-search.tsx` | Create | shadcn `Command` palette (Cmd+K), categorized results (Tenants) |
| `apps/web/src/components/superadmin/global-search-trigger.tsx` | Create | Navbar search button |
| `apps/web/src/actions/admin.ts` | Extend | `adminSearch(query)` |

### 3B: Audit & Impersonation Logs (SA-21, SA-22)

**API Endpoints**:
- `GET /admin/audit-log` — paginated, filterable by action type, admin, date range
- `GET /admin/impersonation-log` — paginated impersonation sessions
- `GET /admin/tenants/:id/activity` — tenant's platform events

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/audit.ts` | Implement | All 3 endpoints |
| `apps/web/src/app/(superadmin)/superadmin/support/page.tsx` | Create | Support hub: tabs for Audit Log, Impersonation Log |
| `apps/web/src/app/(superadmin)/superadmin/support/support-page-client.tsx` | Create | Tabbed interface |
| `apps/web/src/components/superadmin/support/audit-log-table.tsx` | Create | Table: timestamp, admin, action, target, details |
| `apps/web/src/components/superadmin/support/audit-log-filters.tsx` | Create | Date range, action type, admin filter |
| `apps/web/src/components/superadmin/support/impersonation-log-table.tsx` | Create | Table: admin, tenant, reason, duration, actions |
| `apps/web/src/actions/admin.ts` | Extend | `getAuditLog()`, `getImpersonationLog()`, `getTenantActivity()` |

### 3C: Session Security (SA-04)

| File | Action | What |
|------|--------|------|
| `apps/api/src/lib/admin-reauth.ts` | Create | Middleware: check session freshness (<15min) for destructive actions, return `{ requireReauth: true }` if stale |
| `apps/web/src/components/superadmin/reauth-dialog.tsx` | Create | Modal: re-enter password before delete/deactivate |

---

## Phase 4 — System Health & P1 Features (SA-23 → SA-26)

### 4A: System Health Page (SA-25, SA-26)

| File | Action | What |
|------|--------|------|
| `apps/api/src/routes/admin/system.ts` | Implement | GET /admin/system (uptime, memory, DB status), GET /admin/system/webhooks, GET /admin/system/crons |
| `apps/web/src/app/(superadmin)/superadmin/system/page.tsx` | Create | System health page |
| `apps/web/src/app/(superadmin)/superadmin/system/system-page-client.tsx` | Create | Client component |
| `apps/web/src/components/superadmin/system/system-status-card.tsx` | Create | Health indicators (DB, API, memory) |
| `apps/web/src/components/superadmin/system/webhook-log-table.tsx` | Create | Last 100 webhooks: provider, event, status, timestamp |
| `apps/web/src/components/superadmin/system/cron-history-table.tsx` | Create | Cron jobs: name, last run, status, duration |

### 4B: Email Features (SA-23, SA-24) — Deferred

Depends on email infrastructure (Resend) which isn't built yet. Skip until Email Templates (#12) is complete.

### 4C: Affiliates Page

| File | Action | What |
|------|--------|------|
| `apps/web/src/app/(superadmin)/superadmin/affiliates/page.tsx` | Create | Affiliate overview |
| `apps/web/src/components/superadmin/affiliates/affiliate-table.tsx` | Create | Top affiliates, referred tenants, MRR |

---

## Dependency Graph

```
Phase 0A (schema + auth) ─────────┬────────────────────────────┐
                                   │                            │
Phase 0B (layout shell) ──────────┤     Phase 0C (API stubs) ──┤
         │                         │              │              │
Phase 1A (tenant list+detail) ─────┘              │              │
         │                                         │              │
Phase 1B (tenant actions) ─────────────────────────┘              │
         │                                                        │
Phase 2C (event emission) ──── independent ───────────────────────┘
         │
Phase 2A (dashboard + MRR) ────── Phase 2B (funnel + churn + DAT)
         │                                    │
Phase 3A (global search) ──── independent     │
                                              │
Phase 3B (audit logs) ──── needs 1B           │
Phase 3C (reauth) ──── needs 1B              │
                                              │
Phase 2D (P1 analytics) ──── needs 2B        │
Phase 4A (system health) ──── needs 0C only   │
Phase 4C (affiliates) ──── needs 0B only
```

---

## UI/UX Design Specifications

### Design System (from UI/UX Pro Max analysis)

| Aspect | Specification |
|--------|---------------|
| Style | Data-Dense Dashboard + Executive Dashboard hybrid |
| Typography | Space Grotesk (headings, `font-heading`), DM Sans (body, `font-body`) — already configured |
| Icons | Tabler Icons (`@tabler/icons-react`) only — never lucide-react |
| Charts | Recharts — AreaChart (MRR), BarChart (signups), custom funnel, LineChart (DAT/WAT/MAT) |
| KPI Cards | Large metrics (font-heading text-3xl/4xl), trend arrow (green up / red down), sparkline optional |
| Tables | shadcn `Table` component, hover row highlighting, sortable headers, skeleton loaders |
| Sidebar | Red accent via CSS variables (see globals.css changes below) |
| Dark mode | Full support via existing CSS variables + dark: variants |
| Status colors | Active=green, Trialing=blue, Cancelled=red, Deactivated=gray (with dark: variants) |

### shadcn Components — Usage Map Per Feature

All UI primitives come from `apps/web/src/components/ui/`. These already exist:

| shadcn Component | Where Used in Super Admin |
|-----------------|--------------------------|
| `Card` / `CardHeader` / `CardContent` | KPI cards, tenant info panels, subscription card, system status |
| `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` | Tenant list, churn table, audit log, webhook log, cron history, affiliates |
| `Badge` | Tenant status (active/trialing/cancelled/deactivated), plan badges, event type badges |
| `Button` | All actions, CTA: `className="bg-admin-accent text-white hover:bg-admin-accent/90"` for admin-specific CTAs |
| `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogFooter` | Impersonate dialog, deactivate confirm, extend trial, override subscription, edit tenant, delete tenant, re-auth |
| `DropdownMenu` / `DropdownMenuContent` / `DropdownMenuItem` | Tenant row actions (impersonate, deactivate, extend trial, etc.) |
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | Tenant detail (Overview/Activity/Audit), Support page (Audit Log/Impersonation Log), Analytics page sections |
| `Input` | Search bars, form fields (extend trial days, edit tenant fields, delete confirm input) |
| `Label` | All form fields in dialogs |
| `Textarea` | Impersonation reason field |
| `Popover` / `PopoverTrigger` / `PopoverContent` | Tenant list filters (status, plan), audit log filters (action type, date range) |
| `Command` / `CommandInput` / `CommandList` / `CommandGroup` / `CommandItem` | Global search (Cmd+K palette) |
| `Skeleton` | All loading states — table skeletons, KPI card skeletons, chart skeletons |
| `Tooltip` | Icon buttons, truncated text, chart data points |
| `Separator` | Section dividers in sidebar, detail panels |
| `ScrollArea` | Long audit logs, activity feeds, command palette results |
| `Sheet` | Mobile sidebar (responsive) |
| `Progress` | Trial days remaining bar, feature adoption percentages |
| `Avatar` | Admin user in navbar, tenant owner in detail view |
| `Switch` | Toggle tenant active/inactive (optional inline toggle) |
| `DateRangePicker` / `Calendar` | Audit log date range filter, analytics date range selector |

### shadcn Components to Install (NOT yet in project)

Check if these are needed and install via `npx shadcn@latest add <component>`:
- `sidebar` — shadcn sidebar component (recommended by UI/UX Pro Max for `SidebarProvider` pattern). **However**, the existing dashboard already has a custom sidebar. Mirror that custom pattern for consistency rather than adding shadcn's sidebar component.

### KPI Card Component Spec
```
┌─────────────────────────┐
│ ● Total Tenants         │  ← dot + label (text-muted-foreground text-sm font-body)
│ 247                     │  ← value (font-heading text-3xl font-bold text-foreground)
│ ↑ 12% vs last month    │  ← trend (text-green-600 dark:text-green-400 text-sm)
└─────────────────────────┘
Built with: <Card>, inner layout with flex/grid, Tabler icon for trend arrow
```

### globals.css Changes (REQUIRED)

**File**: `apps/web/src/app/globals.css`

Add admin-specific CSS variables inside BOTH `:root` and `.dark` blocks:

```css
/* In :root (light mode) — add after existing brand tokens */
/* Admin accent (red theme for super admin sidebar) */
--admin-accent: 0 72% 51%;           /* red-600 */
--admin-accent-foreground: 0 0% 100%; /* white text on red */
--admin-accent-light: 0 86% 97%;     /* red-50 — hover/subtle bg */
--admin-sidebar-bg: 0 63% 15%;       /* red-950 — sidebar background */
--admin-sidebar-foreground: 0 86% 97%; /* red-50 — sidebar text */
--admin-ring: 0 72% 51%;             /* red-600 — focus ring */

/* In .dark — add after existing dark brand overrides */
--admin-accent: 0 72% 55%;           /* slightly lighter red for dark mode */
--admin-accent-foreground: 0 0% 100%;
--admin-accent-light: 0 50% 15%;     /* dark red subtle bg */
--admin-sidebar-bg: 0 60% 8%;        /* very dark red */
--admin-sidebar-foreground: 0 60% 90%;
--admin-ring: 0 72% 55%;
```

**Also add to `tailwind.config.ts`** (extend colors):
```ts
admin: {
  accent: "hsl(var(--admin-accent))",
  "accent-foreground": "hsl(var(--admin-accent-foreground))",
  "accent-light": "hsl(var(--admin-accent-light))",
  "sidebar-bg": "hsl(var(--admin-sidebar-bg))",
  "sidebar-foreground": "hsl(var(--admin-sidebar-foreground))",
  ring: "hsl(var(--admin-ring))",
},
```

This allows using `bg-admin-accent`, `text-admin-sidebar-foreground`, `bg-admin-sidebar-bg` etc. throughout admin components — fully themeable, dark mode compatible, no hardcoded colors.

### Recharts Chart Theme (use CSS variables)

The existing `apps/web/src/components/ui/chart.tsx` (shadcn chart wrapper) uses `--chart-1` through `--chart-5` CSS variables. Admin charts should use these same variables for consistency:
- MRR Area Chart: `fill: var(--chart-1)` (brand orange) with 20% opacity fill
- Signup Bar Chart: `fill: var(--chart-2)` (teal)
- Active Users Line: `stroke: var(--chart-3)` (dark blue)
- Churn indicators: `fill: var(--destructive)` (red)
- Funnel stages: gradient from `--chart-5` (green/high) to `--destructive` (red/low)

### Status Badge Colors (with dark mode)

```tsx
const STATUS_COLORS = {
  active:      "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  trialing:    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  cancelled:   "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  deactivated: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
  past_due:    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};
```

---

## Files Summary

### Total New Files: ~60
- **Phase 0**: ~15 files (foundation)
- **Phase 1**: ~18 files (tenant management)
- **Phase 2**: ~16 files (analytics)
- **Phase 3**: ~10 files (support/search/audit)
- **Phase 4**: ~8 files (system health)

### Key Files to Modify
- `apps/web/src/app/globals.css` — **ADD admin CSS variables** (--admin-accent, --admin-sidebar-bg, etc.) in both `:root` and `.dark`
- `apps/web/tailwind.config.ts` — **EXTEND colors** with `admin` namespace mapping to new CSS variables
- `packages/database/src/schema/enums.ts` — add `adminTierEnum`
- `packages/database/src/schema/auth.ts` — add `adminTier` column
- `packages/database/src/schema/admin.ts` — add webhook/cron tables
- `apps/api/src/lib/auth-middleware.ts` — extend for 3-tier roles
- `apps/api/src/server.ts` — register admin routes
- `apps/web/src/app/(dashboard)/layout.tsx` — impersonation banner detection
- `apps/web/src/middleware.ts` — verify `/superadmin/*` admin role check
- `apps/api/src/routes/customers/index.ts` — emit platform events
- `apps/api/src/routes/jobs/index.ts` — emit platform events
- `apps/api/src/routes/invoices/index.ts` — emit platform events
- `apps/api/src/routes/bookings/index.ts` — emit platform events
- `docs/project_docs/REPO_MAP.md` — update with all new files
- `docs/API_DOCUMENTATION.md` — document all 23+ admin endpoints
- `docs/todo.md` — track progress

---

## Verification Plan

### Per-Phase Verification
1. **Phase 0**: `pnpm db:generate` succeeds, `pnpm -F api typecheck` passes, admin seed with `--tier super_admin` works, layout renders at `/superadmin/dashboard`
2. **Phase 1**: Tenant list loads with real DB data, tenant detail shows stats, impersonation flow works end-to-end (reason → banner → exit), all actions log to audit table
3. **Phase 2**: Dashboard KPIs populate from real data, charts render with recharts, platform events emit on tenant actions
4. **Phase 3**: Cmd+K search finds tenants, audit log shows all admin actions, re-auth dialog triggers on destructive actions
5. **Phase 4**: System health endpoint returns DB/memory status, webhook log shows entries

### Quality Checks
- `pnpm typecheck` — all packages pass
- `pnpm lint` — no errors
- `pnpm build` — web + api build successfully
- Manual test: login as admin → full flow through all pages
- Verify dark mode on every page
- Verify role permissions: support user cannot delete tenant, billing_admin cannot impersonate

---

## Build Order (Recommended Sequence)

| # | Sprint | Features | Depends On |
|---|--------|----------|------------|
| 1 | 0A | Schema + auth middleware | — |
| 2 | 0B | Layout shell (sidebar, navbar) | 0A |
| 3 | 0C | API route stubs + registration | 0A |
| 4 | 1A | Tenant list + detail pages | 0B, 0C |
| 5 | 1B | Tenant actions + impersonation | 1A |
| 6 | 2C | Platform event emission | 0A |
| 7 | 2A | Dashboard + MRR + signup chart | 0B, 0C |
| 8 | 2B | Trial funnel + churn + DAT | 2A, 2C |
| 9 | 3A | Global search | 0B, 0C |
| 10 | 3B | Audit + impersonation logs | 1B |
| 11 | 3C | Session security + reauth | 1B |
| 12 | 2D | Inactive alerts + feature adoption (P1) | 2B |
| 13 | 4A | System health (P1) | 0C |
| 14 | 4C | Affiliates page | 0B |
