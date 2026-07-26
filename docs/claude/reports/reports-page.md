# Page Report — `/reports`

> Related: [[README|Reports Index]] | [[dashboard|/dashboard report]] | [[api-rules]] | [[security-rules]] | [[strict-rules]] | [[backend-stack]] | [[frontend-nextjs]] | [[todo]]

**Audited** 2026-07-27 · **Auditor** senior engineer + product design pass
**Status** `RESOLVED` — 28 findings (3 critical, 6 high, 12 medium, 7 low), **all 28 fixed 2026-07-27**

**Verdict** The chart work is the best-looking in the app and the section split is sensible.
But this page reports *money*, and three defects make it report money wrongly or silently:
a failed request renders as an empty report, the period-comparison line pairs the wrong
months, and the CSV export is a formula-injection vector reachable from the public booking
portal. It also missed every consistency fix applied to [[dashboard|/dashboard]] last pass.

---

## 1. Scope & method

| Layer | Files |
|-------|-------|
| Route | `apps/web/src/app/(dashboard)/reports/{page,reports-page-client,loading}.tsx` |
| Tabs | `components/dashboard/reports/{revenue,jobs,customers,quotes-invoices,bookings}-tab.tsx` |
| Shared UI | `components/dashboard/reports/{report-chart-card,report-data-table,report-kpi-row,reports-skeleton,export-csv-button}.tsx` |
| Client state | `hooks/queries/use-reports.ts`, `lib/query-keys.ts` |
| Server action | `apps/web/src/actions/reports.ts` |
| API | `apps/api/src/routes/reports/index.ts`, `lib/schemas/dashboard.ts` |
| Service | `apps/api/src/services/analytics/reports.service.ts`, `cache.ts`, `helpers.ts` |
| Queries | `services/analytics/queries/*` (shared with `/dashboard`) |
| Contracts | `packages/types/src/reports.ts` (170 lines) |

Three findings were verified by execution rather than reading: `REP-02` (bucket
misalignment, run against Neon), `REP-03` (CSV injection, run against the real
`escapeCell`), and the `CURRENT_DATE`/`archived_at` gaps (grep counts over the query
layer).

---

## 2. What has been built

Five report sections behind one endpoint, one section at a time:

```
ReportsPageClient (client-only, no SSR)
   │  activeTab + dateRange  ──►  useReportStats({section, from, to})
   │                                    │
   │                              getReportStats()  ──►  GET /reports/stats?section=…
   │                                                            │
   │                                            requireTenant → Zod(reportStatsQuery)
   │                                                            │
   │                                              getReportBySection (10min TTL, SWR)
   │                                                            │
   └──► <SectionTab data={…}>                          switch → 6-8 parallel queries
```

| Tab | Charts | Backing queries |
|-----|--------|-----------------|
| Revenue | trend (current vs previous), by service type, by payment method, avg job value, collection rate, top customers | 8 |
| Jobs | volume trend, by status, by priority, by service type, pipeline distribution, avg completion | 8 |
| Customers | new-customer trend, active vs inactive, repeat vs one-time, top by job count | 7 |
| Quotes & Invoices | conversion funnel, invoice status, aging detail, overdue trend, avg days to payment | 8 |
| Bookings | volume trend, by service type, by day of week, conversion rate | 6 |

Plus a date-range picker with 7 built-in presets + "Last 12 months" / "All time", and a
client-side CSV export per section.

---

## 3. What went well

- **Genuinely good chart implementation.** `ChartContainer` + `ChartConfig` with CSS-var
  colours (`var(--color-current)`) is the correct shadcn pattern, and it is applied
  consistently across all five tabs. This is better than the dashboard's hand-rolled
  Recharts usage.
- **Section-at-a-time fetching.** Only the active tab's queries run. With 5 sections × ~7
  queries, fetching all of them eagerly would be 37 queries per page load.
- **Correct cache tier.** `CACHE_TTL.REPORTS` (10min) rather than the dashboard's 30s —
  the right call for data nobody watches live.
- **`ReportDataTable` is properly generic** (`<T extends Record<string, unknown>>` with a
  typed `render`), and `ReportChartCard` / `ReportKpiRow` keep the five tabs consistent.
