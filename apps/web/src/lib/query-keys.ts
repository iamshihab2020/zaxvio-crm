/**
 * Centralized TanStack Query key factory.
 *
 * Convention:
 *   - `all`  → broadest scope for `invalidateQueries` (e.g. after any customer mutation)
 *   - `list`  → paginated / filtered list queries
 *   - `detail` → single-entity queries
 *   - `stats` → aggregate / KPI queries
 *
 * Invalidating `queryKeys.<domain>.all` blows away list + detail + stats for that domain.
 */
export const queryKeys = {
  // ── Customers ──────────────────────────────────────────────
  customers: {
    all: ["customers"] as const,
    list: (params: Record<string, unknown>) =>
      ["customers", "list", params] as const,
    stats: () => ["customers", "stats"] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    notes: (customerId: string, params?: Record<string, unknown>) =>
      ["customers", "detail", customerId, "notes", params ?? {}] as const,
    activities: (customerId: string, params?: Record<string, unknown>) =>
      ["customers", "detail", customerId, "activities", params ?? {}] as const,
    tags: (customerId: string) =>
      ["customers", "detail", customerId, "tags"] as const,
    photos: (customerId: string, params?: Record<string, unknown>) =>
      ["customers", "detail", customerId, "photos", params ?? {}] as const,
    summary: (customerId: string) =>
      ["customers", "detail", customerId, "summary"] as const,
    // Related lists rendered by the detail tabs. Nested under the customer's
    // detail key so one invalidation refreshes the whole page (CUST-22).
    related: (customerId: string, entity: string, params?: Record<string, unknown>) =>
      ["customers", "detail", customerId, "related", entity, params ?? {}] as const,
  },

  // ── Jobs ───────────────────────────────────────────────────
  jobs: {
    all: ["jobs"] as const,
    list: (params: Record<string, unknown>) =>
      ["jobs", "list", params] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
    assignees: () => ["jobs", "assignees"] as const,
    lineItems: (jobId: string) =>
      ["jobs", "detail", jobId, "lineItems"] as const,
    checklist: (jobId: string) =>
      ["jobs", "detail", jobId, "checklist"] as const,
    photos: (jobId: string, tag?: string) =>
      ["jobs", "detail", jobId, "photos", tag ?? "all"] as const,
    documents: (jobId: string) =>
      ["jobs", "detail", jobId, "documents"] as const,
    activities: (jobId: string, params?: Record<string, unknown>) =>
      ["jobs", "detail", jobId, "activities", params ?? {}] as const,
    // Nested under the job's detail key so editing a line item, an expense or
    // the recorded hours all invalidate the same subtree — the cost summary is
    // derived from every one of them and must never survive a change to any.
    costs: (jobId: string) => ["jobs", "detail", jobId, "costs"] as const,
    expenses: (jobId: string) => ["jobs", "detail", jobId, "expenses"] as const,
  },

  // ── Pipelines ──────────────────────────────────────────────
  pipelines: {
    all: ["pipelines"] as const,
    list: () => ["pipelines", "list"] as const,
    stages: (pipelineId: string) =>
      ["pipelines", pipelineId, "stages"] as const,
  },

  // ── Invoices ───────────────────────────────────────────────
  invoices: {
    all: ["invoices"] as const,
    list: (params: Record<string, unknown>) =>
      ["invoices", "list", params] as const,
    // Takes params now — the stats endpoint honours the same customer/job/date
    // filters as the list, so the cache must key on them too (INV-23).
    stats: (params: Record<string, unknown> = {}) =>
      ["invoices", "stats", params] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
  },

  // ── Quotes ─────────────────────────────────────────────────
  quotes: {
    all: ["quotes"] as const,
    list: (params: Record<string, unknown>) =>
      ["quotes", "list", params] as const,
    stats: () => ["quotes", "stats"] as const,
    detail: (id: string) => ["quotes", "detail", id] as const,
    activities: (quoteId: string, params?: Record<string, unknown>) =>
      ["quotes", "detail", quoteId, "activities", params ?? {}] as const,
  },

  // ── Bookings ───────────────────────────────────────────────
  bookings: {
    all: ["bookings"] as const,
    list: (params: Record<string, unknown>) =>
      ["bookings", "list", params] as const,
    stats: () => ["bookings", "stats"] as const,
    detail: (id: string) => ["bookings", "detail", id] as const,
    activities: (bookingId: string, params?: Record<string, unknown>) =>
      ["bookings", "detail", bookingId, "activities", params ?? {}] as const,
    availability: () => ["bookings", "availability"] as const,
  },

  // ── Equipment / Assets ─────────────────────────────────────
  equipment: {
    all: ["equipment"] as const,
    list: (params: Record<string, unknown>) =>
      ["equipment", "list", params] as const,
    detail: (id: string) => ["equipment", "detail", id] as const,
    refrigerantLogs: (equipmentId: string) =>
      ["equipment", "detail", equipmentId, "refrigerantLogs"] as const,
    history: (equipmentId: string) =>
      ["equipment", "detail", equipmentId, "history"] as const,
  },

  // ── Catalog ────────────────────────────────────────────────
  catalog: {
    all: ["catalog"] as const,
    list: (params: Record<string, unknown>) =>
      ["catalog", "list", params] as const,
    categories: () => ["catalog", "categories"] as const,
    detail: (id: string) => ["catalog", "detail", id] as const,
  },

  // ── Checklists ─────────────────────────────────────────────
  checklists: {
    all: ["checklists"] as const,
    list: (params: Record<string, unknown>) =>
      ["checklists", "list", params] as const,
    detail: (id: string) => ["checklists", "detail", id] as const,
  },

  // ── Calendar Events ────────────────────────────────────────
  calendar: {
    all: ["calendar"] as const,
    events: (params: Record<string, unknown>) =>
      ["calendar", "events", params] as const,
  },

  // ── Service Agreements / Maintenance Contracts ─────────────
  serviceAgreements: {
    all: ["serviceAgreements"] as const,
    list: (params: Record<string, unknown>) =>
      ["serviceAgreements", "list", params] as const,
    detail: (id: string) => ["serviceAgreements", "detail", id] as const,
    expiring: (params?: Record<string, unknown>) =>
      ["serviceAgreements", "expiring", params ?? {}] as const,
  },

  // ── Tags ───────────────────────────────────────────────────
  tags: {
    all: ["tags"] as const,
    list: () => ["tags", "list"] as const,
  },

  // ── Workflows (Automations) ────────────────────────────────
  // `validation` and `versions` nest under the workflow's detail key, so
  // publishing invalidates the whole subtree in one call — a publish changes
  // the version list, the dirty flag and (by clearing the errors it just
  // passed) the validation, and three separate invalidations is three chances
  // to forget one.
  workflows: {
    all: ["workflows"] as const,
    list: (params: Record<string, unknown>) =>
      ["workflows", "list", params] as const,
    detail: (id: string) => ["workflows", "detail", id] as const,
    validation: (id: string) => ["workflows", "detail", id, "validation"] as const,
    versions: (id: string) => ["workflows", "detail", id, "versions"] as const,
    builderContext: (id: string) =>
      ["workflows", "detail", id, "builderContext"] as const,
    quota: () => ["workflows", "quota"] as const,
    /**
     * Nested under `detail` so invalidating one automation clears its runs too.
     * A run list left cached after a manual Run is a page that says "never run"
     * about the run you just started.
     */
    runs: (id: string, params: Record<string, unknown>) =>
      ["workflows", "detail", id, "runs", params] as const,
    run: (id: string, runId: string) =>
      ["workflows", "detail", id, "runs", "detail", runId] as const,
  },

  // ── Dashboard ──────────────────────────────────────────────
  dashboard: {
    all: ["dashboard"] as const,
    /**
     * Every field here participates in the hashed key. The type previously listed
     * only `from`/`to` while callers also passed `granularity` — accurate, but only
     * by accident.
     */
    stats: (params?: {
      from?: string;
      to?: string;
      granularity?: "day" | "week" | "month";
    }) => ["dashboard", "stats", params ?? {}] as const,
    pipeline: (pipelineId?: string | null) =>
      ["dashboard", "pipeline", pipelineId ?? "default"] as const,
  },

  // ── Reports ────────────────────────────────────────────────
  reports: {
    all: ["reports"] as const,
    /**
     * Named fields rather than `Record<string, unknown>`: every one of them
     * changes the payload, and spelling them out is what stops a caller adding
     * a param that silently shares a cache entry with a different request.
     */
    stats: (params: {
      section: string;
      from?: string;
      to?: string;
      granularity?: "day" | "week" | "month";
    }) => ["reports", "stats", params] as const,
  },

  // ── Notifications ──────────────────────────────────────────
  notifications: {
    all: ["notifications"] as const,
    list: (params: Record<string, unknown>) =>
      ["notifications", "list", params] as const,
    unreadCount: () => ["notifications", "unreadCount"] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },

  // ── Tenant ─────────────────────────────────────────────────
  tenant: {
    all: ["tenant"] as const,
    settings: () => ["tenant", "settings"] as const,
    memberRates: () => ["tenant", "memberRates"] as const,
  },

  // ── Conversations (Supabase Realtime — rarely queried via TQ) ──
  conversations: {
    all: ["conversations"] as const,
    list: (params: Record<string, unknown>) =>
      ["conversations", "list", params] as const,
    messages: (conversationId: string, params?: Record<string, unknown>) =>
      ["conversations", conversationId, "messages", params ?? {}] as const,
  },

  // ── Admin (Super Admin panel) ──────────────────────────────
  admin: {
    all: ["admin"] as const,
    users: () => ["admin", "users"] as const,
    dashboard: () => ["admin", "dashboard"] as const,
    tenants: (params: Record<string, unknown>) =>
      ["admin", "tenants", params] as const,
    tenantDetail: (id: string) => ["admin", "tenants", "detail", id] as const,
    tenantAnalytics: (id: string) =>
      ["admin", "tenants", "analytics", id] as const,
    analytics: () => ["admin", "analytics"] as const,
    mrr: () => ["admin", "mrr"] as const,
    signups: () => ["admin", "signups"] as const,
    activeUsers: () => ["admin", "activeUsers"] as const,
    trialConversion: () => ["admin", "trialConversion"] as const,
    churnList: (days?: number) => ["admin", "churnList", days] as const,
    auditLog: (params: Record<string, unknown>) =>
      ["admin", "auditLog", params] as const,
    impersonationLog: (params: Record<string, unknown>) =>
      ["admin", "impersonationLog", params] as const,
    systemHealth: () => ["admin", "systemHealth"] as const,
    webhookLogs: (limit?: number) => ["admin", "webhookLogs", limit] as const,
    cronHistory: (limit?: number) => ["admin", "cronHistory", limit] as const,
    inactiveAlerts: () => ["admin", "inactiveAlerts"] as const,
    featureAdoption: () => ["admin", "featureAdoption"] as const,
  },
} as const;
