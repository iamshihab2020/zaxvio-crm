# PRD: Data Fetching Architecture Upgrade

**Project:** Zaxvio CRM
**Type:** Architecture Improvement
**Priority:** High
**Author:** Engineering
**Last Updated:** 2026-04-14

---

## 1. Executive Summary

Zaxvio CRM's frontend currently fetches all data through 212 Server Actions across 20 domain files, with zero caching and no client-side state management library. Every request hits the Fastify API with `cache: "no-store"`, meaning identical data is re-fetched on every navigation, tab switch, and component mount. This PRD proposes introducing TanStack Query as the client-side data layer while preserving the existing Server Action architecture, adding strategic caching, and improving the user experience with background refetching, optimistic updates, and stale-while-revalidate patterns.

---

## 2. Current Architecture

### What We Have (Working Well)

| Layer | Implementation | Status |
|-------|---------------|--------|
| Auth | Better Auth with HTTP-only session cookies | Secure, production-ready |
| API Gateway | 212 Server Actions in `apps/web/src/actions/` | Consistent, centralized |
| Backend | Fastify (port 4000) with Zod validation on all routes | Solid |
| Real-time | Supabase Realtime (conversations, notifications) | Working |
| Type Safety | `@hvac-saas/types` inferred from Drizzle schema | End-to-end |
| Validation | Zod schemas on API + Server Actions | Enforced |

### Data Flow (Current)

```
Client Component
    --> Server Action (apps/web/src/actions/*.ts)
        --> fetch() with cookie forwarding
            --> Fastify API (port 4000)
                --> Drizzle ORM --> PostgreSQL
```

### What's Not Working

1. **Zero caching** — All 212 Server Actions use `cache: "no-store"`. Navigating from the customer list to a customer detail and back re-fetches the entire list. Dashboard stats re-fetch on every page visit.

2. **No background refetching** — Data goes stale silently. If another team member updates a job status, the current user sees outdated data until they manually refresh.

3. **No loading/error state management** — Each component independently manages `isLoading`, `error`, and `data` states with `useState` + `useEffect`. This leads to inconsistent UX (some pages show skeletons, some show spinners, some show nothing).

4. **No optimistic updates** — Every mutation (create, update, delete) waits for the full round trip before updating the UI. This makes the app feel sluggish, especially on slower connections.

5. **No request deduplication** — If three components on the same page need the same data (e.g., tenant settings), three identical requests fire.

6. **No pagination caching** — Switching between pages in a paginated table re-fetches from scratch. There is no prefetching of the next page.

---

## 3. Objectives

| # | Objective | Success Metric |
|---|-----------|---------------|
| 1 | Reduce redundant API calls | 40-60% fewer requests on repeat navigations |
| 2 | Improve perceived performance | Stale data shown instantly, refreshed in background |
| 3 | Standardize loading/error UX | Single pattern for all data-fetching components |
| 4 | Enable optimistic mutations | UI updates in <50ms for create/update/delete |
| 5 | Maintain Server Action architecture | Zero changes to the 212 existing Server Actions |
| 6 | No auth changes | Better Auth cookie flow remains untouched |

---

## 4. Proposed Solution

### 4.1 Add TanStack Query as the Client-Side Data Layer

TanStack Query wraps existing Server Actions — it does **not** replace them. Server Actions remain the only gateway to the Fastify API.

**New data flow:**

```
Client Component
    --> useQuery / useMutation (TanStack Query)
        --> Server Action (unchanged)
            --> fetch() with cookie forwarding (unchanged)
                --> Fastify API (unchanged)
```

**Why TanStack Query (not SWR, not React Query alternatives):**
- Battle-tested with Next.js App Router and Server Actions
- Built-in devtools for debugging cache state
- First-class support for optimistic updates, infinite queries, and prefetching
- 14KB gzipped — minimal bundle impact
- Already aligned with our React 18 stack

### 4.2 Preserve Server Actions as the Data Gateway

Server Actions are not going anywhere. They handle:
- Cookie forwarding for auth
- Server-side error normalization
- Type-safe request/response contracts

TanStack Query simply caches and manages the results of calling these Server Actions.

### 4.3 Strategic Caching by Data Type

Not all data needs the same caching strategy:

