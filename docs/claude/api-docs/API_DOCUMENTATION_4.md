# API Documentation — Part 4: Bookings, Calendar, Equipment, Service Agreements, Conversations

> **Part 4 of 5** — Bookings, Availability, Calendar Events, Public Booking Portal, Equipment, Service Agreements, Conversations
> - [[API_DOCUMENTATION_1|Part 1]]: Auth, Tenants, Dashboard, Customers, Tags
> - [[API_DOCUMENTATION_2|Part 2]]: Jobs, Quotes, Line Items
> - [[API_DOCUMENTATION_3|Part 3]]: Invoices, Catalog, Checklists, Pipelines
> - [[API_DOCUMENTATION_4|Part 4]]: Bookings, Calendar, Equipment, Service Agreements, Conversations *(this file)*
> - [[API_DOCUMENTATION_5|Part 5]]: Reports, Admin Panel, Enums, Errors
>
> Related: [[bookings-calendar|Bookings & Calendar audit]] | [[security-rules]] | [[api-rules]]
## Bookings (Internal)

Internal booking management for the authenticated tenant.

> **Date and time validation.** `bookingDate` must be a real `YYYY-MM-DD`
> calendar date and `preferredTime` a real `HH:MM`, on every endpoint below.
> Postgres would otherwise accept `infinity`, `today`, `epoch` and `now` — the
> relative ones resolving in the *session* timezone, not the tenant's — and a
> booking stored as `infinity` matches no date query and renders as
> `Invalid Date` everywhere. Shared validators: `isoDate` / `isoTime` /
> `boundedText` in `lib/schemas/common.ts`.

### `GET /bookings`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches customerName, customerEmail, customerPhone |
| `status` | string | - | `pending`, `confirmed`, `cancelled`, `completed` |
| `dateFrom` | string | - | `YYYY-MM-DD` (bookingDate >=). Rejects non-calendar dates |
| `dateTo` | string | - | `YYYY-MM-DD` (bookingDate <=). Rejects non-calendar dates |
| `showArchived` | boolean | `false` | `true` returns only archived bookings |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 200 |
| `sortBy` | string | `"bookingDate"` | `bookingDate`, `createdAt` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

Excludes archived bookings unless `showArchived=true`.

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

### `GET /bookings/stats`

**Auth:** `requireTenant`

Status counts for the four stat cards. Excludes archived bookings, matching
`GET /bookings`.

**Response** `200 OK`

```json
{
  "data": { "pending": 3, "confirmed": 8, "completed": 41, "cancelled": 2 }
}
```

### `GET /bookings/:id`

**Auth:** `requireTenant`

Returns the booking plus the job it was converted into (joined on
`jobs.bookingId`), so the detail view can link to it rather than re-offering
**Convert to Job**.

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
    "convertedToJobId": "job_047",
    "convertedJobNumber": "JOB-0047",
    "convertedJobStatus": "scheduled"
  }
}
```

### `GET /bookings/:id/activities`

**Auth:** `requireTenant`

Audit trail for one booking — status changes, reschedules, conversions and
cancellations, newest first.

**Query Parameters:** `page` (default `1`), `limit` (default `50`, max `100`).

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "act_001",
      "type": "booking.converted",
      "description": "Converted to job JOB-0047",
      "metadata": { "jobId": "job_047" },
      "createdAt": "2026-04-01T14:02:11.000Z",
      "performedBy": "user_001",
      "performedByName": "Sarah Chen"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 4, "totalPages": 1 }
}
```

Activity types: `booking.status_changed`, `booking.rescheduled`,
`booking.converted`, `booking.cancelled`.

### `PATCH /bookings/:id`

**Auth:** `requireTenant`

Update a booking. Status changes follow one transition table shared with
`POST /bookings/bulk-status-update`:

| From | Allowed to |
|------|-----------|
| `pending` | `confirmed`, `completed`, `cancelled` |
| `confirmed` | `completed`, `cancelled` |
| `completed` | *(terminal)* |
| `cancelled` | *(terminal)* |

**Request Body:**

