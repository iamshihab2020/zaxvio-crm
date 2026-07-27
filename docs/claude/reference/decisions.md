# Architecture Decision Records

> Related: [[architecture]] | [[REPO_MAP_1]] | [[backend-stack]] | [[tenant-security]] | [[todo]]

Standing decisions and the reasoning behind them. Read before revisiting any of these — the tradeoffs are already worked out here.

---

## ADR-001 — Drop Supabase entirely: Neon + Cloudflare R2 + SSE

**Date**: 2026-07-26
**Status**: Accepted — in progress

### Context

The original Supabase project (`crkwcuudhjmfgdgllnyl`) was deleted. Its subdomain no longer resolves in DNS, which took out three things at once: Postgres, Storage, and Realtime. Postgres was moved to Neon first; Storage and Realtime stayed pointed at the dead project.

The key discovery during the audit: **all six Realtime usages are `broadcast`, not `postgres_changes`.** Broadcast is a pure websocket relay — the API explicitly publishes a message and browsers listening on that channel receive it. It never reads the database WAL. That means Realtime was never coupled to where the data lives, and replacing it does not require a database-aware service.

### Decision

Drop Supabase completely. No component of it remains.

| Concern | Was | Now | Why |
|---|---|---|---|
| Postgres | Supabase | **Neon** | Done 2026-07-26. PostgreSQL 18.4. `prepare: false` carries over unchanged — Neon's pooled endpoint needs it the same way Supabase's transaction pooler did. |
| Object storage | Supabase Storage | **Cloudflare R2** | 10 GB free permanently vs Supabase's 1 GB, and **zero egress fees** vs a 5 GB/month cap. This app is job-photo-heavy, so egress was the binding constraint. S3-compatible, so the SDK is standard. |
| Realtime | Supabase Realtime | **SSE from Fastify** | Every usage was already fire-and-forget broadcast, and we run a long-lived Fastify process. An in-process event bus plus one `text/event-stream` endpoint replaces it with no vendor and no cost. |

### Alternatives rejected

- **A fresh Supabase project for Storage + Realtime only** — would have been ~10 minutes with zero code changes, and Realtime would have kept working (broadcast doesn't care that data is in Neon). Rejected because the free tier caps file storage at 1 GB with 5 GB/month egress, and **free projects pause after 7 days of inactivity**, taking storage and realtime down together. Doing the migration now also costs the least it ever will: the old project is already deleted, so there is no data to migrate.
- **AWS S3** — no longer has a real free tier. Since July 2025 new accounts get a credit-based plan lasting ~6 months, after which the account closes automatically. That is a trial, not a free tier.
- **Local disk for uploads** — free and vendor-free, but most hosts wipe the filesystem on redeploy, so uploads would need a guaranteed persistent volume.
- **Polling instead of SSE** — simplest option, but impersonation approval would lag 5–15s, and it adds constant background request load.

### Consequences / constraints to remember

- **SSE works with a single API instance.** The event bus is in-process, so a second Fastify instance would not see events published by the first. Scaling horizontally requires swapping the bus for Redis pub/sub — the publish/subscribe interface is designed so only `lib/event-bus.ts` changes.
- **Two R2 buckets, not one.** Public vs private is a per-bucket setting in R2. `job-attachments` and `logos` are served by public URL; `invoices` and `quotes` PDFs are streamed through the API and must never be publicly reachable. Merging them into one public bucket would expose invoice PDFs to anyone who guesses a path.
- **All previously uploaded files are gone permanently.** Deleting the Supabase project deleted its objects. Invoice and quote PDFs self-heal — the download path falls through to on-the-fly regeneration when the stored file is missing. Job photos and tenant logos are unrecoverable.
- R2's free tier is 10 GB storage, 1M Class A (write) ops and 10M Class B (read) ops per month, unlimited egress.

### Revisit if

- A second API instance is needed → replace the in-process bus with Redis pub/sub.
- Storage exceeds 10 GB → R2 is $0.015/GB-month beyond the free tier, still with no egress charge.
