# Deferred Fixes

> Related: [[todo]] | [[strict-rules]] | [[bookings]] | [[tenants]] | [[invoices]] | [[notifications]]

Tracked bugs, validation gaps, and improvements discovered during end-to-end flow audits. These are **real issues** found in the codebase that are deferred because the related feature isn't live yet or the fix is lower priority.

## How This Works

- Each file covers one **domain** (invoices, jobs, quotes, customers, etc.)
- Issues are grouped by **trigger** — what feature/event must be built first
- Every issue has: severity, file path, line numbers, description, and suggested fix
- When you start building a feature, **check this folder first** for known issues in that domain

## Status Labels

- `DEFERRED` — Known issue, not yet fixed, waiting on a feature or prioritization
- `FIXED` — Issue resolved (move to bottom of file with date + commit)
- `WONTFIX` — Analyzed and decided not to fix (add reason)

## Index

| File | Domain | Deferred Issues | Last Audited |
|------|--------|-----------------|--------------|
| [invoices.md](./invoices.md) | Invoice system | 5 | 2026-04-12 |
| [bookings.md](./bookings.md) | Public booking, booking→job, availability, booking form | 26 | 2026-04-13 |
| [tenants.md](./tenants.md) | Tenant init, settings, slug, logo upload, middleware | 12 | 2026-04-13 |
| [notifications.md](./notifications.md) | Notification fan-out, Resend delivery, email crons, consent | 2 open (3 fixed) | 2026-08-07 |

## Rules

1. **Always check before building** — Before implementing a feature, search this folder for related deferred fixes
2. **Add during audits** — When auditing a flow end-to-end, log all deferred issues here
3. **Update on fix** — When a deferred issue gets fixed, mark it `FIXED` with date
4. **Be specific** — Include file paths, line numbers, and concrete fix suggestions
5. **Keep it actionable** — Don't log vague concerns; every entry should have a clear "what to do"
