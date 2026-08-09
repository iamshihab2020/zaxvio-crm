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
| `unitCost` | string \| null | No | What the line costs you. Omit to inherit the linked catalog item's `unitCost`; send `null` to clear it. Left unset the line is **uncosted**, which the margin reports as a gap rather than as zero cost |
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
    "unitCost": "28.40",
    "total": "45.00",
    "costTotal": "28.40",
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

## Job Costing

What a job cost, and what it made. Every figure here is **derived on read** —
nothing is stored — for the same reason invoice status is derived from its
payment rows: a number computed from its inputs cannot drift from them, and a
margin has strictly more inputs than an invoice status does.

The rule the whole surface rests on: **an unknown cost makes a total incomplete,
not lower.** A line item with no `unitCost` contributes nothing to the sum,
which is arithmetically identical to contributing zero — and that is exactly the
danger, because zero cost reads as pure profit. So every summary carries a
`coverage` object saying what is missing, and no client may present a margin as
fact without checking `coverage.complete` first.

Every mutating handler runs `loadEditableJob` first, so an archived job or
another tenant's job is refused before anything is written.

### `GET /jobs/:id/costs`

**Auth:** `requireTenant`

The derived cost/margin rollup for one job.

**Response** `200 OK`

```json
{
  "data": {
    "jobId": "job_001",
    "lineItemCost": "312.40",
    "expenseCost": "84.00",
    "laborCost": "210.00",
    "totalCost": "606.40",
    "actualHours": "3.50",
    "laborCostRate": "60.00",
    "revenue": "980.00",
    "revenueBasis": "invoiced",
    "margin": "373.60",
    "marginPct": 0.3812,
    "coverage": {
      "costedLineItems": 4,
      "lineItems": 4,
      "laborCosted": true,
      "complete": true,
      "gaps": []
    }
  }
}
```

| Field | Notes |
|-------|-------|
| `revenueBasis` | `invoiced` when the job has at least one non-draft, non-void, non-archived invoice — that is the document the customer received. `estimated` falls back to the job's own `totalAmount` |
| `marginPct` | 0–1 fraction, or **`null`** when revenue is 0. A percentage of nothing is undefined, not 0% |
| `coverage.gaps` | Human-readable reasons the figure is provisional, e.g. `"2 of 5 line items have no cost set"`. Empty when `complete` |

| Status | When |
|--------|------|
| `404` | The job is not this tenant's |

### `GET /jobs/:id/expenses`

**Auth:** `requireTenant`

Costs on the job that no line item accounts for. Newest `incurredOn` first.

**Response** `200 OK` — an array of expense rows (shape as in `POST` below).

### `POST /jobs/:id/expenses`

**Auth:** `requireTenant`

**Request Body:**

```json
{
  "category": "subcontractor",
  "description": "Crane hire",
  "amount": "450.00",
  "incurredOn": "2026-08-04",
  "vendor": "Halton Lifting"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | enum | No | `material` · `subcontractor` · `permit` · `fuel` · `equipment_rental` · `other`. Defaults to `material` |
| `description` | string(1..500) | Yes | What the cost was for |
| `amount` | string | Yes | `^\d{1,8}(\.\d{1,2})?$` — a string, because the column is `numeric(10,2)` and a float would round-trip through IEEE 754 on the way in |
| `incurredOn` | string | Yes | `YYYY-MM-DD`, validated by `isoDate` — Postgres magic values like `infinity` are refused, since this reaches a `::date` cast in the report's window filter |
| `vendor` | string(1..200) | No | Supplier |

**Response** `201 Created` — the created row. Also writes an `expense.added` job activity.

| Status | When |
|--------|------|
| `400` | Zod validation, or the job is archived |
| `404` | The job is not this tenant's |

### `PATCH /jobs/:id/expenses/:expenseId`

**Auth:** `requireTenant`

Every field of `POST` is optional. `vendor` is nullable so it can be cleared.

Matched on `tenantId AND jobId AND expenseId` — never the expense id alone.

| Status | When |
|--------|------|
| `404` | No such expense on that job for this tenant |

### `DELETE /jobs/:id/expenses/:expenseId`

**Auth:** `requireTenant`

**Response** `200 OK` — `{ "data": { "id": "exp_001" } }`. Writes an
`expense.deleted` job activity.

### `PATCH /jobs/:id/labor`

**Auth:** `requireTenant`

Record the hours actually worked, and snapshot what they cost.

Hours worked are not the hours billed. A job quoted at a 3-hour flat rate that
took 5 reads as healthy margin if you only look at line items — which is the
failure that makes a costing tool worse than none, because it tells you you are
winning while you lose.

**Request Body:**

```json
{ "actualHours": "3.50" }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actualHours` | string \| null | Yes | `^\d{1,4}(\.\d{1,2})?$`. **`null` clears the hours — and the stored rate with them**, so the job goes back to reporting labour as unknown rather than as configured-and-free |
| `laborCostRate` | string \| null | No | Omit and the server resolves it from the **assignee's** `tenant_member_rates` row, then `tenants.defaultLaborCostRate`, then `null`. The cost of a job is the cost of whoever worked it, not of whoever typed the hours |

The rate is **snapshotted onto the job**, not joined at read time, so giving
somebody a raise does not retroactively rewrite last year's margins.

**Response** `200 OK` — `{ "data": { "id", "actualHours", "laborCostRate" } }`.
Writes a `labor.updated` job activity.

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
  "taxRate": "0.0825",
  "discountAmount": "50.00",
  "notes": "Includes 1-year warranty on all parts"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customerId` | uuid | Yes | Must belong to this tenant |