- **Every chart has an individual empty state** rather than rendering an axis with no data.
- **`getRevenueTrendByMonth` reuse** means the [[dashboard#DASH-07|DASH-07]] window-clamp
  fix from the dashboard pass benefits this page too — the revenue total and the trend now
  agree here for free.

---

## 4. Findings

### P1 — Critical

<a id="REP-01"></a>
#### REP-01 · A failed request is displayed as an empty report · `FIXED (2026-07-27)`

`use-reports.ts:15` throws on error:

```ts
queryFn: async () => {
  const res = await getReportStats(params);
  if (res.error) throw new Error(res.error);   // ← nothing catches this
  return res.data;
}
```

There is no `onError`, no toast, and no error branch in the page. The chain is:

`queryFn` throws → `data` is `undefined` → `tabDataMap[activeTab]` is `null` →
`renderTabContent` falls to `<EmptyTabState />` → the user reads:

> **"No data available for this period."**

So a 500, an expired session, a dropped connection, or a Zod parse failure on the server
all render as *"you had no revenue this period."* On a financial reporting page that is the
worst possible failure mode — it is not a blank screen the user distrusts, it is a
confident, wrong answer. A contractor could reasonably conclude their quarter was empty.

The Export button is also `disabled={!data}`, so the only signal that anything is wrong is
a greyed-out button.

**Fix:** surface `isError`/`error` explicitly. `DashboardLoadError`
(`components/dashboard/home/dashboard-load-error.tsx`) already exists from the dashboard
pass with a retry button — lift it to `components/reusable/` and use it here. The empty
state must only render on a *successful* response with no rows.

---

<a id="REP-02"></a>
#### REP-02 · The "previous period" line plots the wrong months · `FIXED (2026-07-27)`

`reports.service.ts:70-75` zips the two trend series **by array index**:

```ts
const revenueTrend = trendCurrent.map((row, i) => ({
  month: row.month,
  monthLabel: row.month_label,
  current: pFloat(row.amount),
  previous: pFloat(trendPrevious[i]?.amount),   // ← positional, not date-matched
}));
```

Both series come from `generate_series(date_trunc('month', from), date_trunc('month', to))`,
so their **lengths are not guaranteed to match**. A range that sits inside one calendar
month produces one current bucket, while the equal-length previous range straddles two.

Verified against Neon with the real `buildDateRangeParams`:

```
MISALIGNED  range 2026-03-01..2026-03-31
            current  [2026-03]           (1 bucket)
            previous [2026-01, 2026-02]  (2 buckets)   prev range 2026-01-29..2026-02-28
            zipped:  2026-03 <-> 2026-01
```

Selecting **"Last month"** — one of the seven built-in presets, and the single most
natural choice on a reports page — plots March's revenue against **January's**, and
discards February entirely. The chart legend says "Previous Period". It is off by one
month, silently, with no visual tell.

The reverse case (current longer than previous) is equally wrong but fails quietly:
`trendPrevious[i]` is `undefined`, `pFloat(undefined)` returns `0`, and the comparison line
drops to zero rather than being absent.

**Fix:** match on the `month` key, not the index:

```ts
const prevByOffset = new Map(trendPrevious.map((r, i) => [i, r]));
```
is *not* the fix. Either (a) align both series to a shared bucket count by generating the
previous range from the current range's bucket boundaries, or (b) stop pretending the two
periods are comparable month-for-month and render the previous period as a single
aggregate reference line. (b) is simpler and more honest for arbitrary ranges.

---

<a id="REP-03"></a>
#### REP-03 · CSV export is a formula-injection vector · `FIXED (2026-07-27)`

`export-csv-button.tsx:43-49` quotes cells containing `,`, `"`, or newline — the RFC-4180
rules — and nothing else. It does not neutralise leading `=`, `+`, `-`, `@`, tab, or CR,
which spreadsheet applications interpret as the start of a formula.

Verified against the real `escapeCell`:

```
"=1+1"                        -> "=1+1"                        EXECUTES
"=cmd|'/c calc'!A1"           -> "=cmd|'/c calc'!A1"           EXECUTES
"@SUM(1+1)*cmd|'/c calc'!A0"  -> "@SUM(1+1)*cmd|'/c calc'!A0"  EXECUTES
"+1-2" / "-2+3" / "\tHIDDEN"                                   EXECUTES

6 of 9 sample names would be interpreted as a formula.
```

The exported cells include **customer names** (`topCustomersByRevenue`,
`topCustomersByJobCount`), which are user-supplied. They are not only supplied by the
tenant's own staff: the public booking portal accepts a customer name from an
unauthenticated visitor, and the booking→customer flow persists it. So the payload can be
planted by someone with no account, and detonates later when the contractor exports a
revenue report and opens it in Excel or Sheets.

Exploitation needs the victim to open the file and approve the sheet's macro/DDE prompt, so
this is not unauthenticated RCE on its own — but "attacker-controlled string reaches a
spreadsheet formula" is exactly the [OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)
shape, and [[security-rules]] already treats untrusted input reaching a new interpreter as
a hard rule (§5 for LLM prompts, §6 for email headers). CSV is the same class and has no
rule yet.

**Fix:** prefix any cell whose first character is `= + - @ \t \r` with a single quote (or
wrap and prefix), and always quote such cells. Add a rule to [[security-rules]] so the next
export feature inherits it. `escapeCell` is the single choke point — this is a five-line fix.

---

### P2 — High

#### REP-04 · Bookings and customer reports count archived records · `FIXED (2026-07-27)`

`grep -c archived_at` over the query layer: `bookings.ts` → **0**, `customers.ts` → 3 (all
added during the dashboard pass, none covering the report-only queries).

So on this page:

| Query | Used by | Archived handling |
|---|---|---|
| `getBookingVolumeTrend`, `getBookingsByServiceType`, `getBookingsByDayOfWeek`, `getBookingKpis`, `getBookingConversionRate`, `getBookingCount` | Bookings tab | **includes archived** |
| `getUpcomingBookings` | dashboard agenda | excludes archived |
| `getActiveVsInactiveCustomers`, `getTopCustomersByJobCount`, `getRepeatVsOneTime` | Customers tab | **includes archived** |
| `getJobsByStatus/Priority/ServiceType`, `getJobVolumeTrend`, `getJobKpis` | Jobs tab | excludes (fixed last pass) |

The Jobs tab is now correct and the Bookings/Customers tabs are not, so the *same page*
applies two different rules. Booking counts on `/reports` will exceed the Bookings list
page after any bulk archive.

#### REP-05 · `getActiveVsInactiveCustomers` is the last `CURRENT_DATE` holdout · `FIXED (2026-07-27)`

`customers.ts:46` — `AND scheduled_date >= CURRENT_DATE - INTERVAL '90 days'`. Every other
"today" boundary in analytics moved to `(now() AT TIME ZONE $tz)::date` during the
dashboard pass; this one was missed because the dashboard does not call it. Same
consequence as [[dashboard#DASH-09|DASH-09]]: the active/inactive split shifts a day early
for a US Central tenant.

It also computes `inactive = total_customers − active_customers` where `total` has no
archived filter and `active` counts jobs without one — so an archived customer inflates
"inactive", and an archived job can keep a customer counted as "active".

#### REP-06 · Reports lost the crash-observability fix the dashboard got · `FIXED (2026-07-27)`

`reports.service.ts:46` passes `{ ttlMs, staleWhileRevalidate: true }` with **no `onError`**.
The dashboard's equivalent call now logs revalidation failures
([[dashboard#DASH-02|DASH-02]]). The shared `cache.ts` catch means reports can no longer
crash the process — but a failing background refresh here is now *completely silent*: no
log line, and users keep being served stale numbers indefinitely.

This asymmetry was introduced by the dashboard pass. Fixing it is two lines.

#### REP-07 · Reports cache key omits the tenant timezone · `FIXED (2026-07-27)`

`reports.service.ts:24` — `{ section, from, to }`. The dashboard key gained `tz` last pass
because query results now vary by timezone; this one did not. `getInvoiceAgingBuckets`
already takes `params.timezone` (line 252), so a tenant changing their timezone in Settings
keeps getting the old bucket split for up to 10 minutes with no way to force a refresh.

#### REP-08 · Two response fields are hardcoded zeros · `FIXED (2026-07-27)`

- `reports.service.ts:119` — `previousAvgJobValue: 0`
- `reports.service.ts:302` — `previousCollectionRate: 0`

Both ship in the typed contract as though they were computed. The UI currently sidesteps
them (the Avg Job Value KPI passes no `previousValue`, so no trend renders), which means
this is a **loaded gun rather than a live bug**: the first person to wire up
`previousValue={data.kpis.previousAvgJobValue}` gets a permanent "+100%" badge, because
`computeTrend` treats a zero baseline as +100% (see `REP-19`).

Either compute them or remove them from `RevenueReportData` / `QuoteInvoiceReportData`.

#### REP-09 · Revenue and job trends are month-only · `FIXED (2026-07-27)`

Every trend on this page hardcodes month buckets (`getRevenueTrendByMonth`,
`getJobVolumeTrend`, `getNewCustomersTrend`, `getBookingVolumeTrend`,
`getOverdueInvoiceTrend`). The default range is `subMonths(now, 3)` → **three bars**.
Choosing "Last 7 days" from the picker produces a **one-bar chart**.

The dashboard already accepts `granularity=day|week|month` and picks a sensible bucket from
the span. Reports — the page where someone actually studies a trend — cannot.

---

### P3 — Medium

#### REP-10 · The entire reports data path is untyped · `FIXED (2026-07-27)`

`actions/reports.ts:22` declares `data: any` (with an `eslint-disable`), `use-reports.ts`
returns it unchanged, and `reports-page-client.tsx:83-90` casts with
`tabData as RevenueReportData` five times. `export-csv-button.tsx:52` takes `data: any` too.

[[strict-rules]] §4 forbids `as any`/`as unknown` precisely because it moves failure from
compile time to runtime. Here the cast is unchecked in both directions: nothing validates
that the `revenue` section actually returned `RevenueReportData`, so a backend shape change
surfaces as `Cannot read properties of undefined` inside a chart — which, combined with
`REP-11`, blanks the page.

**Fix:** make `getReportStats` generic over the section, or return a discriminated union
`{ section: "revenue"; data: RevenueReportData } | …` so the switch narrows naturally.

#### REP-11 · No error boundary · `FIXED (2026-07-27)`

One malformed row in one chart unmounts the whole page. `WidgetErrorBoundary` was built
during the dashboard pass (`components/dashboard/home/widget-error-boundary.tsx`) and is
not reused here — it should move to `components/reusable/` and wrap each
`ReportChartCard`.

#### REP-12 · No chart is accessible · `FIXED (2026-07-27)`

`grep -l "aria-hidden|ChartDataTable"` over the five tabs returns **nothing**. Every chart
is bare Recharts SVG, and several legends (payment method, service type, status) encode the
series in colour alone — WCAG 1.4.1. `ChartDataTable` exists from the dashboard pass and
solves exactly this without touching the visual design.

#### REP-13 · No SSR prefetch — every visit flashes a skeleton · `FIXED (2026-07-27)`

`page.tsx` is nine lines that render a client component with no initial data. The dashboard
and all list pages prefetch server-side. Reports is the only major page that always starts
empty, and its first paint is a full-page skeleton.

#### REP-14 · Tab switches discard the visible report · `FIXED (2026-07-27)`

`useReportStats` sets no `placeholderData`, so switching tabs blanks the content area to
`ReportsTabSkeleton` even when the new section is already cached-adjacent. Adding
`placeholderData: (prev) => prev` keeps the previous tab visible while the next loads,
matching what the dashboard now does.

#### REP-15 · CSV exports roughly a third of each report · `FIXED (2026-07-27)`

`buildCsvRows` emits two datasets per section. The Revenue tab renders six — the export
silently omits revenue-by-service-type, revenue-by-payment-method, avg-job-value trend, and
the collection rate. A user exporting "the revenue report" gets a subset with no indication
anything was dropped.

#### REP-16 · CSV has no BOM and a colliding filename · `FIXED (2026-07-27)`

- No `﻿` prefix → Excel on Windows renders UTF-8 names as mojibake (`Café` → `CafÃ©`).
  The `escapeCell` test above confirms accented names pass through unescaped.
- Filename is `report-{section}-{today}.csv` using `new Date().toISOString()` — UTC, and
  **excludes the report's date range**. Exporting Q1 and then Q2 on the same day produces
  two files with identical names; the browser silently appends `(1)` and the user has no
  way to tell them apart.

#### REP-17 · Date range is computed from the browser clock · `FIXED (2026-07-27)`

`reports-page-client.tsx:65-68` defaults to `subMonths(new Date(), 3)`, and every preset in
`date-range-picker.tsx` uses `new Date()`. The dashboard was fixed by having the API echo
back the range it resolved in the tenant's timezone (`stats.range`); reports has no
equivalent, so a tenant working across a timezone boundary can request a range that differs
from the one they think they picked.

#### REP-18 · Unreachable branch returning the wrong status code · `FIXED (2026-07-27)`

`reports.service.ts:42` has a `default: return null` that `reportSectionEnum` makes
unreachable — Zod rejects an unknown section with a 400 before the service runs. The route
then handles that impossible case (`routes/reports/index.ts:27`) by returning **HTTP 200**
with `{ data: null, error: "Unknown section: …" }`, which the client would render as… an
empty report (`REP-01`). Dead code that models a failure mode incorrectly.

#### REP-19 · `computeTrend` still reports "+100%" from a zero baseline · `FIXED (2026-07-27)`

`report-kpi-row.tsx:22-27` is the same logic fixed in `KpiPill` as
[[dashboard#DASH-23|DASH-23]] — going from £0 to £4,000 is not "+100%", it is new. Two
copies of this function now exist with different behaviour.

#### REP-20 · Convoluted tab-data plumbing · `FIXED (2026-07-27)`

`reports-page-client.tsx:81-93` builds a five-key `TabDataMap` in which four keys are
*always* `null` by construction, then `renderTabContent` switches over it. The active
section's data is already in `tabData`; the map is pure indirection and the `?? null` on
each branch hides the `any` cast.

#### REP-21 · `ReportDataTable` keys rows by array index · `FIXED (2026-07-27)`

`report-data-table.tsx:65` — `<TableRow key={i}>`. Rows carry real ids (`c.id`); index keys
cause React to reuse DOM across re-sorts.

---

### P4 — Low / polish

All seven `FIXED (2026-07-27)`.

| ID | Finding | Location |
|----|---------|----------|
| REP-22 | `EmptyChart` is defined identically in all five tab files | `*-tab.tsx` |
| REP-23 | Revenue tab mixes semantics in one KPI row: "Total Revenue" is *payments collected*, "Avg Job Value" is `jobs.total_amount` (*booked*, uncollected). Two different meanings of money, side by side, unlabelled | `revenue-tab.tsx:80-105` |
| REP-24 | `getCustomerCount` compares `created_at` (timestamptz) against `${to}::date + INTERVAL '1 day'` — a timezone-fragile boundary that can include or drop a day | `customers.ts:99-106` |
| REP-25 | `URL.revokeObjectURL` fires synchronously after `a.click()`, and the anchor is never appended to the DOM — historically flaky outside Chromium | `export-csv-button.tsx:24-26` |
| REP-26 | `ReportsSkeleton` renders 5 KPI cards; tabs render 3-4, so the skeleton reflows on load | `reports-skeleton.tsx:19` |
| REP-27 | Raw `<h1>` instead of the shared `PageHeader` used by every other page — [[strict-rules]] §5 | `reports-page-client.tsx:107` |
| REP-28 | No quarter presets ("This quarter", "Last quarter") — the periods a contractor actually files taxes on | `date-range-picker.tsx:17-49` |

---

## 5. Product & design critique

**This page and the dashboard are converging on the same content.** Top customers by
revenue, revenue by service type, invoice aging, quote funnel, and job status now render on
both surfaces, from the same queries, with different components and — after `REP-04` and
`REP-05` — subtly different filtering rules. That is double the maintenance and a standing
invitation for the two pages to disagree in front of a customer.

*Recommendation:* make the split about **time and intent**, not entity. Dashboard = today,
operational, fixed windows. Reports = arbitrary historical range, comparative, exportable.
Anything appearing on both should be one shared component fed by one query.

**"Reports" implies something you can send someone.** For a solo contractor the real job to
be done is handing figures to an accountant or a lender. Today the only egress is a partial
CSV (`REP-15`) with a colliding filename (`REP-16`). No PDF, no print stylesheet, no
emailed monthly summary, no "download everything for this period".

*Recommendation:* one "Export full report" that includes every dataset in the section, with
the date range in the filename, is a bigger win than any additional chart.

**30 visualisations for a 1-3 person business.** Five tabs × ~6 charts. The dashboard pass
concluded the same thing and trimmed the default widget set from eleven to six. Reports has
no equivalent triage — every chart renders every time, and the ones that matter (collection
rate, avg days to payment, overdue trend) are buried below the fold behind decorative
distribution pies.

**The comparison story is half-built.** The Revenue tab has a "Current vs previous period"
line (which is wrong — `REP-02`), the Jobs and Customers tabs have previous-period KPI
badges, and Quotes/Bookings have partial ones with hardcoded zeros (`REP-08`). There is no
control over *what* it compares against — no "vs last year", no "vs same period last year",
which is the comparison a seasonal HVAC business actually cares about.

**Nothing is clickable.** Same finding as the pre-fix dashboard. "Top Customers by Revenue"
lists five names and none of them links to the customer. The aging detail table shows
counts per bucket with no path to the invoices.

---

## 6. Recommended order of work

**Now — stop reporting wrong numbers**
1. `REP-01` distinguish error from empty (reuse `DashboardLoadError`)
2. `REP-02` fix or replace the previous-period comparison
3. `REP-03` neutralise CSV formula injection + add a rule to [[security-rules]]

**Next — consistency with the dashboard pass**
4. `REP-04` archived filters on bookings + customer report queries
5. `REP-05` tenant timezone in `getActiveVsInactiveCustomers`
6. `REP-06` `onError` on the reports cache · `REP-07` add `tz` to the cache key
7. `REP-08` compute or delete the hardcoded-zero fields

**Then — capability and safety**
8. `REP-09` granularity control on trends
9. `REP-10` type the data path end-to-end · `REP-11` error boundaries
10. `REP-12` chart accessibility (reuse `ChartDataTable`)
11. `REP-13` SSR prefetch · `REP-14` `placeholderData` on tab switch
12. `REP-15`/`REP-16` complete the CSV, add BOM, put the range in the filename
13. `REP-17`-`REP-21` correctness polish

**Product pass**
14. Deduplicate against the dashboard; add a full-report export; drill-through on
    customer/invoice tables; a "vs same period last year" comparison mode.

---

## 7. Notes for the next auditor

- `REP-02`, `REP-03`, `REP-04`, `REP-05`, and `REP-12` were verified by execution or by
  grep counts over the source. The rest were read.
- **Not verified:** nothing on this page has been observed rendering real data — the Neon
  database still has no users (see [[todo]]). `REP-02`'s numeric impact in particular should
  be re-checked once a tenant has payments spanning several months.
- Several findings here exist *because* of the [[dashboard]] pass on 2026-07-27 — the
  shared analytics layer moved and reports did not move with it (`REP-05`, `REP-06`,
  `REP-07`). When fixing shared code, grep for every caller, not just the page being worked
  on. That lesson belongs in [[backend-stack]] once these are closed. ✅ written up.
- `REP-03` has no matching rule in [[security-rules]] yet. Any future export feature (PDF,
  XLSX, the planned accountant email) inherits the same risk until one is written.
  ✅ now [[security-rules]] §7.

---

## 8. Resolution — all 28 fixed (2026-07-27)

### 8.1 How each finding was closed

| ID | Fix | Verified by |
|----|-----|-------------|
| REP-01 | `use-reports.ts` returns the `{ data, error }` envelope instead of throwing; the page renders `LoadErrorState` with a retry when `error` is set, and the empty state is now reachable only from a *successful* response | reading + typecheck |
| REP-02 | New `compareFrom`/`compareTo` in `DateRangeParams`: the range shifted back by exactly its own bucket count. Pairing is provably safe because shifting both endpoints by whole buckets preserves the count | **executed** — 48 range × granularity combinations, JS `bucketCount` vs SQL `generate_series`, current vs compare lengths equal in all |
| REP-03 | `escapeCell` guards a leading `= + - @ TAB CR` on **string** cells only; numbers bypass so negative amounts stay numeric | **executed** — all 8 audit payloads neutralised, 4 safe values untouched, `-250.5` still numeric |
| REP-04 | `archived_at IS NULL` on every booking, customer, invoice and quote analytics query. Payment-sourced queries deliberately excluded — see 8.3 | executed (44 queries run) |
| REP-05 | `getActiveVsInactiveCustomers` takes `timezone`; boundary is `(now() AT TIME ZONE $tz)::date - INTERVAL '90 days'`. Both halves exclude archived, and `inactive` is `GREATEST(total − active, 0)` | executed |
| REP-06 | `onError` logs a failed background revalidation with `tenantId` + `section` | reading |
| REP-07 | Cache key is now `{ section, from, to, tz, granularity }` | reading |
| REP-08 | `previousAvgJobValue` from a second `getAvgJobValueTrend` over the compare window; `previousCollectionRate` from a second `getInvoiceKpis`. No hardcoded zeros remain | executed |
| REP-09 | New `queries/buckets.ts` — one `bucketSeries()` used by all five trends. `granularity` is a request param; omitted, the API infers day/week/month from the span and echoes the choice back | **executed** — `pickGranularity` 5/5, all three granularities run against Neon |
| REP-10 | `getReportStats` returns `ReportSectionResponse`, a union discriminated on `section`. Zero casts in the render path | typecheck |
| REP-11 | `WidgetErrorBoundary` lives inside `ReportChartCard` and `ReportDataTable`, so every card and table is isolated without repeating it in five files | reading |
| REP-12 | `ReportChartCard` takes `dataTable`; when present the chart is `aria-hidden` and an `sr-only` table carries the numbers. 13 charts covered | reading |
| REP-13 | `page.tsx` prefetches the revenue section server-side and seeds the client cache when params match | build |
| REP-14 | `placeholderData: (prev) => prev`. Cross-tab it still falls back to the skeleton — the payload shape differs and the `section` discriminant is what proves it | reading |
| REP-15 | `buildCsvRows` emits every dataset per section, plus a header block with the period, comparison period and granularity | **executed** — 27 datasets across 5 sections asserted present |
| REP-16 | UTF-8 BOM; filename is `{section}-report-{from}_to_{to}.csv` | executed |
| REP-17 | The API echoes `range`; the picker displays the resolved window instead of a browser-clock guess | reading |
| REP-18 | The dead `default: return null` is gone. `buildSectionResponse` is exhaustive with a `never` check, and the route no longer returns a 200 carrying an error | **executed** — `?section=bogus` → 400 |
| REP-19 | `computeTrend` matches `KpiPill`: a zero baseline renders a "New" badge, not "+100%" | reading |
| REP-20 | `TabDataMap` deleted; one `switch` over the response's own discriminant | typecheck |
| REP-21 | `rowKey` prop; both tables key on `row.id` | reading |
| REP-22 | One `EmptyChart` in `empty-chart.tsx`; five copies deleted | build |
| REP-23 | Relabelled — "Revenue Collected" vs "Avg Job Value", each with a `hint` line stating collected vs booked | reading |
| REP-24 | `getCustomerCount` and the quote queries compare `(created_at AT TIME ZONE $tz)::date`; the `+ INTERVAL '1 day'` boundary is gone | executed |
| REP-25 | Anchor is appended to the DOM, clicked, removed; `revokeObjectURL` deferred | reading |
| REP-26 | Skeleton renders four KPI cards, matching the widest tab | reading |
| REP-27 | `PageHeader`, with the resolved range and granularity as the subtitle | build |
| REP-28 | "This quarter", "Last quarter" and "Last year" added to the shared picker | build |

### 8.2 Verification actually run

| Suite | Result |
|-------|--------|
| SQL + date maths against Neon (`bucketCount` vs `generate_series`, compare-window alignment, all 44 rewritten queries incl. Zod row parsing, `pickGranularity`) | **134 / 134** |
| CSV export (injection payloads, safe values, numeric preservation, dataset completeness, filename/BOM) | **31 / 31** |
| Live endpoint contract: `401` unauthenticated · `400` unknown section · `400` unknown granularity · `400` malformed date · `/health` `200` | 5 / 5 |
| `pnpm typecheck` | exit 0 (10 / 10 tasks) |
| `pnpm build` | exit 0 (6 / 6 tasks) |

`pnpm lint` still fails with *"'eslint' is not recognized"* — eslint is not installed in
this workspace. Pre-existing and unrelated to these changes.

### 8.3 Rules this pass established

- **Archived rows are excluded from entity counts; money already received is never
  retroactively removed.** Booking, customer, invoice, quote and job metrics all filter
  `archived_at IS NULL`. Queries sourced from `invoice_payments` do not — archiving an
  invoice hides a document, it does not un-collect the cash. Stated at the top of
  `revenue.ts` and `quotes-invoices.ts` so the next person does not have to re-derive it.
- **"Previous period" means the same range shifted back by its own bucket count**, not by
  its own day span. Both are kept: `prevFrom`/`prevTo` (day span) still backs the
  dashboard's KPI deltas; `compareFrom`/`compareTo` backs everything on /reports, so the
  comparison line and the KPI badges can never disagree.
- **Overdue is always derived from `due_date`**, never `status = 'overdue'` — now true of
  `getOverdueInvoiceTrend` as well, which was the last holdout.
- **CSV/XLSX exports must neutralise formula leads** — [[security-rules]] §7.

### 8.4 Deliberate behaviour changes

1. **"Last month" now renders 31 daily bars, not one monthly bar.** With granularity
   inferred from the span, a ≤31-day range buckets by day. The old single-bar chart was
   not a trend.
2. **Booking, customer, invoice and quote totals will drop for any tenant that has bulk
   archived.** They were counting archived rows; the list pages never did.
3. **`revenueTrend[].previous` can be `null`.** The chart breaks the line rather than
   drawing a £0 point that never happened.
4. **Dashboard quote counts shift slightly** — `getQuoteSummary` now resolves `created_at`
   in the tenant's timezone and excludes archived quotes. Correct, and consistent with the
   Quotes page, but it is a dashboard-visible change made from a /reports pass.

### 8.5 Not done — product work, still open

The §5 critique is unaddressed by design; it is product direction, not defect repair.
Partial progress: customer tables on the Revenue and Customers tabs now link through to
`/customers/:id`, and the CSV is a complete section export. Still open:

- Deduplicate the overlap between /dashboard and /reports into shared components.
- A "vs same period last year" comparison mode (the one a seasonal trade actually wants).
- PDF / print styling — "Reports" still implies something you can hand an accountant.
- Triage which of the ~30 charts earn their place, the way the dashboard's default widget
  set was cut from eleven to six.

### 8.6 Files touched

**API** — `services/analytics/types.ts` · `queries/buckets.ts` *(new)* · `queries/revenue.ts` ·
`queries/jobs.ts` · `queries/customers.ts` · `queries/quotes-invoices.ts` ·
`queries/bookings.ts` · `reports.service.ts` · `dashboard.service.ts` ·
`routes/reports/index.ts` · `lib/schemas/dashboard.ts`

**Types** — `packages/types/src/reports.ts`

**Web** — `actions/reports.ts` · `hooks/queries/use-reports.ts` · `lib/query-keys.ts` ·
`app/(dashboard)/reports/{page,reports-page-client}.tsx` · all five `*-tab.tsx` ·
`report-chart-card.tsx` · `report-data-table.tsx` · `report-kpi-row.tsx` ·
`reports-skeleton.tsx` · `export-csv-button.tsx` · `empty-chart.tsx` *(new)* ·
`report-format.ts` *(new)* · `ui/date-range-picker.tsx` · `dashboard-page-client.tsx`

**Moved to `components/reusable/`** (shared by both pages) — `chart-data-table.tsx` ·
`widget-error-boundary.tsx` · `load-error-state.tsx` *(was `dashboard-load-error.tsx`)*

**Docs** — [[security-rules]] §7 · [[API_DOCUMENTATION_5]] Reports section *(rewritten —
it documented six endpoints that do not exist)* · [[backend-stack]] · [[frontend-nextjs]] ·
[[REPO_MAP_1]] · [[todo]] · `chatbot/knowledge-base.ts`
