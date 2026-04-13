# API Documentation — Part 5: Reports, Admin, Enums, Errors

> **Part 5 of 5** — Reports, Admin Panel, Enums, Errors
> - [[API_DOCUMENTATION_1|Part 1]]: Auth, Tenants, Dashboard, Customers, Tags
> - [[API_DOCUMENTATION_2|Part 2]]: Jobs, Quotes, Line Items
> - [[API_DOCUMENTATION_3|Part 3]]: Invoices, Catalog, Checklists, Pipelines
> - [[API_DOCUMENTATION_4|Part 4]]: Bookings, Equipment, Service Agreements, Conversations
> - [[API_DOCUMENTATION_5|Part 5]]: Reports, Admin Panel, Enums, Errors *(this file)*
## Reports

Analytics and reporting endpoints for business metrics across all core entities.

### `GET /reports/revenue`

**Auth:** `requireTenant`

Get revenue analytics: total, MRR, YoY comparison, monthly trend.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `dateFrom` | string | Start of current month |
| `dateTo` | string | End of current month |

**Response** `200 OK`

```json
{
  "data": {
    "totalRevenue": "28500.00",
    "previousRevenue": "24100.00",
    "revenueChange": "18.2%",
    "monthlyData": [
      { "month": "2026-01", "amount": "21000.00" },
      { "month": "2026-02", "amount": "24100.00" },
      { "month": "2026-03", "amount": "28500.00" }
    ]
  }
}
```

### `GET /reports/jobs`

**Auth:** `requireTenant`

Get job analytics: counts by status, pipeline breakdown, average time-to-complete.

**Response** `200 OK`

```json
{
  "data": {
    "totalJobs": 125,
    "jobsByStatus": [
      { "status": "scheduled", "count": 8 },
      { "status": "in_progress", "count": 3 },
      { "status": "completed", count: 42 }
    ],
    "avgTimeToComplete": "2.5 days"
  }
}
```

### `GET /reports/customers`

**Auth:** `requireTenant`

Get customer analytics: total, new this month, retention rate, lifetime value.

**Response** `200 OK`

```json
{
  "data": {
    "totalCustomers": 47,
    "newThisMonth": 3,
    "retentionRate": "94.5%",
    "avgLifetimeValue": "3450.00"
  }
}
```

### `GET /reports/quotes-invoices`

**Auth:** `requireTenant`

Get quote and invoice metrics: conversion rate, outstanding balance, aging.

**Response** `200 OK`

```json
{
  "data": {
    "quoteStats": {
      "total": 24,
      "accepted": 16,
      "conversionRate": "66.7%"
    },
    "invoiceStats": {
      "total": 98,
      "paid": 85,
      "outstandingBalance": "15420.00",
      "overdueCount": 3
    }
  }
}
```

### `GET /reports/bookings`

**Auth:** `requireTenant`

Get booking analytics: conversion rate, occupancy, revenue per booking.

**Response** `200 OK`

```json
{
  "data": {
    "totalBookings": 42,
    "convertedToJobs": 38,
    "conversionRate": "90.5%",
    "revenuePerBooking": "678.50"
  }
}
```

### `GET /reports/export`

**Auth:** `requireTenant`

Export report data as CSV.

**Query Parameters:**

| Parameter | Type | Required |
|-----------|------|----------|
| `reportType` | string | Yes — `revenue`, `jobs`, `customers`, `quotes-invoices`, or `bookings` |
| `dateFrom` | string | No |
| `dateTo` | string | No |

**Response** `200 OK` (Content-Type: `text/csv`)

Returns CSV file with report data.

---

## Admin Panel

Super admin endpoints for platform management. Requires admin role.

### `GET /admin/tenants`

**Auth:** `requireAdmin`

