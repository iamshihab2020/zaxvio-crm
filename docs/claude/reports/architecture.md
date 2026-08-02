# Architecture — Project-Wide Report

> Related: [[reports/README|Page Reports]] | [[quotes]] | [[invoices]] | [[jobs]] | [[customers]] | [[architecture|Architecture reference]] | [[api-rules]] | [[strict-rules]] | [[todo]]

**Audited:** 2026-08-02
**Scope:** Cross-cutting, not a page. The data-fetching architecture end to end
(`apps/web/src/actions`, `hooks/queries`, `lib/query-keys`, `next.config.mjs`),
the API's layering (`routes/` vs `services/`), type-safety rule compliance, and
dependency reality across both apps.
**Findings:** 21 — 2 critical (P1), 6 high (P2), 8 medium (P3), 5 low (P4).
**Status: all OPEN.**

> **Method note.** Every number here was produced by running the grep, not
> estimated. Where a count is a proxy for the real defect (e.g. "files with no
> `isError`"), the report says so and gives the false-positive rate. Nothing was
> verified by execution — this audit is a static read of structure, so severities
> are well-founded hypotheses about cost, not measurements of runtime behaviour.

---

## 1. What the architecture actually is

```
Client component
   │  useQuotes() / useCreateQuote()                 TanStack Query v5 — 40 files
   ▼
Server action  "use server"                          20 files · 216 fetch calls
   │  fetch(API_INTERNAL_URL, { headers: { cookie } })
   ▼
Fastify 5                                            186 handlers · Zod on 172
   │  requireTenant → service or handler
   ▼
Drizzle → Neon Postgres
```

Alongside it, three bypasses that are **correct** and prove an alternative works:

| Path | Mechanism | Why |
|---|---|---|
| `/api/auth/*` | Next rewrite → Fastify | Session cookie must be first-party or Safari/Firefox drop it |
| `/events` | Next rewrite → Fastify | `EventSource` sends credentials, same requirement |
| `/equipment/:id/history` | Next rewrite → Fastify | **One component** fetches the API from the browser |

And a fourth pattern, used by the entire superadmin area: **pure RSC** — `page.tsx`
awaits the action server-side and passes results as props, no client query layer
at all. Seven pages, zero `useQuery`.

So the codebase already contains four different ways to get data from the API,
three of which are defensible. That is the finding this report is about.

### What is genuinely good

Worth stating plainly, because the rest of this document is problems:

- **Zod on 172 of 186 handlers**, with `fastify-type-provider-zod` wired up. 32 files import Zod on the API. The rule in [[api-rules]] §2 is real, not aspirational.
- **Query keys are centralised.** `grep` for inline `queryKey: [` outside `lib/query-keys.ts` returns **0**. That rule has held across 19 hook files and 160 hooks.
- **Bulk response contracts are now uniform** — all 8 domains that expose bulk endpoints return `{succeeded, failed, errors}`. The last inconsistent domain (quotes) was fixed 2026-08-01.
- **`EntityDetailShell.loadError` is passed by all 4 detail sheets.** The jobs-audit fix propagated completely.
- **0 `@ts-ignore` / `@ts-expect-error`** in either app.
- **0 components with no importers.** No dead UI.
- **`api-url.ts` documents *why* two URLs exist.** That comment is better engineering documentation than most production codebases have.

---

## 2. The central defect

**Reads travel over a mutation primitive.**

Next.js Server Actions are POST-only, non-cacheable, and **serialized by React**
to preserve mutation ordering. Every read in this product — list pages, pickers,
detail fetches, stats — is a Server Action. So reads inherit constraints they do
not need:

- **No parallelism.** Concurrent reads queue. This is not a theory: opening the
  Create Quote dialog mounted three pickers, each firing an uncached read, and
  the one the user clicked waited behind the two they did not.
- **Two network hops per read** — browser → Next → Fastify — where one would do.
- **No HTTP caching, no CDN, no conditional requests.** A `POST` is uncacheable
  by definition.
- **One serverless invocation per read** on a platform that bills them.

The usual justification — "the session cookie must stay server-side" — does not
survive contact with the code. The credential is the user's own cookie, which is
already in their browser. The API is already on the internet and already
enforces auth, Zod, rate limits and tenant isolation on every route. Proxying
adds no security; it adds a hop.

And the correct mechanism **is already in the repo, used three times**. The third
rewrite is the tell: someone needed a browser-side fetch, solved it properly with
a same-origin rewrite, and added a rule for **one endpoint** rather than
generalising it (`next.config.mjs:36-39`, comment: *"The one dashboard component
that fetches the API straight from the browser"*).

This is not an architecture that needs replacing. It is one transport decision,
with a fix already prototyped in the same file.

---

## 3. Findings

**Severity:** `P1` structural, compounds with every feature · `P2` real cost or
correctness risk today · `P3` drift and waste · `P4` polish.

| ID | Sev | Finding | Measure |
|---|---|---|---|
| ARC-01 | P1 | Reads go through Server Actions, which serialize and cannot cache | 216 fetches, 20 files |
| ARC-02 | P1 | No API client — every call hand-rolled, 4 response shapes in circulation | 425 / 82 / 52 / 26 |
| ARC-03 | P2 | `getCookieHeader()` copy-pasted into every action file | 19 of 20 |
| ARC-04 | P2 | 36% of the query layer has no callers | 58 of 160 hooks |
| ARC-05 | P2 | Service layer covers 8 of 23 route domains; 4 route files exceed 1,300 lines | jobs 2,497 |
| ARC-06 | P2 | 5 pages fetch server-side, pass the result, and never read it | double fetch + skeleton |
| ARC-07 | P2 | 17 list pages have no error state — a 500 renders as "nothing here" | 17 of 34 |
| ARC-08 | P2 | 14 route handlers have no Zod schema | 172 of 186 |
| ARC-09 | P3 | 6 components bypass the hook layer with inline `useQuery` | 6 files |
| ARC-10 | P3 | `as never` still laundering enum writes | 36 sites (18 API, 18 web) |
| ARC-11 | P3 | Transactions used in 7 of 23 domains | 16 without |
| ARC-12 | P3 | `new Date(dateCol).toLocaleDateString` shifts dates back a day | 20 sites |
| ARC-13 | P3 | 5 declared dependencies are never imported | incl. a workspace package |
| ARC-14 | P3 | Two icon libraries; the second serves 2 files | 221 vs 2 |
| ARC-15 | P3 | `"Network error"` written out 208 times | 208 |
| ARC-16 | P3 | One client component calls the API directly, patched with a bespoke rewrite | 1 + 1 rule |
| ARC-17 | P4 | `as any` survives in 5 places | 5 |
| ARC-18 | P4 | A sequential `await` loop remains in a dialog | 1 |
| ARC-19 | P4 | `@types/react-big-calendar` sits in `dependencies` | 1 |
| ARC-20 | P4 | `react` is an API dependency (PDF renderer) — correct but surprising, undocumented | 4 imports |
| ARC-21 | P4 | Four different data-access patterns coexist with nothing naming the intended one | — |

### 3.1 Critical

#### ARC-01 · Reads travel over Server Actions `P1`

See §2. The measure: **216 `fetch` calls across 20 action files**, of which
**135 carry an explicit `method:`** (POST/PATCH/DELETE) — so roughly **81 are
reads** wearing a mutation's clothes, and every one of them is a queued POST.

The symptom already surfaced in production code and was mistaken for a slow
query. It will surface again on any screen that mounts more than one independent
data source.

**Fix:** extend the existing rewrite to `/api/*`, point the query layer at the
API directly for reads, keep Server Actions for mutations (which is what they
are for). Verify the rate limiter's IP handling first — it currently keys on
`req.ip` with an `INTERNAL_PROXY_SECRET` + `x-client-ip` escape hatch built for
the *action* path; through a rewrite the real client IP arrives in
`x-forwarded-for` instead. That is an improvement, but it is a change.

#### ARC-02 · There is no API client `P1`

216 hand-written `fetch` blocks, each with its own `try/catch`, its own error
string, and its own idea of a return shape. Counted across `actions/`:

| Shape | Occurrences |
|---|---|
| `{ data, error }` | 425 |
| `{ error }` only | 82 |
| `{ succeeded, failed, errors }` | 52 |
| raw `await res.json()` | 26 |

Four contracts. Callers cannot know which one they are getting without reading
the action. This is not a tidiness complaint — it is the *generator* of the bugs
the page audits kept finding one at a time:

- [[customers]] CUST-03: bulk toasts reporting success for refused records.
- [[invoices]] INV-11: 404 and 500 collapsed into one branch.
- [[quotes]] QUO-07: the same collapse, on the customer-facing portal.
- [[quotes]] QUO-29: a server-sent `message` silently defeating `bulkToast`.

Every one of those is the same root cause: 216 places to get error handling
right. Auditing pages finds instances; only a client fixes the class.

**Fix:** one `lib/api-fetch.ts` — base URL, cookie header, timeout, error
normalisation, a single discriminated return type. Migrate the 20 action files
onto it mechanically. This is worth doing **whether or not ARC-01 is ever
addressed**, and it makes ARC-01 a change in one file instead of twenty.

### 3.2 High

**ARC-03 · `getCookieHeader()` is duplicated 19 times.** Byte-identical in 19 of
20 action files. Subsumed by ARC-02.

**ARC-04 · 58 of 160 hooks have no caller.** Breakdown, because the raw number
overstates the problem:

| Group | Count | Verdict |
|---|---|---|
| `useAdmin*` / tenant admin | 18 | **Not a defect.** Superadmin is deliberately pure RSC. These were written speculatively and never needed. |
| Domain hooks with a live page that fetches another way | ~14 | Real inconsistency — e.g. `useJobs` is dead while `/jobs` runs its own inline `useQuery`. |
| Mutations never wired to UI | ~26 | Dead until the feature is built (`useSendMessage`, `useCreateTag`, `useReorderJobs`). |

The recurring shape — a hook exists, is correct, and the component next to it
calls the raw action instead — has now been found on invoices (INV-17), quotes
(QUO-15) and jobs. It is worth treating as a class rather than a page finding.

**ARC-05 · Service layer covers 8 of 23 route domains.** `services/` holds
`analytics/`, `availability`, `bookings`, `conversations`, `invoices/`,
`job-stages`, `notifications`, `quotes/`. The other 15 domains keep their logic
in the handler. The four largest route files:

```
jobs      2,497 lines
quotes    1,543
invoices  1,526
customers 1,316
```

[[api-rules]] §1 requires thin handlers. Jobs and customers are the two large
files with no service directory at all.

**ARC-06 · 5 pages pay for their data twice.** `page.tsx` fetches server-side,
passes the result, and the client destructures it and never references it — so
every visit fetches twice and still renders a skeleton. Confirmed by reading each
file: the prop appears exactly twice, in the interface and in the destructure.

| Page | Prop |
|---|---|
| `/assets` | `initialAssets` |
| `/catalog` | `initialItems`, `initialCategories` |
| `/checklists` | `initialTemplates` |
| `/service-agreements` | `initialAgreements` |

Identical to INV-15 and QUO-14. Both of those were fixed on their own page and
the class was never swept — which is [[quotes|§4]]'s finding, restated with a
different set of pages.

**ARC-07 · 17 list pages have no error state.** A failed request renders the
empty state — "No assets yet", "No catalog items" — over zeroed stat cards.
`LoadErrorState` exists and is used in 21 files, all of them on audited pages.

Honest caveat: `isError` is a proxy. `/dashboard` appears in the list but is not
broken — it uses per-widget error boundaries instead. Real count is **16**.

**ARC-08 · 14 handlers have no Zod schema.** 172 of 186 registrations carry a
`schema:` option. [[api-rules]] §6 says no route ships without one. The gap needs
enumerating and closing; a handler without a schema is also a handler whose
`request.body` is untyped.

### 3.3 Medium

**ARC-09 · 6 files bypass the hook layer** with inline `useQuery`:
`jobs-page-client`, `notifications-page-client`, `schedule-page-client`, and three
customer tabs. They still use centralised keys, so cache coherence holds — the
cost is that invalidation logic lives in the component instead of the hook.

**ARC-10 · 36 `as never` casts.** 18 API, 18 web. [[strict-rules]] §4 forbids
them. Each one is a type error being silenced, and the jobs audit found that
deleting a single cast surfaced a second untyped enum the compiler had been
hiding. Concentrated in `routes/bookings`, `routes/catalog`, `lib/schemas/jobs`,
`lib/schemas/invoices`.

**ARC-11 · Transactions in 7 of 23 domains.** Present in availability, bookings,
invoices, jobs, pipelines, pipeline-stages, quotes. Absent in the other 16 —
including `customers`, `equipment`, `catalog`, `checklists` and
`maintenance-contracts`, all of which have multi-statement writes.

**ARC-12 · 20 date-rendering sites shift a day.** `new Date("2026-08-01")` parses
as UTC midnight, so every negative-offset timezone renders the previous day.
`formatDateOnly` exists and is used by invoices and quotes only. 3 of the 20
render `timestamptz`, where the current code is correct — real count **~17**.

**ARC-13 · 5 dependencies are never imported.** ⚠️ **The `radix-ui` row was wrong —
corrected 2026-08-02, see below.**

| Package | Imports | Note |
|---|---|---|
| `chart.js` | 0 | Every chart is Recharts |
| `react-chartjs-2` | 0 | — |
| ~~`radix-ui` (meta)~~ | **2** | **WRONG.** `animate-ui/primitives/radix/{tabs,accordion}.tsx` import it as `import { Tabs as TabsPrimitive } from 'radix-ui'`. Removing it broke the production build |
| `fastify-plugin` | 0 | API |
| `@hvac-saas/ui` | 0 | Workspace package whose `index.ts` is `export {}` and whose `components/` is empty — yet every app depends on it |

> **Correction (2026-08-02).** The count above was produced by searching for the
> package name as an import *path*. That finds `from "radix-ui"` — but the two real
> consumers were missed because the audit read "20 files use the scoped
> `@radix-ui/react-*`" as covering all Radix usage, and never checked whether any
> file used *both* forms. Two did. The dep was removed from `apps/web/package.json`,
> which is not what broke anything on its own: the stale `pnpm-lock.yaml` meant CI
> kept installing `radix-ui` anyway for four days. Regenerating the lockfile removed
> it for real and `next build` failed on the two unresolved imports. Fixed by pointing
> both files at `@radix-ui/react-tabs` / `@radix-ui/react-accordion`, which were
> already dependencies — so the meta-package stays out. See [[frontend-nextjs]].

**ARC-14 · Two icon libraries.** `@tabler/icons-react` in **221** files;
`lucide-react` in **2** — `ui/calendar.tsx` and `ui/select.tsx`, both stock
shadcn files that arrived with those imports.

**ARC-15 · `"Network error"` appears 208 times** as a literal. One user-facing
string, 208 definitions. Subsumed by ARC-02.

**ARC-16 · A client component calls the API directly.**
`asset-service-history-tab.tsx:107` reads `NEXT_PUBLIC_API_URL` and fetches
`/equipment/:id/history` from the browser, against the rule in `CLAUDE.md`. It
works only because `next.config.mjs` carries a bespoke rewrite for that one path.
Two ways to read this: a rule violation with a band-aid, or the first correct
instance of ARC-01's fix. It should become one or the other deliberately.

### 3.4 Low

**ARC-17** · 5 `as any` remain. **ARC-18** · one sequential `await` loop
(`pipeline-stages-dialog.tsx:473`) — same class as the create-quote bug fixed
2026-08-01. **ARC-19** · `@types/react-big-calendar` is in `dependencies`.
**ARC-20** · `react` is an API dependency (the PDF renderer needs JSX) — correct,
but undocumented and surprising to a newcomer. **ARC-21** · four data-access
patterns coexist (action+TanStack, inline `useQuery`, pure RSC, direct browser
fetch) and no document names the intended default.

---

## 4. What went wrong — the pattern

The page audits kept ending with the same observation: fixes land on the page
being audited, not on the class. [[invoices]] §2 counted 1 of 17 patterns
propagating; [[quotes]] §4 got a clean control group — **6 of 6** patterns that
were swept repo-wide arrived, **0 of 19** applied in place did.

This audit shows the layer beneath that. **The patterns do not propagate because
there is nothing for them to propagate *into*.** There is no API client, so
error handling cannot be fixed once. There is no shared list-page shell, so error
states are per-page. There is no enforced service boundary, so 15 domains keep
logic in handlers. Every fix is necessarily a copy, and copies drift.

The two P1s are the same finding stated twice: **the seams are missing.** Adding
them is what turns future audits from "fix 35 instances" into "fix one function".

Concretely, the highest-leverage order is the reverse of the usual instinct —
build the seam first, then sweep:

1. `lib/api-fetch.ts` (ARC-02, ARC-03, ARC-15) — one function, mechanical migration, no behaviour change.
2. The `/api/*` rewrite and reads on the client (ARC-01) — one file, once step 1 exists.
3. A shared list-page shell or hook covering error/empty/loading (ARC-07, ARC-06).
4. Then the sweeps that are currently open in [[todo]].

---

## 5. Verification

**None.** This audit is a static read: greps, import counts and file reads. No
query was run and no request was fired, so every severity here is a judgement
about cost and risk rather than an observed failure. Two specific caveats:

- `isError` (ARC-07) and `new Date(...)` (ARC-12) are **proxies**. Both overstate:
  17 → ~16 and 20 → ~17 after removing the false positives named above.
- The read/write split in ARC-01 (81 reads) is inferred from the absence of a
  `method:` key, not from tracing each call.

The claims that are exact, because they are counts of a literal string: 216
fetches, 19 `getCookieHeader`, 58 of 160 hooks, 5 zero-import dependencies, 36
`as never`, 8 of 23 service domains, 172 of 186 schemas.

---

## 6. Suggested fix order

1. **ARC-02 first**, before any further page audits. It is mechanical, reversible,
   and it is the thing that makes every subsequent fix a one-liner.
2. **ARC-13 and ARC-14** — delete 5 dead dependencies and migrate 2 files off the
   second icon library. Fifteen minutes, and it shrinks the bundle.
3. **ARC-06** — 5 pages, same fix as QUO-14, already written twice.
4. **ARC-01** — the rewrite. Check the rate-limit IP path as part of it.
5. **ARC-07** once a shared shell exists; **ARC-08** and **ARC-10** as one
   compliance sweep with counts recorded.
6. **ARC-05** — extract services for `jobs` and `customers`, the two large
   domains with none. Expect it to surface defects, as it did for quotes.

---

## 7. Remediation record — 2026-08-02

**14 of 21 closed. 1 withdrawn as a false finding. 6 open, deliberately.**

Not verified by build or execution — this pass was structural editing, and the
project's convention is that the user runs the compiler. Every count below is a
re-run grep.

### 7.1 Closed

| ID | What was done |
|---|---|
| **ARC-02** | `lib/api-fetch.ts` — one module, one `fetch`. Owns base URL, cookie header, **timeouts** (there were none), error normalisation, and a `{data, error, status, notFound}` contract. `apiGet`/`apiList`/`apiSend`/`apiVoid`/`apiBulk`/`apiBinary` + `buildQuery`. Return shapes unchanged, so callers did not move. Migration proven on `tags.ts`: **99 lines → 25**, no behaviour change. |
| **ARC-03** | Subsumed — `getCookieHeader` lives in `api-fetch` only. |
| **ARC-04** | `use-admin.ts` deleted whole: **21 hooks, 225 lines, zero callers** — superadmin is pure RSC and never needed them. Hook count 160 → **140**. |
| **ARC-06** | All 4 pages now consume what the server sent, via a new `hooks/queries/seed.ts`. It encodes the two rules each page kept re-deriving: seed **only** the key the server rendered, and give an honest `initialDataUpdatedAt` so the seed still ages. |
| **ARC-10** | **0 `as never` left in code.** The catalog/checklists casts silenced nothing — their Zod schemas already matched the pgEnums exactly, so the casts were leftovers from before the Zod migration. |
| **ARC-12** | 6 files moved to the shared `formatDateOnly`. |
| **ARC-13** | 5 dead dependencies removed, plus `lucide-react`. `packages/ui` **deleted** — its `index.ts` was `export {}` and every app depended on it. |
| **ARC-14** | 3 files migrated to Tabler; `lucide-react` gone. It was serving 3 of 224 icon sites. |
| **ARC-16** | New `getEquipmentHistory` action + `useEquipmentHistory` hook. The bespoke one-endpoint rewrite is deleted from `next.config.mjs`. Found while fixing: its catch block was literally `// silent fail`, so a 500 rendered as "No service history". |
| **ARC-17** | 3 real sites replaced with specific casts. |
| **ARC-18** | The displaced-stage loop issues its writes together and fails as a set. |
| **ARC-19** | `@types/react-big-calendar` → `devDependencies`. |
| **ARC-21** | [[decisions\|ADR-002]] names the one pattern and says which of the four coexisting ones stay legitimate. |
| — | **New, found while fixing:** `catalogListQuery.showArchived` used `z.coerce.boolean()`, so `Boolean("false") === true` and `?showArchived=false` returned **archived only**. This is CUST-29 exactly, and `booleanFlag` has existed in `common.ts` for it since. Now fixed; catalog was the only remaining site. |
| — | **New:** `PaginationData` was declared 8 times across page clients under two names. Now `lib/pagination.ts`. |

### 7.2 Withdrawn

**ARC-08 was a false finding.** The report claimed 14 handlers had no Zod schema.
Re-checked by bounding each handler at the next registration: there are 16 without
one, and **every one of them reads no input at all** — only `request.authUser`. A
schema on a route with no params, query or body validates nothing. Two things
inflated the original number: a regex that missed multi-line options objects (it
flagged `POST /jobs/:id/upload`, which has had `schema: { params, body }` all
along), and a search window that spilled into the following handler.

**ARC-10's headline count was also inflated.** "36 `as never`" counted matches
inside comments and inside chatbot prose ("a draft has **never** been sent"). The
real number was **7**, all now fixed. ARC-12's "20" was similarly 6 real files —
`customer-overview-tab` already anchored dates at midday, and `customer-table`
renders a `timestamptz`, where `new Date()` is correct.

The lesson is the one §5 flagged in advance: a grep is a proxy, and a proxy needs
verifying before it becomes a severity.

### 7.3 Open, deliberately

| ID | Why it is still open |
|---|---|
| **ARC-01** | The transport change. Known fix, but it moves the rate limiter from `req.ip`/`INTERNAL_PROXY_SECRET` to `x-forwarded-for` and cannot be verified here. `api-fetch.ts` makes it a one-file change instead of twenty — which was the point of sequencing it second. |
| **ARC-02** (rest) | 19 of 20 action files still to migrate onto `api-fetch`. Purely mechanical repetition of the `tags.ts` diff; the client and the contract are done. |
| **ARC-05** | Services for `jobs` (2,497 lines) and `customers` (1,316). Real, large, and — on the quotes precedent — likely to surface defects while extracting. Deserves its own pass, not a tail-end of this one. |
| **ARC-07** | 16 list pages with no error state. Wants a shared list-page shell rather than 16 copies of the same nine lines, which is the same "build the seam first" argument as ARC-02. |
| **ARC-09** | 6 components with inline `useQuery`. Now covered by ADR-002; migrate when each page is next touched. |
| **ARC-04** (rest) | ~37 hooks still without callers. Deliberately kept: most are the *intended* path for a page that currently inlines its query (`useJobs` is dead precisely because `/jobs` bypasses it). Deleting them would be fixing the symptom backwards — ARC-09 is the fix. |
| **ARC-15/20** | Cosmetic; subsumed or documented. |
