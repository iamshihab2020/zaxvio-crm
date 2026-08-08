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

## Workflows (Automations)

`requireTenant` throughout. The tenant is **always** taken from the session and
never from a body.

Split across three plugins under one `/workflows` prefix: `routes/workflows/index.ts`
holds the record CRUD, `routes/workflows/graph.ts` the builder's graph endpoints,
`routes/workflows/runs.ts` the run history. The split is deliberate —
`routes/jobs/index.ts` reached 2,497 lines one reasonable addition at a time
([[architecture|ARC-05]]).

**The two verbs that are not the same thing.** `PUT /:id/graph` **saves** and
changes nothing about what runs. `POST /:id/publish` **publishes** — snapshots
the draft into an immutable version, points `active_version_id` at it, and writes
`trigger_types`, which is what makes the automation visible to the trigger
matcher at all. An automation that has never been published fires for nothing,
and cannot be switched on.

### `POST /workflows/:id/runs`

Run an automation by hand against one record. Until the trigger matcher ships,
this is the only way to start a run.

Rate limit: 10/min — running an automation can send email.

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `subject.type` | enum | No | `customer`, `job`, `invoice`, `quote`, `booking`, `equipment`, `maintenance_contract` |
| `subject.id` | uuid | No | Required if `subject.type` is given |
| `versionId` | uuid | No | Run a specific **published** version. Not a way to run a draft — a version id only exists after a publish |

**Response** `201 Created`

```json
{
  "data": {
    "executionId": "…",
    "status": "completed",
    "reason": "Finished",
    "nodesExecuted": 4,
    "diagnostics": []
  }
}
```

`status` is one of `completed`, `failed`, `cancelled` or `waiting`. `waiting`
means a step paused the run — it is **not** an error, and the run resumes on its
own.

`diagnostics` lists any `{{variable}}` that did not resolve, with the field it
was in and a suggested correction. It is returned to the caller rather than only
logged: a blank email is otherwise the least debuggable failure this feature has.

**Error** `400 Bad Request` — over quota, no published version, or no trigger
step. The `message` is written for the person who has to fix it:

```json
{ "message": "This automation has no published version, or it has been archived. Drawing an automation isn't the same as publishing it — open it and press Publish." }
```

**Error** `409 Conflict` — this automation is already running or waiting for
this record. Not an error state: the correct response to a second enrolment is
to leave the first run alone.

### `GET /workflows/quota`

This workspace's usage against its limits. Surfaced so a tenant never meets a
cap by surprise.

**Response** `200 OK`

```json
{
  "data": {
    "concurrent": 3,
    "concurrentLimit": 25,
    "daily": 142,
    "dailyLimit": 2000
  }
}
```

`concurrent` counts runs that are `running` **or** `waiting` — a run parked on a
delay holds no worker but does hold its subject's slot. `daily` is a rolling 24
hours, not a calendar day, so it means the same thing in every timezone.

### `GET /workflows`

The automations list. Paginated.

| Query | Type | Notes |
|-------|------|-------|
| `page`, `limit`, `search` | — | Standard. `search` matches `name`, escaped for `ilike` |
| `showArchived` | `true`/`false`/`1`/`0` | String enum, **not** `z.coerce.boolean()` — `Boolean("false")` is `true` (CUST-29) |
| `isActive` | `true`/`false` | Same encoding |
| `folderId` | uuid | |

**Response** `200 OK` — `{ data: [...], pagination: { page, limit, total, totalPages } }`,
ordered by `updatedAt` descending.

Each row is the workflow plus three fields **left-joined from its active
version**, so the list can say what each automation *is* rather than only what it
is called:

| Field | Null when | Notes |
|-------|-----------|-------|
| `version` | never published | Displayed as "v3" |
| `nodeCount` | never published | "6 steps" |
| `triggerTypes` | never published | Event ids; the client resolves them to names through the event registry |