List all tenants on the platform.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `search` | string | - |
| `page` | integer | `1` |
| `limit` | integer | `20` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "businessName": "Smith HVAC Services",
      "ownerName": "John Smith",
      "email": "john@smithhvac.com",
      "isActive": true,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "subscription": {
        "status": "active",
        "planName": "starter"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

### `GET /admin/tenants/:id`

**Auth:** `requireAdmin`

Get detailed tenant information.

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "businessName": "Smith HVAC Services",
    "ownerName": "John Smith",
    "email": "john@smithhvac.com",
    "phone": "(512) 555-0100",
    "city": "Austin",
    "state": "TX",
    "isActive": true,
    "createdAt": "2026-01-15T10:00:00.000Z",
    "subscription": {
      "status": "active",
      "planName": "starter",
      "currentPeriodEnd": "2026-04-15T10:00:00.000Z"
    },
    "stats": {
      "customerCount": 47,
      "jobCount": 125,
      "invoiceCount": 98
    }
  }
}
```

### `GET /admin/analytics`

**Auth:** `requireAdmin`

Platform-wide analytics.

**Response** `200 OK`

```json
{
  "data": {
    "totalTenants": 15,
    "activeTenants": 12,
    "totalRevenue": "8820.00",
    "mrr": "588.00",
    "signupsThisMonth": 3,
    "churnRate": 2.1
  }
}
```

### `GET /admin/audit-log`

**Auth:** `requireAdmin`

View admin actions audit log.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `page` | integer | `1` |
| `limit` | integer | `50` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "audit_001",
      "adminUserId": "usr_admin",
      "action": "tenant.viewed",
      "targetTenantId": "550e8400-e29b-41d4-a716-446655440000",
      "metadata": null,
      "ipAddress": "192.168.1.1",
      "createdAt": "2026-03-28T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 120,
    "totalPages": 3
  }
}
```

### `POST /admin/tenants/:id/deactivate`

**Auth:** `requireAdminTier(["super_admin"])`

Deactivate a tenant (sets `isActive = false`). Logged to audit.

**Response** `200 OK`

```json
{ "success": true }
```

### `POST /admin/tenants/:id/activate`

**Auth:** `requireAdminTier(["super_admin"])`

Activate a deactivated tenant. Logged to audit.

**Response** `200 OK`

```json
{ "success": true }
```

### `POST /admin/tenants/:id/extend-trial`

**Auth:** `requireAdminTier(["super_admin", "support"])`

Extend tenant trial period.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `days` | number | Yes | Days to extend (1-365) |

**Response** `200 OK`

```json
{ "success": true, "trialEndsAt": "2026-05-15T00:00:00.000Z" }
```

### `POST /admin/tenants/:id/override-subscription`

**Auth:** `requireAdminTier(["super_admin", "billing_admin"])`

Override subscription status/plan.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | New subscription status |
| `planName` | string | No | New plan name |

**Response** `200 OK`

```json
{ "success": true }
```

### `PATCH /admin/tenants/:id`

**Auth:** `requireAdminTier(["super_admin"])`

Edit tenant details. Only allowed fields: businessName, ownerName, email, phone, slug, address, city, state, zipCode.

**Response** `200 OK`

```json
{ "success": true }
```

### `DELETE /admin/tenants/:id`

**Auth:** `requireAdminTier(["super_admin"])`

Hard delete tenant with 2-step confirmation.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `confirmBusinessName` | string | Yes | Must match tenant business name |

**Response** `200 OK`

```json
{ "success": true }
```

### `GET /admin/analytics/mrr`

**Auth:** `requireAdmin`

MRR metrics with plan breakdown.

**Response** `200 OK`

```json
{
  "data": {
    "currentMRR": 490,
    "totalActiveSubscriptions": 10,
    "breakdown": [
      { "planName": "starter", "count": 10, "price": 49, "mrr": 490 }
    ]
  }
}
```

### `GET /admin/analytics/signups`

**Auth:** `requireAdmin`

Daily signups for last 90 days.

**Response** `200 OK`

```json
{
  "data": [
    { "date": "2026-03-01", "count": 3 },
    { "date": "2026-03-02", "count": 1 }
  ]
}
```