| Field | Type | Notes |
|-------|------|-------|
| `status` | enum | See the table above |
| `notes` | string | Max 5,000 |
| `bookingDate` | string | `YYYY-MM-DD`, real calendar date |
| `preferredTime` | string | `HH:MM`, on the hour when rescheduling |
| `address` | string | Max 500 |
| `description` | string | Max 2,000 |
| `force` | boolean | Bypass the availability check below |

Changing `bookingDate` or `preferredTime` runs the same availability rules the
public portal enforces: the day must be open (weekly schedule *and* date
overrides), the time must fall on an offered slot, and the slot must not already
be at capacity — counting bookings, jobs **and** calendar events. Staff may book
sooner than the public 24-hour rule and up to 24 months out. Send `force: true`
to override deliberately.

Sending `status: "confirmed"` emails the customer (E-04).

**Response** `200 OK`

**Error** `400 Bad Request` — illegal transition, e.g.
`{ "message": "This booking is completed and can no longer be changed." }`

**Error** `409 Conflict` — slot rejected, e.g.
`{ "message": "This time slot is no longer available. Please choose another. Re-send with force to override." }`

### `POST /bookings/:id/convert-to-job`

**Auth:** `requireTenant`

Convert a booking into a job. Creates or links the customer, copies quote line
items when the booking came from a quote, attaches a matching checklist
template, writes `bookings.convertedToJobId`, confirms the booking, and logs
both a job activity and a booking activity — all inside one transaction holding
a `SELECT … FOR UPDATE` on the booking.

**Request Body** (optional):

```json
{
  "pipelineStageId": "stage_001"
}
```

**Response** `201 Created` — the created job row under `data`.

**Error** `400 Bad Request`

```json
{ "message": "This booking has already been converted to a job" }
```

No notification, platform event or customer email is emitted on any error path.

### `DELETE /bookings/:id`

**Auth:** `requireTenant`

Cancels the booking (soft — sets `status: "cancelled"`). Idempotent. Emails the
customer that the appointment is cancelled (E-14) and notifies the team.

If the booking had been converted, the linked job is **not** touched — cancelling
an appointment and cancelling the work are separate decisions — and the job is
reported back so the UI can prompt:

```json
{
  "data": { "id": "bk_001", "status": "cancelled" },
  "linkedJob": { "id": "job_047", "jobNumber": "JOB-0047" }
}
```

**Error** `400 Bad Request` — `{ "message": "Cannot cancel a completed booking" }`

### Bulk operations

| Endpoint | Notes |
|---|---|
| `POST /bookings/bulk-archive` | Sets `archivedAt`. Reversible |
| `POST /bookings/bulk-restore` | Clears `archivedAt` |
| `POST /bookings/bulk-delete` | Hard delete. **Refuses** any booking with a linked job — the job would lose its origin. Reports each as `"Converted to job JOB-0047 — archive it instead of deleting"` |
| `POST /bookings/bulk-status-update` | Uses the transition table above |