All three were already denormalised onto `workflow_versions` for other reasons —
`trigger_types` for the matcher, `node_count` for version history — so this costs
one join rather than a query per row. The join is a **LEFT** join deliberately:
an unpublished automation has no version and must still appear, and an inner join
would silently hide every draft.

### `POST /workflows`

Creates the record only — no nodes. A new automation opens on the template
gallery, and the chosen template is installed by the graph PUT, so creation has
one job and templates need no second code path.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string ≤120 | Yes | |
| `description` | string ≤2000 | No | |
| `folderId` | uuid | No | |
| `timezoneMode` | `tenant` \| `custom` | No | Defaults `tenant` |
| `timezone` | string ≤64 | No | IANA zone; only meaningful when mode is `custom` |
| `templateKey` | string ≤120 | No | |

**Response** `201 Created` — the row. `isActive` is **always `false`**: a drawing
tool that starts emailing customers when a trigger lands on the canvas is a bad
idea.

### `GET /workflows/:id`

The record, its **draft** graph, and enough state to render the toolbar.

**Response** `200 OK`

```json
{
  "data": {
    "workflow": { "…": "…" },
    "graph": { "nodes": [], "edges": [] },
    "activeVersion": { "id": "…", "version": 3, "publishedAt": "…", "note": null },
    "isDirty": true
  }
}
```

`isDirty` compares **behaviour, not layout** — node positions are excluded, so
tidying the canvas does not light "unpublished changes". Parameter keys and row
order are normalised first, or a re-save in a different key order would read as a
change nobody made.

### `PATCH /workflows/:id`

`name`, `description`, `folderId`, `timezoneMode`, `timezone`. At least one
field required.

`isActive` is **not** accepted here — see below.

### `POST /workflows/:id/active`

The on/off switch. Its own endpoint because it carries a rule no other field
does.

**Body** — `{ "isActive": true }`

**Error** `400` — nothing published yet (`is_active` with no `active_version_id`
is a workflow the matcher would find and have no graph to run), or the
automation is archived.

### `DELETE /workflows/:id`

**Archives**, and switches off in the same write. Not a hard delete:
`workflow_executions` cascades from this row, so deleting destroys the record of
every email the automation ever sent. An archived automation that kept firing
would be the worst possible reading of "delete".

`404` if not found **or already archived**.

### `PUT /workflows/:id/graph`

Whole-graph save. Never changes what runs.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `nodes` | array ≤60 | Yes | `MAX_NODES_PER_WORKFLOW` |
| `edges` | array ≤240 | Yes | Capped above nodes: branching and converging mean edges outnumber nodes |
| `expectedUpdatedAt` | ISO datetime | **Yes** | The `updatedAt` the client last saw |

Node ids are **client-minted** uuids; the server diffs by id. `sourceHandle` is a
stable id (`found`), never a display label — renaming a branch must not break
routing on every saved automation.

`expectedUpdatedAt` has no default and no force flag. A save that *may* omit its
concurrency token is a save that *will*, and with a whole-graph write the thing
being overwritten is not a field — it is somebody's entire automation.

**Response** `200 OK` — `{ data: { updatedAt, graph } }`. Send `updatedAt` back as
the next `expectedUpdatedAt`.

**Error** `409 Conflict` — someone else saved in between. Nothing is written.

```json
{
  "message": "Someone else edited this automation while you were working on it. Reload to see their changes — your version has not been saved.",
  "data": { "currentUpdatedAt": "…" }
}
```

**Error** `400` — more than 60 steps.

### `GET /workflows/:id/validate`

The answer Publish would give, without publishing.

**Response** `200 OK` — `{ data: { errors: GraphIssue[], warnings: GraphIssue[], canPublish: boolean } }`

Each `GraphIssue` is `{ severity, code, message, nodeId?, field? }`. `nodeId` is
what makes an error clickable — a list of errors you cannot navigate to is barely
better than no list.

Errors block: no trigger · required field empty · orphaned step · dangling edge ·
unknown or unavailable node type · duplicate node id · unconnected branch output ·
`goto` target deleted · over 60 steps · delay inside a loop · an action whose
subject no trigger provides · a config pointing at a row this workspace does not own.