| Data Type | Examples | staleTime | gcTime | Refetch Strategy |
|-----------|----------|-----------|--------|-----------------|
| Static config | Tenant settings, pipelines, stages | 5 min | 30 min | On window focus |
| List data | Customers, jobs, invoices | 30 sec | 5 min | On window focus + interval (60s) |
| Detail data | Single customer, job detail | 30 sec | 5 min | On window focus |
| Dashboard/analytics | KPI cards, charts | 60 sec | 10 min | On window focus + interval (120s) |
| Real-time data | Conversations, notifications | 0 (always fresh) | 1 min | Via Supabase Realtime (existing) |
| User session | Current user, org membership | 10 min | 30 min | On auth events |

### 4.4 Standardized Query Key Convention

```typescript
// Pattern: [domain, scope, ...params]
// Examples:
["customers", "list", { page: 1, limit: 20, search: "" }]
["customers", "detail", customerId]
["jobs", "list", { pipelineId, status: "active" }]
["jobs", "detail", jobId]
["dashboard", "stats", { dateRange }]
["tenant", "settings"]
["pipelines", "list"]
```

All query keys are defined in a single file: `apps/web/src/lib/query-keys.ts`.

---

## 5. Functional Requirements

### FR-1: TanStack Query Provider Setup

- Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- Create `QueryClientProvider` wrapper in the app layout
- Configure sensible global defaults:
  - `staleTime: 30_000` (30 seconds)
  - `gcTime: 300_000` (5 minutes)
  - `refetchOnWindowFocus: true`
  - `retry: 1` (single retry on failure)

### FR-2: Query Hook Library

Create domain-specific query hooks that wrap existing Server Actions:

```
apps/web/src/hooks/queries/
  use-customers.ts      // useCustomers(), useCustomer(id), useCustomerMutations()
  use-jobs.ts           // useJobs(), useJob(id), useJobMutations()
  use-invoices.ts       // useInvoices(), useInvoice(id), ...
  use-quotes.ts
  use-bookings.ts
  use-dashboard.ts      // useDashboardStats(), useRevenueChart()
  use-pipelines.ts
  use-calendar.ts
  use-equipment.ts
  use-notifications.ts
  use-tenant.ts         // useTenantSettings()
  use-catalog.ts
  use-checklists.ts
  use-conversations.ts
  use-tags.ts
  use-admin.ts
```

Each hook file follows this pattern:

```typescript
// apps/web/src/hooks/queries/use-customers.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer } from "@/actions/customers";
import { queryKeys } from "@/lib/query-keys";

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getCustomers(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomer(id),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}
```

### FR-3: Optimistic Updates for High-Frequency Mutations

Implement optimistic updates for actions where immediate feedback matters:

| Action | Optimistic Behavior |
|--------|-------------------|
| Update job status (kanban drag) | Move card instantly, revert on error |
| Toggle notification read | Mark read instantly |
| Update customer field (inline edit) | Show new value instantly |
| Delete list item | Remove from list instantly, revert on error |
| Create new entity | Add to list with temporary ID, replace on success |
| Bulk archive/restore | Remove/add items instantly |

### FR-4: Prefetching for Predictable Navigation

- **List-to-detail**: When hovering over a list row, prefetch the detail data
- **Pagination**: When viewing page N, prefetch page N+1
- **Tab prefetching**: When viewing a job detail, prefetch the first inactive tab's data

### FR-5: Cache Invalidation Rules

Mutations must invalidate related caches:

| Mutation | Invalidates |
|----------|------------|
| Create/update/delete customer | `customers.list`, `customers.detail(id)`, `dashboard.stats` |
| Create/update/delete job | `jobs.list`, `jobs.detail(id)`, `dashboard.stats`, `pipelines.list` |
| Create/update invoice | `invoices.list`, `invoices.detail(id)`, `dashboard.stats`, `jobs.detail(jobId)` |
| Update tenant settings | `tenant.settings` |
| Job status change | `jobs.list`, `jobs.detail(id)`, `dashboard.stats` |

### FR-6: Error Handling

Standardize error handling through TanStack Query's built-in mechanisms:

- Global `onError` callback in QueryClient for unexpected errors (toast notification)
- Per-query `onError` for domain-specific handling
- Automatic retry with exponential backoff (1 retry, 1s delay)
- Error boundaries for catastrophic failures

