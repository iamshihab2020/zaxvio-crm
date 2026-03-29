# Super Admin Panel — Complete Analysis Report

> **Generated:** 2026-03-28 | **Branch:** `feature/zax-34` | **Build Order:** #11

---

## Current State: ~5% Built (Scaffold Only)

### What EXISTS Today

| Component | Status |
|-----------|--------|
| Route folder structure (`(superadmin)/`) | Scaffold (`.gitkeep` files) |
| Single placeholder page (`/superadmin/dashboard`) | Centered `<h1>` only |
| `requireAdmin` middleware | Working |
| Admin DB schema (3 tables) | Migrated |
| Admin seed script (`seed:admin`) | Working |
| Better Auth admin plugin | Configured |
| Login → admin redirect | Working |

### What's MISSING

| Component | Status |
|-----------|--------|
| Superadmin layout/sidebar/navbar | Not built |
| All 7+ page implementations | Not built |
| All superadmin components | Empty dir |
| All admin server actions | Not built |
| All admin API endpoints (27+) | Not built |
| Admin services (business logic) | Not built |
| Route registration in Fastify server | Not done |
| Frontend role-based middleware | Not done |

---

## All 26 Features (SA-01 → SA-26)

### Core Access & Auth (SA-01 → SA-04)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SA-01 | Unified admin routes (`/superadmin/*`) | P0 | Scaffold only |
| SA-02 | Admin login (unified `/login` page) | P0 | Redirect works, no role guard |
| SA-03 | 3-tier roles (super_admin, support, billing_admin) | P0 | Not built (currently only "admin" role) |
| SA-04 | Session security (4h JWT expiry, re-auth for destructive ops) | P0 | Not built |

### Tenant Management (SA-05 → SA-12)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SA-05 | Tenant list (search, sort, filter, MRR) | P0 | Not built |
| SA-06 | Tenant detail view (profile, stats, subscription) | P0 | Not built |
| SA-07 | Impersonation (JWT + reason + audit + red banner) | P0 | Not built |
| SA-08 | Activate/Deactivate tenant | P0 | Not built |
| SA-09 | Extend trial | P0 | Not built |
| SA-10 | Subscription override | P0 | Not built |
| SA-11 | Edit tenant details | P1 | Not built |
| SA-12 | Delete tenant (2-step confirm, cascade) | P1 | Not built |

### Platform Analytics (SA-13 → SA-19)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SA-13 | MRR dashboard (current, 30d ago, delta) | P0 | Not built |
| SA-14 | Signup chart (bar chart, 90-day, recharts) | P0 | Not built |
| SA-15 | Trial conversion funnel | P0 | Not built |
| SA-16 | Churn list (30/60/90 days, MRR lost) | P0 | Not built |
| SA-17 | Active tenant tracking (DAT/WAT/MAT) | P0 | Not built |
| SA-18 | Inactive alert list (no events in 14d) | P1 | Not built |
| SA-19 | Feature adoption (% using booking, invoice, etc.) | P1 | Not built |

### Support Tools (SA-20 → SA-24)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SA-20 | Global search (tenant, email, job#, invoice#) | P0 | Not built |
| SA-21 | Tenant activity log (platform_events) | P0 | Not built |
| SA-22 | Impersonation audit log | P0 | Not built |
| SA-23 | Email delivery log (Resend webhooks) | P1 | Not built |
| SA-24 | Manual email trigger | P1 | Not built |

### System Health (SA-25 → SA-26)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| SA-25 | Webhook log (Lemon Squeezy, last 100) | P0 | Not built |
| SA-26 | Cron job history (last run, errors) | P0 | Not built |

---

## Role Permission Matrix

| Action | super_admin | support | billing_admin |
|--------|:-----------:|:-------:|:-------------:|
| View tenant list/detail | Yes | Yes | Limited |
| Impersonate tenant | Yes | Yes | No |
| Activate/Deactivate | Yes | No | No |
| Extend trial | Yes | Yes | No |
| Override subscription | Yes | No | Yes |
| Edit tenant details | Yes | No | No |
| Delete tenant | Yes | No | No |
| View all analytics | Yes | Yes | Yes |
| Global search | Yes | Yes | No |
| View audit log | Yes | No | No |
| System health | Yes | No | No |

---

## Pages to Build (8 routes)

1. **`/superadmin/dashboard`** — KPI overview: MRR card, signups chart, active tenants, churn summary
2. **`/superadmin/tenants`** — Searchable tenant table with filters + status badges
3. **`/superadmin/tenants/[id]`** — Tenant detail: profile, stats, impersonate button, actions
4. **`/superadmin/analytics`** — Full analytics: MRR trends, signups, churn, conversion funnel
5. **`/superadmin/analytics/active-users`** — DAT/WAT/MAT metrics, inactive alert list
6. **`/superadmin/support`** — Global search, audit log, activity log viewer
7. **`/superadmin/system`** — Webhook log, cron history
8. **`/superadmin/affiliates`** — Attribution table, top affiliates, referred MRR

