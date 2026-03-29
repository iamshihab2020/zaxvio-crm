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
- [Pipeline Stages](#pipeline-stages)
- [Bookings (Internal)](#bookings-internal)
- [Availability / Schedule](#availability--schedule)
- [Public Booking Portal](#public-booking-portal)
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

## Jobs

Job management with Kanban pipeline support.

### `GET /jobs`

**Auth:** `requireTenant`

List jobs with rich filtering and pagination.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches jobNumber, title, description, customer name |
| `status` | string | - | Pipeline stage name (e.g., `"scheduled"`, `"in_progress"`) |
| `customerId` | uuid | - | Filter by customer |
| `serviceType` | string | - | See [Service Types](#enums--constants) |
| `priority` | string | - | `standard`, `urgent`, `emergency` |
| `dateFrom` | string | - | ISO date (scheduledDate >=) |
| `dateTo` | string | - | ISO date (scheduledDate <=) |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"scheduledDate"` | `scheduledDate`, `createdAt`, `jobNumber`, `status`, `priority`, `totalAmount` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "job_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "bookingId": null,
      "jobNumber": "JOB-2026-0045",
      "status": "scheduled",
      "priority": "standard",
      "serviceType": "repair",
      "title": "AC Unit Not Cooling",
      "description": "Customer reports AC blowing warm air. Possible refrigerant leak.",
      "scheduledDate": "2026-03-29",
      "scheduledStart": "09:00",
      "scheduledEnd": "11:00",
      "address": "789 Elm St, Austin, TX 78703",
      "subtotal": "450.00",
      "taxRate": "0.0825",
      "taxAmount": "37.13",
      "totalAmount": "487.13",
      "notes": "Bring refrigerant recovery equipment",
      "completedAt": null,
      "createdAt": "2026-03-28T14:00:00.000Z",
      "updatedAt": "2026-03-28T14:00:00.000Z",
      "customerFirstName": "Jane",
      "customerLastName": "Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### `POST /jobs`

**Auth:** `requireTenant`

Create a new job. Auto-generates `jobNumber` (format: `JOB-YYYY-XXXX`). Automatically attaches a matching checklist template if one exists for the service type. Logs a `job.created` activity.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "serviceType": "repair",
  "title": "AC Unit Not Cooling",
  "description": "Customer reports AC blowing warm air.",
  "scheduledDate": "2026-03-29",
  "scheduledStart": "09:00",
  "scheduledEnd": "11:00",
  "address": "789 Elm St, Austin, TX 78703",
  "priority": "standard",
  "taxRate": "8.25",
  "notes": "Bring refrigerant recovery equipment",
  "lineItems": [
    {
      "catalogItemId": "cat_001",
      "description": "Diagnostic Service Call",
      "quantity": 1,
      "unitPrice": "95.00",
      "itemType": "service_call"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | uuid | Yes | Customer ID |
| `serviceType` | string | Yes | See [Service Types](#enums--constants) |
| `title` | string | Yes | Job title |
| `scheduledDate` | string | Yes | `YYYY-MM-DD` |
| `description` | string | No | Detailed description |
| `scheduledStart` | string | No | `HH:MM` format |
| `scheduledEnd` | string | No | `HH:MM` format |
| `address` | string | No | Job site address |
| `priority` | string | No | `standard` (default), `urgent`, `emergency` |
| `taxRate` | string | No | Tax rate percentage |
| `notes` | string | No | Internal notes |
| `lineItems` | array | No | Initial line items |

**Response** `201 Created`

```json
{
  "data": {
    "id": "job_001",
    "jobNumber": "JOB-2026-0045",
    "status": "scheduled",
    "...": "...all job fields..."
  }
}
```

### `GET /jobs/:id`

**Auth:** `requireTenant`

Get a single job with line items, checklist, and photo count.

**Response** `200 OK`

```json
{
  "data": {
    "id": "job_001",
    "jobNumber": "JOB-2026-0045",
    "status": "scheduled",
    "priority": "standard",
    "serviceType": "repair",
    "title": "AC Unit Not Cooling",
    "description": "Customer reports AC blowing warm air.",
    "scheduledDate": "2026-03-29",
    "scheduledStart": "09:00",
    "scheduledEnd": "11:00",
    "address": "789 Elm St, Austin, TX 78703",
    "subtotal": "450.00",
    "taxRate": "0.0825",
    "taxAmount": "37.13",
    "totalAmount": "487.13",
    "notes": "Bring refrigerant recovery equipment",
    "completedAt": null,
    "customerFirstName": "Jane",
    "customerLastName": "Doe",
    "lineItems": [
      {
        "id": "li_001",
        "jobId": "job_001",
        "catalogItemId": "cat_001",
        "itemType": "service_call",
        "description": "Diagnostic Service Call",
        "quantity": "1.00",
        "unitPrice": "95.00",
        "total": "95.00",
        "sortOrder": 0
      },
      {
        "id": "li_002",
        "jobId": "job_001",
        "catalogItemId": "cat_005",
        "itemType": "labor",
        "description": "Refrigerant Recharge - R410A",
        "quantity": "1.00",
        "unitPrice": "355.00",
        "total": "355.00",
        "sortOrder": 1
      }
    ],
    "checklist": [
      {
        "id": "jcc_001",
        "checklistItemId": "ci_001",
        "isCompleted": true,
        "completedBy": "usr_abc123",
        "completedAt": "2026-03-29T10:15:00.000Z",
        "label": "Check thermostat settings",
        "isRequired": true,
        "catalogItemId": null,
        "sortOrder": 0,
        "catalogItemName": null,
        "catalogItemPrice": null
      },
      {
        "id": "jcc_002",
        "checklistItemId": "ci_002",
        "isCompleted": false,
        "completedBy": null,
        "completedAt": null,
        "label": "Inspect refrigerant levels",
        "isRequired": true,
        "catalogItemId": "cat_005",
        "sortOrder": 1,
        "catalogItemName": "Refrigerant Recharge - R410A",
        "catalogItemPrice": "355.00"
      }
    ],
    "photoCount": 3
  }
}
```

### `PATCH /jobs/:id`

**Auth:** `requireTenant`

Update job fields. Automatically recalculates totals if line-item-affecting fields change. Logs a `job.updated` activity.

**Request Body** (all fields optional):

```json
{
  "status": "in_progress",
  "priority": "urgent",
  "scheduledDate": "2026-03-30",
  "notes": "Customer confirmed morning availability"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "job_001",
    "status": "in_progress",
    "...": "...updated fields..."
  }
}
```

### `DELETE /jobs/:id`

**Auth:** `requireTenant`

Permanently delete a job and all related records (line items, checklist completions, photos, activities).

**Response** `200 OK`

```json
{
  "message": "Job deleted"
}
```

---

## Job Line Items

Sub-resource under `/jobs/:id/line-items`. All operations automatically recalculate job totals (subtotal, tax, total).

### `POST /jobs/:id/line-items`

**Auth:** `requireTenant`

Add a line item to a job.

**Request Body:**

```json
{
  "catalogItemId": "cat_003",
  "itemType": "part",
  "description": "Capacitor - 45/5 MFD",
  "quantity": 1,
  "unitPrice": "45.00",
  "sortOrder": 2
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | Yes | Line item description |
| `quantity` | number | Yes | Quantity |
| `unitPrice` | string | Yes | Unit price |
| `itemType` | string | Yes | See [Item Types](#enums--constants) |
| `catalogItemId` | uuid | No | Link to catalog item |
| `sortOrder` | integer | No | Display order |

**Response** `201 Created`

```json
{
  "data": {
    "id": "li_003",
    "jobId": "job_001",
    "catalogItemId": "cat_003",
    "itemType": "part",
    "description": "Capacitor - 45/5 MFD",
    "quantity": "1.00",
    "unitPrice": "45.00",
    "total": "45.00",
    "sortOrder": 2,
    "createdAt": "2026-03-28T15:00:00.000Z"
  }
}
```

### `PATCH /jobs/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

Update a line item. `total` is auto-calculated (`quantity * unitPrice`).

**Request Body:**

```json
{
  "quantity": 2,
  "unitPrice": "45.00"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "li_003",
    "quantity": "2.00",
    "unitPrice": "45.00",
    "total": "90.00"
  }
}
```

### `DELETE /jobs/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Line item deleted"
}
```

---

## Job Checklist

Sub-resource for managing checklist completions on a job.

### `PATCH /jobs/:id/checklist/:completionId`

**Auth:** `requireTenant`

Toggle a checklist item's completion status. When a checklist item linked to a catalog item is completed, the corresponding line item is automatically added to the job.

**Request Body:**

```json
{
  "isCompleted": true
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "jcc_002",
    "jobId": "job_001",
    "checklistItemId": "ci_002",
    "isCompleted": true,
    "completedBy": "usr_abc123",
    "completedAt": "2026-03-29T10:30:00.000Z"
  }
}
```

---

## Job Photos

Sub-resource for managing photos attached to a job (stored in Supabase Storage).

### `GET /jobs/:id/photos`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "photo_001",
      "jobId": "job_001",
      "storagePath": "tenants/550e8400/jobs/job_001/photo1.jpg",
      "caption": "Compressor unit before repair",
      "takenAt": "2026-03-29T10:00:00.000Z",
      "createdAt": "2026-03-29T10:05:00.000Z"
    }
  ]
}
```

### `POST /jobs/:id/photos`

**Auth:** `requireTenant`

Register a photo (after uploading to Supabase Storage).

**Request Body:**

```json
{
  "storagePath": "tenants/550e8400/jobs/job_001/photo1.jpg",
  "caption": "Compressor unit before repair",
  "takenAt": "2026-03-29T10:00:00.000Z"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "photo_001",
    "jobId": "job_001",
    "storagePath": "tenants/550e8400/jobs/job_001/photo1.jpg",
    "caption": "Compressor unit before repair",
    "createdAt": "2026-03-29T10:05:00.000Z"
  }
}
```

### `DELETE /jobs/:id/photos/:photoId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Photo deleted"
}
```

---

## Job Activities

### `GET /jobs/:id/activities`

**Auth:** `requireTenant`

Get the activity timeline for a job.

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
      "id": "jact_001",
      "jobId": "job_001",
      "type": "job.status_changed",
      "description": "Status changed from scheduled to in_progress",
      "metadata": {
        "previousStatus": "scheduled",
        "newStatus": "in_progress"
      },
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-29T09:00:00.000Z"
    },
    {
      "id": "jact_002",
      "jobId": "job_001",
      "type": "job.created",
      "description": "Job created",
      "metadata": null,
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-28T14:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## Quotes

Quote builder with PDF generation and quote-to-job conversion.

### `GET /quotes`

**Auth:** `requireTenant`

List quotes with filtering and pagination. Automatically expires sent quotes past their expiry date.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches quoteNumber, notes, customer name |
| `status` | string | - | `draft`, `sent`, `accepted`, `declined`, `expired` |
| `customerId` | uuid | - | Filter by customer |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `issuedDate`, `expiryDate`, `quoteNumber`, `status`, `totalAmount` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "qt_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "quoteNumber": "QT-2026-0012",
      "status": "sent",
      "issuedDate": "2026-03-25",
      "expiryDate": "2026-04-25",
      "subtotal": "1850.00",
      "taxRate": "0.0825",
      "taxAmount": "152.63",
      "discountAmount": "0.00",
      "totalAmount": "2002.63",
      "notes": "Includes 1-year warranty on all parts",
      "pdfStoragePath": "tenants/550e8400/quotes/QT-2026-0012.pdf",
      "convertedToJobId": null,
      "createdAt": "2026-03-25T08:00:00.000Z",
      "updatedAt": "2026-03-25T09:30:00.000Z",
      "customerFirstName": "Jane",
      "customerLastName": "Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 24,
    "totalPages": 2
  }
}
```

### `POST /quotes`

**Auth:** `requireTenant`

Create a new quote. Auto-generates `quoteNumber` (format: `QT-YYYY-XXXX`). Logs a `quote.created` activity.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "issuedDate": "2026-03-28",
  "expiryDate": "2026-04-28",
  "taxRate": "8.25",
  "discountAmount": "50.00",
  "notes": "Includes 1-year warranty on all parts",
  "lineItems": [
    {
      "catalogItemId": "cat_010",
      "description": "New Trane XR15 Heat Pump - 3 Ton",
      "quantity": 1,
      "unitPrice": "1200.00",
      "itemType": "part"
    },
    {
      "description": "Installation Labor (8 hours)",
      "quantity": 8,
      "unitPrice": "85.00",
      "itemType": "labor"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | uuid | Yes | Customer ID |
| `issuedDate` | string | No | `YYYY-MM-DD` (default: today) |
| `expiryDate` | string | No | `YYYY-MM-DD` |
| `taxRate` | number | No | Tax rate percentage |
| `discountAmount` | number | No | Flat discount amount |
| `notes` | string | No | Quote notes (shown on PDF) |
| `lineItems` | array | No | Initial line items |

**Response** `201 Created`

```json
{
  "data": {
    "id": "qt_002",
    "quoteNumber": "QT-2026-0013",
    "status": "draft",
    "totalAmount": "1830.63",
    "...": "...all quote fields..."
  }
}
```

### `GET /quotes/:id`

**Auth:** `requireTenant`

Get a single quote with line items.

**Response** `200 OK`

```json
{
  "data": {
    "id": "qt_001",
    "quoteNumber": "QT-2026-0012",
    "status": "sent",
    "customerId": "cust_001",
    "customerFirstName": "Jane",
    "customerLastName": "Doe",
    "issuedDate": "2026-03-25",
    "expiryDate": "2026-04-25",
    "subtotal": "1850.00",
    "taxRate": "0.0825",
    "taxAmount": "152.63",
    "discountAmount": "0.00",
    "totalAmount": "2002.63",
    "notes": "Includes 1-year warranty on all parts",
    "lineItems": [
      {
        "id": "qli_001",
        "quoteId": "qt_001",
        "catalogItemId": "cat_010",
        "itemType": "part",
        "description": "New Trane XR15 Heat Pump - 3 Ton",
        "quantity": "1.00",
        "unitPrice": "1200.00",
        "total": "1200.00",
        "sortOrder": 0
      },
      {
        "id": "qli_002",
        "quoteId": "qt_001",
        "catalogItemId": null,
        "itemType": "labor",
        "description": "Installation Labor (8 hours)",
        "quantity": "8.00",
        "unitPrice": "85.00",
        "total": "680.00",
        "sortOrder": 1
      }
    ]
  }
}
```

### `PATCH /quotes/:id`

**Auth:** `requireTenant`

Update a quote. Only draft quotes can be modified. Automatically recalculates totals.

**Request Body** (all fields optional):

```json
{
  "taxRate": "8.25",
  "discountAmount": "100.00",
  "expiryDate": "2026-05-01",
  "notes": "Updated terms"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "qt_001",
    "totalAmount": "1902.63",
    "...": "...updated fields..."
  }
}
```

### `DELETE /quotes/:id`

**Auth:** `requireTenant`

Delete a quote. Only draft quotes can be deleted.

**Response** `200 OK`

```json
{
  "message": "Quote deleted"
}
```

### `POST /quotes/:id/send`

**Auth:** `requireTenant`

Mark a quote as sent. Generates a PDF and logs `quote.sent` activity.

**Response** `200 OK`

```json
{
  "message": "Quote sent"
}
```

### `GET /quotes/:id/pdf`

**Auth:** `requireTenant`

Download the quote PDF.

**Response** `200 OK` (Content-Type: `application/pdf`)

Returns the PDF binary stream.

### `POST /quotes/:id/accept`

**Auth:** `requireTenant`

Accept a quote. Only quotes with `"sent"` status can be accepted. Logs `quote.accepted` activity.

**Response** `200 OK`

```json
{
  "message": "Quote accepted"
}
```

**Error** `400 Bad Request`

```json
{
  "error": "Only sent quotes can be accepted"
}
```

### `POST /quotes/:id/decline`

**Auth:** `requireTenant`

Decline a quote. Only quotes with `"sent"` status can be declined. Logs `quote.declined` activity.

**Response** `200 OK`

```json
{
  "message": "Quote declined"
}
```

### `POST /quotes/:id/convert`

**Auth:** `requireTenant`

Convert an accepted quote into a job. Copies all line items to the new job, attaches a matching checklist, and logs activities on both the quote and the new job.

**Request Body** (optional):

```json
{
  "pipelineStageId": "stage_001"
}
```

**Response** `201 Created`

```json
{
  "message": "Quote converted to job",
  "jobId": "job_046"
}
```

---

## Quote Line Items

Sub-resource under `/quotes/:id/line-items`. All operations automatically recalculate quote totals.

### `POST /quotes/:id/line-items`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "catalogItemId": "cat_003",
  "itemType": "part",
  "description": "Thermostat - Honeywell T6",
  "quantity": 1,
  "unitPrice": "175.00"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "qli_003",
    "quoteId": "qt_001",
    "description": "Thermostat - Honeywell T6",
    "quantity": "1.00",
    "unitPrice": "175.00",
    "total": "175.00",
    "sortOrder": 2
  }
}
```

### `PATCH /quotes/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "quantity": 2
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "qli_003",
    "quantity": "2.00",
    "total": "350.00"
  }
}
```

### `DELETE /quotes/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Line item deleted"
}
```

---

## Quote Activities

### `GET /quotes/:id/activities`

**Auth:** `requireTenant`

Get the activity timeline for a quote.

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
      "id": "qact_001",
      "quoteId": "qt_001",
      "type": "quote.sent",
      "description": "Quote sent to customer",
      "metadata": null,
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-25T09:30:00.000Z"
    },
    {
      "id": "qact_002",
      "quoteId": "qt_001",
      "type": "quote.created",
      "description": "Quote created",
      "metadata": null,
      "performedBy": "usr_abc123",
      "performerName": "John Smith",
      "createdAt": "2026-03-25T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

## Invoices

Invoice management with payment tracking.

### `GET /invoices`

**Auth:** `requireTenant`

List invoices with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches invoiceNumber, notes, customer name |
| `status` | string | - | `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `void` |
| `customerId` | uuid | - | Filter by customer |
| `jobId` | uuid | - | Filter by linked job |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `issuedDate`, `dueDate`, `invoiceNumber`, `status`, `totalAmount`, `balanceDue` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "inv_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "jobId": "job_001",
      "invoiceNumber": "INV-2026-0032",
      "status": "sent",
      "issuedDate": "2026-03-29",
      "dueDate": "2026-04-28",
      "subtotal": "450.00",
      "taxRate": "0.0825",
      "taxAmount": "37.13",
      "discountAmount": "0.00",
      "totalAmount": "487.13",
      "amountPaid": "0.00",
      "balanceDue": "487.13",
      "notes": "Thank you for choosing Smith HVAC!",
      "pdfStoragePath": "tenants/550e8400/invoices/INV-2026-0032.pdf",
      "createdAt": "2026-03-29T12:00:00.000Z",
      "updatedAt": "2026-03-29T12:00:00.000Z",
      "customerFirstName": "Jane",
      "customerLastName": "Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 32,
    "totalPages": 2
  }
}
```

### `POST /invoices`

**Auth:** `requireTenant`

Create a new invoice. Auto-generates `invoiceNumber` (format: `INV-YYYY-XXXX`). If `jobId` is provided, line items are automatically copied from the job.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "jobId": "job_001",
  "issuedDate": "2026-03-29",
  "dueDate": "2026-04-28",
  "taxRate": "8.25",
  "discountAmount": "0",
  "notes": "Thank you for choosing Smith HVAC!",
  "lineItems": [
    {
      "description": "Diagnostic Service Call",
      "quantity": 1,
      "unitPrice": "95.00",
      "itemType": "service_call"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | uuid | Yes | Customer ID |
| `jobId` | uuid | No | Link to job (auto-copies line items) |
| `invoiceNumber` | string | No | Custom number (auto-generated if omitted) |
| `issuedDate` | string | No | `YYYY-MM-DD` (default: today) |
| `dueDate` | string | No | `YYYY-MM-DD` |
| `taxRate` | number | No | Tax rate percentage |
| `discountAmount` | number | No | Flat discount |
| `notes` | string | No | Invoice notes |
| `lineItems` | array | No | Line items (ignored if jobId copies them) |

**Response** `201 Created`

```json
{
  "data": {
    "id": "inv_002",
    "invoiceNumber": "INV-2026-0033",
    "status": "draft",
    "totalAmount": "487.13",
    "balanceDue": "487.13",
    "...": "...all invoice fields..."
  }
}
```

### `GET /invoices/:id`

**Auth:** `requireTenant`

Get a single invoice with line items and payment history.

**Response** `200 OK`

```json
{
  "data": {
    "id": "inv_001",
    "invoiceNumber": "INV-2026-0032",
    "status": "partially_paid",
    "customerId": "cust_001",
    "customerFirstName": "Jane",
    "customerLastName": "Doe",
    "jobId": "job_001",
    "issuedDate": "2026-03-29",
    "dueDate": "2026-04-28",
    "subtotal": "450.00",
    "taxRate": "0.0825",
    "taxAmount": "37.13",
    "discountAmount": "0.00",
    "totalAmount": "487.13",
    "amountPaid": "200.00",
    "balanceDue": "287.13",
    "lineItems": [
      {
        "id": "ili_001",
        "invoiceId": "inv_001",
        "itemType": "service_call",
        "description": "Diagnostic Service Call",
        "quantity": "1.00",
        "unitPrice": "95.00",
        "total": "95.00",
        "sortOrder": 0
      },
      {
        "id": "ili_002",
        "invoiceId": "inv_001",
        "itemType": "labor",
        "description": "Refrigerant Recharge - R410A",
        "quantity": "1.00",
        "unitPrice": "355.00",
        "total": "355.00",
        "sortOrder": 1
      }
    ],
    "payments": [
      {
        "id": "pay_001",
        "invoiceId": "inv_001",
        "amount": "200.00",
        "paymentMethod": "credit_card",
        "paymentDate": "2026-03-30",
        "referenceNumber": null,
        "notes": "Partial payment",
        "createdAt": "2026-03-30T16:00:00.000Z"
      }
    ]
  }
}
```

### `PATCH /invoices/:id`

**Auth:** `requireTenant`

Update invoice fields. Recalculates totals automatically.

**Request Body** (all fields optional):

```json
{
  "dueDate": "2026-05-15",
  "notes": "Extended payment terms approved"
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "inv_001",
    "dueDate": "2026-05-15",
    "...": "...updated fields..."
  }
}
```

### `DELETE /invoices/:id`

**Auth:** `requireTenant`

Delete an invoice and all related line items and payments.

**Response** `200 OK`

```json
{
  "message": "Invoice deleted"
}
```

---

## Invoice Line Items

Sub-resource under `/invoices/:id/line-items`. All operations automatically recalculate invoice totals and balance due.

### `POST /invoices/:id/line-items`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "itemType": "part",
  "description": "Air Filter - 20x25x1 MERV 13",
  "quantity": 4,
  "unitPrice": "18.50",
  "catalogItemId": "cat_007"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "ili_003",
    "invoiceId": "inv_001",
    "description": "Air Filter - 20x25x1 MERV 13",
    "quantity": "4.00",
    "unitPrice": "18.50",
    "total": "74.00",
    "sortOrder": 2
  }
}
```

