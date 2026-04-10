# API Documentation — Part 4: Bookings, Equipment, Service Agreements, Conversations
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