All four take `{ "ids": [...] }` (max 100) and return
`{ "succeeded": n, "failed": n, "errors": [{ "id", "reason" }] }`.

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
    ],
    "timezone": "America/Chicago",
    "slotCapacity": 1
  }
}
```

`timezone` and `slotCapacity` come from the tenant. The calendar uses `timezone`
to decide which column is "today"; `slotCapacity` is how many appointments can
share one time slot.

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
  ],
  "slotCapacity": 3
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `schedule` | array | Yes | Exactly 7 entries, no duplicate `dayOfWeek`; active days need `startTime < endTime`, both `HH:MM` |
| `slotCapacity` | integer | No | 1–50. Concurrent appointments per slot; omitted leaves it unchanged |

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

## Calendar Events

Standalone calendar entries — meetings, reminders, personal blocks — that are
neither jobs nor bookings. They appear on `/schedule` alongside both, and they
**occupy portal slots**: an event from 14:00–16:00 blocks those two hours from
being sold.

### `GET /calendar-events`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `dateFrom` | string | - | `YYYY-MM-DD`, real calendar date |
| `dateTo` | string | - | `YYYY-MM-DD`, real calendar date |
| `page` | integer | `1` | - |
| `limit` | integer | `50` | Max: 200 |

**Response** `200 OK` — `{ "data": [...], "pagination": {...} }`, ordered by
`eventDate`, then `startTime`.

### `GET /calendar-events/:id`

**Auth:** `requireTenant`

**Response** `200 OK` · **Error** `404 Not Found`

### `POST /calendar-events`

**Auth:** `requireTenant`

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | 1–200 |
| `eventDate` | string | Yes | `YYYY-MM-DD`, real calendar date |
| `startTime` | string | No | `HH:MM`. Omit both times for an all-day event |
| `endTime` | string | No | `HH:MM`, must be **after** `startTime` |
| `description` | string | No | Max 2,000 |
| `contactName` | string | No | Max 100 |
| `contactPhone` | string | No | Max 20 |
| `address` | string | No | Max 500 |
| `notes` | string | No | Max 2,000 |
| `color` | enum | No | `purple` (default), `blue`, `green`, `amber`, `red`, `teal` |
| `customerId` | uuid | No | Links the event to a customer. Must belong to the caller's tenant |

**Response** `201 Created` · **Error** `400 Bad Request` — `{ "message": "Customer not found" }`
when `customerId` names a customer outside the tenant.

### `PATCH /calendar-events/:id`

**Auth:** `requireTenant`

Same fields, all optional; nullable ones accept `null` to clear. `endTime` must
still be after `startTime`. `customerId` is tenant-checked as on `POST`.

**Response** `200 OK` · **Error** `404 Not Found`, `400 Bad Request` (foreign `customerId`)

### `DELETE /calendar-events/:id`

**Auth:** `requireTenant`

**Response** `200 OK` — `{ "message": "Event deleted" }`

---

## Public Booking Portal

Public-facing endpoints for customer self-service booking. No authentication required. Accessed via tenant slug.

**Rate limits** ([[security-rules]] §4). Every endpoint here is capped per
minute, per key:

| Endpoint | Limit |
|---|---|
| `GET /:slug`, `/availability`, `/slots` | 60/min |
| `POST /:slug/submit` | 5/min |
| `GET /:slug/status/:bookingId` | 10/min |

The key is normally the caller's IP. These endpoints are reached through Next.js
server actions, so Fastify would otherwise see the *Next server's* address for
every visitor and lump them into one bucket. Setting `INTERNAL_PROXY_SECRET` to
the same value in the root `.env` and `apps/web/.env.local` makes the web app
forward the visitor's IP (`x-client-ip`, authenticated by
`x-internal-proxy-secret`) and the limiter keys on that instead. An unsigned
forwarded header is ignored — trusting it blindly would be a bypass, not a fix.

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

A slot is offered when it starts inside the day's window (a `17:30` close does
sell the `17:00` slot) and fewer than `slotCapacity` things overlap it. Occupancy
counts **bookings, jobs and calendar events** — a day filled from phone calls
blocks the portal, which it previously did not.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | Yes | `YYYY-MM-DD`, real calendar date |

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
| `customerName` | string | Yes | 2–100 characters |
| `customerEmail` | string | Conditional | Valid email, max 254. One of email/phone required |
| `customerPhone` | string | Conditional | Max 20, digits and `+-().` only. One of email/phone required |
| `serviceType` | string | Yes | Must be valid service type |
| `bookingDate` | string | Yes | `YYYY-MM-DD` real calendar date, 24h+ in future, within 3 months |
| `preferredTime` | string | Yes | `HH:MM`, on the hour, inside an offered slot |
| `address` | string | No | Max 500 |
| `description` | string | No | Max 2,000 |
| `source` | enum | No | `portal` (default), `embed`, `widget` |
| `quoteId` | uuid | No | Links the booking to an accepted quote |

Availability is re-checked server-side against the same resolver the slots
endpoint uses, so a stale slot list cannot create a double booking.

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

Sends the customer a confirmation (E-02, including a link to their status page)
and the owner a notification (E-03).

**Error** `400 Bad Request` — validation or an unavailable date/time:

```json
{ "message": "Selected time is outside available hours." }
```

**Error** `409 Conflict` — the slot filled between listing and submitting:

```json
{ "message": "This time slot is no longer available. Please choose another." }
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