### `PATCH /invoices/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

**Response** `200 OK`

### `DELETE /invoices/:id/line-items/:lineItemId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Line item deleted"
}
```

---

## Invoice Payments

### `POST /invoices/:id/payments`

**Auth:** `requireTenant`

Record a payment against an invoice. Automatically updates `amountPaid`, `balanceDue`, and `status` (to `paid` if fully paid, `partially_paid` if partially paid).

**Request Body:**

```json
{
  "amount": "287.13",
  "paymentDate": "2026-04-05",
  "method": "check",
  "notes": "Check #1234"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Payment amount |
| `paymentDate` | string | Yes | `YYYY-MM-DD` |
| `method` | string | No | `cash`, `check`, `credit_card`, `bank_transfer`, `other` |
| `notes` | string | No | Payment notes/reference |

**Response** `201 Created`

```json
{
  "data": {
    "id": "pay_002",
    "invoiceId": "inv_001",
    "amount": "287.13",
    "paymentMethod": "check",
    "paymentDate": "2026-04-05",
    "notes": "Check #1234",
    "createdAt": "2026-04-05T10:00:00.000Z"
  }
}
```

---

## Service Catalog

Manage reusable parts, labor, and service items.

### `GET /catalog`

**Auth:** `requireTenant`

List catalog items with filtering.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches name, category, description |
| `itemType` | string | - | `labor`, `part`, `material`, `service_call`, `other` |
| `showArchived` | boolean | `false` | Include inactive items |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `name`, `unitPrice`, `category`, `itemType` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "cat_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Diagnostic Service Call",
      "itemType": "service_call",
      "unitPrice": "95.00",
      "unit": "each",
      "category": "Service Fees",
      "description": "Standard diagnostic and inspection fee",
      "isActive": true,
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "cat_005",
      "name": "Refrigerant Recharge - R410A",
      "itemType": "material",
      "unitPrice": "355.00",
      "unit": "per lb",
      "category": "Refrigerants",
      "description": "R-410A refrigerant recharge including recovery",
      "isActive": true,
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 28,
    "totalPages": 2
  }
}
```

### `GET /catalog/categories`

**Auth:** `requireTenant`

Get distinct category names for the tenant. Useful for filter dropdowns.

**Response** `200 OK`

```json
{
  "data": [
    "Compressors",
    "Electrical",
    "Filters",
    "Refrigerants",
    "Service Fees",
    "Thermostats"
  ]
}
```

### `GET /catalog/:id`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "data": {
    "id": "cat_001",
    "name": "Diagnostic Service Call",
    "itemType": "service_call",
    "unitPrice": "95.00",
    "unit": "each",
    "category": "Service Fees",
    "description": "Standard diagnostic and inspection fee",
    "isActive": true,
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

### `POST /catalog`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "name": "Capacitor - 45/5 MFD",
  "itemType": "part",
  "unitPrice": "45.00",
  "unit": "each",
  "category": "Electrical",
  "description": "Dual run capacitor for AC compressor"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name |
| `itemType` | string | Yes | `labor`, `part`, `material`, `service_call`, `other` |
| `unitPrice` | number | Yes | Price per unit (>= 0) |
| `unit` | string | No | Unit of measure (default: `"each"`) |
| `category` | string | No | Category name |
| `description` | string | No | Description |

**Response** `201 Created`

```json
{
  "data": {
    "id": "cat_030",
    "name": "Capacitor - 45/5 MFD",
    "itemType": "part",
    "unitPrice": "45.00",
    "unit": "each",
    "category": "Electrical",
    "isActive": true,
    "createdAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `PATCH /catalog/:id`

**Auth:** `requireTenant`

**Request Body** (all fields optional):

```json
{
  "unitPrice": "49.99",
  "isActive": false
}
```

**Response** `200 OK`

```json
{
  "data": {
    "id": "cat_030",
    "unitPrice": "49.99",
    "isActive": false,
    "...": "...other fields..."
  }
}
```

### `DELETE /catalog/:id`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Catalog item deleted"
}
```

---

## Checklist Templates

Manage reusable checklist templates per service type. When a job is created with a matching service type, the checklist is automatically attached.

### `GET /checklists`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `serviceType` | string | - | Filter by service type |
| `showInactive` | boolean | `false` | Include inactive templates |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "tmpl_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "serviceType": "repair",
      "name": "AC Repair Checklist",
      "isActive": true,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "itemCount": 8
    },
    {
      "id": "tmpl_002",
      "serviceType": "maintenance",
      "name": "Seasonal Maintenance Checklist",
      "isActive": true,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "itemCount": 12
    }
  ]
}
```

### `GET /checklists/:id`

**Auth:** `requireTenant`

Get a template with all its items.

**Response** `200 OK`

```json
{
  "data": {
    "id": "tmpl_001",
    "serviceType": "repair",
    "name": "AC Repair Checklist",
    "isActive": true,
    "items": [
      {
        "id": "ci_001",
        "templateId": "tmpl_001",
        "label": "Check thermostat settings",
        "isRequired": true,
        "catalogItemId": null,
        "sortOrder": 0,
        "catalogItemName": null,
        "catalogItemPrice": null
      },
      {
        "id": "ci_002",
        "templateId": "tmpl_001",
        "label": "Inspect refrigerant levels",
        "isRequired": true,
        "catalogItemId": "cat_005",
        "sortOrder": 1,
        "catalogItemName": "Refrigerant Recharge - R410A",
        "catalogItemPrice": "355.00"
      },
      {
        "id": "ci_003",
        "templateId": "tmpl_001",
        "label": "Test capacitor",
        "isRequired": false,
        "catalogItemId": "cat_030",
        "sortOrder": 2,
        "catalogItemName": "Capacitor - 45/5 MFD",
        "catalogItemPrice": "45.00"
      }
    ]
  }
}
```

### `POST /checklists`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "name": "AC Repair Checklist",
  "serviceType": "repair",
  "isActive": true,
  "items": [
    { "label": "Check thermostat settings", "isRequired": true },
    { "label": "Inspect refrigerant levels", "isRequired": true, "catalogItemId": "cat_005" },
    { "label": "Test capacitor", "isRequired": false, "catalogItemId": "cat_030" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name |
| `serviceType` | string | Yes | See [Service Types](#enums--constants) |
| `isActive` | boolean | No | Default: `true` |
| `items` | array | No | Initial checklist items |

**Response** `201 Created`

```json
{
  "data": {
    "id": "tmpl_003",
    "name": "AC Repair Checklist",
    "serviceType": "repair",
    "isActive": true,
    "items": [...]
  }
}
```

### `PATCH /checklists/:id`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "name": "Updated Checklist Name",
  "isActive": false
}
```

**Response** `200 OK`

### `DELETE /checklists/:id`

**Auth:** `requireTenant`

Delete a template and all its items.

**Response** `200 OK`

```json
{
  "message": "Checklist template deleted"
}
```

### Checklist Items

#### `POST /checklists/:id/items`

**Auth:** `requireTenant`

Add an item to a checklist template.

**Request Body:**

```json
{
  "label": "Check condenser coil",
  "isRequired": true,
  "catalogItemId": null,
  "sortOrder": 3
}
```

**Response** `201 Created`

#### `PATCH /checklists/:id/items/:itemId`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "label": "Check and clean condenser coil",
  "isRequired": true
}
```

**Response** `200 OK`

#### `DELETE /checklists/:id/items/:itemId`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "message": "Checklist item deleted"
}
```

---

## Pipeline Stages

Per-tenant custom Kanban pipeline stages for job management.

### `GET /pipeline-stages`

**Auth:** `requireTenant`

List all pipeline stages, sorted by `sortOrder`. Auto-seeds default stages on first access if none exist.

**Default stages:** Scheduled, In Progress, Completed, Cancelled

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "stage_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "scheduled",
      "label": "Scheduled",
      "color": "blue",
      "sortOrder": 0,
      "isDefault": true,
      "jobCount": 8,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "stage_002",
      "name": "in_progress",
      "label": "In Progress",
      "color": "amber",
      "sortOrder": 1,
      "isDefault": true,
      "jobCount": 3,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "stage_003",
      "name": "awaiting_parts",
      "label": "Awaiting Parts",
      "color": "purple",
      "sortOrder": 2,
      "isDefault": false,
      "jobCount": 2,
      "createdAt": "2026-03-01T08:00:00.000Z",
      "updatedAt": "2026-03-01T08:00:00.000Z"
    },
    {
      "id": "stage_004",
      "name": "completed",
      "label": "Completed",
      "color": "green",
      "sortOrder": 3,
      "isDefault": true,
      "jobCount": 42,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```

### `POST /pipeline-stages`

**Auth:** `requireTenant`

Create a custom pipeline stage.

**Request Body:**

```json
{
  "label": "Awaiting Parts",
  "color": "purple"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Display label |
| `color` | string | No | Color key (default: `"gray"`) -- see stage color presets |

**Response** `201 Created`

```json
{
  "data": {
    "id": "stage_003",
    "name": "awaiting_parts",
    "label": "Awaiting Parts",
    "color": "purple",
    "sortOrder": 2,
    "isDefault": false
  }
}
```

### `PATCH /pipeline-stages/reorder`

**Auth:** `requireTenant`

Bulk reorder all stages. Runs in a transaction.

**Request Body:**

```json
{
  "order": ["stage_001", "stage_003", "stage_002", "stage_004"]
}
```

**Response** `200 OK`

```json
{
  "message": "Reordered"
}
```

### `PATCH /pipeline-stages/:id`

**Auth:** `requireTenant`

Update a stage's label or color. If the stage name changes, all jobs in that stage are updated.

**Request Body:**

```json
{
  "label": "Waiting for Parts",
  "color": "amber"
}
```

**Response** `200 OK`

### `DELETE /pipeline-stages/:id`

**Auth:** `requireTenant`

Delete a pipeline stage.

**Validation Rules:**
- Cannot delete if jobs exist in this stage
- At least 1 stage must remain

**Response** `200 OK`

```json
{
  "message": "Stage deleted"
}
```

**Error** `400 Bad Request`

```json
{
  "error": "Cannot delete stage with existing jobs. Move or delete jobs first."
}
```

---

## Bookings (Internal)

Internal booking management for the authenticated tenant.

### `GET /bookings`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches customerName, customerEmail, customerPhone, description |
| `status` | string | - | `pending`, `confirmed`, `cancelled`, `completed` |
| `dateFrom` | string | - | ISO date (bookingDate >=) |
| `dateTo` | string | - | ISO date (bookingDate <=) |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"bookingDate"` | `bookingDate`, `createdAt`, `status` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "bk_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_002",
      "customerName": "Robert Wilson",
      "customerEmail": "robert@email.com",
      "customerPhone": "(512) 555-0300",
      "serviceType": "maintenance",
      "bookingDate": "2026-04-01",
      "preferredTime": "10:00",
      "address": "456 Pine St, Austin, TX 78704",
      "description": "Annual AC tune-up",
      "status": "confirmed",
      "notes": null,
      "convertedToJobId": null,
      "convertedJobNumber": null,
      "convertedJobStatus": null,
      "createdAt": "2026-03-27T15:00:00.000Z",
      "updatedAt": "2026-03-27T16:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 6,
    "totalPages": 1
  }
}
```

### `GET /bookings/:id`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "data": {
    "id": "bk_001",
    "customerName": "Robert Wilson",
    "customerEmail": "robert@email.com",
    "customerPhone": "(512) 555-0300",
    "serviceType": "maintenance",
    "bookingDate": "2026-04-01",
    "preferredTime": "10:00",
    "address": "456 Pine St, Austin, TX 78704",
    "description": "Annual AC tune-up",
    "status": "confirmed",
    "notes": null,
    "convertedToJobId": null
  }
}
```