### `GET /admin/analytics/active-users`

**Auth:** `requireAdmin`

Daily/Weekly/Monthly active tenant counts.

**Response** `200 OK`

```json
{ "data": { "dat": 5, "wat": 12, "mat": 25 } }
```

### `GET /admin/analytics/churn`

**Auth:** `requireAdmin`

**Query Params:** `days` (default: 90)

**Response** `200 OK`

```json
{
  "data": [
    {
      "tenantId": "uuid",
      "businessName": "Cool Air LLC",
      "planName": "starter",
      "cancelledAt": "2026-03-15T00:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "mrrLost": 49,
      "daysActive": 73
    }
  ]
}
```

### `GET /admin/analytics/trial-conversion`

**Auth:** `requireAdmin`

Trial funnel metrics.

**Response** `200 OK`

```json
{
  "data": {
    "totalTrials": 50,
    "activeTrials": 10,
    "converted": 30,
    "cancelled": 10,
    "conversionRate": 60
  }
}
```

### `GET /admin/analytics/inactive-alerts`

**Auth:** `requireAdmin`

Tenants with no platform_events in last 14 days (churn risk).

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "businessName": "Lazy AC Co",
      "ownerName": "John",
      "email": "john@lazy.com",
      "planName": "starter",
      "subscriptionStatus": "active",
      "mrr": 49
    }
  ]
}
```

### `GET /admin/analytics/feature-adoption`

**Auth:** `requireAdmin`

Feature usage percentages across all tenants.

**Response** `200 OK`

```json
{
  "data": {
    "totalTenants": 25,
    "features": [
      { "feature": "Jobs", "tenants": 20, "percentage": 80 },
      { "feature": "Customers", "tenants": 25, "percentage": 100 },
      { "feature": "Invoices", "tenants": 15, "percentage": 60 },
      { "feature": "Quotes", "tenants": 10, "percentage": 40 },
      { "feature": "Bookings", "tenants": 5, "percentage": 20 }
    ]
  }
}
```

### `GET /admin/search?q=term`

**Auth:** `requireAdminTier(["super_admin", "support"])`

Global cross-tenant search by business name, owner, email, or slug.

**Query Params:** `q` (min 2 chars), `limit` (default: 20)

**Response** `200 OK`

```json
{
  "data": {
    "tenants": [
      {
        "id": "uuid",
        "businessName": "Cool Air LLC",
        "ownerName": "John Doe",
        "email": "john@coolair.com",
        "slug": "cool-air",
        "isActive": true,
        "subscriptionStatus": "active",
        "planName": "starter",
        "mrr": 49
      }
    ]
  }
}
```

### `POST /admin/impersonation/start`

**Auth:** `requireAdminTier(["super_admin", "support"])`

Start impersonating a tenant. Creates an impersonation session and returns session ID for cookie-based context injection.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string (UUID) | Yes | Tenant to impersonate |
| `reason` | string | Yes | Audit reason for impersonation |

**Response** `200 OK`

```json
{
  "sessionId": "uuid",
  "tenantId": "uuid",
  "tenantUserId": "usr_tenant_owner",
  "tenantName": "Cool Air LLC",
  "expiresAt": "2026-03-29T14:00:00.000Z"
}
```

### `POST /admin/impersonation/end`

**Auth:** `requireAdmin`

End an active impersonation session.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string (UUID) | Yes | Impersonation session to end |

**Response** `200 OK`

```json
{
  "success": true,
  "tenantId": "uuid"
}
```

### `GET /admin/impersonation/active`

**Auth:** `requireAdmin`

Check if the requesting admin has an active impersonation session.

**Response** `200 OK`

```json
{
  "active": true,
  "session": {
    "id": "uuid",
    "tenantId": "uuid",
    "tenantName": "Cool Air LLC",
    "reason": "Support ticket #123",
    "startedAt": "2026-03-29T12:00:00.000Z",
    "expiresAt": "2026-03-29T14:00:00.000Z"
  }
}
```

### `POST /admin/impersonation/request`

**Auth:** `requireAdminTier(["super_admin", "support"])`

Request visible (consent-based) impersonation. Creates a pending session and broadcasts a realtime request to the tenant.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenantId` | string (UUID) | Yes | Tenant to impersonate |
| `reason` | string | Yes | Reason shown to tenant |

