# API Documentation — Part 3: Invoices, Catalog, Checklists, Pipelines
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

## Pipelines

Per-tenant pipelines for organizing job workflows. Each pipeline contains its own set of stages.

### `GET /pipelines`

**Auth:** `requireTenant`

List all pipelines for the tenant.

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "pipe_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "default",
      "label": "Default",
      "isDefault": true,
      "stageCount": 4,
      "jobCount": 53,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "pipe_002",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "name": "commercial",
      "label": "Commercial",
      "isDefault": false,
      "stageCount": 6,
      "jobCount": 12,
      "createdAt": "2026-03-01T08:00:00.000Z",
      "updatedAt": "2026-03-01T08:00:00.000Z"
    }
  ]
}
```

### `POST /pipelines`

**Auth:** `requireTenant`

Create a new pipeline.

**Request Body:**

```json
{
  "label": "Commercial",
  "isDefault": false,
  "seedDefaultStages": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Display label |
| `isDefault` | boolean | No | Set as default pipeline (unsets previous default) |
| `seedDefaultStages` | boolean | No | Seed 4 default stages (default: `true`). Ignored if `copyFromPipelineId` is provided |
| `copyFromPipelineId` | string | No | Copy stages from an existing pipeline |

**Response** `201 Created`

```json
{
  "data": {
    "id": "pipe_002",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "commercial",
    "label": "Commercial",
    "isDefault": false,
    "stageCount": 4,
    "jobCount": 0,
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-01T08:00:00.000Z"
  }
}
```

**Notes:** If `isDefault: true`, the previously default pipeline is unset in a transaction. Seeds 4 default stages (Scheduled, In Progress, Completed, Cancelled) unless `seedDefaultStages: false` or `copyFromPipelineId` is provided.

### `PATCH /pipelines/:id`

**Auth:** `requireTenant`

Update a pipeline's label or default status.

**Request Body:**

```json
{
  "label": "Commercial Projects",
  "isDefault": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | No | New display label |
| `isDefault` | boolean | No | Set as default pipeline (unsets previous default in a transaction) |

**Response** `200 OK`

```json
{
  "data": {
    "id": "pipe_002",
    "tenantId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "commercial_projects",
    "label": "Commercial Projects",
    "isDefault": true,
    "stageCount": 6,
    "jobCount": 12,
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-15T09:00:00.000Z"
  }
}
```

### `DELETE /pipelines/:id`

**Auth:** `requireTenant`

Delete a pipeline. Cannot delete the default pipeline or the last remaining pipeline.

**Response** `200 OK`

```json
{
  "message": "Pipeline deleted"
}
```

**Error** `400 Bad Request`

```json
{
  "error": "Cannot delete the default pipeline"
}
```

**Error** `409 Conflict`

```json
{
  "error": "Cannot delete pipeline with assigned jobs. Move or delete 12 jobs first.",
  "jobCount": 12
}
```

---

## Pipeline Stages

Per-pipeline custom Kanban pipeline stages for job management. Stage name uniqueness is scoped to the pipeline (not tenant-wide).

### `GET /pipeline-stages`

**Auth:** `requireTenant`

List all pipeline stages for a given pipeline, sorted by `sortOrder`. Auto-seeds default stages on first access if none exist.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pipelineId` | uuid | - | Pipeline to list stages for (defaults to the default pipeline) |

**Default stages:** Scheduled, In Progress, Completed, Cancelled

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "stage_001",
      "tenantId": "550e8400-e29b-41d4-a716-446655440000",
      "pipelineId": "pipe_001",
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
      "pipelineId": "pipe_001",
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
      "pipelineId": "pipe_001",
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
      "pipelineId": "pipe_001",
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
  "pipelineId": "pipe_001",
  "label": "Awaiting Parts",
  "color": "purple"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pipelineId` | string | Yes | Pipeline to add the stage to |
| `label` | string | Yes | Display label |
| `color` | string | No | Color key (default: `"gray"`) -- see stage color presets |

**Response** `201 Created`

```json
{
  "data": {
    "id": "stage_003",
    "pipelineId": "pipe_001",
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

