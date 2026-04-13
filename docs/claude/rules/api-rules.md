# API Architecture Rules (MUST FOLLOW)

> Related: [[strict-rules]] | [[security-rules]] | [[architecture]] | [[backend-stack]] | [[API_DOCUMENTATION_1|API Docs]]

1. **Service layer for business logic** — Route handlers MUST be thin: validate input, call a service function, return the response. Never put SQL queries, data transformations, or business logic directly in route handlers. Service files live in `apps/api/src/services/`.
2. **Query layer separation** — Complex or reusable SQL queries MUST live in dedicated query files under `services/<domain>/queries/`. Each function accepts `(db, params)` and returns typed data. Route handlers never call `db.execute()` or `db.select()` directly.
3. **Hybrid ORM approach** — Use Drizzle query builder for simple CRUD and aggregations. Use `db.execute(sql\`...\`)` only for PostgreSQL-specific features (`generate_series`, CTEs, window functions, `CASE WHEN` bucketing). Never fight the ORM — if it takes >10 minutes to express a query in Drizzle, use raw SQL.
4. **Zod validation on query results** — All raw SQL query results MUST be validated with Zod schemas at the query function level (not in routes). Schemas live in the service's `schemas.ts` file. This catches database schema drift at runtime.
5. **Shared query functions** — If the same query is used by multiple features (e.g., dashboard and reports both need revenue totals), extract it into a shared query file. Never duplicate SQL across routes.
6. **Analytics caching** — Analytics/dashboard endpoints MUST use the `analyticsCache` from `services/analytics/cache.ts` with appropriate TTL presets (`REALTIME: 30s`, `TRENDS: 5min`, `REPORTS: 10min`). Use stale-while-revalidate for chart data.

---

## Zod Validation Rules (MUST FOLLOW)

`fastify-type-provider-zod` is configured in `apps/api/src/server.ts`. All routes MUST use it.

### 1. Every route handler requires a Zod schema

```typescript
// CORRECT — schema declared, request fields are typed and validated automatically
fastify.post("/", {
  preHandler: [requireAuth, requireTenant],
  schema: { body: createCustomerBody },
}, async (request, reply) => {
  const { firstName, lastName, email } = request.body; // fully typed, safe to use
});

// WRONG — manual cast, no runtime validation
fastify.post("/", async (request, reply) => {
  const body = request.body as Record<string, unknown>; // FORBIDDEN
  const firstName = body.firstName as string;            // FORBIDDEN
});
```

### 2. Schema file location

One schema file per domain: `apps/api/src/lib/schemas/<domain>.ts`

```
apps/api/src/lib/schemas/
  common.ts           <- idParam, paginationQuery — ALWAYS reuse these
  auth.ts             <- passwordSchema
  customers.ts        <- createCustomerBody, updateCustomerBody, customerListQuery, ...
  jobs.ts             <- createJobBody, updateJobBody, jobListQuery, ...
  invoices.ts         <- createInvoiceBody, ...
  quotes.ts           <- createQuoteBody, ...
  tags.ts             <- createTagBody, ...
  pipelines.ts        <- createPipelineBody, ...
  bookings.ts         <- createBookingBody, availabilityQuery, ...
  catalog.ts          <- createCatalogItemBody, ...
  equipment.ts        <- createEquipmentBody, ...
  checklists.ts       <- createChecklistBody, ...
  calendar-events.ts  <- createEventBody, ...
  notifications.ts    <- markReadBody, ...
  tenants.ts          <- updateTenantBody, ...
  admin.ts            <- createAdminBody, impersonateBody, ...
  public-booking.ts   <- submitBookingBody, publicSlotsQuery, ...
```

### 3. Reuse common schemas — never redefine

```typescript
import { idParam, paginationQuery } from "../lib/schemas/common.js";

// idParam = z.object({ id: z.string().uuid() })
// paginationQuery = z.object({ page: z.coerce.number()..., limit: ..., search: ... })
```

### 4. Enum schema pattern

Mirror Drizzle pgEnums as Zod enums in the schema file — never import pgEnum directly into Zod:

```typescript
// In apps/api/src/lib/schemas/jobs.ts
export const jobStatusSchema = z.enum(["scheduled", "in_progress", "completed", "cancelled"]);
export const jobPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
```

### 5. Coerce query string numbers

Query params arrive as strings — always use `z.coerce.number()`:

```typescript
export const listQuery = paginationQuery.extend({
  page: z.coerce.number().int().min(1).default(1),   // "1" -> 1
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### 6. NEVER add a route without a schema

If you write a new route handler, its schema MUST be added to the domain schema file in the same commit. No exceptions.

**Service layer structure:**
```
apps/api/src/services/
  analytics/
    types.ts               # Shared param interfaces
    helpers.ts             # Parse helpers, label maps
    schemas.ts             # Zod schemas for raw SQL results
    cache.ts               # In-memory TTL cache
    queries/               # Individual query functions
      revenue.ts
      jobs.ts
      customers.ts
      quotes-invoices.ts
      bookings.ts
      dashboard-only.ts
    reports.service.ts     # Report section aggregators
    dashboard.service.ts   # Dashboard aggregator
  notifications.service.ts # Notification queries
```