---

## API Endpoints to Build (27+)

### Auth & Tenant Management

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| `GET` | `/admin/tenants` | List all tenants (paginated, searchable) | support+ |
| `GET` | `/admin/tenants/:id` | Tenant detail with stats | support+ |
| `PATCH` | `/admin/tenants/:id` | Edit tenant details | super_admin |
| `DELETE` | `/admin/tenants/:id` | Hard delete tenant | super_admin |
| `POST` | `/admin/tenants/:id/impersonate` | Start impersonation session | support+ |
| `POST` | `/admin/tenants/:id/deactivate` | Deactivate tenant | super_admin |
| `POST` | `/admin/tenants/:id/activate` | Activate tenant | super_admin |
| `POST` | `/admin/tenants/:id/extend-trial` | Extend trial period | support+ |
| `POST` | `/admin/tenants/:id/override-subscription` | Override subscription status | billing_admin+ |

### Analytics

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| `GET` | `/admin/analytics/mrr` | MRR metrics | billing_admin+ |
| `GET` | `/admin/analytics/signups` | Signup data (chart-ready) | support+ |
| `GET` | `/admin/analytics/active-users` | DAT/WAT/MAT | support+ |
| `GET` | `/admin/analytics/churn` | Churn list | billing_admin+ |
| `GET` | `/admin/analytics/trial-conversion` | Funnel data | support+ |
| `GET` | `/admin/analytics/feature-adoption` | Feature usage % | support+ |

### Support

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| `GET` | `/admin/search` | Global cross-tenant search | support+ |
| `GET` | `/admin/tenants/:id/activity` | Tenant platform events | support+ |
| `GET` | `/admin/audit-log` | Admin actions audit log | super_admin |
| `GET` | `/admin/impersonation-log` | Impersonation sessions | super_admin |

### System

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| `GET` | `/admin/system/webhooks` | Webhook log | super_admin |
| `GET` | `/admin/system/crons` | Cron job history | super_admin |
| `GET` | `/admin/system` | System health (uptime, memory, DB) | super_admin |

### Affiliates

| Method | Endpoint | Purpose | Role |
|--------|----------|---------|------|
| `GET` | `/admin/affiliates` | Affiliate list with stats | billing_admin+ |

---

## DB Infrastructure Already in Place

| Table | Status | Purpose |
|-------|--------|---------|
| `adminAuditLog` | Migrated | Tracks all admin actions |
| `adminImpersonationSessions` | Migrated | Tracks impersonation sessions |
| `platformEvents` | Migrated | DAT/WAT/MAT activity tracking |
| `user.role` | Working | `"admin"` flag via Better Auth |
| `tenants` | Working | Core tenant data |
| `tenantSubscriptions` | Working | Subscription/MRR data |

### Missing DB Work

The PRD calls for 3-tier roles (`super_admin`, `support`, `billing_admin`) but the current implementation only has a single `"admin"` role. This will need either:
- A role enum column on the user table
- A separate admin roles table
- Or leveraging Better Auth's permission system

---

## Estimated Build Scope

| Layer | Items | Complexity |
|-------|-------|------------|
| Superadmin layout + sidebar | 1 layout, 1 sidebar component | Medium |
| API routes | ~23 endpoints | Large |
| Server actions | ~15 action files | Medium |
| Frontend pages | 8 pages | Large |
| Frontend components | ~20+ components | Large |
| Charts (recharts) | 4-5 chart components | Medium |
| Role permission system | Middleware + guards | Medium |
| Impersonation system | JWT + banner + audit | High complexity |

---

## P0 vs P1 Summary

### P0 (Must Have — 18 features)

- SA-01 to SA-10: Core access, auth, tenant management
- SA-13 to SA-17: Platform analytics (MRR, signups, churn, active users)
- SA-20 to SA-22: Support tools (search, activity log, audit log)
- SA-25 to SA-26: System health (webhooks, crons)

### P1 (Lower Priority — 8 features)

- SA-11 to SA-12: Edit/delete tenant
- SA-18 to SA-19: Inactive alerts, feature adoption
- SA-23 to SA-24: Email delivery log, manual email trigger
- Affiliates page (AF-06)

---

## Key Architecture Decisions

1. **Same app deployment** — `/superadmin/*` lives in the same Next.js app (route group isolation), no separate admin app
2. **Same Fastify backend** — `/admin/*` routes alongside tenant routes
3. **Unified login** — Same `/login` page detects admin role and redirects
4. **Red sidebar** — Distinct visual indicator for admin context (per PRD)
5. **Impersonation** — Short-lived JWT with mandatory reason field, red banner in tenant app, full action audit
6. **Platform events** — `platformEvents` table powers DAT/WAT/MAT metrics (events must be emitted from tenant actions)
7. **Charts** — Recharts library for bar/area/funnel charts

---

> **This is the largest remaining feature in the build order.** P0 features alone cover 18 of the 26 items. The impersonation system (SA-07) is the highest-complexity single feature.
