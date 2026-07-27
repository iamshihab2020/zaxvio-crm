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

Bookings & Calendar covers `/bookings`, `/schedule`, `/settings/bookings` and the public
`/book/[slug]` portal — they share one availability model and are audited together.

Customers covers `/customers`, `/customers/[id]` and its ten tabs. There is no `/contacts`
route — Customers is the contact entity.

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