### `PATCH /bookings/:id`

**Auth:** `requireTenant`

Update a booking. Cannot modify cancelled or completed bookings.

**Request Body:**

```json
{
  "status": "confirmed",
  "notes": "Customer confirmed via phone"
}
```

**Response** `200 OK`

**Error** `400 Bad Request`

```json
{
  "error": "Cannot modify cancelled or completed bookings"
}
```

### `POST /bookings/:id/convert-to-job`

**Auth:** `requireTenant`

Convert a booking into a job. Creates or links the customer, attaches a matching checklist template, logs activities.

**Request Body** (optional):

```json
{
  "pipelineStageId": "stage_001"
}
```

**Response** `201 Created`

```json
{
  "message": "Booking converted to job",
  "jobId": "job_047"
}
```

---

## Availability / Schedule

Manage weekly availability and date-specific overrides for the booking portal.

### `GET /availability`

**Auth:** `requireTenant`

Get the tenant's weekly schedule and upcoming overrides. Lazy-seeds Mon-Fri 8am-5pm defaults if no schedule exists.

**Response** `200 OK`

```json
{
  "data": {
    "weeklySchedule": [
      { "id": "sched_0", "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isActive": false },
      { "id": "sched_1", "dayOfWeek": 1, "startTime": "08:00", "endTime": "17:00", "isActive": true },
      { "id": "sched_2", "dayOfWeek": 2, "startTime": "08:00", "endTime": "17:00", "isActive": true },
      { "id": "sched_3", "dayOfWeek": 3, "startTime": "08:00", "endTime": "17:00", "isActive": true },
      { "id": "sched_4", "dayOfWeek": 4, "startTime": "08:00", "endTime": "17:00", "isActive": true },
      { "id": "sched_5", "dayOfWeek": 5, "startTime": "08:00", "endTime": "17:00", "isActive": true },
      { "id": "sched_6", "dayOfWeek": 6, "startTime": "08:00", "endTime": "17:00", "isActive": false }
    ],
    "overrides": [
      {
        "id": "ovr_001",
        "overrideDate": "2026-04-04",
        "isAvailable": false,
        "startTime": null,
        "endTime": null,
        "reason": "Good Friday - Office Closed"
      },
      {
        "id": "ovr_002",
        "overrideDate": "2026-04-12",
        "isAvailable": true,
        "startTime": "09:00",
        "endTime": "13:00",
        "reason": "Saturday half-day for emergency backlog"
      }
    ]
  }
}
```

