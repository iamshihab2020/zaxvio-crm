# Page Reports

> Related: [[todo]] | [[architecture]] | [[REPO_MAP_1]] | [[lessons]] | [[deferred-fixes/README|Deferred Fixes]] | [[strict-rules]]

Per-page engineering + product audits. One file per page. Each report cross-checks the
frontend, the API route, the service/query layer, the shared types, and the docs, then
records what shipped, what is wrong, and what to do next.

## Index

| Page | Report | Date | Findings | Status |
|------|--------|------|----------|--------|
| `/dashboard` | [[dashboard]] | 2026-07-27 | 29 (3 critical, 5 high, 10 medium, 11 low) | ✅ all fixed |
| `/reports` | [[reports-page]] | 2026-07-27 | 28 (3 critical, 6 high, 12 medium, 7 low) | ✅ all fixed |
| Bookings & Calendar | [[bookings-calendar]] | 2026-07-27 | 34 (4 critical, 9 high, 14 medium, 7 low) | ✅ all fixed |
| `/customers` | [[customers]] | 2026-07-27 | 35 (3 critical, 9 high, 16 medium, 7 low) | ✅ all fixed |
| Jobs | [[jobs]] | 2026-07-29 | 42 (5 critical, 9 high, 20 medium, 8 low) + 6 found while fixing | ✅ all 48 fixed |
| Invoices | [[invoices]] | 2026-07-29 | 42 (5 critical, 9 high, 20 medium, 8 low) | ✅ all fixed |
| Quotes | [[quotes]] | 2026-08-01 | 35 (4 critical, 12 high, 13 medium, 6 low) | ✅ all fixed |
| **Architecture** (cross-cutting) | [[architecture]] | 2026-08-02 | 21 (2 critical, 6 high, 8 medium, 5 low) | 🟡 14 fixed, 1 withdrawn, 6 open |

Bookings & Calendar covers `/bookings`, `/schedule`, `/settings/bookings` and the public
`/book/[slug]` portal — they share one availability model and are audited together.

Customers covers `/customers`, `/customers/[id]` and its ten tabs. There is no `/contacts`
route — Customers is the contact entity.

Jobs covers `/jobs` (board · list · table), `/jobs/[id]`, the detail sheet,
`/settings/pipelines` and the stage editor. Its four criticals share one root cause —
`jobs.status` is both a lifecycle enum and a free-text pipeline stage name — so
[[jobs|§5.1]] should be decided before any of them is fixed individually.

Invoices covers `/invoices`, `/invoices/[id]`, the detail sheet, `/settings/invoices`,
the `routes/invoices` endpoints (20 at audit, 22 after), the PDF and the E-06/07/08/12
email paths. Unlike the five reports above it, the audit itself **was not verified by
execution** — see its method note. Its §2 is the finding that mattered most: of 17
remediation patterns established by the previous five audits, **one** had reached this
page. §7 records the answer to that — the sweeps were run repo-wide with counts, which
is the process change §2 asked for.

Quotes covers `/quotes`, `/quotes/[id]`, the detail sheet, `/settings/quotes`, the
public `/quote/[token]` acceptance portal, `routes/quotes` (19 endpoints),
`routes/public/quote.ts` (3), the PDF, `lib/quote-to-job.ts` and the E-13 email. It is
the control group for the [[invoices|§2]] process change: of the 6 patterns that were
swept repo-wide during earlier remediations, **6 reached this page**; of the 19 fixed
only where they were found, **0** did. [[quotes|§4]] has the table. Its worst finding
(QUO-02) is a three-day-old regression — `lib/quote-to-job.ts` writes `jobs.status` by
hand and never sets `stage_id`, so no job created from a quote is inside the stage model
the [[jobs]] audit built.

[[architecture]] is the first report that is **not** a page. It audits the data-fetching
architecture end to end, the API's layering, and dependency reality. It exists because the
page audits kept reaching the same conclusion — fixes do not propagate — and the cause turned
out to sit below the pages: there is no API client to fix error handling in once, and no
service boundary in 15 of 23 domains. Read [[architecture|§4]] with [[quotes|§4]].

## Conventions

- **Finding IDs** are `<PAGE>-NN` (e.g. `DASH-01`) so they can be referenced from
  commits, [[todo]], and [[deferred-fixes/README|deferred fixes]].
- **Severity**: `P1` breaks correctness or availability · `P2` wrong or inconsistent
  numbers · `P3` waste, drift, or noticeable UX defect · `P4` polish.
- **Status**: `OPEN` · `FIXED (YYYY-MM-DD)` · `DEFERRED → <file>` · `WONTFIX (reason)`.
- Every claim cites `file:line`. Anything not verified by reading code or running it is
  labelled **unverified**.
- Findings that cannot be fixed now because a feature is not live belong in
  [[deferred-fixes/README|deferred-fixes/]], not here — link them both ways.