**Response** `200 OK`

```json
{
  "sessionId": "uuid",
  "status": "pending"
}
```

### `POST /admin/impersonation/cancel`

**Auth:** `requireAdmin`

Cancel a pending visible impersonation request. Broadcasts cancel event to tenant.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string (UUID) | Yes | Pending session to cancel |

**Response** `200 OK`

```json
{ "success": true }
```

### `POST /tenants/impersonation/respond`

**Auth:** `requireTenant`

Tenant accepts or rejects a visible impersonation request.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string (UUID) | Yes | Impersonation session |
| `approved` | boolean | Yes | Whether to grant access |

**Response** `200 OK`

```json
{ "success": true }
```

### `GET /tenants/impersonation/pending`

**Auth:** `requireTenant`

Check for pending visible impersonation requests targeting this tenant.

**Response** `200 OK`

```json
{
  "pending": true,
  "request": {
    "sessionId": "uuid",
    "adminName": "Super Admin",
    "reason": "Support ticket #456"
  }
}
```

### `GET /tenants/impersonation/active-viewer`

**Auth:** `requireTenant`

Check if an admin is actively viewing this tenant's account (visible mode).

**Response** `200 OK`

```json
{
  "active": true,
  "viewer": {
    "sessionId": "uuid",
    "adminName": "Super Admin"
  }
}
```

### `GET /admin/impersonation-log`

**Auth:** `requireAdminTier(["super_admin", "support"])`

Impersonation session history with pagination.

**Query Params:** `page` (default: 1), `limit` (default: 50)

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "adminUserId": "usr_admin",
      "adminName": "Admin User",
      "tenantId": "uuid",
      "tenantName": "Cool Air LLC",
      "reason": "Support ticket #123",
      "startedAt": "2026-03-28T12:00:00.000Z",
      "endedAt": "2026-03-28T12:15:00.000Z",
      "actionsTaken": []
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 5, "totalPages": 1 }
}
```

### `GET /admin/tenants/:id/activity`

**Auth:** `requireAdmin`

Platform events for a specific tenant.

**Query Params:** `page` (default: 1), `limit` (default: 50)

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "eventType": "job_created",
      "userId": "usr_123",
      "metadata": null,
      "createdAt": "2026-03-28T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 100, "totalPages": 2 }
}
```

### `GET /admin/system`

**Auth:** `requireAdminTier(["super_admin"])`

System health metrics.

**Response** `200 OK`

```json
{
  "data": {
    "uptime": 3600,
    "database": "healthy",
    "memory": {
      "heapUsedMB": 64,
      "heapTotalMB": 128,
      "rssMB": 180
    },
    "nodeVersion": "v22.13.0"
  }
}
```

### `GET /admin/system/webhooks`

**Auth:** `requireAdminTier(["super_admin"])`

Last N webhook deliveries.

**Query Params:** `limit` (default: 100)

**Response** `200 OK`

```json
{ "data": [] }
```

### `GET /admin/system/crons`

**Auth:** `requireAdminTier(["super_admin"])`

Cron job execution history.

**Query Params:** `limit` (default: 50)

**Response** `200 OK`

```json
{ "data": [] }
```

---

## Enums & Constants

### Service Types

| Value | Description |
|-------|-------------|
| `installation` | New equipment installation |
| `repair` | Equipment repair |
| `maintenance` | Preventive maintenance |
| `inspection` | System inspection |
| `emergency` | Emergency service call |
| `consultation` | Consultation / estimate visit |
| `other` | Other service type |

### Job Priority

