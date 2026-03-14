# HVAC SaaS Platform — System Diagrams & Unified Auth Architecture

| Field | Details |
|---|---|
| Document Type | System Architecture Diagrams + Unified Auth Redesign |
| Version | 1.0 |
| Date | March 2026 |
| Relates To | HVAC_SaaS_Phase1_PRD_v2.md |

---

## Table of Contents

1. [Unified Auth — Superadmin in Same Domain](#1-unified-auth--superadmin-in-same-domain)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Monorepo Structure Diagram](#3-monorepo-structure-diagram)
4. [Database ERD](#4-database-erd)
5. [Authentication Flow Diagrams](#5-authentication-flow-diagrams)
6. [User Flow Diagrams](#6-user-flow-diagrams)
7. [API Route Architecture](#7-api-route-architecture)
8. [Multi-Tenancy & RLS Model](#8-multi-tenancy--rls-model)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Cron & Background Jobs](#11-cron--background-jobs)
12. [Component Architecture (Frontend)](#12-component-architecture-frontend)
13. [Email System Flow](#13-email-system-flow)
14. [Billing & Subscription Flow](#14-billing--subscription-flow)
15. [Affiliate Program Flow](#15-affiliate-program-flow)
16. [Impersonation Flow](#16-impersonation-flow)
17. [Security Architecture](#17-security-architecture)
18. [Feature Module Dependency Map](#18-feature-module-dependency-map)

---

## 1. Unified Auth — Superadmin in Same Domain

### 1.1 Change Summary

**BEFORE (PRD v2):** Superadmin was a separate Next.js app (`apps/admin`) deployed at a different URL with its own auth system.

**AFTER (This Document):** Superadmin is integrated into the same `apps/web` app. Login is unified — entering superadmin credentials on the regular login page authenticates as superadmin and redirects to `/superadmin/*` routes.

### 1.2 What Changes

| Aspect | Before (Separate App) | After (Unified) |
|---|---|---|
| Apps | `apps/web` + `apps/admin` | `apps/web` only |
| Login URL | `/admin/login` (separate) | `/login` (same login page) |
| Auth System | Completely separate Supabase Auth + admin_users | Single login form, dual-path auth |
| Deployment | 2 Vercel deployments | 1 Vercel deployment |
| Domain | `admin.yourapp.com` | `yourapp.com/superadmin/*` |
| Session | Separate cookies | Same cookie store, role-aware |
| Cost | 2x Vercel hobby slots | 1x Vercel hobby slot |

### 1.3 Updated Monorepo Structure (No `apps/admin`)

```
hvac-saas/
├── apps/
│   ├── web/                        # Next.js 14 — ALL UI (tenant + superadmin)
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, signup, forgot-password
│   │   │   ├── (dashboard)/        # Tenant owner dashboard (RLS-protected)
│   │   │   │   ├── jobs/
│   │   │   │   ├── customers/
│   │   │   │   ├── invoices/
│   │   │   │   ├── bookings/
│   │   │   │   ├── quotes/
│   │   │   │   ├── schedule/
│   │   │   │   └── settings/
│   │   │   ├── (superadmin)/       # Super Admin pages (admin auth required)
│   │   │   │   ├── layout.tsx      # Admin layout with sidebar + red "ADMIN" indicator
│   │   │   │   ├── dashboard/      # MRR, signups, active users overview
│   │   │   │   ├── tenants/        # Tenant list + detail + impersonation
│   │   │   │   ├── analytics/      # Full analytics dashboards
│   │   │   │   ├── support/        # Global search, audit log, email log
│   │   │   │   ├── affiliates/     # Affiliate performance
│   │   │   │   └── system/         # Webhook log, cron history
│   │   │   ├── book/[slug]/        # Public booking portal (no auth)
│   │   │   ├── ref/[code]/         # Affiliate redirect
│   │   │   └── api/                # Next.js API routes
│   │   ├── components/
│   │   ├── middleware.ts           # Route protection (tenant vs admin)
│   │   └── package.json
│   └── api/                        # Fastify server (unchanged)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── jobs/
│       │   │   ├── invoices/
│       │   │   ├── bookings/
│       │   │   ├── customers/
│       │   │   ├── quotes/
│       │   │   ├── admin/          # Super admin API routes (unchanged)
│       │   │   └── webhooks/
│       │   └── server.ts
│       └── package.json
├── packages/
│   ├── database/
│   ├── types/
│   ├── ui/
│   ├── email/
│   └── config/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 1.4 Unified Login Logic

The login page (`/login`) handles both tenant users and superadmins with a **single form**:

```
User enters email + password on /login
         │
         ▼
  ┌──────────────────────┐
  │ Check admin_users    │ ← Fastify POST /admin/auth/login
  │ table first          │
  └────────┬─────────────┘
           │
     ┌─────┴─────┐
     │ Found in   │
     │admin_users?│
     └─────┬──┬──┘
       YES │  │ NO
           │  │
           ▼  ▼
  ┌────────┐  ┌────────────────┐
  │Verify  │  │ Proceed with   │
  │bcrypt  │  │ Supabase Auth  │
  │password│  │ (normal tenant │
  └───┬────┘  │  login flow)   │
      │       └───────┬────────┘
      ▼               ▼
 Issue admin      Issue tenant
 JWT + redirect   JWT + redirect
 to /superadmin   to /dashboard
```

**Implementation approach:**

1. Login form submits email + password
2. Client calls `POST /api/auth/login` (Next.js API route)
3. Next.js route first tries `POST {FASTIFY_URL}/admin/auth/login` with the credentials
4. If admin auth succeeds → store admin JWT in httpOnly cookie `admin_token`, redirect to `/superadmin/dashboard`
5. If admin auth returns 401 → fall through to normal Supabase Auth `signInWithPassword()`
6. If Supabase auth succeeds → normal tenant flow, redirect to `/dashboard`
7. If both fail → show "Invalid credentials" error

### 1.5 Middleware Route Protection

```typescript
// middleware.ts — updated
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Superadmin routes: require admin_token cookie
  if (pathname.startsWith('/superadmin')) {
    const adminToken = request.cookies.get('admin_token');
    if (!adminToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Verify admin JWT (check expiry, role)
    // If invalid/expired → redirect to /login
  }

  // Dashboard routes: require Supabase session
  if (pathname.startsWith('/dashboard')) {
    const supabaseSession = request.cookies.get('sb-access-token');
    if (!supabaseSession) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}
```

### 1.6 Updated Route Table

**Removed routes** (no longer exist):
- ~~`/admin/login`~~
- ~~`/admin/*`~~ (all admin routes)

**New routes** (under same app):

| Route | Page | Auth Required |
|---|---|---|
| `/login` | Unified login (tenant + admin) | Public |
| `/superadmin` | Admin dashboard | Admin JWT |
| `/superadmin/tenants` | Tenant list | Admin JWT |
| `/superadmin/tenants/[id]` | Tenant detail + impersonate | Admin JWT |
| `/superadmin/analytics` | Full analytics | Admin JWT |
| `/superadmin/support` | Support tools | Admin JWT |
| `/superadmin/affiliates` | Affiliate overview | Admin JWT |
| `/superadmin/system` | System health | Admin JWT |

### 1.7 Security Considerations

| Concern | Mitigation |
|---|---|
| Admin routes accessible by URL guessing | Middleware blocks all `/superadmin/*` without valid admin JWT |
| Tenant user tries `/superadmin` | Middleware rejects — tenant Supabase token ≠ admin JWT |
| Admin JWT leaks | 4h expiry; re-auth for destructive ops; httpOnly cookie |
| `/superadmin` visible in sitemap/crawlers | Add to `robots.txt` disallow; `noindex` meta tag |
| Shared cookie domain | Admin and tenant cookies use different names (`admin_token` vs `sb-*`) |

---

## 2. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser (User)"]
        Mobile["Mobile Browser"]
        BookingPortal["Public Booking Portal"]
    end

    subgraph "Frontend — Vercel"
        NextJS["Next.js 14<br/>(App Router)<br/>Port 3000"]
        subgraph "Route Groups"
            Auth["(auth)<br/>Login/Signup"]
            Dashboard["(dashboard)<br/>Tenant UI"]
            SuperAdmin["(superadmin)<br/>Admin Panel"]
            Public["book/[slug]<br/>Booking Portal"]
        end
    end

    subgraph "Backend — Render"
        Fastify["Fastify API<br/>Port 4000"]
        subgraph "API Modules"
            TenantAPI["Tenant Routes<br/>/jobs /invoices<br/>/customers /bookings<br/>/quotes"]
            AdminAPI["Admin Routes<br/>/admin/tenants<br/>/admin/analytics<br/>/admin/auth"]
            WebhookAPI["Webhook Routes<br/>/webhooks/lemon-squeezy"]
            CronJobs["Cron Jobs<br/>Quote Expiry<br/>Invoice Reminders<br/>Review Requests"]
        end
    end

    subgraph "Data Layer — Supabase"
        SupaDB[("PostgreSQL 15<br/>+ Row Level Security")]
        SupaAuth["Supabase Auth<br/>(Tenant Users)"]
        SupaStorage["Supabase Storage<br/>(Photos, PDFs, Logos)"]
        SupaRealtime["Supabase Realtime<br/>(Kanban Live Updates)"]
    end

    subgraph "External Services"
        Resend["Resend<br/>(Transactional Email)"]
        Mapbox["Mapbox GL JS<br/>(Maps & Geocoding)"]
        LemonSqueezy["Lemon Squeezy<br/>(Billing & Affiliates)"]
    end

    Browser --> NextJS
    Mobile --> NextJS
    BookingPortal --> NextJS

    NextJS --> Fastify
    Auth --> SupaAuth
    Dashboard --> Fastify
    SuperAdmin --> Fastify
    Public --> Fastify

    Fastify --> SupaDB
    Fastify --> SupaAuth
    Fastify --> SupaStorage
    Fastify --> Resend
    Fastify --> Mapbox

    LemonSqueezy -->|Webhooks| WebhookAPI
    SupaRealtime -->|Live Updates| NextJS

    style SuperAdmin fill:#dc2626,color:#fff
    style AdminAPI fill:#dc2626,color:#fff
```

---

## 3. Monorepo Structure Diagram

```mermaid
graph TD
    subgraph "Turborepo Root"
        Root["hvac-saas/<br/>turbo.json<br/>pnpm-workspace.yaml"]
    end

    subgraph "Apps"
        Web["apps/web<br/>Next.js 14<br/>Tenant + Superadmin UI"]
        API["apps/api<br/>Fastify<br/>REST API + Cron"]
    end

    subgraph "Packages"
        DB["packages/database<br/>Supabase Client<br/>Types + Helpers"]
        Types["packages/types<br/>Shared TypeScript<br/>Interfaces"]
        UI["packages/ui<br/>Shared React<br/>Components"]
        Email["packages/email<br/>React Email<br/>Templates"]
        Config["packages/config<br/>ESLint, TS Config<br/>Shared Configs"]
    end

    Root --> Web
    Root --> API

    Web --> DB
    Web --> Types
    Web --> UI
    Web --> Config

    API --> DB
    API --> Types
    API --> Email
    API --> Config

    style Web fill:#0070f3,color:#fff
    style API fill:#00a86b,color:#fff
```

---

## 4. Database ERD

### 4.1 Core Business Tables

```mermaid
erDiagram
    tenants ||--o{ users : "has"
    tenants ||--o{ customers : "has"
    tenants ||--o{ jobs : "has"
    tenants ||--o{ invoices : "has"
    tenants ||--o{ bookings : "has"
    tenants ||--o{ quotes : "has"
    tenants ||--o{ catalog_items : "has"
    tenants ||--o{ checklist_templates : "has"
    tenants ||--o{ equipment : "has"
    tenants ||--o{ maintenance_contracts : "has"
    tenants ||--|| tenant_subscriptions : "has"

    tenants {
        uuid id PK
        text business_name
        text slug
        text owner_email
        boolean is_active
        timestamptz trial_ends_at
        text google_review_url
        boolean review_request_enabled
        text referred_by_affiliate_id
        text referral_source
        timestamptz created_at
    }

    users {
        uuid id PK
        uuid tenant_id FK
        text email
        text full_name
        text role
        timestamptz last_login_at
    }

    customers {
        uuid id PK
        uuid tenant_id FK
        text first_name
        text last_name
        text email
        text phone
        text address
        float latitude
        float longitude
        timestamptz created_at
    }

    jobs {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        text job_number
        text status
        text service_type
        text priority
        date scheduled_date
        time scheduled_start
        text description
        numeric total_amount
        timestamptz created_at
    }

    invoices {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        uuid job_id FK
        text invoice_number
        text status
        numeric subtotal
        numeric tax_amount
        numeric total_amount
        numeric balance_due
        text pdf_storage_path
        timestamptz review_requested_at
        timestamptz created_at
    }

    bookings {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        text status
        date booking_date
        time booking_time
        text service_type
        text notes
        timestamptz created_at
    }

    quotes {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        text quote_number
        text status
        date issued_date
        date expiry_date
        numeric total_amount
        text pdf_storage_path
        uuid converted_to_job_id FK
        timestamptz created_at
    }

    tenant_subscriptions {
        uuid id PK
        uuid tenant_id FK
        text lemon_squeezy_subscription_id
        text status
        text plan_name
        numeric affiliate_commission_rate
        timestamptz created_at
    }
```

### 4.2 Line Items & Catalog

```mermaid
erDiagram
    catalog_items ||--o{ job_line_items : "referenced by"
    catalog_items ||--o{ invoice_line_items : "referenced by"
    catalog_items ||--o{ quote_line_items : "referenced by"
    catalog_items ||--o{ checklist_items : "auto line item"
    jobs ||--o{ job_line_items : "has"
    jobs ||--o{ job_photos : "has"
    invoices ||--o{ invoice_line_items : "has"
    invoices ||--o{ invoice_payments : "has"
    quotes ||--o{ quote_line_items : "has"

    catalog_items {
        uuid id PK
        uuid tenant_id FK
        text name
        text item_type
        numeric unit_price
        text unit
        text category
        text description
        boolean is_active
    }

    job_line_items {
        uuid id PK
        uuid tenant_id FK
        uuid job_id FK
        uuid catalog_item_id FK
        text item_type
        text description
        numeric quantity
        numeric unit_price
        numeric total
        int sort_order
    }

    invoice_line_items {
        uuid id PK
        uuid tenant_id FK
        uuid invoice_id FK
        text item_type
        text description
        numeric quantity
        numeric unit_price
        numeric total
    }

    quote_line_items {
        uuid id PK
        uuid tenant_id FK
        uuid quote_id FK
        uuid catalog_item_id FK
        text item_type
        text description
        numeric quantity
        numeric unit_price
        numeric total
        int sort_order
    }

    job_photos {
        uuid id PK
        uuid job_id FK
        text storage_path
        text caption
    }

    invoice_payments {
        uuid id PK
        uuid invoice_id FK
        numeric amount
        text payment_method
        date payment_date
    }
```

### 4.3 Checklists & Equipment

```mermaid
erDiagram
    checklist_templates ||--o{ checklist_items : "contains"
    checklist_items ||--o{ job_checklist_completions : "tracked by"
    jobs ||--o{ job_checklist_completions : "has"
    customers ||--o{ equipment : "owns"
    equipment ||--o{ refrigerant_logs : "has"
    customers ||--o{ maintenance_contracts : "has"

    checklist_templates {
        uuid id PK
        uuid tenant_id FK
        text service_type
        text name
        boolean is_active
    }

    checklist_items {
        uuid id PK
        uuid tenant_id FK
        uuid template_id FK
        text label
        boolean is_required
        uuid catalog_item_id FK
        int sort_order
    }

    job_checklist_completions {
        uuid id PK
        uuid tenant_id FK
        uuid job_id FK
        uuid checklist_item_id FK
        boolean is_completed
        uuid completed_by FK
        timestamptz completed_at
    }

    equipment {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        text equipment_type
        text brand
        text model
        text serial_number
        date install_date
    }

    refrigerant_logs {
        uuid id PK
        uuid tenant_id FK
        uuid equipment_id FK
        uuid job_id FK
        text refrigerant_type
        numeric amount_lbs
        text action_type
    }

    maintenance_contracts {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        text status
        date start_date
        date end_date
        text frequency
        numeric price
    }
```

### 4.4 Superadmin & Platform Tables

```mermaid
erDiagram
    admin_users ||--o{ admin_audit_log : "performs"
    admin_users ||--o{ admin_impersonation_sessions : "creates"
    tenants ||--o{ admin_impersonation_sessions : "targeted by"
    tenants ||--o{ platform_events : "generates"
    tenants ||--o{ admin_audit_log : "affected in"

    admin_users {
        uuid id PK
        text email
        text password_hash
        text role
        text full_name
        boolean is_active
        timestamptz last_login_at
        timestamptz created_at
    }

    admin_audit_log {
        uuid id PK
        uuid admin_user_id FK
        text action
        uuid target_tenant_id FK
        uuid target_user_id
        jsonb metadata
        text ip_address
        timestamptz created_at
    }

    admin_impersonation_sessions {
        uuid id PK
        uuid admin_user_id FK
        uuid tenant_id FK
        uuid tenant_user_id FK
        text reason
        timestamptz started_at
        timestamptz ended_at
        jsonb actions_taken
    }

    platform_events {
        uuid id PK
        uuid tenant_id FK
        text event_type
        uuid user_id
        jsonb metadata
        timestamptz created_at
    }
```

### 4.5 Scheduling & Availability

```mermaid
erDiagram
    tenants ||--o{ availability_schedules : "defines"
    tenants ||--o{ schedule_overrides : "defines"

    availability_schedules {
        uuid id PK
        uuid tenant_id FK
        int day_of_week
        time start_time
        time end_time
        boolean is_active
    }

    schedule_overrides {
        uuid id PK
        uuid tenant_id FK
        date override_date
        boolean is_available
        time start_time
        time end_time
        text reason
    }
```

---

## 5. Authentication Flow Diagrams

### 5.1 Unified Login Flow (Updated)

```mermaid
sequenceDiagram
    actor User
    participant LoginPage as /login Page
    participant NextAPI as Next.js API Route
    participant FastifyAdmin as Fastify /admin/auth/login
    participant SupaAuth as Supabase Auth
    participant Browser as Browser Cookies

    User->>LoginPage: Enter email + password
    LoginPage->>NextAPI: POST /api/auth/login {email, password}

    NextAPI->>FastifyAdmin: POST /admin/auth/login {email, password}

    alt Admin credentials match
        FastifyAdmin-->>NextAPI: 200 {admin_jwt, role, full_name}
        NextAPI->>Browser: Set httpOnly cookie "admin_token"
        NextAPI-->>LoginPage: {redirect: "/superadmin/dashboard", isAdmin: true}
        LoginPage->>User: Redirect to /superadmin/dashboard
    else Not an admin user (401)
        FastifyAdmin-->>NextAPI: 401 Unauthorized
        NextAPI->>SupaAuth: signInWithPassword(email, password)

        alt Tenant credentials match
            SupaAuth-->>NextAPI: {session, user}
            NextAPI->>Browser: Set Supabase session cookies
            NextAPI-->>LoginPage: {redirect: "/dashboard", isAdmin: false}
            LoginPage->>User: Redirect to /dashboard
        else Invalid credentials
            SupaAuth-->>NextAPI: AuthError
            NextAPI-->>LoginPage: 401 {error: "Invalid credentials"}
            LoginPage->>User: Show error message
        end
    end
```

### 5.2 Tenant Signup Flow

```mermaid
sequenceDiagram
    actor Owner as HVAC Owner
    participant Signup as /signup Page
    participant SupaAuth as Supabase Auth
    participant Fastify as Fastify API
    participant DB as PostgreSQL
    participant Resend as Resend Email

    Owner->>Signup: Fill: name, email, password, business name
    Signup->>SupaAuth: signUp(email, password, metadata)
    SupaAuth->>DB: Insert auth.users row
    SupaAuth-->>Signup: {user, session}

    Signup->>Fastify: POST /onboarding {businessName, slug, ...}
    Fastify->>DB: INSERT tenants row
    Fastify->>DB: INSERT users row (linked to tenant)
    Fastify->>DB: INSERT default availability_schedules
    Fastify->>Resend: Send welcome email (E-01)
    Fastify-->>Signup: {tenant, user}

    Signup->>Owner: Redirect to /dashboard (onboarding wizard)
```

### 5.3 Admin JWT Lifecycle

```mermaid
stateDiagram-v2
    [*] --> LoginAttempt: Admin enters credentials
    LoginAttempt --> VerifyPassword: Check admin_users table
    VerifyPassword --> IssueJWT: bcrypt match ✓
    VerifyPassword --> Rejected: bcrypt match ✗

    IssueJWT --> ActiveSession: JWT stored in httpOnly cookie
    ActiveSession --> ActiveSession: Normal admin operations
    ActiveSession --> ReAuth: Destructive action requested
    ReAuth --> ActiveSession: Password re-verified
    ActiveSession --> Expired: 4 hours elapsed
    Expired --> LoginAttempt: Must re-login

    Rejected --> [*]

    note right of IssueJWT
        JWT contains:
        - admin_user_id
        - role (super_admin/support/billing_admin)
        - full_name
        - exp (4h TTL)
    end note
```

---

## 6. User Flow Diagrams

### 6.1 Job Lifecycle (End-to-End)

```mermaid
flowchart TD
    A[Customer calls / books online] --> B{Booking or Direct?}

    B -->|Online Booking| C[Customer fills booking form]
    C --> D[Booking created: status=pending]
    D --> E[Owner sees in /dashboard/bookings]
    E --> F[Owner clicks 'Create Job from Booking']

    B -->|Direct Call| G[Owner creates job manually]

    F --> H[Job created: status=scheduled]
    G --> H

    H --> I{Checklist template exists<br/>for service_type?}
    I -->|Yes| J[Auto-attach checklist items]
    I -->|No| K[No checklist]

    J --> L[Tech goes to job site]
    K --> L

    L --> M[Tech completes checklist items]
    M --> N{Checklist item has<br/>catalog_item_id?}
    N -->|Yes| O[Auto-add line item to job]
    N -->|No| P[Just mark complete]

    O --> Q[All required items checked?]
    P --> Q

    Q -->|No| M
    Q -->|Yes| R[Click 'Complete Job']
    R --> S[Job status: completed]
    S --> T[Generate invoice from job line items]
    T --> U[Send invoice via email E-06]
    U --> V[Customer pays]
    V --> W[Mark invoice: paid]
    W --> X{review_request_enabled<br/>AND google_review_url set?}
    X -->|Yes| Y[Queue review request email E-12<br/>2h delay]
    X -->|No| Z[Done]
    Y --> Z

    style H fill:#3b82f6,color:#fff
    style S fill:#22c55e,color:#fff
    style W fill:#22c55e,color:#fff
    style Y fill:#f59e0b,color:#fff
```

### 6.2 Quote-to-Job Conversion

```mermaid
flowchart LR
    A[Create Quote] --> B[Add line items<br/>from catalog]
    B --> C[Generate PDF]
    C --> D[Send to customer<br/>Email E-13]
    D --> E{Customer Response}

    E -->|Accepts| F[Quote status: accepted]
    E -->|Declines| G[Quote status: declined]
    E -->|No response| H{Expiry date passed?}
    H -->|Yes| I[Cron: status → expired]
    H -->|No| E

    F --> J[Click 'Create Job']
    J --> K[Job created with<br/>same line items]
    K --> L[Normal job lifecycle]

    style F fill:#22c55e,color:#fff
    style G fill:#ef4444,color:#fff
    style I fill:#6b7280,color:#fff
```

### 6.3 Customer Booking Portal Flow

```mermaid
flowchart TD
    A[Customer visits /book/business-slug] --> B[See business info + services]
    B --> C[Select service type]
    C --> D[Pick date from availability calendar]
    D --> E[Pick time slot]
    E --> F[Fill: name, phone, email, address, notes]
    F --> G{Address autocomplete}
    G --> H[Mapbox geocoding → lat/lng]
    H --> I[Submit booking]
    I --> J[Booking created: status=pending]
    J --> K[Email confirmation to customer E-02]
    J --> L[Email notification to owner E-03]
    L --> M[Owner sees booking in dashboard]
    M --> N[Owner confirms → creates job]

    style J fill:#3b82f6,color:#fff
```

---

## 7. API Route Architecture

```mermaid
graph TD
    subgraph "Fastify API Server (Port 4000)"
        Entry["server.ts<br/>Plugins: CORS, JWT, Rate Limit, Swagger"]

        subgraph "Tenant Routes (Supabase JWT Auth)"
            Jobs["/jobs<br/>CRUD + status transitions"]
            Invoices["/invoices<br/>CRUD + PDF + send"]
            Customers["/customers<br/>CRUD + search"]
            Bookings["/bookings<br/>CRUD + confirm"]
            Quotes["/quotes<br/>CRUD + PDF + convert"]
            Catalog["/catalog<br/>CRUD + search"]
            Equipment["/equipment<br/>CRUD"]
            Refrigerant["/refrigerant-logs<br/>CRUD"]
            Checklists["/checklists<br/>Templates + completions"]
            Schedule["/availability<br/>Schedules + overrides"]
            Settings["/settings<br/>Tenant profile + billing"]
        end

        subgraph "Admin Routes (Admin JWT Auth)"
            AdminAuth["/admin/auth<br/>Login + refresh"]
            AdminTenants["/admin/tenants<br/>List + detail + actions"]
            AdminAnalytics["/admin/analytics<br/>MRR + signups + churn"]
            AdminSearch["/admin/search<br/>Global cross-tenant"]
            AdminAudit["/admin/audit-log<br/>Action history"]
            AdminSystem["/admin/system<br/>Webhooks + crons"]
            AdminAffiliates["/admin/affiliates<br/>Attribution data"]
        end

        subgraph "Public Routes (No Auth)"
            BookingPublic["/public/booking<br/>Availability + submit"]
            WebhooksLS["/webhooks/lemon-squeezy<br/>Subscription events"]
            AffRedirect["/ref/[code]<br/>Cookie + redirect"]
        end

        subgraph "Background Jobs"
            CronInvoice["Cron: Invoice reminders<br/>Daily 9am"]
            CronQuote["Cron: Quote expiry<br/>Daily midnight"]
            CronReview["Cron: Review requests<br/>Every 2 hours"]
            CronEvents["Cron: Platform events<br/>aggregation"]
        end
    end

    Entry --> Jobs
    Entry --> AdminAuth
    Entry --> BookingPublic
    Entry --> CronInvoice

    style AdminAuth fill:#dc2626,color:#fff
    style AdminTenants fill:#dc2626,color:#fff
    style AdminAnalytics fill:#dc2626,color:#fff
    style AdminSearch fill:#dc2626,color:#fff
    style AdminAudit fill:#dc2626,color:#fff
    style AdminSystem fill:#dc2626,color:#fff
    style AdminAffiliates fill:#dc2626,color:#fff
```

---

## 8. Multi-Tenancy & RLS Model

```mermaid
graph TD
    subgraph "Request Flow"
        Req["Incoming API Request"]
        JWT["Extract JWT → tenant_id"]
        RLS["Supabase RLS Policy<br/>WHERE tenant_id = jwt.tenant_id"]
    end

    subgraph "Tenant A Data"
        A_Jobs["Jobs (3)"]
        A_Customers["Customers (15)"]
        A_Invoices["Invoices (8)"]
    end

    subgraph "Tenant B Data"
        B_Jobs["Jobs (7)"]
        B_Customers["Customers (22)"]
        B_Invoices["Invoices (12)"]
    end

    subgraph "Admin Access"
        AdminReq["Admin Request<br/>(Service Role Key)"]
        Bypass["Bypasses RLS"]
        AllData["Access ALL tenant data"]
    end

    Req --> JWT --> RLS
    RLS -->|tenant_id = A| A_Jobs
    RLS -->|tenant_id = A| A_Customers
    RLS -->|tenant_id = A| A_Invoices
    RLS -.->|BLOCKED| B_Jobs
    RLS -.->|BLOCKED| B_Customers
    RLS -.->|BLOCKED| B_Invoices

    AdminReq --> Bypass --> AllData
    AllData --> A_Jobs
    AllData --> B_Jobs

    style RLS fill:#f59e0b,color:#000
    style Bypass fill:#dc2626,color:#fff
```

### RLS Policy Pattern (Applied to Every Tenant Table)

```mermaid
flowchart LR
    A["SELECT/INSERT/UPDATE/DELETE<br/>on any tenant table"] --> B{"auth.jwt() ->> 'tenant_id'<br/>== row.tenant_id?"}
    B -->|Yes| C["Query Executes ✓"]
    B -->|No| D["Row Invisible / Blocked ✗"]

    style C fill:#22c55e,color:#fff
    style D fill:#ef4444,color:#fff
```

---

## 9. Deployment Architecture

```mermaid
graph TB
    subgraph "DNS / Domain"
        Domain["yourapp.com"]
        APIDomain["api.yourapp.com"]
    end

    subgraph "Vercel (Free Hobby Tier)"
        VercelWeb["apps/web<br/>Next.js 14<br/>SSR + Static"]
        VercelEdge["Edge Middleware<br/>Route Protection"]
        VercelFunc["Serverless Functions<br/>API Routes (/api/*)"]
    end

    subgraph "Render (Free Tier)"
        RenderAPI["apps/api<br/>Fastify Server<br/>Node.js Runtime"]
    end

    subgraph "Supabase (Free Tier)"
        SupaPG[("PostgreSQL 15<br/>+ RLS")]
        SupaAuthS["Auth Service"]
        SupaStorageS["Storage (S3)"]
        SupaRealtimeS["Realtime (WebSocket)"]
        SupaEdge["Edge Functions<br/>(if needed)"]
    end

    subgraph "External SaaS"
        ResendS["Resend<br/>3K emails/mo free"]
        MapboxS["Mapbox<br/>50K loads/mo free"]
        LemonS["Lemon Squeezy<br/>5% + $0.50/txn"]
    end

    Domain --> VercelWeb
    APIDomain --> RenderAPI

    VercelWeb --> VercelEdge
    VercelEdge --> VercelFunc
    VercelFunc --> RenderAPI

    RenderAPI --> SupaPG
    RenderAPI --> SupaAuthS
    RenderAPI --> SupaStorageS
    RenderAPI --> ResendS

    VercelWeb --> SupaRealtimeS

    LemonS -->|Webhooks| RenderAPI

    style VercelWeb fill:#000,color:#fff
    style RenderAPI fill:#46e3b7,color:#000
    style SupaPG fill:#3ecf8e,color:#000
```

---

## 10. Data Flow Diagrams

### 10.1 Invoice Generation & Payment Flow

```mermaid
sequenceDiagram
    actor Owner
    participant Web as Next.js App
    participant API as Fastify API
    participant DB as PostgreSQL
    participant Storage as Supabase Storage
    participant Email as Resend

    Owner->>Web: Click "Generate Invoice" on completed job
    Web->>API: POST /invoices {job_id, customer_id}
    API->>DB: Copy job_line_items → invoice_line_items
    API->>DB: INSERT invoice (auto-number INV-YYYY-XXXX)
    API->>DB: Calculate subtotal, tax, total
    API-->>Web: {invoice}

    Owner->>Web: Click "Send Invoice"
    Web->>API: POST /invoices/:id/send
    API->>API: Generate PDF (pdfkit)
    API->>Storage: Upload PDF
    API->>DB: UPDATE invoice.pdf_storage_path
    API->>Email: Send E-06 with PDF attachment
    API-->>Web: {sent: true}

    Owner->>Web: Click "Mark as Paid"
    Web->>API: POST /invoices/:id/payments {amount, method}
    API->>DB: INSERT invoice_payment
    API->>DB: UPDATE invoice.balance_due, status=paid

    Note over API: If review_request_enabled && google_review_url set
    API->>DB: SET review_requested_at = now() + 2h
    API->>Email: Queue E-12 review request (2h delay)
```

### 10.2 Realtime Kanban Update Flow

```mermaid
sequenceDiagram
    actor Owner as Owner (Browser A)
    actor Tech as Tech (Browser B)
    participant Web as Next.js App
    participant API as Fastify API
    participant DB as PostgreSQL
    participant RT as Supabase Realtime

    Tech->>Web: Drag job card to "In Progress"
    Web->>API: PATCH /jobs/:id {status: "in_progress"}
    API->>DB: UPDATE jobs SET status = 'in_progress'
    DB->>RT: Broadcast change event
    RT->>Owner: WebSocket: job status changed
    Owner->>Owner: Kanban card moves automatically

    Note over Owner: No page refresh needed
```

---

## 11. Cron & Background Jobs

```mermaid
graph LR
    subgraph "Fastify Cron Scheduler"
        C1["Invoice Reminder<br/>Daily 9:00 AM<br/>Overdue invoices → E-07"]
        C2["Quote Expiry<br/>Daily 00:00<br/>Expired quotes → status=expired"]
        C3["Review Request<br/>Every 2 hours<br/>Paid invoices → E-12"]
        C4["Trial Expiry Check<br/>Daily 00:00<br/>trial_ends_at < now → gate"]
        C5["Platform Event Agg<br/>Hourly<br/>Aggregate DAT/WAT/MAT"]
    end

    subgraph "Targets"
        DB[("PostgreSQL")]
        Email["Resend"]
    end

    C1 --> DB
    C1 --> Email
    C2 --> DB
    C3 --> DB
    C3 --> Email
    C4 --> DB
    C5 --> DB

    style C1 fill:#f59e0b,color:#000
    style C2 fill:#f59e0b,color:#000
    style C3 fill:#f59e0b,color:#000
    style C4 fill:#f59e0b,color:#000
    style C5 fill:#f59e0b,color:#000
```

---

## 12. Component Architecture (Frontend)

```mermaid
graph TD
    subgraph "App Shell"
        Layout["Root Layout<br/>Providers, Toasts, Realtime"]
    end

    subgraph "(auth) Route Group"
        Login["LoginPage<br/>Unified: tenant + admin"]
        Signup["SignupPage"]
        ForgotPW["ForgotPassword"]
    end

    subgraph "(dashboard) Route Group"
        DashLayout["DashboardLayout<br/>Sidebar + Header"]
        Home["KPI Dashboard<br/>6 stat cards"]
        JobsKanban["Jobs Kanban<br/>Drag & drop columns"]
        JobsCalendar["Jobs Calendar<br/>react-big-calendar"]
        CustomersPage["Customers<br/>Table + detail"]
        InvoicesPage["Invoices<br/>Table + PDF"]
        BookingsPage["Bookings<br/>Pending list"]
        QuotesPage["Quotes<br/>Table + builder"]
        SchedulePage["Schedule<br/>Availability mgmt"]
        SettingsPage["Settings<br/>Business + billing + catalog"]
    end

    subgraph "(superadmin) Route Group"
        SALayout["SuperAdminLayout<br/>Red sidebar + ADMIN badge"]
        SADash["SA Dashboard<br/>MRR + signups + active"]
        SATenants["SA Tenants<br/>List + detail + impersonate"]
        SAAnalytics["SA Analytics<br/>Charts + metrics"]
        SASupport["SA Support<br/>Search + audit log"]
        SAAffiliates["SA Affiliates<br/>Attribution table"]
        SASystem["SA System<br/>Webhook + cron logs"]
    end

    subgraph "Public Routes"
        BookingPortal["book/[slug]<br/>Public booking form"]
        RefRedirect["ref/[code]<br/>Affiliate redirect"]
    end

    Layout --> Login
    Layout --> DashLayout
    Layout --> SALayout
    Layout --> BookingPortal

    DashLayout --> Home
    DashLayout --> JobsKanban
    DashLayout --> JobsCalendar
    DashLayout --> CustomersPage
    DashLayout --> InvoicesPage
    DashLayout --> BookingsPage
    DashLayout --> QuotesPage
    DashLayout --> SchedulePage
    DashLayout --> SettingsPage

    SALayout --> SADash
    SALayout --> SATenants
    SALayout --> SAAnalytics
    SALayout --> SASupport
    SALayout --> SAAffiliates
    SALayout --> SASystem

    style SALayout fill:#dc2626,color:#fff
    style SADash fill:#dc2626,color:#fff
    style SATenants fill:#dc2626,color:#fff
    style SAAnalytics fill:#dc2626,color:#fff
    style SASupport fill:#dc2626,color:#fff
    style SAAffiliates fill:#dc2626,color:#fff
    style SASystem fill:#dc2626,color:#fff
```

### Shared UI Components

```mermaid
graph TD
    subgraph "packages/ui"
        Button["Button"]
        Input["Input"]
        Table["DataTable<br/>Sortable, filterable"]
        Card["Card / StatCard"]
        Modal["Modal / Dialog"]
        Form["Form + Validation"]
        Select["Select / Combobox"]
        DatePicker["DatePicker"]
        Skeleton["Skeleton Loader"]
        Badge["StatusBadge"]
        Sidebar["Sidebar"]
        Kanban["KanbanBoard"]
        Calendar["CalendarView"]
    end

    subgraph "Used By"
        Web["apps/web<br/>(dashboard + superadmin)"]
    end

    Web --> Button
    Web --> Input
    Web --> Table
    Web --> Card
    Web --> Modal
    Web --> Kanban
    Web --> Calendar
```

---

## 13. Email System Flow

```mermaid
graph TD
    subgraph "Email Triggers"
        T1["Signup → E-01 Welcome"]
        T2["Booking submitted → E-02 Customer Confirm"]
        T3["Booking submitted → E-03 Owner Notify"]
        T4["Booking confirmed → E-04 Customer Notify"]
        T5["Job completed → E-05 Summary"]
        T6["Invoice sent → E-06 Invoice Email"]
        T7["Invoice overdue → E-07 Reminder"]
        T8["Payment received → E-08 Receipt"]
        T9["Contract renewal → E-09 Reminder"]
        T10["Trial expiring → E-10 Warning"]
        T11["First paid sub → E-11 Welcome + Affiliate"]
        T12["Invoice paid → E-12 Review Request"]
        T13["Quote sent → E-13 Quote Email"]
    end

    subgraph "Email Engine"
        ReactEmail["React Email<br/>packages/email"]
        Resend["Resend API<br/>3K emails/mo free"]
    end

    subgraph "Delivery"
        Customer["Customer Inbox"]
        Owner["Owner Inbox"]
    end

    T1 --> ReactEmail
    T2 --> ReactEmail
    T3 --> ReactEmail
    T6 --> ReactEmail
    T12 --> ReactEmail
    T13 --> ReactEmail

    ReactEmail --> Resend
    Resend --> Customer
    Resend --> Owner

    style Resend fill:#000,color:#fff
```

---

## 14. Billing & Subscription Flow

```mermaid
sequenceDiagram
    actor Owner
    participant Web as Next.js App
    participant LS as Lemon Squeezy
    participant Webhook as Fastify Webhook Handler
    participant DB as PostgreSQL

    Owner->>Web: Click "Subscribe" ($49/mo)
    Web->>LS: Redirect to LS checkout

    Note over LS: LS detects aff_code cookie<br/>if affiliate referral

    Owner->>LS: Enter payment details
    LS->>LS: Process payment
    LS->>Webhook: POST /webhooks/lemon-squeezy<br/>event: subscription_created

    Webhook->>DB: UPSERT tenant_subscriptions
    Webhook->>DB: SET tenants.referred_by_affiliate_id<br/>(if affiliate)
    Webhook-->>LS: 200 OK

    Note over DB: tenant.is_active = true<br/>Subscription gates removed

    LS-->>Owner: Redirect back to app
    Owner->>Web: Full access to dashboard

    Note over LS: Monthly recurring charge
    LS->>Webhook: subscription_payment_success (monthly)
    Webhook->>DB: UPDATE subscription status

    Note over LS: If customer cancels
    LS->>Webhook: subscription_cancelled
    Webhook->>DB: UPDATE status = 'cancelled'
    Webhook->>DB: SET is_active = false (after grace period)
```

---

## 15. Affiliate Program Flow

```mermaid
flowchart TD
    A[Happy customer visits<br/>Lemon Squeezy affiliate portal] --> B[Signs up as affiliate]
    B --> C[Gets unique link:<br/>yourapp.com/?aff=ABC123]
    C --> D[Shares with HVAC friends]

    D --> E[Friend visits /ref/ABC123]
    E --> F[Cookie 'aff_code=ABC123' set<br/>30-day expiry]
    F --> G[Friend signs up for account]
    G --> H[Friend goes through onboarding]
    H --> I[Friend hits Lemon Squeezy checkout]

    I --> J{aff_code cookie present?}
    J -->|Yes| K[LS tracks conversion<br/>affiliate_id in webhook payload]
    J -->|No| L[Organic signup]

    K --> M[Webhook: subscription_created]
    M --> N[Save affiliate_id to tenant record]
    N --> O[referral_source = 'affiliate']

    O --> P[LS handles 25% recurring commission<br/>payout to affiliate automatically]

    G --> Q[Send E-11 welcome email<br/>with their own referral link]
    Q --> R[New customer becomes<br/>potential affiliate too]

    style K fill:#22c55e,color:#fff
    style P fill:#22c55e,color:#fff
```

---

## 16. Impersonation Flow (Updated for Unified App)

```mermaid
sequenceDiagram
    actor Admin
    participant SAPage as /superadmin/tenants/[id]
    participant API as Fastify Admin API
    participant DB as PostgreSQL
    participant Dashboard as /dashboard (tenant view)

    Admin->>SAPage: Click "Impersonate" on tenant
    SAPage->>SAPage: Modal: Enter mandatory reason
    Admin->>SAPage: Submit reason: "Support ticket #456"

    SAPage->>API: POST /admin/tenants/:id/impersonate<br/>{reason: "Support ticket #456"}
    API->>DB: INSERT admin_impersonation_sessions
    API->>DB: INSERT admin_audit_log (action: impersonate_start)
    API->>API: Generate short-lived tenant JWT (15 min TTL)<br/>with is_impersonation=true flag
    API-->>SAPage: {impersonation_token, tenant_name}

    SAPage->>Dashboard: Redirect to /dashboard<br/>with impersonation_token cookie

    Note over Dashboard: Red banner shows:<br/>"⚠️ Viewing as [Business Name] — [Admin Name]"

    Admin->>Dashboard: Browse tenant data (RLS enforced)
    Dashboard->>API: All requests use impersonation JWT<br/>scoped to tenant_id
    API->>DB: Log actions to impersonation_sessions.actions_taken

    Admin->>Dashboard: Click "Exit Impersonation" in banner
    Dashboard->>API: POST /admin/impersonation/end
    API->>DB: UPDATE session: ended_at = now()
    API->>DB: INSERT admin_audit_log (action: impersonate_end)
    API-->>Dashboard: Clear impersonation cookie
    Dashboard->>SAPage: Redirect back to /superadmin/tenants
```

---

## 17. Security Architecture

```mermaid
graph TD
    subgraph "Authentication Layers"
        L1["Layer 1: Supabase Auth<br/>Tenant user signup/login<br/>JWT with tenant_id claim"]
        L2["Layer 2: Admin Auth<br/>admin_users table + bcrypt<br/>Separate JWT with admin role"]
        L3["Layer 3: Impersonation<br/>Short-lived tenant JWT<br/>15-min TTL, is_impersonation flag"]
    end

    subgraph "Authorization"
        RLS["Row Level Security<br/>Every table filtered by tenant_id"]
        AdminRole["Admin Role Check<br/>super_admin > support > billing_admin"]
        Middleware["Next.js Middleware<br/>/superadmin/* → admin JWT required<br/>/dashboard/* → tenant JWT required"]
    end

    subgraph "Audit & Compliance"
        AuditLog["admin_audit_log<br/>Append-only, no DELETE policy"]
        ImpLog["admin_impersonation_sessions<br/>Reason + duration + actions"]
        PlatformLog["platform_events<br/>Tenant activity tracking"]
    end

    subgraph "Security Controls"
        HTTPOnly["httpOnly Cookies<br/>No JS access to tokens"]
        CSRF["CORS + Origin Check"]
        RateLimit["Rate Limiting<br/>Login: 5 req/min<br/>API: 100 req/min"]
        ReAuth["Re-auth for<br/>destructive actions"]
        TTL["Token Expiry<br/>Tenant: 1h<br/>Admin: 4h<br/>Impersonation: 15min"]
    end

    L1 --> RLS
    L2 --> AdminRole
    L2 --> Middleware
    L3 --> RLS

    AdminRole --> AuditLog
    L3 --> ImpLog

    style AuditLog fill:#dc2626,color:#fff
    style RLS fill:#f59e0b,color:#000
```

---

## 18. Feature Module Dependency Map

```mermaid
graph TD
    subgraph "Foundation (Week 1)"
        Auth["Auth + Multi-tenancy"]
        DB["Database + RLS"]
        Customers["Customer CRUD"]
        Catalog["Service Catalog"]
        KPI["KPI Dashboard"]
        SAScaffold["Superadmin Scaffold<br/>Login + Tenant List"]
    end

    subgraph "Core Workflows (Week 2)"
        Booking["Booking Portal"]
        Kanban["Job Kanban"]
        Calendar["Calendar View"]
        Impersonate["Impersonation"]
    end

    subgraph "Revenue Features (Week 3)"
        Invoice["Invoicing + PDF"]
        Quotes["Quote Builder"]
        CatalogInteg["Catalog → Line Item<br/>Autocomplete"]
        Review["Review Request"]
        SAAnalytics["Admin Analytics"]
    end

    subgraph "Completion (Week 4)"
        Equipment["Equipment Records"]
        Refrigerant["Refrigerant Logs"]
        Checklists["Checklists + Templates"]
        Contracts["Maintenance Contracts"]
        Affiliate["Affiliate Program"]
        Polish["Polish + Deploy"]
    end

    Auth --> Customers
    Auth --> SAScaffold
    DB --> Auth
    DB --> Catalog

    Customers --> Booking
    Customers --> Kanban
    Kanban --> Calendar
    SAScaffold --> Impersonate

    Catalog --> CatalogInteg
    Kanban --> Invoice
    CatalogInteg --> Invoice
    CatalogInteg --> Quotes
    Invoice --> Review
    Impersonate --> SAAnalytics

    Customers --> Equipment
    Equipment --> Refrigerant
    Catalog --> Checklists
    Kanban --> Checklists
    Invoice --> Affiliate

    style Auth fill:#3b82f6,color:#fff
    style DB fill:#3b82f6,color:#fff
    style SAScaffold fill:#dc2626,color:#fff
    style Impersonate fill:#dc2626,color:#fff
    style SAAnalytics fill:#dc2626,color:#fff
```

---

## Summary of Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Superadmin deployment | Same app, `/superadmin/*` routes | Saves a Vercel slot, simpler deployment, unified login UX |
| Admin auth | Separate `admin_users` table + bcrypt + own JWT | Complete isolation from tenant auth; service role DB access |
| Login flow | Try admin first, fall through to Supabase | Single login form, zero UX friction, role-based redirect |
| Route protection | Next.js middleware | Edge-level check before any page renders |
| Multi-tenancy | Shared DB + RLS | Cost-effective for free tier; Supabase RLS is battle-tested |
| Realtime | Supabase Realtime | Bundled with DB, zero extra cost |
| Billing | Lemon Squeezy | Built-in affiliates, no Stripe Atlas needed |
| Email | Resend + React Email | 3K/mo free; React components for templates |
| Maps | Mapbox GL JS | 50K loads/mo free; better DX than Google Maps |
| PDF | pdfkit | Zero external API cost; runs on Fastify |

---

*HVAC SaaS — System Diagrams & Unified Auth Architecture · Version 1.0 · March 2026*