## Equipment (Assets)

Manage HVAC equipment/assets linked to customers.

### `GET /equipment`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches equipmentType, brand, model, serialNumber |
| `customerId` | string | - | Filter by customer |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `equipmentType`, `brand`, `installDate`, `warrantyExpiry` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "equip_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "customerFirstName": "Jane",
      "customerLastName": "Doe",
      "equipmentType": "Central AC",
      "brand": "Carrier",
      "model": "24ACC636A003",
      "serialNumber": "SN-2024-00456",
      "installDate": "2024-06-15",
      "warrantyExpiry": "2029-06-15",
      "location": "Rooftop Unit #1",
      "notes": "Installed during full system replacement",
      "createdAt": "2026-03-28T14:30:00.000Z",
      "updatedAt": "2026-03-28T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

### `GET /equipment/:id`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "data": {
    "id": "equip_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "customerFirstName": "Jane",
    "customerLastName": "Doe",
    "equipmentType": "Central AC",
    "brand": "Carrier",
    "model": "24ACC636A003",
    "serialNumber": "SN-2024-00456",
    "installDate": "2024-06-15",
    "warrantyExpiry": "2029-06-15",
    "location": "Rooftop Unit #1",
    "notes": "Installed during full system replacement",
    "createdAt": "2026-03-28T14:30:00.000Z",
    "updatedAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `POST /equipment`

**Auth:** `requireTenant`

Create a new equipment record.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "equipmentType": "Central AC",
  "brand": "Carrier",
  "model": "24ACC636A003",
  "serialNumber": "SN-2024-00456",
  "installDate": "2024-06-15",
  "warrantyExpiry": "2029-06-15",
  "location": "Rooftop Unit #1",
  "notes": "Installed during full system replacement"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | Yes | Customer who owns the equipment |
| `equipmentType` | string | Yes | Type of equipment (e.g., "Central AC", "Furnace") |
| `brand` | string | No | Manufacturer brand |
| `model` | string | No | Model number |
| `serialNumber` | string | No | Serial number |
| `installDate` | string | No | `YYYY-MM-DD` install date |
| `warrantyExpiry` | string | No | `YYYY-MM-DD` warranty expiration |
| `location` | string | No | Where the equipment is installed |
| `notes` | string | No | Additional notes |

**Response** `201 Created`

```json
{
  "data": {
    "id": "equip_002",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "equipmentType": "Central AC",
    "brand": "Carrier",
    "model": "24ACC636A003",
    "serialNumber": "SN-2024-00456",
    "installDate": "2024-06-15",
    "warrantyExpiry": "2029-06-15",
    "location": "Rooftop Unit #1",
    "notes": "Installed during full system replacement",
    "createdAt": "2026-03-31T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:00:00.000Z"
  }
}
```

### `PATCH /equipment/:id`

**Auth:** `requireTenant`

Update an equipment record.

**Request Body:**

```json
{
  "equipmentType": "Heat Pump",
  "brand": "Trane",
  "location": "Basement"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `equipmentType` | string | No | Type of equipment |
| `brand` | string | No | Manufacturer brand |
| `model` | string | No | Model number |
| `serialNumber` | string | No | Serial number |
| `installDate` | string | No | `YYYY-MM-DD` install date |
| `warrantyExpiry` | string | No | `YYYY-MM-DD` warranty expiration |
| `location` | string | No | Where the equipment is installed |
| `notes` | string | No | Additional notes |

**Response** `200 OK`

```json
{
  "data": {
    "id": "equip_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "equipmentType": "Heat Pump",
    "brand": "Trane",
    "model": "24ACC636A003",
    "serialNumber": "SN-2024-00456",
    "installDate": "2024-06-15",
    "warrantyExpiry": "2029-06-15",
    "location": "Basement",
    "notes": "Installed during full system replacement",
    "createdAt": "2026-03-28T14:30:00.000Z",
    "updatedAt": "2026-03-31T10:15:00.000Z"
  }
}
```

### `DELETE /equipment/:id`

**Auth:** `requireTenant`

Delete an equipment record.

**Response** `200 OK`

```json
{
  "message": "Equipment deleted"
}
```

---

## Refrigerant Logs

EPA-compliant refrigerant tracking for equipment.

### `GET /equipment/:id/refrigerant-logs`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "reflog_001",
      "equipmentId": "equip_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "refrigerantType": "R-410A",
      "action": "added",
      "quantity": 3.5,
      "unit": "lbs",
      "technicianName": "John Smith",
      "epaCertNumber": "EPA-12345",
      "jobId": "job_015",
      "notes": "Topped off after leak repair",
      "createdAt": "2026-03-28T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 4,
    "totalPages": 1
  }
}
```

