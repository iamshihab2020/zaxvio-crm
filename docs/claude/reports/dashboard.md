# Page Report — `/dashboard`

> Related: [[README|Reports Index]] | [[architecture]] | [[api-rules]] | [[security-rules]] | [[frontend-nextjs]] | [[backend-stack]] | [[todo]] | [[REPO_MAP_1]]

**Audited** 2026-07-27 · **Auditor** senior engineer + product design pass
**Status** ✅ **All 29 findings resolved 2026-07-27.** See [[#8-resolution]] for what changed,
how it was verified, and the two behaviour changes worth knowing about.

**Original verdict** Strong architecture, genuinely impressive breadth. Three defects made the
page show wrong numbers or take the API down.

---

## 1. Scope & method

Read end-to-end and cross-checked against each other:

| Layer | Files |
|-------|-------|
| Route | `apps/web/src/app/(dashboard)/dashboard/{page,dashboard-page-client,loading}.tsx` |
| Widgets | `apps/web/src/components/dashboard/home/` (20 files) |
| Client state | `hooks/queries/use-dashboard.ts`, `hooks/use-dashboard-widget-prefs.ts`, `lib/query-keys.ts` |
| Server action | `apps/web/src/actions/dashboard.ts` |
| API | `apps/api/src/routes/dashboard/index.ts`, `lib/schemas/dashboard.ts` |
| Service | `apps/api/src/services/analytics/{dashboard.service,cache,types,helpers,schemas}.ts` |
| Queries | `services/analytics/queries/{dashboard-only,revenue,jobs,customers,quotes-invoices,bookings}.ts` |
| Contracts | `packages/types/src/dashboard.ts`, `packages/database/src/schema/{enums,jobs,bookings,tenants}.ts` |

One behaviour was verified by execution rather than reading (see [[#DASH-01]]).

---

## 2. What has been built

### Data flow

```
page.tsx (RSC)  ──► getDashboardStats()  ──► GET /dashboard/stats
      │                (server action)              │
      │                                    requireTenant → Zod(dashboardStatsQuery)
      │                                              │
      └──► DashboardPageClient(initialStats)   getDashboardStats(db, params, granularity, pipelineId)
                    │                                 │
             useDashboardStats()               analyticsCache.getOrFetch (30s TTL, SWR)
             TanStack Query                           │
                    │                          Promise.all([...27 queries])
             11 widgets                               │
                                               DashboardStats
```

One endpoint, one round trip, 27 parallel queries, one cached blob. The route handler is
6 lines — exactly what [[api-rules]] §1 asks for.

### Feature inventory (11 widgets)

| Widget | Component | Backing data | Respects date picker? |
|--------|-----------|--------------|----------------------|
| Overdue alert banner | `overdue-alert-banner.tsx` | `getOverdueInvoiceSummary` | **No** — all-time |
| KPI pills ×3 | `kpi-pill.tsx` | jobsToday, quoteSummary, derived avg value | Partly |
| Revenue hero + range tabs | `revenue-range-chart.tsx` | `getRevenueTrend` + `getRevenueTotal` | Yes |
| Jobs Management (3 segments) | `jobs-management-panel.tsx` | pipeline / priority / service | Yes (pipeline: no) |
| Agenda timeline | `agenda-timeline.tsx` | events + jobs + bookings, next 7d | **No** — fixed 7d |
| Retention rate | `retention-chart.tsx` | `getRepeatCustomerRateByMonth` | **No** — fixed 6mo |
| Quote funnel | `quote-conversion.tsx` | `getQuoteSummary` | Yes |
| Invoice aging | `invoice-aging.tsx` | `getInvoiceAgingBuckets` | **No** — all open |
| Revenue by service | `revenue-by-service-chart.tsx` | `getRevenueByServiceType` | Yes |
| Top customers | `top-customers-card.tsx` | `getTopCustomersByRevenue` | Yes |
| Activity feed | `recent-activity-feed.tsx` | `getRecentActivity` (UNION) | **No** — last 10 |

Plus: `DashboardToolbar` (Ask AI → chatbot bus, last-updated indicator, customize popover),
`QuickActions`, `DateRangePicker`, per-widget show/hide persisted to localStorage.

---

## 3. What went well

Credit where it is due — several decisions here are better than the norm for this codebase.

- **Layering is clean and matches the rules.** Route → service → query files, every raw
  SQL result parsed through a Zod schema (`services/analytics/schemas.ts`). [[api-rules]]
  §§1–4 are followed literally, including the `db.execute(sql\`...\`)`-only-for-Postgres-
  features rule (`generate_series`, `FILTER`, CTEs, `date_trunc`).
- **One batched endpoint, not eleven.** 27 queries fan out under a single `Promise.all`
  behind one HTTP call. This is the right shape and it is rare to get right.
- **`generate_series` zero-fill on every trend** (`revenue.ts:31`, `customers.ts:154`,
  `dashboard-only.ts:83`) — charts have no phantom gaps on sparse data.
- **Stage colors read from the database** with a single source of truth and a validating
  resolver that tolerates legacy raw-CSS rows (`jobs-management-panel.tsx:191-201`). The
  comment explains *why*. This is the best-written function on the page.
- **Empty states are genuinely good.** `EmptyRevenueState` (`revenue-range-chart.tsx:194`)
  tells the user *what to do next* ("try 1Y or ALL") instead of shrugging.
- **SSR prefetch + hydration** — the page paints with data, no client waterfall.
- **Server-action boundary respected** — no client component touches the API directly.

---

## 4. Findings

29 findings. IDs are stable; cite them in commits.

### P1 — Critical

<a id="DASH-01"></a>
#### DASH-01 · Every job in the Agenda renders at "12:00 AM" · `FIXED (2026-07-27)`

`agenda-timeline.tsx:80-91` builds the job start time with `parseISO(j.scheduledStart)`.
But `scheduled_start` is a Postgres **`time`** column (`schema/jobs.ts:54`), serialised by
`dashboard-only.ts:150` as `j.scheduled_start::text` → `"09:00:00"`. `parseISO` cannot
parse a time-only string.

Verified by execution:

```
parseISO("09:00:00")  -> Invalid Date | isValid: false
parseISO("2026-07-28") -> Tue Jul 28 2026 00:00:00 | formatted: 12:00 AM
```

`isValid` fails, the code falls back to `parseISO(j.scheduledDate)` → local midnight, and
the label renders **12:00 AM for every job**. `scheduledEnd` fails the same way and is
dropped to `null` (line 102), so no job shows an end time either.

The events path is already correct — `eventToItem` uses `parseDateAt(e.eventDate,
e.startTime)` (line 39), and bookings use it too (line 57). Only jobs bypass the helper.

**Impact:** the Agenda is one of two hero widgets and its times are all wrong. Jobs also
sort ahead of everything else because midnight is the earliest timestamp.

**Fix:** one line — `const start = parseDateAt(j.scheduledDate ?? "", j.scheduledStart);`
and the same for `end`. The helper already exists directly above.

---

#### DASH-02 · Background cache revalidation can crash the API process · `FIXED (2026-07-27)`

`cache.ts:94-100`:

```ts
if (options.staleWhileRevalidate && age <= entry.ttlMs * 2) {
  void fetcher().then((data) => { this.store.set(k, {...}); });
  return entry.data as T;
}
```

No `.catch()`. `fetcher` is `fetchDashboardStats`, which runs 27 database queries. Any
rejection — a dropped Neon connection, a pool timeout, a Zod parse failure on schema drift
— becomes an **unhandled promise rejection**, and Node ≥15 terminates the process by
default. The request that triggered it already returned 200, so the crash is detached from
any user-visible error and will look random.

This is the single highest-risk line on the page: it converts a transient database blip
into an API outage for every tenant.

**Fix:** `.catch((err) => fastify.log.error({ err }, "analytics revalidate failed"))`.
Serve the stale entry regardless. Consider a process-level `unhandledRejection` handler as
a backstop.

---

#### DASH-03 · Changing the date range shows the wrong data and never refetches · `FIXED (2026-07-27)`

`dashboard-page-client.tsx:92-95` passes `initialStats` into the hook unconditionally, and
`use-dashboard.ts:10-19` forwards it as `initialData` with `staleTime: 60_000`.

`initialData` in TanStack Query applies **per query key**. The key includes the date range
(`query-keys.ts:140`), so when the user clicks `1Y`:

1. A new query key is created.
2. It has no cache entry → `initialData` seeds it with the **month-to-date** payload.
3. Because `initialDataUpdatedAt` is not supplied, `dataUpdatedAt` is stamped `Date.now()`.
4. `staleTime: 60_000` → the query is considered **fresh** → **no fetch is issued**.
5. `isLoading` is `false`, so `dashboard-page-client.tsx:129` never shows the skeleton.

Result: clicking `1Y`, `6M`, or any picker range displays month-to-date numbers labelled as
that range, with no spinner and no network request, for 60 seconds. The same applies to the
pipeline selector.

**Fix:** only pass `initialData` when the key matches what the server rendered, and stamp
it honestly:

```ts
const isInitialKey = /* dateParams deep-equals the server-rendered params */;
useQuery({
  queryKey: queryKeys.dashboard.stats(dateParams),
  ...(isInitialKey && initialData
    ? { initialData, initialDataUpdatedAt: initialFetchedAt }
    : {}),
});
```

Cleanest alternative: drop `initialData` and use `HydrationBoundary` with a server-side
`prefetchQuery` on the exact same key — that is what the rest of the app's prefetch pattern
does, and it cannot desynchronise.

---

### P2 — High (wrong or inconsistent numbers)

#### DASH-04 · Pipeline query missing `tenant_id` on the jobs join · `FIXED (2026-07-27)`

`dashboard-only.ts:212-213`:

```sql
LEFT JOIN jobs j ON j.status = jps.name AND j.pipeline_id = jps.pipeline_id
```

No `j.tenant_id = ${tenantId}`. [[security-rules]] §1 requires it on every tenant-scoped
read. Its own twin in the reports path has it (`jobs.ts:119-121`), so this is a regression,
not a convention.

Practical exploitability is low — the join runs through `pipeline_id`, a UUID already
scoped by the `WHERE jps.tenant_id` clause — so this is defence-in-depth rather than a live
leak. It is still the only query on this page without the guard, and the rule is absolute
for a reason: the next person to edit this join will not know that.

#### DASH-05 · Archived jobs counted in KPIs but excluded from the Agenda · `FIXED (2026-07-27)`

Bulk archive shipped 2026-04-10 and `jobs.archived_at` is live. On this page:

| Excludes archived | Includes archived |
|---|---|
| `getUpcomingJobs` (`dashboard-only.ts:155`) | `getJobsToday` (`jobs.ts:170`) |
| `getUpcomingBookings` (`dashboard-only.ts:182`) | `getJobCount` (`jobs.ts:156`) |
| | `getJobsByPriority` / `ByServiceType` (`jobs.ts:60,76`) |
| | `getDashboardPipeline` (`dashboard-only.ts:212`) |
| | `getWeeklyJobVolume` (`dashboard-only.ts:84`) |
| | `getTodaySchedule` (`dashboard-only.ts:69`) |
| | `getActiveCustomerCount` (`customers.ts:113`) |

So "Jobs Today: 7" can sit next to an agenda showing 4, and the dashboard pipeline totals
will not match the Jobs page after any bulk archive. Pick one rule — archived jobs are
almost certainly *not* operational work — and apply `AND archived_at IS NULL` uniformly.

#### DASH-06 · Priority enum mismatch — "emergency" is styled as routine · `FIXED (2026-07-27)`

The database enum is `standard | urgent | emergency` (`schema/enums.ts:10-14`). Two
components disagree:

- `jobs-management-panel.tsx:44-49` maps `urgent | high | normal | low`. `high`, `normal`,
  and `low` never occur; `standard` and `emergency` both fall through to
  `hsl(var(--brand))`, so the Priority segment renders **two different buckets in the same
  colour** and the legend is unreadable.
- `agenda-timeline.tsx:103-108` colours `urgent` red, `high` amber (dead branch), and
  everything else brand orange — so **`emergency`, the most severe priority, is styled
  identically to `standard`**.

For an HVAC dispatch board this is the wrong way round: emergency should be the loudest
thing on screen.

**Fix:** derive the map from the enum. Better, export a shared `PRIORITY_COLORS` from
`lib/constants/` keyed off the Drizzle enum so a future enum change breaks the build
instead of silently greying out a colour.

#### DASH-07 · Headline revenue and the revenue chart are computed over different windows · `FIXED (2026-07-27)`

- Headline (`revenue-range-chart.tsx:101`) ← `getRevenueTotal`, which filters
  `payment_date >= from AND payment_date <= to` (`revenue.ts:105-107`).
- Chart ← `getRevenueTrend`, which runs `generate_series` from `date_trunc(granularity,
  from)` to `date_trunc(granularity, to)` and each bucket spans a **full** interval
  (`revenue.ts:31-39`, `51-59`, `80-88`).

With week or month granularity the first bucket starts *before* `from` and the last extends
*past* `to`. A 6-month range at week granularity pulls in up to 6 extra days at the front.
The big number and the sum of the plotted area do not agree, and the discrepancy grows with
the range.

**Fix:** clamp the join to the requested window —
`AND ip.payment_date >= ${from}::date AND ip.payment_date <= ${to}::date` inside the
`LEFT JOIN` condition — or compute the headline as `SUM(trend.amount)` so there is one
source of truth.

#### DASH-08 · "Overdue" means two different things on the same screen · `FIXED (2026-07-27)`

- Overdue banner ← `getOverdueInvoiceSummary`: `WHERE status = 'overdue'`
  (`quotes-invoices.ts:226-228`) — a **stored** status that only changes when a cron job
  flips it.
- Invoice Aging ← `getInvoiceAgingBuckets`: buckets computed **live** from `due_date`
  against `CURRENT_DATE` (`quotes-invoices.ts:64-70`), for any invoice not `paid`/`void`.

An invoice 10 days past due whose status is still `sent` appears in the aging widget's
"1-30 days" bucket and is **absent from the overdue banner**. The two widgets sit two rows
apart and will visibly disagree whenever the cron lags or has not run.

**Fix:** define overdue once, in SQL, as `status NOT IN ('paid','void') AND due_date <
CURRENT_DATE`, and have both widgets use it. Keep the stored status for email triggers
only.

---

### P3 — Medium (waste, drift, UX defects)

#### DASH-09 · Tenant timezone is modelled and completely ignored · `FIXED (2026-07-27)`

`tenants.timezone` exists with a `America/Chicago` default (`schema/tenants.ts:29`) and is
never read by this page. Every "today" boundary is **UTC**:

- SQL `CURRENT_DATE` — Neon sessions run UTC (`jobs.ts:171`, `dashboard-only.ts:70,83,97`,
  `quotes-invoices.ts:66`, `customers.ts:115`).
- JS `new Date().toISOString().split("T")[0]` — `dashboard.service.ts:285,296,301,308`.

For a US Central tenant the dashboard rolls over to "tomorrow" at **6–7 PM local**. Jobs
Today empties out during the evening; the vs-yesterday comparison shifts with it. This will
be reported as a bug by the first real customer.

**Fix:** load the tenant timezone alongside `tenantId` and pass it through
`DateRangeParams`; replace `CURRENT_DATE` with
`(now() AT TIME ZONE ${tz})::date` and the JS helpers with a `date-fns-tz` equivalent.

#### DASH-10 · ~22% of the page's database work is thrown away · `FIXED (2026-07-27)`

`DashboardStats` ships four sections that **no component reads**:
`kpis.openInvoices`, `kpis.outstandingBalance`, `kpis.upcomingBookings`, `todaySchedule`
(searched all of `apps/web/src`; `dashboard-page-client.tsx` renders none of them).

That is 6 of the 27 queries — `getOpenInvoiceCount` ×2, `getOutstandingBalance` ×2,
`getPendingBookingCount`, `getTodaySchedule` — running on every cold cache fill, plus the
payload weight.

These look like casualties of the 2026-04-17 redesign that replaced `KpiGrid` with three
`KpiPill`s. Either surface them (outstanding balance is arguably more useful to a solo
contractor than "Avg Customer Value") or delete the queries and the type fields.

#### DASH-11 · Switching pipeline refetches all 27 queries · `FIXED (2026-07-27)`

`pipelineId` is part of the query key (`dashboard-page-client.tsx:87`, `query-keys.ts:141`)
but only feeds `getDashboardPipeline`. Changing the selector in the Jobs Management panel
re-runs the entire dashboard to repaint one segmented bar.

**Fix:** split the pipeline distribution onto its own small endpoint/query key, or have the
panel fetch it independently.

#### DASH-12 · Hidden widgets flash on every page load · `FIXED (2026-07-27)`

`useDashboardWidgetPrefs` returns a `hydrated` flag precisely to prevent this
(`use-dashboard-widget-prefs.ts:50,87`) and `dashboard-page-client.tsx:89` never reads it.
State starts at `DEFAULT_VISIBLE` (all 11 true), localStorage loads in `useEffect`, so a
user who hid 6 widgets sees all 11 paint and then 6 vanish — a large layout jump.

**Fix:** gate the widget grid on `prefs.hydrated`, or read localStorage in a
`useState` initialiser guarded for SSR.

#### DASH-13 · Cache is never invalidated by writes · `FIXED (2026-07-27)`

`analyticsCache.invalidateTenant()` is defined (`cache.ts:112`) and **called from nowhere**
in the repo. Creating a job, recording a payment, or accepting a quote does not refresh the
dashboard; the user waits out the 30s TTL and wonders why the number did not move.

**Fix:** call `invalidateTenant(tenantId)` from the mutating services (jobs, invoices,
payments, quotes). Cheap, and it makes the page feel live.

#### DASH-14 · No in-flight request coalescing · `FIXED (2026-07-27)`

`getOrFetch` (`cache.ts:74-109`) has no pending-promise map. On a cold key, N concurrent
requests each run all 27 queries. With SSR prefetch + client hydration, a single page load
can already issue two.

**Fix:** store `Promise<T>` in the map rather than the resolved value.

#### DASH-15 · Three different skeletons, none matching the layout · `FIXED (2026-07-27)`

`loading.tsx` renders 4 KPI cards and 3-column widget rows. `DashboardSkeleton`
(`dashboard-page-client.tsx:132`) is a different shape again. The real page has **3** KPI
pills and 2-column rows. Every load produces a visible reflow.

**Fix:** one skeleton, mirroring the real grid, used by both.

#### DASH-16 · `DayTimeline` is unreachable dead code · `FIXED (2026-07-27)`

`agenda-timeline.tsx:126-135` picks the mode from the agenda window, which the backend
hardcodes to today → +7 days (`dashboard.service.ts:120-122,244-245`). `span` is always 7,
so `mode` is always `"week"` and `DayTimeline` (lines 196-258, ~60 lines) never renders.

It also carries a latent bug for whenever it *is* enabled: line 216 silently drops any item
starting before 08:00 or after 20:00 — an emergency 6 AM call would vanish with no
indicator.

**Fix:** delete it, or wire the agenda window to the date picker and fix the clipping with
an "N earlier / N later" affordance.

#### DASH-17 · Aging bucket named `90plus` actually holds 61+ days · `FIXED (2026-07-27)`

`quotes-invoices.ts:64-70` produces `current` (not yet due), `30` (0-30 days late), `60`
(31-60), and `90plus` (**61+**). The UI label is "60+ days" (`invoice-aging.tsx:19`), so
users are not misled — but the key and the TS union member
(`packages/types/src/dashboard.ts:122`) both say 90, which is a trap for the next reader.

Standard AR aging is 1-30 / 31-60 / 61-90 / 90+. The page is missing a bucket, and "90+"
is the number a contractor actually cares about for write-offs.

**Fix:** rename to `61plus`, or add the real 61-90 and 90+ split.

#### DASH-18 · Five dead component files · `FIXED (2026-07-27)`

Nothing imports `kpi-card.tsx`, `kpi-grid.tsx`, `job-pipeline-chart.tsx`,
`revenue-chart.tsx`, `today-schedule.tsx` (`kpi-grid` imports `kpi-card`, but nothing
imports `kpi-grid`). Superseded by the 2026-04-17 redesign. Delete, and update
[[REPO_MAP_1]].

---

### P4 — Low / polish

All eleven `FIXED (2026-07-27)`. Note DASH-19 and DASH-20 were resolved by *removing* the
"Avg Customer Value" pill rather than repairing it — see [[#8-resolution]].

| ID | Finding | Location |
|----|---------|----------|
| DASH-19 | `avgCustomerValuePrev` divides by `count \|\| 1` while the current value guards `> 0` — with zero active customers the pill shows a spurious **-100%** | `dashboard-page-client.tsx:117-127` |
| DASH-20 | "Avg Customer Value" mixes windows: *range* revenue ÷ *trailing-90-day* active customers. Not a coherent metric; rename or recompute both over the range | `dashboard-page-client.tsx:117-121` |
| DASH-21 | Default granularity is `month` with a month-to-date range → the hero chart opens as a **single data point**. The same span would select `day` if the user touched the picker (line 106) | `dashboard-page-client.tsx:85,106` |
| DASH-22 | `toast.error` inside `queryFn` fires on every retry — up to 4 stacked toasts per failure. Move to the `error` state | `use-dashboard.ts:14` |
| DASH-23 | `computeTrend` returns `+100%` when previous is 0. Should render "New" — 100% is a real number that means something else | `kpi-pill.tsx:24-27` |
| DASH-24 | `queryKeys.dashboard.stats` types params as `{from?, to?}` but `granularity` and `pipelineId` are passed and hashed. It works; the type lies | `query-keys.ts:140-141` |
| DASH-25 | Cache has no size bound. Arbitrary `from`/`to` values mint unique keys retained up to 10 min (cleanup runs at 5 min, evicts at 2× TTL) | `cache.ts:18,122-129` |
| DASH-26 | No chart accessibility: no `aria-label`, no table fallback, legends distinguished by colour alone. Fails WCAG 1.4.1 | all chart widgets |
| DASH-27 | No error boundary. One widget throwing blanks the page. The `!stats` fallback is a bare sentence with **no retry button** | `dashboard-page-client.tsx:137-145` |
| DASH-28 | Server action `fetch` has no timeout/`AbortSignal` — a hung API hangs the RSC render with no TTFB | `actions/dashboard.ts:35-38` |
| DASH-29 | `titleCase` duplicated verbatim in two layers | `dashboard.service.ts:288`, `agenda-timeline.tsx:74` |

---

## 5. Product & design critique

**The page answers an analyst's questions, not a contractor's.** Eleven widgets, all on by
default, roughly 4,000px of scroll. The target user is a 1-3 person HVAC shop whose first
two questions each morning are *"what am I doing today"* and *"who owes me money."* Those
are the Agenda and Invoice Aging — currently rows 3 and 5. Revenue-by-service composition
and 6-month repeat-customer retention are quarterly-review metrics sitting above the fold.

*Recommendation:* ship an opinionated default of 5 widgets (Overdue → KPIs → Agenda →
Revenue → Invoice Aging) and let the customize popover add the rest. Defaults are the
product; the popover is the escape hatch.

**The date picker silently governs only half the page.** Six of eleven widgets ignore it
entirely (Agenda is fixed at 7 days, Retention at 6 months, Aging and the Overdue banner
are all-time, Activity is the last 10 events). Nothing on screen says so. A user who sets
"Last quarter" will reasonably read the Agenda as last quarter's agenda.

*Recommendation:* badge range-independent widgets with their actual window — "Next 7 days",
"Last 6 months", "All open" — in the card header. Small change, removes a whole class of
misreading.

**Dead ends.** Only one of eleven widgets is clickable (`Jobs Today` → `/jobs`). Top
Customers, aging buckets, quote funnel stages, and pipeline segments are all natural
drill-throughs into pre-filtered list pages, and none of them navigate. This is the
cheapest available uplift on the page.

**Widget preferences are device-local.** `localStorage` (`use-dashboard-widget-prefs.ts:32`)
means the layout does not follow the user across devices and is lost on cache clear. Fine
for v1; worth a `user_preferences` row once there is a second device in play.

**No first-run state.** A brand-new tenant sees eleven correctly-empty widgets. Each has a
good individual empty state, but eleven of them together reads as a broken product rather
than a new account. A single "Let's get you set up" panel that collapses once the first
customer and job exist would carry the whole first session.

**Trust markers are good.** The last-updated dot with the freshness pulse
(`dashboard-toolbar.tsx:60-79`) is a nice touch that most dashboards skip — though see
[[#DASH-03]]: it currently reports "now" for data that may be 60s stale and, worse, for a
range that was never actually fetched.

---

## 6. Recommended order of work

**Now — correctness and availability**
1. `DASH-02` add `.catch()` to the SWR revalidate (one line, prevents outages)
2. `DASH-01` fix agenda job times via `parseDateAt` (one line, visible to every user)
3. `DASH-03` fix `initialData` keying (the page currently lies when the range changes)

**Next — trustworthy numbers**
4. `DASH-08` single definition of overdue
5. `DASH-07` align the revenue headline with the chart window
6. `DASH-05` consistent `archived_at` filtering
7. `DASH-06` shared priority colour map derived from the enum
8. `DASH-04` add `j.tenant_id` to the pipeline join

**Then — waste and drift**
9. `DASH-09` tenant timezone (largest single change; scope it properly)
10. `DASH-10` surface or delete the four unused payload sections
11. `DASH-13` invalidate the cache on write · `DASH-14` coalesce in-flight fetches
12. `DASH-11` split the pipeline query off the main key
13. `DASH-12` gate on `hydrated` · `DASH-15` one skeleton · `DASH-16`/`DASH-18` delete dead code

**Product pass**
14. Opinionated 5-widget default; window badges on range-independent cards; drill-through
    links on Top Customers, aging buckets, funnel stages, pipeline segments.

---

## 7. Notes for the next auditor

- Every finding above was read in source. `DASH-01` was additionally verified by executing
  `date-fns` against the real column format. Nothing here is inferred from documentation.
- **Not verified:** runtime behaviour against a populated database — the Neon instance has
  no users yet (see [[todo]] → Post-Neon Cleanup), so no widget has been observed rendering
  real data. Re-run this audit after the first tenant has jobs, invoices, and payments;
  `DASH-07` in particular deserves a numeric check against known data.
- `docs/claude/api-docs/` documents `GET /dashboard/stats` but not the four unused response
  sections flagged in `DASH-10` — update it whichever way that finding is resolved.

---

## 8. Resolution

All 29 findings fixed on **2026-07-27**. `pnpm typecheck` and `pnpm build` both pass
(exit 0). Sections 2-6 above are preserved as the original audit and describe the
*pre-fix* state.

### Verification performed

Each of these was executed, not reasoned about:

| Check | Result |
|-------|--------|
| All 28 rewritten SQL queries run against Neon (incl. Zod row parsing) | 28/28 pass |
| SQL `(now() AT TIME ZONE tz)::date` vs JS `todayInTimezone(tz)` agree | exact match for `America/Chicago` and `Asia/Dhaka` |
| Date helpers across DST transitions, year boundaries, month rollback | pass |
| Previous-period math for multi-day, single-day, and default ranges | pass |
| Cache: concurrent cold requests, SWR failure, cold-key failure, 700-key spray, tenant invalidation | 10/10 pass, **no unhandled rejection escaped** |
| Agenda time rendering incl. untimed and end-only jobs | 6/6 pass |
| `initialData` seeding across 5 range-change scenarios | 5/5 pass |
| API boot: `/health` 200, `/dashboard/stats` 401, `/dashboard/pipeline` 401, `?from=notadate` 400 | pass |

At the moment of the timezone test the server clock read `2026-07-26 19:35 UTC` — UTC and
Chicago were on the 26th while Dhaka was already on the 27th, so the fix demonstrably
changes behaviour rather than being theoretical.

### Architectural changes

- **Tenant timezone is now plumbed end-to-end.** `requireTenant` selects `tenants.timezone`
  in the query it was already running (zero extra round trips) and puts it on
  `request.authUser.tenantTimezone`; `DateRangeParams` carries it; every `CURRENT_DATE`
  became `(now() AT TIME ZONE $tz)::date` and every `toISOString()` became
  `todayInTimezone(tz)`. Reports inherit this too.
- **`GET /dashboard/pipeline` is a new endpoint.** `pipelineId` was removed from
  `/dashboard/stats`. Changing the pipeline selector now costs one small query instead of
  the full fan-out, and the default pipeline still arrives with the main payload so the
  common case adds no request at all.
- **The query fan-out dropped from 27 to 21.** Six queries fed response fields no component
  read. `outstandingBalance` was kept but is now derived from the aging buckets already
  being fetched — a *better* metric for free — and promoted to a KPI pill.
- **One `onResponse` hook invalidates the analytics cache** after any successful mutating
  request, rather than 30 call sites that would drift.
- **Archived jobs are excluded uniformly**, via a shared `NOT_ARCHIVED` SQL fragment.
- **Overdue has one definition** — `status NOT IN ('paid','void') AND due_date < today` —
  used by both the banner and the aging buckets. The stored `status` column is now only for
  email triggers.

### Contract changes (breaking for any other consumer)

`DashboardStats` changed shape:

| Before | After |
|--------|-------|
| `kpis.thisMonthRevenue` | `kpis.rangeRevenue` (same data, honest name — it was never "this month" once a range was picked) |
| `kpis.outstandingBalance: { amount, previousAmount }` | `kpis.outstandingBalance: { amount, invoiceCount }` (all open, not range-scoped) |
| `kpis.openInvoices`, `kpis.upcomingBookings`, `todaySchedule`, `selectedPipelineId` | removed — nothing rendered them |
| `invoiceAging` bucket `"90plus"` = 61+ days | buckets `"90"` (61-90) and `"90plus"` (90+) |
| — | `range: { from, to }` added — the range the backend actually used |

### Two behaviour changes worth a look

1. **Default widget set is now six, not eleven.** Quote Funnel, Retention, Revenue by
   Service, Top Customers, and Activity Feed are off by default and one click away under
   Customize. Anyone who has already customised keeps their layout (stored prefs merge over
   the defaults). To revert, flip them back to `true` in `DEFAULT_VISIBLE` in
   `apps/web/src/hooks/use-dashboard-widget-prefs.ts`.
2. **"Avg Customer Value" was removed.** It divided range revenue by trailing-90-day active
   customers — two different windows, so the number meant nothing. Replaced with
   **Outstanding**, which a solo contractor checks daily. If you want a per-customer metric
   back, it should be computed over a single consistent window.

### Follow-ups not covered by this pass

- Widget preferences remain `localStorage`-only (device-local). Worth a `user_preferences`
  row once a second device is realistic.
- No first-run/empty-tenant state — a brand-new account still sees six correctly-empty
  widgets rather than a setup prompt.
- `DASH-07` (revenue headline vs chart window) is verified structurally but never against
  known numeric data, because the database is still empty. Re-check once a tenant has
  payments spanning a week/month boundary.

### Addendum — drill-through required fixes outside the dashboard

The first draft of the drill-through links assumed the target pages read `status`,
`priority`, `serviceType`, and `pipelineId`. **They did not.** Checking rather than
assuming turned up four separate problems, all now fixed:

1. **Jobs, Invoices, and Quotes ignored filter params entirely** — each read only its
   deep-link id (`jobId` / `invoiceId` / `quoteId`) and kept filters in local state. Links
   would have navigated correctly and silently applied no filter, which is worse than no
   link. All three now seed filter state from the URL through an allow-list
   (`readUrlEnumParam` in the Jobs page, `readUrlStatus` in `lib/url-filters.ts`) so a
   hand-edited URL cannot inject an arbitrary value into an API query param.
2. **Wrong param names, including a pre-existing bug** — the Jobs page reads `pipeline`,
   not `pipelineId`. Separately, the agenda had always linked to `/jobs?job=` and
   `/bookings?booking=` while those pages read `jobId` and `bookingId`, so **agenda rows
   have never opened the detail sheet they promise**. Both corrected.
3. **The Jobs page has no status filter** — status *is* the board's columns. A status
   bucket now opens the correct pipeline rather than appending a filter that would do
   nothing.
4. **`/invoices?status=overdue` reintroduced DASH-08 one click later** — the invoice list
   and its stats card both filtered on the stored `status` column, so the dashboard banner
   (due-date derived) and the list it links to would report different counts. Both the
   list filter and `GET /invoices/stats` now derive overdue from `due_date` in the tenant's
   timezone, matching `getOverdueInvoiceSummary`. Verified by executing both queries.

Also added `notInArray` to the `@hvac-saas/database` operator barrel — it was missing, and
[[backend-stack]] records why operators must come from the barrel rather than `drizzle-orm`
directly.