| `issuedDate` | string | No | `YYYY-MM-DD`, a **real calendar date**. Defaults to today **in the tenant's timezone** |
| `expiryDate` | string | No | `YYYY-MM-DD`, real calendar date. Defaults to issue + 30 days |
| `taxRate` | string | No | **Decimal fraction, 0–1** — `"0.0825"` is 8.25%, not `"8.25"`. Defaults to the tenant's `defaultTaxRate` |
| `discountAmount` | string | No | Flat amount, `0` – `99999999.99` |
| `notes` | string | No | Max 5000 chars. Shown on the PDF and the public portal |
| `equipmentId` | uuid | No | Must belong to this tenant **and to `customerId`** |

> **Validation.** `issuedDate` / `expiryDate` go through `isoDate`, which rejects
> both the Postgres magic values (`infinity`, `today`, `epoch`, `now`) and dates
> that do not exist (`2026-02-30`). All of those used to be accepted and stored
> (QUO-17): an `infinity` expiry never lapsed and rendered as `Invalid Date`
> everywhere.
>
> **There is no `lineItems` field** — this endpoint has never accepted one.
> Add lines with `POST /quotes/:id/line-items` after creating the quote.

The insert and its activity row are one transaction.

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

Update a quote. **Only draft quotes**, and **not archived ones** — every mutating
handler now goes through `loadEditableQuote` (QUO-23; an archived quote used to be
fully editable and sendable). `customerId` and `equipmentId` are re-checked against
the tenant, and equipment against the customer (QUO-22). Financial changes
recalculate the totals.

**Request Body** (all fields optional):