### `POST /equipment/:id/refrigerant-logs`

**Auth:** `requireTenant`

Create a new refrigerant log entry.

**Request Body:**

```json
{
  "refrigerantType": "R-410A",
  "action": "added",
  "quantity": 3.5,
  "unit": "lbs",
  "technicianName": "John Smith",
  "epaCertNumber": "EPA-12345",
  "jobId": "job_015",
  "notes": "Topped off after leak repair"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refrigerantType` | string | Yes | Type of refrigerant (e.g., "R-410A", "R-22") |
| `action` | string | Yes | `added`, `recovered`, or `recycled` |
| `quantity` | number | Yes | Amount of refrigerant |
| `unit` | string | No | Unit of measurement (default: "lbs") |
| `technicianName` | string | No | Name of the technician |
| `epaCertNumber` | string | No | EPA certification number |
| `jobId` | string | No | Associated job ID |
| `notes` | string | No | Additional notes |

**Response** `201 Created`

```json
{
  "data": {
    "id": "reflog_002",
    "equipmentId": "equip_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "refrigerantType": "R-410A",
    "action": "added",
    "quantity": 3.5,
    "unit": "lbs",
    "technicianName": "John Smith",
    "epaCertNumber": "EPA-12345",
    "jobId": "job_015",
    "notes": "Topped off after leak repair",
    "createdAt": "2026-03-31T10:00:00.000Z"
  }
}
```

---

## Equipment Service History

### `GET /equipment/:id/history`

**Auth:** `requireTenant`

Get the full service history for an equipment item, including related jobs, service agreements, and refrigerant logs.

**Response** `200 OK`

```json
{
  "data": {
    "jobs": [
      {
        "id": "job_015",
        "jobNumber": "JOB-2026-0015",
        "title": "AC Leak Repair",
        "status": "completed",
        "serviceType": "repair",
        "scheduledDate": "2026-03-25",
        "completedAt": "2026-03-25T16:00:00.000Z"
      }
    ],
    "agreements": [
      {
        "id": "mc_001",
        "contractName": "Annual Maintenance Plan",
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "frequency": "quarterly",
        "isActive": true
      }
    ],
    "refrigerantLogs": [
      {
        "id": "reflog_001",
        "refrigerantType": "R-410A",
        "action": "added",
        "quantity": 3.5,
        "unit": "lbs",
        "technicianName": "John Smith",
        "createdAt": "2026-03-28T14:30:00.000Z"
      }
    ]
  }
}
```

---

## Service Agreements (Maintenance Contracts)

Manage recurring service/maintenance agreements linked to customers and optionally to equipment.

### `GET /maintenance-contracts`

**Auth:** `requireTenant`

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches contractName, customerFirstName, customerLastName |
| `customerId` | string | - | Filter by customer |
| `equipmentId` | string | - | Filter by equipment |
| `isActive` | string | - | `true` or `false` |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |
| `sortBy` | string | `"createdAt"` | `createdAt`, `startDate`, `endDate`, `contractName`, `annualPrice` |
| `sortOrder` | string | `"desc"` | `asc`, `desc` |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "mc_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "customerFirstName": "Jane",
      "customerLastName": "Doe",
      "equipmentId": "equip_001",
      "equipmentType": "Central AC",
      "equipmentBrand": "Carrier",
      "contractName": "Annual Maintenance Plan",
      "startDate": "2026-01-01",
      "endDate": "2026-12-31",
      "frequency": "quarterly",
      "visitsPerYear": 4,
      "annualPrice": "499.00",
      "isActive": true,
      "notes": "Includes filter changes and coil cleaning",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "updatedAt": "2026-01-01T10:00:00.000Z"
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

