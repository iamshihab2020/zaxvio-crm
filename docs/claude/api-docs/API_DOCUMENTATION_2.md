# API Documentation — Part 2: Jobs & Quotes

> **Part 2 of 5** — Jobs, Quotes, Line Items
> - [[API_DOCUMENTATION_1|Part 1]]: Auth, Tenants, Dashboard, Customers, Tags
> - [[API_DOCUMENTATION_2|Part 2]]: Jobs, Quotes, Line Items *(this file)*
> - [[API_DOCUMENTATION_3|Part 3]]: Invoices, Catalog, Checklists, Pipelines
> - [[API_DOCUMENTATION_4|Part 4]]: Bookings, Equipment, Service Agreements, Conversations
> - [[API_DOCUMENTATION_5|Part 5]]: Reports, Admin Panel, Enums, Errors
## Jobs

Job management with Kanban pipeline support.

### `GET /jobs/assignees`

**Auth:** `requireTenant`

Returns all org members available to assign to jobs.

**Response:**
```json
{
  "data": [
    { "id": "user_abc", "name": "Jane Smith", "email": "jane@example.com", "image": null, "role": "member" }
  ]
}
```

---

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
| `pipelineId` | uuid | - | Filter by pipeline (defaults to all pipelines) |
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
      "pipelineId": "pipe_001",
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

Create a new job. Auto-generates `jobNumber` (format: `JOB-YYYY-XXXX`). Automatically attaches a matching checklist template if one exists for the service type. Logs a `job.created` activity. If `pipelineId` is omitted, the job is assigned to the default pipeline.

The insert, the checklist attach and both activity rows run in **one transaction**, so a
job never exists without its checklist.

The job starts in the stage named by `stageId` or `status` — which is how "add a job to
this column" works — and otherwise in the pipeline's first stage by `sortOrder`. `status`
on the response is that stage's `name`, so a tenant who renamed *Scheduled* to *Booked*
sees `"booked"`.

**Request Body:**