| Value | Description |
|-------|-------------|
| `standard` | Normal priority (default) |
| `urgent` | Urgent -- needs prompt attention |
| `emergency` | Emergency -- immediate response |

### Invoice Status

| Value | Description |
|-------|-------------|
| `draft` | Not yet sent to customer |
| `sent` | Sent to customer, awaiting payment |
| `paid` | Fully paid |
| `partially_paid` | Partial payment received |
| `overdue` | Past due date, unpaid |
| `void` | Cancelled / voided |

### Quote Status

| Value | Description |
|-------|-------------|
| `draft` | Not yet sent to customer |
| `sent` | Sent to customer, awaiting response |
| `accepted` | Customer accepted the quote |
| `declined` | Customer declined the quote |
| `expired` | Past expiry date without response |

### Booking Status

| Value | Description |
|-------|-------------|
| `pending` | New booking, not yet confirmed |
| `confirmed` | Booking confirmed |
| `cancelled` | Booking cancelled |
| `completed` | Booking completed |

### Service Frequency

| Value | Description |
|-------|-------------|
| `weekly` | Every week |
| `biweekly` | Every two weeks |
| `monthly` | Every month |
| `quarterly` | Every three months |
| `semi_annual` | Every six months |
| `annual` | Once per year |

### Refrigerant Action

| Value | Description |
|-------|-------------|
| `added` | Refrigerant added to system |
| `recovered` | Refrigerant recovered from system |
| `recycled` | Refrigerant recycled |

### Item Types

| Value | Description |
|-------|-------------|
| `labor` | Labor charge |
| `part` | Replacement part |
| `material` | Consumable material |
| `service_call` | Service call fee |
| `other` | Miscellaneous |

### Payment Methods

| Value | Description |
|-------|-------------|
| `cash` | Cash payment |
| `check` | Check payment |
| `credit_card` | Credit/debit card |
| `bank_transfer` | Bank transfer / ACH |
| `other` | Other payment method |

### Subscription Status

| Value | Description |
|-------|-------------|
| `trialing` | Free trial period |
| `active` | Active subscription |
| `paused` | Subscription paused |
| `past_due` | Payment past due |
| `cancelled` | Subscription cancelled |
| `expired` | Subscription expired |

### Admin Tier

| Value | Description |
|-------|-------------|
| `super_admin` | Full access to all admin features |
| `support` | Can impersonate, extend trials, view analytics, search — cannot delete or override billing |
| `billing_admin` | Can override subscriptions, view analytics, affiliates — cannot impersonate |

### Platform Event Types

| Value | Description |
|-------|-------------|
| `login` | User logged in |
| `job_created` | Job was created |
| `invoice_sent` | Invoice was sent |
| `booking_received` | Booking was received |
| `customer_created` | Customer was created |

---

## Error Handling

All errors follow a consistent format:

### Error Response Shape

```json
{
  "error": "Human-readable error message"
}
```

### HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | OK | Successful read/update/delete |
| `201` | Created | Successful resource creation |
| `204` | No Content | Successful deletion (some endpoints) |
| `400` | Bad Request | Validation error, invalid state transition |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | No tenant initialized, insufficient role |
| `404` | Not Found | Resource doesn't exist or wrong tenant |
| `409` | Conflict | Duplicate resource (unique constraint) |
| `500` | Internal Server Error | Unexpected server error |

### Common Error Examples

**401 Unauthorized:**

```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**

```json
{
  "error": "No active organization. Please create or join an organization first."
}
```

**404 Not Found:**

```json
{
  "error": "Customer not found"
}
```

**400 Validation Error:**

```json
{
  "error": "firstName is required"
}
```

**400 Invalid State:**

```json
{
  "error": "Only sent quotes can be accepted"
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authenticated endpoints:** 100 requests per minute per user
- **Public endpoints:** 20 requests per minute per IP
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

---

## Swagger / OpenAPI

Interactive API documentation is available at:

```
GET /docs
```

This provides a Swagger UI interface for testing endpoints directly in the browser (development only).