### `GET /maintenance-contracts/expiring`

**Auth:** `requireTenant`

Get service agreements expiring within a number of days.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | `30` | Number of days to look ahead |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "mc_002",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_003",
      "customerFirstName": "Mike",
      "customerLastName": "Johnson",
      "contractName": "Semi-Annual HVAC Checkup",
      "startDate": "2025-05-01",
      "endDate": "2026-04-30",
      "frequency": "semi_annual",
      "visitsPerYear": 2,
      "annualPrice": "299.00",
      "isActive": true,
      "notes": null
    }
  ]
}
```

### `GET /maintenance-contracts/:id`

**Auth:** `requireTenant`

**Response** `200 OK`

```json
{
  "data": {
    "id": "mc_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "customerFirstName": "Jane",
    "customerLastName": "Doe",
    "equipmentId": "equip_001",
    "equipmentType": "Central AC",
    "equipmentBrand": "Carrier",
    "contractName": "Annual Maintenance Plan",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "frequency": "quarterly",
    "visitsPerYear": 4,
    "annualPrice": "499.00",
    "isActive": true,
    "notes": "Includes filter changes and coil cleaning",
    "createdAt": "2026-01-01T10:00:00.000Z",
    "updatedAt": "2026-01-01T10:00:00.000Z"
  }
}
```

### `POST /maintenance-contracts`

**Auth:** `requireTenant`

Create a new service agreement.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "contractName": "Annual Maintenance Plan",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "equipmentId": "equip_001",
  "frequency": "quarterly",
  "visitsPerYear": 4,
  "annualPrice": "499.00",
  "notes": "Includes filter changes and coil cleaning"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | string | Yes | Customer for this agreement |
| `contractName` | string | Yes | Name of the agreement |
| `startDate` | string | Yes | `YYYY-MM-DD` start date |
| `endDate` | string | Yes | `YYYY-MM-DD` end date |
| `equipmentId` | string | No | Linked equipment item |
| `frequency` | string | No | Visit frequency (see `service_frequency` enum) |
| `visitsPerYear` | integer | No | Number of visits per year |
| `annualPrice` | string | No | Annual contract price |
| `notes` | string | No | Additional notes |

**Response** `201 Created`

```json
{
  "data": {
    "id": "mc_003",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "contractName": "Annual Maintenance Plan",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "equipmentId": "equip_001",
    "frequency": "quarterly",
    "visitsPerYear": 4,
    "annualPrice": "499.00",
    "isActive": true,
    "notes": "Includes filter changes and coil cleaning",
    "createdAt": "2026-03-31T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:00:00.000Z"
  }
}
```

### `PATCH /maintenance-contracts/:id`

**Auth:** `requireTenant`

Update a service agreement.

**Request Body:**

```json
{
  "contractName": "Premium Maintenance Plan",
  "annualPrice": "699.00",
  "visitsPerYear": 6,
  "isActive": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractName` | string | No | Name of the agreement |
| `startDate` | string | No | `YYYY-MM-DD` start date |
| `endDate` | string | No | `YYYY-MM-DD` end date |
| `equipmentId` | string | No | Linked equipment item |
| `frequency` | string | No | Visit frequency (see `service_frequency` enum) |
| `visitsPerYear` | integer | No | Number of visits per year |
| `annualPrice` | string | No | Annual contract price |
| `isActive` | boolean | No | Whether the agreement is active |
| `notes` | string | No | Additional notes |

**Response** `200 OK`

```json
{
  "data": {
    "id": "mc_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "contractName": "Premium Maintenance Plan",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "equipmentId": "equip_001",
    "frequency": "quarterly",
    "visitsPerYear": 6,
    "annualPrice": "699.00",
    "isActive": false,
    "notes": "Includes filter changes and coil cleaning",
    "createdAt": "2026-01-01T10:00:00.000Z",
    "updatedAt": "2026-03-31T10:30:00.000Z"
  }
}
```

### `DELETE /maintenance-contracts/:id`

**Auth:** `requireTenant`

Delete a service agreement.

**Response** `200 OK`

```json
{
  "message": "Service agreement deleted"
}
```

---

## Conversations

Messaging system for multi-channel communication with customers (email, SMS, voice).

### `GET /conversations`

**Auth:** `requireTenant`

List all conversations with customers, organized by channel.

**Query Parameters:**

| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `search` | string | - | Searches customer name, email, phone |
| `channel` | string | - | `email`, `sms`, `voice` |
| `customerId` | uuid | - | Filter by customer |
| `page` | integer | `1` | - |
| `limit` | integer | `20` | Max: 100 |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "conv_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "customerId": "cust_001",
      "channel": "email",
      "customerName": "Jane Doe",
      "customerEmail": "jane.doe@email.com",
      "unreadCount": 2,
      "lastMessage": "Thanks for the quick response!",
      "lastMessageAt": "2026-03-28T14:30:00.000Z",
      "createdAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "totalPages": 1
  }
}
```

### `POST /conversations`

**Auth:** `requireTenant`

Get or create a conversation with a customer on a channel. Idempotent per
`(tenant, customer, channel)` — an existing thread is returned rather than duplicated.

**Request Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `customerId` | uuid | Yes | Must belong to the caller's tenant |
| `channel` | enum | Yes | `email` \| `sms` |
| `subject` | string | No | Applied only when a new thread is created |

`customerId` is checked against the tenant before anything is written. It decides
whose name, email and phone the response carries, and who `POST /:id/messages`
later emails — an unchecked value would have been a cross-tenant disclosure and an
outbound email to another tenant's customer.

**Response** `200 OK` · **Error** `404 Not Found` — `{ "error": "Customer not found" }`

> **Doc drift, not yet reconciled:** the two entries below describe
> `GET /conversations/:id` returning an embedded `messages` array and a
> `POST /conversations/:id/send`. The implementation has
> `GET /conversations/:id/messages` (cursor-paginated) and
> `POST /conversations/:id/messages`. Left as-is here because correcting it is a
> documentation pass, not part of the security fix that touched this route.

### `GET /conversations/:id`

**Auth:** `requireTenant`

Get conversation details with full message thread.

**Response** `200 OK`

```json
{
  "data": {
    "id": "conv_001",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "customerId": "cust_001",
    "channel": "email",
    "customerName": "Jane Doe",
    "customerEmail": "jane.doe@email.com",
    "subject": "AC Repair Follow-up",
    "messages": [
      {
        "id": "msg_001",
        "senderType": "customer",
        "senderName": "Jane Doe",
        "content": "Is the AC fixed?",
        "sentAt": "2026-03-28T10:00:00.000Z"
      },
      {
        "id": "msg_002",
        "senderType": "staff",
        "senderName": "John Smith",
        "content": "Yes, all fixed! New compressor installed.",
        "sentAt": "2026-03-28T12:00:00.000Z"
      }
    ]
  }
}
```

### `POST /conversations/:id/send`

**Auth:** `requireTenant`

Send a message in a conversation.

**Request Body:**

```json
{
  "content": "Invoice for AC repair is attached.",
  "attachmentUrl": null
}
```

**Response** `201 Created`

```json
{
  "data": {
    "id": "msg_003",
    "conversationId": "conv_001",
    "senderType": "staff",
    "senderName": "John Smith",
    "content": "Invoice for AC repair is attached.",
    "sentAt": "2026-03-28T14:30:00.000Z"
  }
}
```

### `PATCH /conversations/:id/mark-read`

**Auth:** `requireTenant`

Mark all messages in a conversation as read.

**Response** `200 OK`

```json
{
  "success": true
}
```

---