```json
{
  "customerId": "cust_001",
  "pipelineId": "pipe_001",
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
| `notes` | string | No | Internal notes, ≤ 5000 chars |
| `stageId` | uuid | No | Stage to start in; must belong to the resolved pipeline |
| `status` | string | No | Stage `name` (slug) to start in; `stageId` wins if both are sent |
| `equipmentId` | uuid | No | Asset, validated against the tenant |
| `bookingId` | uuid | No | Source booking, validated against the tenant |
| `assigneeId` | string | No | Must be a member of the tenant's organization |
| `lineItems` | array | No | Initial line items |

**Validation.** `serviceType` and `priority` are enums (`400` on anything else, not a 500).
`scheduledDate` must be a real calendar date — `infinity`, `today` and `2026-02-30` are all
rejected. `scheduledStart`/`scheduledEnd` must be `HH:MM`, and the end must be strictly
after the start. `title` ≤ 200, `description`/`notes` ≤ 5000, `address` ≤ 500.
`unitPrice` and `quantity` on line items are bounded by `numeric(10,2)` (max
`99,999,999.99`) and reject `Infinity`/`NaN`.

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

Update job fields. Automatically recalculates totals if `taxRate` changes. Logs a `job.updated` activity.

> **`status` is not accepted here** — use `PATCH /jobs/:id/status`, which is the only
> writer of a job's stage and the only path that enforces the completion gate.

Rejects the request when the job is archived (`400`), when `scheduledEnd <= scheduledStart`
after merging with the stored row (`400`), or when `pipelineId` names a pipeline with no
stage matching the job's current lifecycle (`400`).

**Request Body** (all fields optional):

```json
{
  "priority": "urgent",
  "serviceType": "maintenance",
  "scheduledDate": "2026-03-30",
  "scheduledStart": "09:00",
  "scheduledEnd": "11:30",
  "notes": "Customer confirmed morning availability"
}
```

| Field | Rules |
|---|---|
| `title` | 1–200 chars |
| `description`, `notes` | ≤ 5000 chars |
| `address` | ≤ 500 chars |
| `serviceType` | enum: `installation·repair·maintenance·inspection·emergency·consultation·other` |
| `priority` | enum: `standard·urgent·emergency` |
| `scheduledDate` | `YYYY-MM-DD`, must be a real calendar date (`2026-02-30` is rejected) |
| `scheduledStart`, `scheduledEnd` | `HH:MM` or `HH:MM:SS` |

Blank strings for `description`, `address`, `notes`, `scheduledStart` and `scheduledEnd`
are stored as `NULL`, matching `POST /jobs`.

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

Permanently delete a job and all related records (line items, checklist completions, photos, activities). Stored photos and documents are removed from R2 first.

`invoices.job_id` is `ON DELETE SET NULL`, so any invoice raised against this job survives
but stops pointing at it. The count is returned so the caller can say so.

**Response** `200 OK`

```json
{
  "message": "Job deleted. 2 invoice(s) are no longer linked to a job.",
  "unlinkedInvoices": 2
}
```

---

### `PATCH /jobs/:id/status`

**Auth:** `requireTenant`

**The only endpoint that moves a job between pipeline stages.** Enforces the lifecycle
transition rules, the required-checklist gate, `completedAt`, the `job.status_changed`
activity, the in-app notification and the E-05 customer completion email.

A stage is identified either by `stageId` (precise) or by `status` (the stage's slug
`name`). Custom stages are fully supported — the value is resolved against *this job's*
pipeline, so `awaiting_parts` works exactly as `in_progress` does. Exactly one of the two
fields is required.

**Request Body:**

```json
{ "stageId": "stage_abc" }
```
```json
{ "status": "awaiting_parts" }
```

**Transition rules** — evaluated on the stage's `lifecycle`, never on its name:

| From | Allowed to |
|---|---|
| `scheduled` | `scheduled`, `in_progress`, `completed`, `cancelled` |
| `in_progress` | `in_progress`, `completed`, `cancelled` |
| `completed` | `completed` (terminal) |
| `cancelled` | `cancelled`, `scheduled` |

Moving between two stages that share a lifecycle is always allowed — that is ordinary
workflow, not a state change.

`scheduled → completed` is deliberate (2026-08-01). The Manage Pipeline UI only asks a tenant
to mark which stage **completes** a job and which **cancels** it; every other stage is open
work and is stored as `scheduled`. A board of Lead → Site visit → Quoted → Done therefore has
no `in_progress` stage at all, and without this row a job on it could never be finished.

**Response** `200 OK` — the updated job row.

**Errors:** `404` job not found · `400` archived, no such stage in this pipeline, already
in that stage, illegal transition, or required checklist items still open.

---

### `PATCH /jobs/reorder`

**Auth:** `requireTenant`

Persist card positions after a drag. **Positions only** — this endpoint cannot change a
job's stage; use `PATCH /jobs/:id/status` for that.

**Request Body:**

```json
{
  "items": [
    { "id": "job_001", "sortOrder": 0 },
    { "id": "job_002", "sortOrder": 1 }
  ]
}
```

`items` is 1–500 entries. Archived or unknown jobs are reported in `skipped` rather than
failing the request.

**Response** `200 OK`

```json
{
  "success": true,
  "skipped": [{ "id": "job_009", "reason": "Job not found or archived" }]
}
```

---

### `GET /jobs/:id/line-items`

**Auth:** `requireTenant`

All line items for a job, ordered by `sortOrder`.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "li_001",
      "jobId": "job_001",
      "catalogItemId": "cat_001",
      "itemType": "labor",
      "description": "Diagnostic visit",
      "quantity": "1.00",
      "unitPrice": "95.00",
      "total": "95.00",
      "sortOrder": 0
    }
  ]
}
```

---

### `GET /jobs/:id/checklist`

**Auth:** `requireTenant`