Warnings do not: unreachable step · `goto` after a split · no action steps · more
than 3 triggers · a **disabled** step with an empty required field.

Two rules deserve their reasoning stated, because both would be publish-blockers
if implemented naively:

- **Hidden fields are never missing.** `displayOptions` is what makes an
  eight-property node usable; choosing "Plain text" hides the HTML body, and
  reporting it would block Publish forever on a field that appears nowhere.
- **An undeterminable subject proves nothing.** `trigger.manual` carries its
  subject in a *parameter*, not its definition. Reading only the definition would
  make every manual automation look like a mismatch and none could be published.

### `POST /workflows/:id/publish`

Snapshots the draft, bumps the version, points `active_version_id` at it, writes
`trigger_types`.

**Body** — `{ "note": "…" }` (optional, ≤500 chars, shown in version history).

One transaction with the workflow row locked: `version` is derived from the
current maximum and `(workflow_id, version)` is unique, so two concurrent
publishes would otherwise race to the same number. Validation runs **inside** the
transaction against the graph just read, never against a client claim of validity.

**Response** `201 Created`

```json
{
  "data": {
    "id": "…", "version": 4, "publishedAt": "…",
    "triggerTypes": ["job.completed"], "nodeCount": 6, "note": null
  }
}
```

`triggerTypes` is recomputed from the snapshot every time, never adjusted in
place — a deleted trigger must stop matching the moment its author publishes.
Disabled trigger nodes are excluded, or the disable toggle would be a lie.

**Error** `422 Unprocessable Entity` — the request was well formed, the graph is
not. `data` is the full validation payload so the dialog can list every problem
and select the node behind each one.

### `GET /workflows/:id/builder-context`

Members, pipelines and stages in **one** request. Selecting a step in the builder
would otherwise fire a server action per picker, sequentially, every time.

Scoped to `:id` rather than being a bare `/workflows/builder-context` so it 404s
for an automation this tenant does not own — the payload is workspace reference
data and should not be readable by id-less probing.

**Response** `200 OK`

```json
{
  "data": {
    "members":   [{ "id": "…", "name": "…", "email": "…", "image": null }],
    "pipelines": [{ "id": "…", "name": "Standard" }],
    "stages":    [{ "id": "…", "label": "Awaiting parts", "pipelineId": "…", "lifecycle": "in_progress" }]
  }
}
```

Small, bounded lists only. Anything that can grow without limit — customers,
jobs, invoices — is a searchable picker with its own endpoint, not a payload
shipped on open. Stages carry their `pipelineId` so the stage picker filters
client-side off the sibling field rather than making a second request, and
`label` is the human name (`name` is the slug).

### `POST /workflows/:id/nodes/:nodeId/preview`

"Test this step" — **resolves the step's settings; does not run it.**

That distinction is the design, not a limitation. Half the catalogue is
`at-most-once`: running `email.send` to test it puts a real message in a
customer's inbox, and a test button that mails customers is one people learn not
to press. What actually goes wrong with a step is its *configuration* — a
mistyped `{{customer.frstName}}`, a variable the trigger cannot provide, a
subject that comes out blank — and all of that is visible from the resolved
values with no side effects. Executing a step belongs with the run viewer (P8),
where there is somewhere to show what it did.

Previews the **draft**, not the published version: the point is to check what you
are editing.

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `subject.type` | enum | No | Omit to see which variables would resolve empty — a manual run with no subject does the same |
| `subject.id` | uuid | No | |

**Response** `200 OK`

```json
{
  "data": {
    "parameters": { "subject": "Your repair visit on 12 Aug", "body": "Hi Dana, …" },
    "diagnostics": [
      { "path": "customer.frstName", "field": "body",
        "message": "No variable at that path", "suggestions": ["customer.firstName"] }
    ]
  }
}
```