### FR-7: Loading State Standardization

Replace per-component loading logic with TanStack Query states:

```typescript
const { data, isLoading, isFetching, error } = useCustomers(params);

// isLoading = true on first load (show skeleton)
// isFetching = true on background refetch (show subtle indicator)
// error = non-null on failure (show error state)
```

Adopt project convention:
- `isLoading` (no cached data) → Skeleton loader (existing pattern, per CLAUDE.md)
- `isFetching` (has cached data, refreshing) → Subtle top-bar progress indicator
- `error` → Error card with retry button

---

## 6. Non-Functional Requirements

### Performance

- Bundle size increase must stay under 20KB gzipped (TanStack Query is ~14KB)
- No increase in Time to First Byte — Server Actions still run server-side
- Background refetches must not block UI rendering

### Security

- No changes to auth flow — Better Auth cookies remain the sole auth mechanism
- Server Actions remain the only code that calls the Fastify API
- No API URLs or tokens exposed to the client bundle

### Compatibility

- Must work with Next.js 14 App Router
- Must work alongside existing Supabase Realtime subscriptions
- Must not break any existing Server Action signatures

### Developer Experience

- TanStack Query DevTools enabled in development
- Query keys auto-complete via TypeScript
- Consistent hook naming: `use<Entity>()` for lists, `use<Entity>(id)` for details

---

## 7. Migration Plan

### Phase 1: Foundation (Week 1)

**Goal:** Install TanStack Query, set up provider, create query key system.

- [ ] Install `@tanstack/react-query` and `@tanstack/react-query-devtools`
- [ ] Create `apps/web/src/lib/query-client.ts` — QueryClient factory with global defaults
- [ ] Create `apps/web/src/lib/query-keys.ts` — Centralized query key factory
- [ ] Create `apps/web/src/components/providers/query-provider.tsx`
- [ ] Add `QueryProvider` to `apps/web/src/app/layout.tsx`
- [ ] Add TanStack Query DevTools (dev mode only)
- [ ] Verify: existing app works unchanged with provider added

**Zero breaking changes. All existing code continues to work.**

### Phase 2: Dashboard + High-Impact Pages (Week 2)

**Goal:** Migrate the most-visited pages to TanStack Query hooks.

- [ ] Create `hooks/queries/use-dashboard.ts` — Dashboard stats, charts
- [ ] Create `hooks/queries/use-customers.ts` — Customer list, detail, mutations
- [ ] Create `hooks/queries/use-jobs.ts` — Job list (table + kanban), detail, mutations
- [ ] Create `hooks/queries/use-pipelines.ts` — Pipeline list, stages
- [ ] Migrate Dashboard page to use `useDashboardStats()`
- [ ] Migrate Customers list page to use `useCustomers()`
- [ ] Migrate Jobs kanban/table to use `useJobs()`
- [ ] Add optimistic updates for job status changes (kanban drag)
- [ ] Verify: pages load with cached data on back-navigation

### Phase 3: Remaining Domains (Week 3)

**Goal:** Migrate all remaining list/detail pages.

- [ ] Invoices — `use-invoices.ts`
- [ ] Quotes — `use-quotes.ts`
- [ ] Bookings — `use-bookings.ts`
- [ ] Calendar — `use-calendar.ts`
- [ ] Equipment/Assets — `use-equipment.ts`
- [ ] Catalog — `use-catalog.ts`
- [ ] Checklists — `use-checklists.ts`
- [ ] Conversations — `use-conversations.ts`
- [ ] Notifications — `use-notifications.ts`
- [ ] Tags — `use-tags.ts`
- [ ] Settings/Tenant — `use-tenant.ts`
- [ ] Reports — `use-reports.ts`
- [ ] Admin — `use-admin.ts`

### Phase 4: Advanced Patterns (Week 4)

**Goal:** Add prefetching, pagination caching, and optimistic updates across all domains.

- [ ] Implement hover-prefetch on all list-to-detail navigations
- [ ] Implement pagination prefetching (next page)
- [ ] Add optimistic updates for all create/update/delete mutations
- [ ] Add background refetch indicator (top-bar progress)
- [ ] Audit and tune staleTime/gcTime per domain
- [ ] Load test: verify no performance regression
- [ ] Remove unused `useState`/`useEffect` data-fetching patterns from migrated components