The job's checklist completions joined to their template items, in template order.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "comp_001",
      "checklistItemId": "ci_001",
      "label": "Check refrigerant charge",
      "isRequired": true,
      "isCompleted": false,
      "completedAt": null,
      "completedBy": null,
      "catalogItemId": null
    }
  ]
}
```

---

### `POST /jobs/:id/upload`

**Auth:** `requireTenant` · **bodyLimit:** ~67 MB

Upload a photo or document to R2 and return its storage path. Register the result
afterwards with `POST /jobs/:id/photos` or `POST /jobs/:id/documents`.

**Request Body:**

```json
{
  "data": "<base64>",
  "filename": "compressor.jpg",
  "mimeType": "image/jpeg",
  "tag": "before"
}
```

**Limits:** images 20 MB, documents 50 MB (measured on the decoded bytes).

**Allowed `mimeType`:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/heic`,
`image/heif`, `application/pdf`, `text/plain`, `text/csv`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
`application/vnd.ms-excel`,
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
Anything else is `400`. SVG is deliberately excluded — it is a script host in a browser.

**Response** `201 Created`

```json
{
  "data": {
    "storagePath": "tenant_abc/jobs/job_001/1754000000000_compressor.jpg",
    "publicUrl": "https://cdn.example.com/job-attachments/...",
    "fileSize": 2411233,
    "mimeType": "image/jpeg"
  }
}
```

**Errors:** `400` unsupported type, invalid base64, over the per-type limit, or archived
job · `404` job not found · `413` body larger than the route's `bodyLimit`.

---

### `PATCH /jobs/:id/photos/:photoId`

**Auth:** `requireTenant`

Change a photo's tag.

**Request Body:** `{ "tag": "after" }` — one of `before`, `after`, `general`.

**Response** `200 OK` — the updated photo row.

---

### `GET /jobs/:id/documents`

**Auth:** `requireTenant`

List the job's documents, newest first.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "doc_001",
      "fileName": "warranty.pdf",
      "storagePath": "tenant_abc/jobs/job_001/warranty.pdf",
      "fileSize": 51221,
      "mimeType": "application/pdf",
      "customerId": null,
      "uploadedBy": "user_abc",
      "createdAt": "2026-07-29T10:00:00Z"
    }
  ]
}
```

---

### `POST /jobs/:id/documents`

**Auth:** `requireTenant`

Register a document after `POST /jobs/:id/upload`.

**Request Body:**

```json
{
  "storagePath": "tenant_abc/jobs/job_001/warranty.pdf",
  "fileName": "warranty.pdf",
  "fileSize": 51221,
  "mimeType": "application/pdf",
  "customerId": "cus_001"
}
```

`storagePath` must begin with `<tenantId>/`. `customerId`, when given, must belong to the
same tenant.

**Response** `201 Created` — the created document row.

---

### `DELETE /jobs/:id/documents/:docId`

**Auth:** `requireTenant`

Delete a document from R2 and the database.

**Response** `200 OK` — `{ "message": "Document deleted" }`

---

### Bulk operations

All four accept `{ "ids": [...] }` (1–100 uuids) and return the standard bulk shape:

```json
{ "succeeded": 3, "failed": 1, "errors": [{ "id": "N/A", "message": "1 job(s) not found" }] }
```

#### `POST /jobs/bulk-archive`
Sets `archivedAt` on every live job in `ids`. Archived jobs are hidden from the board and
refused by every mutating endpoint until restored.

#### `POST /jobs/bulk-restore`
Clears `archivedAt` on every archived job in `ids`.

#### `POST /jobs/bulk-delete`
Permanently deletes the jobs, removing their R2 photos and documents first. Also returns
`unlinkedInvoices` — invoices whose `job_id` was nulled by the delete.

#### `POST /jobs/bulk-status-update`
Moves many jobs to one stage. Takes `stageId` **or** `status` alongside `ids`, exactly like
`PATCH /jobs/:id/status`, and resolves the target **per pipeline** so a mixed selection
lands in each pipeline's own column. Applies the same transition rules, the same
required-checklist gate, and sends the same E-05 completion email per job.

```json
{ "ids": ["job_001", "job_002"], "status": "completed" }
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