`diagnostics` is the reason this endpoint exists. An unresolved `{{token}}`
renders as an empty string at run time — a blank line in a customer's email and
no error anywhere. Naming the bad path with its near-misses turns the least
debuggable failure in the feature into a fixable one.

Timezone resolves through the same `resolveTimezone` a real run uses (workflow
zone → tenant zone → default, never the server's), so a preview cannot format a
date differently from the run it is previewing.

**Error** `404` — no such automation, or the step is not in the saved draft (save
first). **Error** `400` — the record no longer exists.

### `GET /workflows/:id/versions`

Version history, newest first. The `graph` column is deliberately **not**
selected — shipping fifty snapshots to render fifty rows of "v12 · 3 Aug · Bob"
is a payload nobody asked for.

**Response** `200 OK` — `{ data: [{ id, version, publishedAt, publishedBy, note, nodeCount, triggerTypes, isActive }] }`

`isActive` marks the version `active_version_id` points at — which is not
necessarily the highest number, once someone restores an older one.

---

## Public Unsubscribe

No authentication. The token *is* the authorisation: an HMAC-SHA256 of
`unsubscribe:<tenantId>:<customerId>` under the server secret, formatted
`<customerId>.<signature>`. It is derived rather than stored, so there is no
token column, nothing to backfill, and rotating the secret invalidates every
outstanding link at once. The tenant id is inside the signature, so a token is
valid for exactly one (tenant, customer) pair.

Every failure — malformed token, unknown customer, bad signature — returns the
same `404`. Distinguishing them would let an unauthenticated caller probe the
id space, and there is nothing useful to tell them.

Opting out suppresses **marketing** email only (review requests, renewal
reminders, workflow sends). Estimates, invoices and receipts are transactional
and continue.

### `GET /public/unsubscribe/:token`

Who is this link for. **Changes nothing** — Gmail, Outlook and corporate link
scanners fetch URLs in the background, so a `GET` that opted someone out would
opt out people who never clicked.

Rate limit: 30/min.

**Response** `200 OK`

```json
{
  "data": {
    "businessName": "Smith HVAC Services",
    "email": "s•••@example.com",
    "alreadyOptedOut": false
  }
}
```

`email` is masked. The page has to show which address is affected; the full
address is not this endpoint's to hand out.

**Error** `404 Not Found` — `{ "message": "This unsubscribe link is not valid" }`

### `POST /public/unsubscribe/:token`

Record the opt-out. Idempotent — a second click is a `200`, not an error, and
the **first** timestamp is kept, because that is the date the customer will
quote back at you.

Rate limit: 10/min.

**Response** `200 OK`

```json
{ "data": { "businessName": "Smith HVAC Services", "optedOut": true } }
```

**Error** `404 Not Found` — same body as above.

### `POST /public/unsubscribe/:token/one-click`

RFC 8058. The mail provider posts here itself when the reader clicks the
unsubscribe control Gmail renders beside the sender name — no browser, no page,
nobody to read a response body. Required of bulk senders by Gmail and Yahoo, and
this deployment sends every tenant's mail from one shared domain, so a missing
one-click path is a deliverability problem for all of them.

Accepts `application/x-www-form-urlencoded`; the body (`List-Unsubscribe=One-Click`)
carries nothing the token does not and is discarded.

Rate limit: 10/min.

**Response** `204 No Content` — **even for an invalid token.** A mail provider
retries a `4xx` and has nothing to fix; the failure that matters is a valid
unsubscribe that does not take effect.

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

### `POST /workflows/from-template`

Install one of the shipped templates as a new **draft** automation.

The body carries a template **id**, never a graph. The browser imports the same
catalogue and could send the nodes — which is exactly why it must not: a graph
accepted from the client is a graph the client can change, and "install this
template" would quietly become "write me any automation you like, including one
that emails every customer".

Created **off and unpublished**, like every other automation. `templateKey` is
recorded on the row so the gallery can say "already added".

**Body**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `templateId` | string | ✓ | An id from `WORKFLOW_TEMPLATES` |
| `name` | string | | Rename before creating. Max 120 |

**Responses**

- `201` — `{ "data": { "id": "uuid" } }`
- `404` — unknown template id
- `422` — the template names a node this build does not have. A packaging
  mistake, not a tenant error, and caught before anything is written so it
  cannot leave a half-built automation behind.

---

## Run history

The engine has written a row per run and a row per node since P3. These are the
first read paths either table has ever had — before them an automation could be
built, published, switched on and run with no way for its owner to find out
whether it had done anything.

Both lead with the **plain-language** fields. `error_hint` and `skip_reason` are
written for the person who has to fix the automation; `error_message` is the
technical one and is carried alongside rather than instead.

### `GET /workflows/:id/runs`

One page of runs, newest first, plus whole-history counts.

404s when the automation is not yours — checked before querying, so a foreign id
cannot come back as "0 runs", which reads as "this has never run".

**Query**

| Field | Type | Notes |
|-------|------|-------|
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |
| `status` | string | **Comma-separated set** — `failed,cancelled`. 1–5 of `running`/`waiting`/`completed`/`failed`/`cancelled` |
| `customerId` | uuid | "Which automations touched this customer" |

**Response**

```jsonc
{
  "runs": [{
    "id": "uuid",
    "status": "completed",          // running | waiting | completed | failed | cancelled
    "source": "event",              // event | manual | test | webhook | schedule | sub | replay
    "triggerEvent": "job.completed",
    "startedAt": "2026-08-09T14:02:11.000Z",
    "completedAt": "2026-08-09T14:02:12.400Z",
    "resumeAt": null,               // set only while waiting on a delay
    "errorHint": null,              // plain language, never a stack
    "nodesExecuted": 4,
    "contextTruncated": false,
    "subjectType": "job",
    "subjectId": "uuid",
    "customerId": "uuid",
    "customerName": "Maria Delgado", // null when there is no customer
    "versionNumber": 3
  }],
  "pagination": { "page": 1, "limit": 20, "total": 61, "totalPages": 4 },
  // Counted in SQL over the WHOLE history, not derived from this page — a tally
  // from 20 rows would sit above a paginated list contradicting it.
  "stats": {
    "total": 61, "running": 0, "waiting": 2,
    "completed": 57, "failed": 1, "cancelled": 1,
    "lastRunAt": "2026-08-09T14:02:11.000Z"
  }
}
```

### `GET /workflows/:id/runs/:runId`

One run and every step it took, in execution order.

404 when the run does not exist **or** belongs to another tenant — one answer on
purpose, so the response does not confirm which ids are real.

**Response**

```jsonc
{
  "run": {
    // ...every field from the list, plus:
    "workflowName": "Review request",
    "versionId": "uuid",         // the PINNED version this run executes on
    "triggerNodeId": "uuid",
    "currentNodeId": "uuid",     // where a waiting run is paused
    "parentExecutionId": null,   // set by "run from here"
    "errorMessage": "…",         // technical; the UI leads with errorHint
    "steps": [{
      "id": "uuid",
      "nodeId": "uuid",          // NO foreign key — a deleted node keeps its history
      "nodeType": "email.send",
      "nodeLabel": "Ask for a review",
      "sequence": 3,             // execution order, which after a branch is not canvas order
      "status": "skipped",       // running | completed | failed | waiting | skipped
      "skipReason": "This customer unsubscribed on 12 July, so we didn't email them.",
      "startedAt": "2026-08-09T14:02:12.100Z",
      "completedAt": "2026-08-09T14:02:12.180Z",
      "durationMs": 80,
      "resolvedParams": { "subject": "How did we do, Maria?" }, // AFTER interpolation
      "output": { "messageId": "…" },
      "errorHint": null,
      "errorMessage": null
    }]
  }
}
```

`context_snapshot` is deliberately **not** returned. It is stored for failed
nodes, it can be large, and a run page that ships a megabyte of context for a run
nobody expands is a page nobody waits for.

---