---

## 8. Files Changed

### New Files

```
apps/web/src/lib/query-client.ts           # QueryClient config
apps/web/src/lib/query-keys.ts             # Centralized key factory
apps/web/src/components/providers/query-provider.tsx
apps/web/src/hooks/queries/use-customers.ts
apps/web/src/hooks/queries/use-jobs.ts
apps/web/src/hooks/queries/use-invoices.ts
apps/web/src/hooks/queries/use-quotes.ts
apps/web/src/hooks/queries/use-bookings.ts
apps/web/src/hooks/queries/use-dashboard.ts
apps/web/src/hooks/queries/use-pipelines.ts
apps/web/src/hooks/queries/use-calendar.ts
apps/web/src/hooks/queries/use-equipment.ts
apps/web/src/hooks/queries/use-catalog.ts
apps/web/src/hooks/queries/use-checklists.ts
apps/web/src/hooks/queries/use-conversations.ts
apps/web/src/hooks/queries/use-notifications.ts
apps/web/src/hooks/queries/use-tags.ts
apps/web/src/hooks/queries/use-tenant.ts
apps/web/src/hooks/queries/use-reports.ts
apps/web/src/hooks/queries/use-admin.ts
```

### Modified Files

```
apps/web/package.json                      # New dependencies
apps/web/src/app/layout.tsx                # Add QueryProvider
apps/web/src/app/(in-app)/**/*-page-client.tsx  # Migrate to query hooks
apps/web/src/components/dashboard/**/*.tsx  # Use query hooks instead of direct Server Action calls
```

### Unchanged Files

```
apps/web/src/actions/*.ts                  # ALL Server Actions stay exactly as they are
apps/api/**                                # Entire API backend untouched
packages/**                                # All shared packages untouched
apps/web/src/lib/auth-client.ts            # Auth unchanged
apps/web/src/lib/supabase-client.ts        # Realtime unchanged
```

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Stale data shown to users | Medium | Medium | Conservative staleTime defaults (30s); refetch on window focus; real-time channels for critical data |
| Cache invalidation bugs | Medium | High | Strict invalidation rules in mutation hooks; integration tests for cache behavior |
| Bundle size increase | Low | Low | TanStack Query is 14KB gzipped; well within budget |
| Migration regressions | Medium | Medium | Migrate one page at a time; keep old code working until hook is verified; feature flag if needed |
| Developer confusion (two patterns) | Medium | Low | Document the migration path clearly; lint rule to warn on direct Server Action calls from new components |
| Hydration mismatches | Low | Medium | Use `placeholderData` instead of `initialData` for server-rendered pages; test SSR behavior |

---

## 10. What This PRD Does NOT Cover

These are adjacent improvements that may be worth pursuing separately:

- **Server-side caching** (Next.js `unstable_cache` or `revalidateTag`) — Worth exploring after client-side caching proves the ROI. Would reduce API load further.
- **WebSocket migration** — Currently using Supabase Realtime broadcast channels. If we outgrow this, a dedicated WebSocket layer (Fastify `@fastify/websocket`) would be a separate effort.
- **API response compression** — Fastify supports gzip/brotli via `@fastify/compress`. Separate from data fetching.
- **Edge caching / CDN** — Only relevant after we have cache headers and a deployment strategy that supports it.
- **BFF layer / Next.js API routes** — The current Server Action pattern already serves as a BFF. Adding a separate `/api/*` proxy layer would add complexity without clear benefit.
- **Auth migration** — Better Auth with HTTP-only cookies is already secure. No changes needed.

---

## 11. Success Criteria

- [ ] All 20 domain pages use TanStack Query hooks instead of direct Server Action calls in components
- [ ] Navigating back to a previously-visited page shows cached data instantly (no loading skeleton)
- [ ] Dashboard page loads in under 200ms on repeat visits (cached)
- [ ] Kanban drag-and-drop updates UI in under 50ms (optimistic)
- [ ] TanStack Query DevTools show no duplicate active queries on any page
- [ ] Zero changes to Server Action files (`apps/web/src/actions/`)
- [ ] Zero changes to API backend (`apps/api/`)
- [ ] Bundle size increase under 20KB gzipped
- [ ] All existing Vitest and Playwright tests pass without modification