### `PUT /availability`

**Auth:** `requireTenant`

Bulk update the weekly schedule. Must provide all 7 days. Replaces existing schedule in a transaction.

**Request Body:**

```json
{
  "schedule": [
    { "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isActive": false },
    { "dayOfWeek": 1, "startTime": "07:00", "endTime": "18:00", "isActive": true },
    { "dayOfWeek": 2, "startTime": "07:00", "endTime": "18:00", "isActive": true },
    { "dayOfWeek": 3, "startTime": "07:00", "endTime": "18:00", "isActive": true },
    { "dayOfWeek": 4, "startTime": "07:00", "endTime": "18:00", "isActive": true },
    { "dayOfWeek": 5, "startTime": "07:00", "endTime": "18:00", "isActive": true },
    { "dayOfWeek": 6, "startTime": "08:00", "endTime": "12:00", "isActive": true }
  ]
}
```

**Response** `200 OK`

```json
{
  "data": [
    { "id": "sched_0", "dayOfWeek": 0, "startTime": "08:00", "endTime": "17:00", "isActive": false },
    "...6 more days..."
  ]
}
```

### `POST /availability/overrides`

**Auth:** `requireTenant`

Create a schedule override for a specific date (holiday, closure, or custom hours).

**Request Body:**

```json
{
  "overrideDate": "2026-07-04",
  "isAvailable": false,
  "reason": "Independence Day - Office Closed"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `overrideDate` | string | Yes | `YYYY-MM-DD`, must be in the future |
| `isAvailable` | boolean | Yes | `true` = custom hours, `false` = closed |
| `startTime` | string | Conditional | Required if `isAvailable: true` |
| `endTime` | string | Conditional | Required if `isAvailable: true` |
| `reason` | string | No | Description |

**Response** `201 Created`

```json
{
  "data": {
    "id": "ovr_003",
    "overrideDate": "2026-07-04",
    "isAvailable": false,
    "startTime": null,
    "endTime": null,
    "reason": "Independence Day - Office Closed"
  }
}
```

### `DELETE /availability/overrides/:id`

**Auth:** `requireTenant`

**Response** `204 No Content`

---

## Public Booking Portal

Public-facing endpoints for customer self-service booking. No authentication required. Accessed via tenant slug.

### `GET /public/booking/:slug`

Get tenant branding and available service types for the booking form.

**Response** `200 OK`

```json
{
  "data": {
    "businessName": "Smith HVAC Services",
    "logoUrl": null,
    "slug": "smith-hvac-services",
    "timezone": "America/Chicago",
    "serviceTypes": [
      "installation",
      "repair",
      "maintenance",
      "inspection",
      "emergency",
      "consultation",
      "other"
    ]
  }
}
```

### `GET /public/booking/:slug/availability`

Get available dates for a given month.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `month` | string | Yes | `YYYY-MM` format |

**Response** `200 OK`

```json
{
  "data": {
    "month": "2026-04",
    "timezone": "America/Chicago",
    "availableDates": [
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-07",
      "2026-04-08",
      "2026-04-09",
      "2026-04-10",
      "2026-04-11"
    ]
  }
}
```

### `GET /public/booking/:slug/slots`

Get available 1-hour time slots for a specific date.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | `YYYY-MM-DD` format |

**Response** `200 OK`

```json
{
  "data": {
    "date": "2026-04-01",
    "timezone": "America/Chicago",
    "slots": [
      { "time": "08:00", "available": true },
      { "time": "09:00", "available": true },
      { "time": "10:00", "available": false },
      { "time": "11:00", "available": true },
      { "time": "12:00", "available": true },
      { "time": "13:00", "available": true },
      { "time": "14:00", "available": true },
      { "time": "15:00", "available": true },
      { "time": "16:00", "available": true }
    ]
  }
}
```

### `POST /public/booking/:slug/submit`

Submit a new booking request.

**Request Body:**

```json
{
  "customerName": "Sarah Johnson",
  "customerEmail": "sarah@email.com",
  "customerPhone": "(512) 555-0400",
  "serviceType": "repair",
  "bookingDate": "2026-04-01",
  "preferredTime": "09:00",
  "address": "321 Cedar Ln, Austin, TX 78705",
  "description": "AC unit making loud buzzing noise"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `customerName` | string | Yes | Min 2 characters |
| `customerEmail` | string | Conditional | One of email/phone required |
| `customerPhone` | string | Conditional | One of email/phone required |
| `serviceType` | string | Yes | Must be valid service type |
| `bookingDate` | string | Yes | `YYYY-MM-DD`, 24h+ in future, within 3 months |
| `preferredTime` | string | Yes | `HH:MM` format |
| `address` | string | No | Service address |
| `description` | string | No | Problem description |

**Response** `201 Created`

```json
{
  "data": {
    "id": "bk_005",
    "bookingDate": "2026-04-01",
    "preferredTime": "09:00",
    "serviceType": "repair",
    "status": "pending"
  }
}
```

**Error** `400 Bad Request`

```json
{
  "error": "This time slot is no longer available"
}
```

### `GET /public/booking/:slug/status/:bookingId`

Public booking confirmation/status page.

**Response** `200 OK`

```json
{
  "data": {
    "booking": {
      "id": "bk_005",
      "customerName": "Sarah Johnson",
      "serviceType": "repair",
      "bookingDate": "2026-04-01",
      "preferredTime": "09:00",
      "status": "pending",
      "description": "AC unit making loud buzzing noise"
    },
    "businessName": "Smith HVAC Services",
    "logoUrl": null,
    "timezone": "America/Chicago"
  }
}
```

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
