# Zaxvio CRM - API Documentation

**Base URL:** `http://localhost:4000` (development) | `https://api.zaxvio.com` (production)

**Version:** 1.0.0

**Content-Type:** `application/json`

---

## Table of Contents

- [Authentication](#authentication)
- [Common Patterns](#common-patterns)
- [Health Check](#health-check)
- [Auth](#auth-endpoints)
- [Tenants](#tenants)
- [Dashboard](#dashboard)
- [Customers](#customers)
- [Customer Notes](#customer-notes)
- [Customer Activities](#customer-activities)
- [Customer Tags](#customer-tags)
- [Tags](#tags)
- [Jobs](#jobs)
- [Job Line Items](#job-line-items)
- [Job Checklist](#job-checklist)
- [Job Photos](#job-photos)
- [Job Activities](#job-activities)
- [Quotes](#quotes)
- [Quote Line Items](#quote-line-items)
- [Quote Activities](#quote-activities)
- [Invoices](#invoices)
- [Invoice Line Items](#invoice-line-items)
- [Invoice Payments](#invoice-payments)
- [Catalog](#service-catalog)
- [Checklists](#checklist-templates)
- [Pipelines](#pipelines)
- [Pipeline Stages](#pipeline-stages)
- [Bookings (Internal)](#bookings-internal)
- [Availability / Schedule](#availability--schedule)
- [Public Booking Portal](#public-booking-portal)
- [Equipment (Assets)](#equipment-assets)
- [Refrigerant Logs](#refrigerant-logs)
- [Equipment Service History](#equipment-service-history)
- [Service Agreements (Maintenance Contracts)](#service-agreements-maintenance-contracts)
- [Conversations](#conversations)
- [Reports](#reports)
- [Admin Panel](#admin-panel)
- [Enums & Constants](#enums--constants)
- [Error Handling](#error-handling)

---

## Authentication

All API requests (except [public](#public-booking-portal) and [health](#health-check) endpoints) require authentication via Better Auth session tokens.

### Headers

```
Authorization: Bearer <session_token>
Cookie: better-auth.session_token=<token>
```

### Middleware Layers

| Middleware | Description |
|-----------|-------------|
| `requireAuth` | Validates session. Returns `401` if not authenticated. |
| `requireTenant` | Extends `requireAuth`. Resolves active organization to tenant. Returns `403` if no tenant initialized. |
| `requireAdmin` | Extends `requireAuth`. Validates `role === "admin"`. Returns `403` if not admin. |

### Session Object

Every authenticated request injects the following into the request context:

```json
{
  "userId": "usr_abc123",
  "email": "john@example.com",
  "name": "John Smith",
  "role": "user",
  "activeOrganizationId": "org_xyz789",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Common Patterns

### Pagination

All list endpoints support standard pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (1-indexed) |
| `limit` | integer | `20` | Items per page (max: 100) |

**Response shape:**

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

### Sorting

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sortBy` | string | `"createdAt"` | Field to sort by (varies per endpoint) |
| `sortOrder` | string | `"desc"` | `"asc"` or `"desc"` |

### Search

Most list endpoints accept a `search` query parameter that performs case-insensitive partial matching across relevant fields.

### Monetary Values

All monetary fields (`subtotal`, `taxAmount`, `totalAmount`, `unitPrice`, etc.) are returned as **string** representations of `numeric(10,2)` values (e.g., `"1250.00"`). This preserves decimal precision.

### Timestamps

All timestamps are ISO 8601 format in UTC: `"2026-03-28T14:30:00.000Z"`

---

## Health Check

### `GET /health`

**Auth:** None

Returns server health status.

**Response** `200 OK`

```json
{
  "status": "ok",
  "timestamp": "2026-03-28T14:30:00.000Z"
}
```

---

## Auth Endpoints

Authentication is handled by [Better Auth](https://www.better-auth.com/). All auth routes are mounted at `/api/auth/*`.

### `POST /api/auth/sign-up/email`

Create a new account with email and password.

**Request Body:**

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response** `200 OK`

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Smith",
    "email": "john@example.com",
    "emailVerified": false,
    "role": "user",
    "createdAt": "2026-03-28T14:30:00.000Z"
  },
  "session": {
    "id": "ses_xyz789",
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-04-28T14:30:00.000Z"
  }
}
```

### `POST /api/auth/sign-in/email`

Sign in with email and password.

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response** `200 OK`

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Smith",
    "email": "john@example.com",
    "role": "user"
  },
  "session": {
    "id": "ses_xyz789",
    "token": "eyJhbGciOi...",
    "expiresAt": "2026-04-28T14:30:00.000Z"
  }
}
```

### `POST /api/auth/sign-out`

Sign out and invalidate the current session.

**Response** `200 OK`

```json
{
  "success": true
}
```

### `GET /api/auth/get-session`

Get the current authenticated session.

**Response** `200 OK`

```json
{
  "user": {
    "id": "usr_abc123",
    "name": "John Smith",
    "email": "john@example.com",
    "role": "user"
  },
  "session": {
    "id": "ses_xyz789",
    "expiresAt": "2026-04-28T14:30:00.000Z",
    "activeOrganizationId": "org_xyz789"
  }
}
```

---

## Tenants

Tenant management for the current authenticated organization.

### `POST /tenants/initialize`

**Auth:** `requireAuth`

Initialize a new tenant for the current organization. Idempotent -- safe to call multiple times. Creates tenant record, subscription (trial), default pipeline stages, and default availability schedule (Mon-Fri 8am-5pm).

**Request Body:** None

**Response** `201 Created` (first call) / `200 OK` (already exists)

```json
{
  "message": "Tenant initialized successfully",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /tenants/current`

**Auth:** `requireTenant`

Get the current tenant's business information.

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "organizationId": "org_xyz789",
    "businessName": "Smith HVAC Services",
    "ownerName": "John Smith",
    "email": "john@smithhvac.com",
    "phone": "(512) 555-0100",
    "slug": "smith-hvac-services",
    "address": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "logoUrl": null,
    "googleReviewUrl": "https://g.page/r/smith-hvac/review",
    "timezone": "America/Chicago",
    "defaultTaxRate": "8.25",
    "licenseNumber": "TACLA12345",
    "invoicePaymentTerms": "Net 30",
    "invoicePaymentInstructions": "Pay via check or bank transfer",
    "invoiceTermsConditions": "All work guaranteed for 1 year...",
    "invoiceFooterMessage": "Thank you for your business!",
    "quoteTermsConditions": "Quote valid for 30 days...",
    "quoteFooterMessage": "We look forward to working with you!",
    "createdAt": "2026-01-15T10:00:00.000Z",
    "updatedAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `PATCH /tenants/current`

**Auth:** `requireTenant`

Update the current tenant's business settings.

**Request Body** (all fields optional):

```json
{
  "businessName": "Smith HVAC Pro",
  "ownerName": "John Smith",
  "email": "contact@smithhvac.com",
  "phone": "(512) 555-0100",
  "address": "456 Oak Ave",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78702",
  "defaultTaxRate": "8.25",
  "googleReviewUrl": "https://g.page/r/smith-hvac/review",
  "timezone": "America/Chicago",
  "licenseNumber": "TACLA12345",
  "invoicePaymentTerms": "Net 30",
  "invoicePaymentInstructions": "Pay via Zelle or check",
  "invoiceTermsConditions": "All work guaranteed...",
  "invoiceFooterMessage": "Thank you!",
  "quoteTermsConditions": "Quote valid for 30 days...",
  "quoteFooterMessage": "We look forward to working with you!"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "businessName": "Smith HVAC Pro",
    "...": "...updated fields..."
  }
}
```

---

## Dashboard

### `GET /dashboard/stats`

**Auth:** `requireTenant`

Returns all KPI metrics, charts, and activity data in a single response. Powers the main dashboard page.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | string (ISO date) | First day of current month | Period start |
| `to` | string (ISO date) | Last day of current month | Period end |

**Response** `200 OK`

```json
{
  "data": {
    "jobsToday": {
      "count": 5,
      "emergencyCount": 1,
      "yesterdayCount": 3
    },
    "openInvoices": {
      "count": 12,
      "previousCount": 8
    },
    "outstandingBalance": {
      "amount": "15420.00",
      "previousAmount": "12300.00"
    },
    "thisMonthRevenue": {
      "amount": "28500.00",
      "previousAmount": "24100.00"
    },
    "activeCustomers": {
      "count": 47
    },
    "upcomingBookings": {
      "count": 6
    },
    "overdueInvoices": {
      "count": 3,
      "totalAmount": "4200.00"
    },
    "jobPipeline": [
      { "stageName": "scheduled", "stageLabel": "Scheduled", "stageColor": "blue", "count": 8 },
      { "stageName": "in_progress", "stageLabel": "In Progress", "stageColor": "amber", "count": 3 },
      { "stageName": "completed", "stageLabel": "Completed", "stageColor": "green", "count": 42 }
    ],
    "revenueTrend": [
      { "month": "2025-10", "monthLabel": "Oct", "amount": "22000.00" },
      { "month": "2025-11", "monthLabel": "Nov", "amount": "19500.00" },
      { "month": "2025-12", "monthLabel": "Dec", "amount": "15000.00" },
      { "month": "2026-01", "monthLabel": "Jan", "amount": "21000.00" },
      { "month": "2026-02", "monthLabel": "Feb", "amount": "24100.00" },
      { "month": "2026-03", "monthLabel": "Mar", "amount": "28500.00" }
    ],
    "recentActivity": [
      {
        "id": "act_001",
        "type": "job",
        "action": "created",
        "description": "Job JOB-2026-0045 created for AC Repair",
        "entityId": "job_abc123",
        "entityLabel": "JOB-2026-0045",
        "createdAt": "2026-03-28T13:00:00.000Z"
      }
    ],
    "todaySchedule": [
      {
        "id": "job_abc123",
        "jobNumber": "JOB-2026-0045",
        "customerName": "Jane Doe",
        "scheduledStart": "09:00",
        "scheduledEnd": "11:00",
        "status": "scheduled",
        "priority": "standard",
        "serviceType": "repair"
      }
    ],
    "invoiceAging": {
      "current": { "count": 5, "amount": "6200.00" },
      "thirtyDays": { "count": 4, "amount": "5020.00" },
      "sixtyDays": { "count": 2, "amount": "2800.00" },
      "ninetyPlus": { "count": 1, "amount": "1400.00" }
    },
    "quoteSummary": {
      "totalQuotes": 24,
      "accepted": 16,
      "declined": 3,
      "pending": 5,
      "conversionRate": 66.7
    },
    "weeklyJobVolume": [
      { "day": "Mon", "value": 4 },
      { "day": "Tue", "value": 6 },
      { "day": "Wed", "value": 5 },
      { "day": "Thu", "value": 3 },
      { "day": "Fri", "value": 7 },
      { "day": "Sat", "value": 2 },
      { "day": "Sun", "value": 0 }
    ],
    "weeklyRevenue": [
      { "day": "Mon", "value": "3200.00" },
      { "day": "Tue", "value": "4800.00" },
      { "day": "Wed", "value": "3900.00" },
      { "day": "Thu", "value": "2100.00" },
      { "day": "Fri", "value": "5600.00" },
      { "day": "Sat", "value": "1200.00" },
      { "day": "Sun", "value": "0.00" }
    ]
  }
}
```

---

## Customers

### `GET /customers`

**Auth:** `requireTenant`

List customers with search, filtering, and pagination.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches firstName, lastName, email, phone |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `firstName`, `lastName`, `email` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "cust_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane.doe@email.com",
      "phone": "(512) 555-0200",
      "address": "789 Elm St",
      "city": "Austin",
      "state": "TX",
      "zipCode": "78703",
      "notes": "Prefers morning appointments",
      "createdAt": "2026-02-10T09:00:00.000Z",
      "updatedAt": "2026-03-15T11:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

### `POST /customers`

**Auth:** `requireTenant`

Create a new customer. Automatically logs a `customer.created` activity.

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@email.com",
  "phone": "(512) 555-0200",
  "address": "789 Elm St",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78703",
  "notes": "Prefers morning appointments"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `firstName` | string | Yes | Customer first name |
| `lastName` | string | Yes | Customer last name |
| `email` | string | No | Email address |
| `phone` | string | No | Phone number |
| `address` | string | No | Street address |
| `city` | string | No | City |
| `state` | string | No | State (e.g., "TX") |
| `zipCode` | string | No | ZIP code |
| `notes` | string | No | Internal notes |

**Response** `201 Created`

```json
{
  "data": {
    "id": "cust_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@email.com",
    "phone": "(512) 555-0200",
    "address": "789 Elm St",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78703",
    "notes": "Prefers morning appointments",
    "createdAt": "2026-03-28T14:30:00.000Z",
    "updatedAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `GET /customers/:id`

**Auth:** `requireTenant`

Get a single customer by ID.

**Response** `200 OK`

```json
{
  "data": {
    "id": "cust_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane.doe@email.com",
    "phone": "(512) 555-0200",
    "address": "789 Elm St",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78703",
    "notes": "Prefers morning appointments",
    "createdAt": "2026-02-10T09:00:00.000Z",
    "updatedAt": "2026-03-15T11:30:00.000Z"
  }
}
```

### `PATCH /customers/:id`

**Auth:** `requireTenant`

Update a customer. Only provided fields are updated. Logs a `customer.updated` activity with changed fields in metadata.

**Request Body** (all fields optional):

```json
{
  "phone": "(512) 555-0300",
  "address": "100 New Street"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "cust_001",
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "(512) 555-0300",
    "address": "100 New Street",
    "...": "...other fields..."
  }
}
```

### `DELETE /customers/:id`

**Auth:** `requireTenant`

Permanently delete a customer. Cascades to all related records (jobs, invoices, notes, tags, etc.).

**Response** `200 OK`

```json
{
  "message": "Customer deleted"
}
```

---

## Customer Notes

Sub-resource under `/customers/:id/notes`.

### `GET /customers/:id/notes`

**Auth:** `requireTenant`

List notes for a customer, newest first. Includes the author's name via join.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `page` | integer | `1` |
| `limit` | integer | `20` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "note_001",
      "customerId": "cust_001",
      "content": "Customer called about AC making a grinding noise. Scheduled inspection for next week.",
      "createdBy": "usr_abc123",
      "authorName": "John Smith",
      "createdAt": "2026-03-28T10:15:00.000Z",
      "updatedAt": "2026-03-28T10:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### `POST /customers/:id/notes`

**Auth:** `requireTenant`

Add a note to a customer. Logs a `note.created` activity.

**Request Body:**

```json
{
  "content": "Customer called about AC making a grinding noise."
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "note_001",
    "customerId": "cust_001",
    "content": "Customer called about AC making a grinding noise.",
    "createdBy": "usr_abc123",
    "createdAt": "2026-03-28T10:15:00.000Z",
    "updatedAt": "2026-03-28T10:15:00.000Z"
  }
}
```

### `PATCH /customers/:id/notes/:noteId`

**Auth:** `requireTenant`

Update a customer note.

**Request Body:**

```json
{
  "content": "Updated note content here."
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "note_001",
    "content": "Updated note content here.",
    "updatedAt": "2026-03-28T15:00:00.000Z"
  }
}
```

### `DELETE /customers/:id/notes/:noteId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Note deleted"
}
```

---

## Customer Activities

Automatic activity timeline for customer-related events.

### `GET /customers/:id/activities`

**Auth:** `requireTenant`

List customer activities (newest first). Activities are auto-generated by the system.

**Query Parameters:**

| Parameter | Type | Default |
|-----------|------|---------|
| `page` | integer | `1` |
| `limit` | integer | `20` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "act_001",
      "customerId": "cust_001",
      "type": "customer.updated",
      "description": "Customer information updated",
      "metadata": {
        "changedFields": ["phone", "address"]
      },
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-28T14:30:00.000Z"
    },
    {
      "id": "act_002",
      "customerId": "cust_001",
      "type": "note.created",
      "description": "Note added to customer",
      "metadata": null,
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-28T10:15:00.000Z"
    },
    {
      "id": "act_003",
      "customerId": "cust_001",
      "type": "customer.created",
      "description": "Customer created",
      "metadata": null,
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-02-10T09:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

---

## Customer Tags

Assign and manage tags on customers.

### `GET /customers/:id/tags`

**Auth:** `requireTenant`

Get all tags assigned to a customer.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "tag_001",
      "name": "VIP",
      "color": "#f59e0b",
      "assignedAt": "2026-03-20T08:00:00.000Z"
    },
    {
      "id": "tag_002",
      "name": "Maintenance Contract",
      "color": "#10b981",
      "assignedAt": "2026-03-22T09:30:00.000Z"
    }
  ]
}
```

### `POST /customers/:id/tags`

**Auth:** `requireTenant`

Assign a tag to a customer. Duplicates are silently ignored.

**Request Body:**

```json
{
  "tagId": "tag_001"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "ct_001",
    "customerId": "cust_001",
    "tagId": "tag_001",
    "createdAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `DELETE /customers/:id/tags/:tagId`

**Auth:** `requireTenant`

Remove a tag from a customer.

**Response** `200 OK`

```json
{
  "message": "Tag removed"
}
```

---

## Tags

Manage tenant-level reusable tags.

### `GET /tags`

**Auth:** `requireTenant`

List all tags for the tenant, sorted alphabetically.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "tag_002",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Maintenance Contract",
      "color": "#10b981",
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-02-01T10:00:00.000Z"
    },
    {
      "id": "tag_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "VIP",
      "color": "#f59e0b",
      "createdAt": "2026-01-20T09:00:00.000Z",
      "updatedAt": "2026-01-20T09:00:00.000Z"
    }
  ]
}
```

### `POST /tags`

**Auth:** `requireTenant`

Create a new tag.

**Request Body:**

```json
{
  "name": "Emergency Priority",
  "color": "#ef4444"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tag name (unique per tenant) |
| `color` | string | No | Hex color code |

**Response** `201 Created`

```json
{
  "data": {
    "id": "tag_003",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Emergency Priority",
    "color": "#ef4444",
    "createdAt": "2026-03-28T14:30:00.000Z",
    "updatedAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `PATCH /tags/:id`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "name": "Priority Customer",
  "color": "#dc2626"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "tag_003",
    "name": "Priority Customer",
    "color": "#dc2626",
    "updatedAt": "2026-03-28T15:00:00.000Z"
  }
}
```

### `DELETE /tags/:id`

**Auth:** `requireTenant`

Delete a tag. Automatically removes all customer-tag associations.

**Response** `200 OK`

```json
{
  "message": "Tag deleted"
}
```

---