```json
{
  "taxRate": "0.0825",
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


### `GET /quotes/stats`

**Auth:** `requireTenant`

Status counts for the KPI cards, in one query. Counts **exclude archived quotes**
(the list excludes them too — they used to disagree, QUO-08) and use the
*derived* status, so a `sent` quote past its expiry is counted as `expired` the
moment it lapses rather than when the cron next runs.

**Response** `200 OK`

```json
{
  "data": { "draft": 3, "sent": 4, "accepted": 6, "declined": 1, "expired": 2 }
}
```

---

### `POST /quotes/bulk-archive`

**Auth:** `requireTenant`

**Body:** `{ "ids": ["qt_001", "qt_002"] }` (1–100 uuids)

**Response** `200 OK` — `{ "succeeded": 2, "failed": 0, "errors": [] }`

`succeeded` is the number of rows actually archived, not the number requested.
Already-archived ids count as `failed`.

---

### `POST /quotes/bulk-restore`

**Auth:** `requireTenant`

**Body:** `{ "ids": [...] }` · **Response:** `{ succeeded, failed, errors }`

Only rows that were archived are restored; ids that were already active count as
`failed`.

---

### `POST /quotes/bulk-delete`

**Auth:** `requireTenant`

**Body:** `{ "ids": [...] }` · **Response:** `{ succeeded, failed, errors }`

Hard-deletes **draft quotes only**. Non-draft ids and unknown ids come back in
`errors` with a per-id reason, e.g.
`{ "id": "qt_009", "message": "Quote is sent, only draft quotes can be deleted" }`.

---

### `POST /quotes/bulk-status-update`

**Auth:** `requireTenant`

**Body:** `{ "ids": [...], "status": "accepted" | "declined" | "expired" }`

**Response** `200 OK` — `{ succeeded, failed, errors }`

`"sent"` is **not** an accepted value. A quote becomes `sent` only through
`POST /quotes/:id/send`, which generates the PDF, mints the access token and
emails the customer; setting the status directly produced a quote with no token
and no PDF that `/send`, `PATCH` and `DELETE` all then refused (QUO-01).

Each id is checked against the same transition table the single-quote handlers
use — `sent → accepted | declined | expired`, and nothing else — plus the
archived guard. Refusals are reported per id in `errors`; eligible rows are
updated in one transaction and each gets an activity row.

---

## Public Quote Portal

Unauthenticated. The `token` is the `access_token` minted by
`POST /quotes/:id/send` (a v4 UUID, 122 bits, backed by a UNIQUE index).

A token resolves only when **all** of the following hold: the tenant is active,
the tenant has **online acceptance enabled** (`quoteOnlineAcceptanceEnabled` —
enforced here, not just when building the email link, QUO-04), and the quote is
not archived. Otherwise `404`.

Rate limits: `60/min` for the read, `10/min` for each response verb.

### `GET /public/quote/:token`

**Response** `200 OK`

```json
{
  "data": {
    "business": { "name": "...", "logoUrl": null, "phone": "...", "address": "...",
                  "city": "...", "state": "...", "zipCode": "...", "slug": "...",
                  "timezone": "America/Chicago" },
    "quote": { "id": "qt_001", "quoteNumber": "QT-2026-0001", "status": "sent",
               "issuedDate": "2026-08-01", "expiryDate": "2026-08-31",
               "lineItems": [{ "description": "Labor", "quantity": "1.50",
                               "unitPrice": "10.33", "total": "15.50",
                               "itemType": "labor" }],
               "subtotal": "31.00", "taxAmount": "2.56", "discountAmount": "0.00",
               "totalAmount": "33.56", "notes": null,
               "termsConditions": null, "footerMessage": null,
               "customerName": "Jane Doe", "customerEmail": "jane@example.com",
               "customerPhone": "...", "customerAddress": "...",
               "declineReason": null,
               "customerScheduledDate": null, "customerScheduledTime": null },
    "settings": { "postAcceptanceScheduling": false, "autoConvertToJob": false }
  }
}
```

`status` is **derived** in the tenant's timezone — a lapsed quote reads
`expired` without the endpoint writing to the row. The sweep that updates the
stored column runs hourly in the cron (QUO-09).

### `POST /public/quote/:token/accept`

**Body** (both optional, and both ignored unless the tenant has
`quotePostAcceptanceScheduling` enabled):

```json
{ "scheduledDate": "2026-08-15", "scheduledTime": "09:00" }
```

`scheduledDate` must be a real calendar date (`2026-13-45` is rejected) and
`scheduledTime` a real `HH:MM`.

**Response** `200 OK` — `{ "data": { "status": "accepted", "jobCreated": true } }`

The status change is claimed under `SELECT … FOR UPDATE` inside a transaction, so
exactly one of N concurrent requests wins and the rest get `400`. Auto-convert
to a job runs only for the winner, so a double-click can no longer produce two
notifications, two activity rows, or a job on a quote that ended up declined
(QUO-03).

**Errors:** `400 This quote has expired` · `400 This quote has already been responded to` · `404 Quote not found`

### `POST /public/quote/:token/decline`

**Body:** `{ "reason": "Too expensive" }` (optional, max 2000 chars)

**Response** `200 OK` — `{ "data": { "status": "declined" } }`

Same claim-under-lock semantics and the same error set as `accept`.

---
