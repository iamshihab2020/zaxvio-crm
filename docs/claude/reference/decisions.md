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

---

## ADR-002 — One data-access pattern: `api-fetch` → server action → TanStack Query

**Date**: 2026-08-02
**Status**: Accepted — migration in progress

### Context

The [[architecture]] audit found **four** ways to reach the API coexisting, with
nothing naming the intended one (ARC-21):

1. Server action → TanStack Query hook (the majority)
2. Inline `useQuery` in a component, bypassing the hook layer (6 files)
3. Pure RSC — `page.tsx` awaits the action and passes props (all 7 superadmin pages)
4. A bare browser `fetch` to `NEXT_PUBLIC_API_URL` (1 component, propped up by a
   one-endpoint rewrite in `next.config.mjs`)

Underneath them sat **216 hand-written `fetch` blocks** across 20 action files,
returning four different response shapes, with `getCookieHeader()` duplicated 19
times and the string `"Network error"` written out 208 times.

That last part is the reason this ADR exists. The page audits had been finding
the same defect repeatedly — CUST-03, INV-11, QUO-07, QUO-29 are all "error
handling is wrong in one of the 216 copies". Fixing them one page at a time
could never converge, because there was no shared place for a fix to live.

### Decision

**`lib/api-fetch.ts` is the only module that may call the API.** Everything else
composes on top of it.

| Layer | Rule |
|---|---|
| `lib/api-fetch.ts` | The single `fetch`. Owns the base URL, the cookie header, timeouts, error normalisation and the `{data, error, status, notFound}` contract. |
| `actions/*.ts` | Thin. One `apiGet`/`apiSend`/`apiVoid`/`apiBulk`/`apiBinary` call each, plus the path and a fallback message. No `try/catch`, no `res.ok`, no cookie handling. |
| `hooks/queries/*.ts` | The only place components read or mutate. Owns the query key, `staleTime`, invalidation and the toast. |
| Components | Call hooks. **Never** an action directly, **never** `fetch`. |
| `page.tsx` (RSC) | May await an action for initial data, and must pass it through `seeded()` so the client consumes it instead of refetching. |

Pure RSC (pattern 3) stays legitimate for read-only screens with no client
interactivity — superadmin is the example. What is **not** legitimate is a
client component fetching directly (pattern 4, now removed) or a page inventing
its own `useQuery` (pattern 2, to be migrated).

### Why the transport stays a Server Action, for now

Reads travelling over Server Actions is a real cost (ARC-01): they are POST-only,
uncacheable, and React **serializes** them, so concurrent reads queue. That is
what made the Create Quote pickers feel slow.

The fix is known — extend the `/api/*` rewrite that already carries
`/api/auth/*` and `/events`, and let the browser call the API same-origin. It is
deliberately **not** bundled into this ADR, because it changes the rate limiter's
IP handling (`req.ip` + `INTERNAL_PROXY_SECRET` + `x-client-ip` today;
`x-forwarded-for` through a rewrite) and cannot be verified without running the
app. With `api-fetch.ts` in place it becomes a change in one file rather than
twenty, which is the point of doing this first.

### Consequences

- A fix to error handling, retries, timeouts or auth is now **one edit**.
- `status` and `notFound` come out of the transport, so the 404-vs-500 collapse
  (INV-11, QUO-07) is not expressible any more.
- Every request has a timeout. Previously a hung API hung the server action.
- Cost: 20 action files to migrate. `tags.ts` went 99 lines → 25 with no
  behaviour change; the rest are the same shape.
