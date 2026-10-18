# Todo

> Related: [[workflow]] | [[planner]] | [[lessons]] | [[decisions]] | [[deferred-fixes/README|Deferred Fixes]] | [[wf-PROGRESS]]

Task tracking for the Zaxvio CRM project. Detail lives in git history; the long-form version of this
file (every finding, proof and caveat up to 2026-10-17) is `git show f6327fe:docs/claude/todo.md`.

---

## In Progress

### Deploy: `9893fa9` failed on Vercel, `c04e229` fixed it (2026-10-18)
GitHub Actions CI never runs: the GitHub account is locked over billing.
- [x] Type error at `admins-page-client.tsx:136` (implicit `any` on untyped action data) fixed; 7 ambiguous Tailwind `duration-[…]`/`ease-[…]` classes rewritten as arbitrary properties.
- [x] `c04e229` deployed green; `zaxvio-crm-web.vercel.app` serves the new landing.
- [ ] `pnpm typecheck` + `pnpm lint` before the next push: `next build` reports only the first error, and ~290 files have never been checked.

### Rebrand + animation pass — written 2026-10-18, never rendered
Both are in Completed. Nothing has been typechecked, linted or opened in a browser (user's call).
- [ ] `pnpm typecheck` + `pnpm lint`, then a browser pass in both themes: open/close a dialog, an alert dialog, a sheet and the phone drawer (overlays moved from motion springs to CSS); navigate between pages behind a skeleton (late `data-stagger`); change a dashboard date range (figures count, charts redraw); drag a kanban card; flip calendar weeks; reduced motion on.
- [ ] Consolidate the duplicate hooks the parallel agents wrote: "arrived by client navigation" (`superadmin/use-arrived-by-navigation.ts`, `settings/use-arrival-stagger.ts`) and "flash a changed row" (`use-row-flash`, `use-new-ids`, superadmin `useChangeFlash`).
- [ ] Regenerate the Impeccable sidecar `apps/web/.impeccable/design.json` from the new DESIGN.md (it still describes cream + orange).
- [ ] The pipeline-stage colour presets offer "brand" and "blue", which are now nearly the same colour.
- [ ] Later, with the logo: the landing illustrations and PDF fonts (PDFs use the blue but keep Helvetica).

### Responsive app + dashboard redesign — written 2026-10-18, never rendered
Phases 1–4 are in Completed. Nothing here has been typechecked, linted or opened in a browser (user's call: no checks between phases).
- [ ] `pnpm typecheck` + `pnpm lint`, then a browser pass at 375/768/1024/1440 in both themes: the dashboard, every list page, a detail page and sheet, the job board (swipe vs press-and-hold drag on a real phone), the calendar's day view and task sheet, the builder's read-only mode, superadmin.
- [ ] Arbitrary Tailwind values to confirm in the first build: `md:max-w-[min(var(--sheet-w),100vw)]`, `max-w-[calc(100vw_-_var(--sidebar-w,0px)_-_1rem)]`, `md:max-xl:sr-only`, `[@media(hover:hover)]:group-hover:*`. (The Vercel log for `9893fa9` flagged 7 ambiguous `duration-[…]`/`ease-[…]` classes, fixed 2026-10-18; it raised none of these four.)
- [ ] Pipeline page (2026-10-19, never rendered), on a real phone: the board snaps a column at a time and the stage rail follows the swipe; tapping a rail cell scrolls there; a held card dropped on a rail cell moves stage (and a refused move puts it back); auto-scroll at the edge still works mid-drag (snap is off then); the two-line toolbar at 320/375px; a 6+ stage pipeline scrolls the rail. Confirm `dark:[@media(hover:hover)]:hover:*` on the kanban cards compiles.
- [ ] Schedule (2026-10-19, never rendered) at 360/375/768/1024 and with the task column open at 1280: the toolbar is 2 rows under a 42rem card and one row above, nothing clipped; the filters button replaces the filter row and its dot shows; the day view's week strip (tap a day, swipe it for the next week); swipe on the grid turns the day/week/month and does NOT fire after a press-and-hold drag of an event; the week view's narrow cards show the customer name and the headers the weekday initial; the phone month shows dots and a tap opens the day; the day names stay pinned while the hours scroll (sticky inside the Radix viewport). Confirm the `[@container(min-width:…)]:` arbitrary variants compile in the first build. With a timer running: Schedule, Conversations, Settings and an automation's builder end at the screen's bottom (no page scroll), also while impersonating; the bar keeps a 16px gutter on a phone.
- [ ] Known gaps: Week Ahead columns ~35px wide on a phone; Revenue by service has no visible amounts; line-item tables scroll sideways on phones; on a phone the job and invoice tables sort only by the columns that stay visible; `invoice-photos-tab.tsx` opens its lightbox on double click only; the builder's palette + config panel still squeeze the canvas between `lg` and `xl` (needs a store change).

### Landing redesign + dashboard layout — written 2026-10-18, never rendered
Both are in Completed. Nothing has been typechecked, linted or opened in a browser.
- [ ] Browser pass on `/` at 360/375/1024/1440 in both themes: hero quote and invoice cards ~8px from the edge at exactly 1024px (`lg:-right-6`); day-sheet 1.5h blocks have ~2px of slack at `sm`; the job-flow and automation-chain connectors depend on fixed disc sizes; the industry tab panel sits in an auto-height wrapper that clips; touch-scroll the trades strip.
- [ ] Copy to confirm before launch: "Cancel any time" (`final-cta-section.tsx`) and "Billed monthly. Cancel whenever you like." (`pricing-section.tsx`) describe billing PRODUCT.md says isn't built; "Team members: Unlimited" (`differentiators-section.tsx`) follows PRODUCT.md's "per business, not per user" but the word isn't there; the flow snippet's `JOB-2026-0142` will age.
- [ ] Regenerate `display-phone` in the Impeccable sidecar (the hero h1 is now 2.75rem on phones).
- [ ] Dashboard: Up next takes its row's height at `xl` when it shares the row (`contain:size`); check it with Revenue hidden, with an empty agenda, and with 2, 4 and 8 widgets.
- [ ] Dashboard Arrange (2026-10-19, never rendered): drag with a mouse, press-and-hold on a phone, and Space + arrows; the drop bar sits on the right side; two wide cards wrap and the short row widens its last card; Reset layout disables at the default; Up next beside a short card scrolls inside it; the sticky bar clears the navbar (and the impersonation banner, which it doesn't account for).
- [ ] Phone overflow (user report 2026-10-18: right gutter wider than left on the dashboard): `<main>` now clips horizontal overflow, but the widget that overflows is unknown. In DevTools at 375px run `[...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1)` and fix that element.

### App-wide slowness (2026-10-16)
Measured with curl against dev: ~0.3s per Neon round trip, ~1.2s of every call spent on the session check, and reads queued behind Next 14's one-at-a-time server-action queue. First pass is in Completed.
- [ ] Look at it in a browser. Everything was measured with curl; `tsc` and the UI are unverified.
- [ ] `/jobs/:id/time-entries` and `/tenants/impersonation/pending` still make 2 sequential round trips (role check, then the query); share a `Promise.all`.
- [ ] Round-trip leftovers: `GET /customers` tags and `GET /bookings` linked-job follow-ups (2 → 1 via LATERAL/json_agg), `/customers/stats` and `/jobs/assignees` (2 → 1), `PATCH /notifications/preferences` N+1 (~2N).
- [ ] Indexes, not applied: `tenants.organization_id`, `member(organization_id, user_id)`, `job_photos(job_id)`, `jobs(tenant_id, customer_id)`; `job_line_items(tenant_id, job_id)` exists only in a migration (ONB-12).
- [ ] Infra (user's call): the Render API is on the **free** plan in **oregon** and Neon is in **ohio**. Move the API to ohio (needs a new Render service) and off the sleeping plan.

### Workflow automation: verification debt ([[wf-PROGRESS]])
P0–P10 are written and `pnpm typecheck` is green. **Proven by execution against Neon:** P1 schema, the P2 outbox pipeline (72/72), the first event-triggered run (15/15), the P6 gate (pause survives a deploy, version pinning, compare-and-set, DST, OR/AND joins), `split.branch`, `goal.event`, and P7a's job-write extraction. **Written, never executed:** the P5 builder UI (never rendered), the P2 instrumentation sweep, P7b/c pickers and nodes 23 → 54, P8 run history, P9 webhooks + schedules, P10 templates + `http.request`/`webhook.send`, the retention sweep, version restore, wait-until-date.
- [ ] Render the builder in a browser and run one automation from the UI.
- [ ] Run the integration config. `job-move-stage`, `workflow-trigger-match` and `job-time` have never run under vitest (the unit suite passed 235/235 on 2026-08-15).
- [ ] **P7a.3c**: move the job line-item and checklist handlers into `services/jobs/` (`routes/jobs/index.ts` is 1,862 lines).
- [ ] **P8** remaining: replay, run-from-node, a global activity view.
- [ ] **P10** remaining: hardening and GA housekeeping beyond the templates and §10.5 HTTP guards.
- [ ] `workflow_event_queue.last_error` stores `DrizzleQueryError.message` (SQL + params) and drops `.cause`; record `cause.code`/`cause.message`.
- [ ] A `failed` outbox row is invisible and looks like "nothing matched"; surface it as an alert.
- [ ] Goal filters: the column and shape exist, the evaluator does not (needs a payload-path resolver).

---

## Backlog

### Follow-ups from shipped work
- [ ] **Time tracking:** drop `jobs.labor_cost_rate` once the backfill is proven on real data (nothing reads it). Overlapping entries by one person are allowed with no warning.
- [ ] **Security:** regression test for the `/api/auth/admin/*` denylist in all four forms (plain, uppercase, percent-encoded, dot-segment).
- [ ] **Security:** fold the `ownsCustomer` copies in `invoice-guards.ts:181` and `quote-guards.ts:193` into `tenant-guards.ts`.
- [ ] **Docs:** conversations API docs describe `GET /conversations/:id` and `POST /:id/send`; the code has `GET|POST /:id/messages`.
- [ ] **Settings:** the nav links owners to `/settings/billing`, and `billing/` has no `page.tsx`, so it 404s.
- [ ] **Auth (found 2026-10-18):** `forgot-password/page.tsx:43` sends `redirectTo: /reset-password`, and no `reset-password` route exists, so every password-reset email links to a 404.
- [ ] **Chatbot (found 2026-10-18):** `chatbot-panel.tsx` auto-scroll sets `scrollTop` on an element inside the Radix ScrollArea viewport, so new messages can land below the fold.
- [ ] **Settings nav, browser check:** Business + Billing present on first paint after reloading `/settings/business`; the highlight moves at once on Business → Pipelines.

### Architecture audit remainder ([[architecture]])
- [ ] **ARC-02** — 19 action files still to migrate onto `api-fetch`. Mechanical.
- [ ] **ARC-01** — the public portal's reads, after a rate-limiter IP review (`req.ip` → a trusted `x-forwarded-for` through the rewrite).
- [ ] **ARC-05** — `services/jobs/` is under way (P7a, P7a.3c above); `customers` has only the tag service.
- [ ] **ARC-07** — 16 pages with no error state; wants a shared list shell, not 16 copies.
- [ ] **ARC-09** — 6 components with inline `useQuery`, which is also why ~37 hooks have no callers.

### Cross-page sweeps (baseline 2026-08-01; the re-measured count is the deliverable)
- [ ] `isError` on list pages: 17 `*-page-client.tsx` have none (assets, catalog, checklists, conversations, service-agreements, 3 settings, 7 superadmin).
- [ ] `new Date(col).toLocaleDateString`: 20 sites in `components/dashboard/` (lint flags 53 repo-wide). Correct on `timestamptz`, shifts a `date` column back a day.
- [ ] Bare `z.string()` on a date reaching a `::date` cast: `schemas/equipment.ts`. Use `isoDate`.
- [ ] Unified List Page Migration (open since 2026-04-04): customers, invoices, quotes, bookings, assets, catalog, checklists, service agreements.
- [ ] Next page audit (user picks): Assets & Service Agreements, or Catalog + Checklists.

### Manual verification against real data
Tenants: Shihab Housing (`/book/shihab-housing`) and Shihab Roofing Corp (demo seed). Emails 403 until a Resend domain is verified, so check DB rows.
- [ ] Dashboard: revenue headline = sum of the chart across a week/month boundary (DASH-07); job counts match the Jobs page after a bulk archive; overdue banner = rows on `/invoices?status=overdue`.
- [ ] `/reports`: the previous-period line plots the period immediately before (REP-02); booking and customer totals match their list pages after a bulk archive.
- [ ] Walk `/book/shihab-housing`: submit → confirm → convert → cancel, checking `booking_activities`.
- [ ] BOOK-21: a booking + a calendar event on one day close those portal hours; Booking Capacity > 1 keeps a slot sellable until that many overlap.
- [ ] Set `INTERNAL_PROXY_SECRET` in both env files; two IPs should get separate rate-limit buckets.

### Onboarding audit ([[codebase-onboarding]], 2026-10-15)
- [ ] **ONB-10** Decide in-tenant role gating: a `member` can reach every owner/admin screen except those behind `requireOrgRole`. Product decision first.
- [ ] **ONB-11** `redact()` in `engine/node-executor.ts` is top-level only, so nested `http.request` headers are stored unredacted in `node_execution_logs.resolved_params`.
- [ ] **ONB-12…18** (see the report): `db:push` vs migration-only indexes, `isUniqueViolation` misses wrapped Drizzle errors, cascading deletes, engine operational gaps, non-atomic E-09/E-10 crons, chatbot issues, middleware drops the query string on redirect.
- [ ] Add `pnpm test` to CI, plus guard and middleware tests.

### Landing page ([[landing-page]] §7, §10)
- [ ] **Before launch:** legal review of `/privacy` and `/terms`, a governing-law clause, and a real inbox in `LEGAL_CONTACT_EMAIL` (`apps/web/src/lib/legal.ts`).
- [ ] **When billing lands:** add Lemon Squeezy to `DATA_PROCESSORS` and re-read the Trial and price section of `/terms`.
- [ ] **LAND-09 (half done):** `MotionProvider` still loads on `/` through `ui/sheet.tsx` and the animate-ui tabs and accordion. Replace them or lazy-load the Sheet; measure a build before and after.
- [ ] **LAND-23 (P2):** the two linked blog posts promise online payment and cite unsourced figures (`lib/blog/posts.ts:32,66,74`). Also LAND-24 (16px `ui/sheet` close target), LAND-25 (bright-orange check markers), LAND-17.
- [ ] **Render check, never done:** 360/375/390px `scrollWidth`, touch-scroll of the trust and industry strips, a keyboard pass in both themes for the `--brand-ink` ring.
- [ ] **Photographs:** the page has none. Shot list: hero 4:5 technician on site, 6 industry tabs at 16:10, OG image at 1200×630.

### Infrastructure and setup
- [ ] **Cloudflare R2:** create the public + private buckets ([[decisions|ADR-001]]) with the `quotes` and `job-attachments` prefixes; set `R2_*` in the root `.env` and `NEXT_PUBLIC_R2_PUBLIC_URL` in `apps/web/.env.local`.
- [ ] **Resend:** verify a sender domain and set `RESEND_FROM_EMAIL`. Zero verified domains, so no email has ever been delivered ([[deferred-fixes/notifications|DF-NOT-02]]).
- [ ] Set `ADMIN_SEED_EMAIL` to a real address, then run `pnpm seed:admin`.
- [ ] **`supabase/migrations/`:** most hand-written files are missing from `meta/_journal.json`. `db:migrate` is disabled and `db:apply` takes one file at a time; re-baseline the journal or move the hand-written SQL.
- [ ] **`turbo.json`:** no task declares `env` keys, so hosted builds can cache-hit stale and inline a wrong `NEXT_PUBLIC_API_URL`.
- [ ] **SSE:** end-to-end test `/events` with a real session in a browser.

### Deferred / Blocked
- [ ] **E-01 Welcome Email** — needs org creation refactor
- [ ] **E-11 Welcome Paid Email** — needs Lemon Squeezy webhook
- [ ] **Billing/Subscription** — Lemon Squeezy subscription management in settings. Review webhook signature verification the day it lands.
- [ ] **Affiliate Program** (#13) — Lemon Squeezy integration, referral tracking, affiliate dashboard

### Future Ideas
- [ ] Time tracking: a weekly "my time" view, payroll export, per-user timesheet report.
- [ ] Quote costing (`quote_line_items.unit_cost` + generated `cost_total`) to see margin before committing to a price.

---

## Completed

- [x] **Page height under the timer bar** (2026-10-19) — full-height pages subtracted a literal 3.5rem, so a running timer pushed Schedule, Conversations and Settings 3rem off the screen and hid the bottom of the automation builder (no page scroll there); impersonation did the same. `--page-chrome-h` on `.dashboard-main` (navbar + banner + timer bar via `:has`) and `h-page`/`min-h-page` utilities, used by every dashboard full-height page and detail shell. The timer bar is a fixed `h-12` and lost its `-mx-4`/`-mx-6`, which put the clock and Stop flush against the screen edges. Never rendered.
- [x] **Schedule on phones and tablets** (2026-10-19) — the calendar card is a size container, so the toolbar (2×2 under 42rem, one row above), filter row (one filters button when narrow) and narrow forms follow the card, not the screen; the task column docks from `xl` (at `lg` it left a 470px week). Day view gets a week strip (dots per item, tap, swipe) and loads its whole week; week headers stack weekday over date; narrow event cards show the customer name; the narrow month is dots per day, tap to open; touch swipe turns the page; day names pin while the hours scroll; gutter reads "9 AM". Skeleton matches. Never rendered.
- [x] **Dashboard Arrange** (2026-10-19) — every card below the KPI row is in one grid in a user-set order (localStorage); Arrange turns them into draggable tiles with Reset layout + Done. Revenue and Activity are wide, so two never share a row, and a short row widens its last card (`placeWidgets`, replacing `fillLastRow` and the fixed Revenue/Up next band). dnd-kit loads only when Arrange opens; `MousePenSensor` moved to `lib/dnd-sensors.ts` for both drag surfaces.
- [x] **Dashboard charts in brand blue** (2026-10-19) — same system as `/reports`, shared through `chart-palette.ts` (`kindColor`, `stateColor`, `pipelineStageColors`/`pipelineRingOrder`, `AGING_COLORS`, `barBackground`) and `components/dashboard/reusable/chart-fills.tsx`. Week Ahead + Up next + its hover card: job/booking/event as ramp steps 3/5/1 (Calendar keeps teal/violet). Invoice Aging (and the reports aging chart): Current is the brand, overdue stays red. Quote Funnel: accepted step 5, pending step 3, declined stone. Jobs Management: stages climb the ramp in board order, priority 1/3/5, services by rank. Gradients on Retention, Revenue by Service, Top Customers, Revenue area. Never rendered.
- [x] **Reports charts in brand blue** (2026-10-19) — user asked for the brand's shades instead of green, amber, teal and orange. New `--chart-ramp-1..5` (Deep Sea Blue, quiet → strong) and a warm stone `--chart-neutral`, validated as an ordinal ramp in both themes; `STATE_COLORS` maps states to steps. Every one-series chart on `/reports` is the brand with a quiet gradient; rings are ordered so touching slices are two steps apart and get a legend with figures; red stays only for overdue. Fixed Pipeline Distribution drawing stage preset names as CSS keyword colours (#0000ff). Never rendered.
- [x] **Jobs → Pipeline, phone layout** (2026-10-19) — page renamed in the sidebar (kanban icon), navbar, tab title, job breadcrumb and chatbot; route stays `/jobs`. Below `md` the board snaps one column at a time under a stage rail (the board in miniature: counts, jump to a column, drop a held card on any stage); toolbar 3 → 2 lines on a phone; inline card editors off below `md`; grab glow only where hover exists. Also fixed the chatbot's stale "stats bar" and "gear icon" answers.
- [x] **Reports tabs on a phone** (2026-10-18) — dropped the second `overflow-x-auto` wrapper around the tab list; the list fades at the right edge below `sm` and scrolls the selected tab into view.
- [x] **Demo seed: two months, connected** (2026-10-18) — `pnpm seed:demo -- --reset` rewritten as a pure generator + writer: 37 customers, 76 jobs on a one-person schedule, 16 quotes (accepted ones became the install jobs), 16 bookings, 56 invoices with payments, 61 time entries, 20 expenses, notifications. Ran against Shihab Roofing Corp; 26/26 consistency checks against the database passed. Automations untouched.
- [x] **Landing width** (2026-10-18) — container 72rem → 88rem (navbar, hero, sections, footer, legal pages) after the user found the side margins too wide at 1920px.
- [x] **Landing page redesign** (2026-10-18) — two-column section headings, a larger hero (day sheet + accepted quote + paid invoice, captioned "Example data"), trades tiles, a new Booking → Paid flow (`#features`) and Why switch rows (`#why-zaxvio`), restyled industries/how-it-works/pricing/FAQ/blog, and a neutral closing card instead of the navy band (user asked). `features-section.tsx` deleted; `example-ui.tsx` holds the shared sample pieces.
- [x] **Dashboard layout: no empty column** (2026-10-18) — the side zone left a void under Up next; now a top band (Up next beside Revenue at `xl`, matching its height) and one flowing grid for every other widget, with `fillLastRow` spanning the last card so no row ends in a hole.
- [x] **Animation pass: every page and component** (2026-10-18) — a motion foundation (`lib/motion.ts`, `useStagger`, `AnimatedNumber`, CSS `motion-pop/shake/highlight/grow-x/grow-y`, overlays on CSS so Radix exits finally play, tab panels fade, a gliding sidebar highlight) applied by six parallel passes: page sections arrive in sequence (also when a page streams in behind its skeleton), rows and lists re-enter on filter/page changes, figures count to new values, charts and bars draw in, created/edited rows flash, rejected saves shake, dropped kanban cards settle. Removed on the way: per-card kanban motion nodes, width-animated panels, three loops, hover lifts, `card-enter`/`node-enter`/`settings-enter`. Fixed: toasts were light in dark mode; a refused job-field save played the "saved" wash.
- [x] **Rebrand: Deep Sea Blue + Inter** (2026-10-18) — palette from Coolors "Deep Sea Blue" after the user rejected a yellow proposal; a true dark mode (near-neutral greys) after rejecting navy surfaces; Inter for every font slot; chart palette re-validated; `--midnight-accent` for brand text on the navy slab; emails (Inter + blue) and PDFs (blue) moved off the old orange; DESIGN.md rewritten.
- [x] **Responsive app, Phase 3** (2026-10-18) — seven parallel passes: full-width detail/create sheets below `md` (the default was 40% of the viewport: 150px on a phone); one `ListToolbar` for nine list pages; column hiding with folded sub-lines on every wide table; dialogs capped to the screen; scrollable tab lists; jobs list view by default and press-and-hold drag on phones; calendar day view and task sheet; the builder actually read-only below `md` (it was fully editable under a banner saying it wasn't), with Publish kept; the superadmin shell given the same drawer; 16px fields on phones so iOS stops zooming. Found on the way: every `ui/switch` thumb stayed put when toggled (user report); invoice, quote and job detail sidebars were `hidden xl:block`, hiding contact details and Generate Invoice below 1280px.
- [x] **Dashboard redesign + responsive shell, Phases 1–2** (2026-10-18) — sidebar becomes a drawer below `lg`; dashboard in two zones with today's work first on phones, **Up next** as a day sheet, every widget back on DESIGN.md (8px cards, no hover lift or glow, filter tabs, `WidgetHeader`). DESIGN.md gained The Phone Is a Peer Rule; the chatbot no longer claims a responsive app that wasn't.
- [x] **App-wide slowness, first pass** (2026-10-16) — Better Auth cookie cache 10s → 5 min, dashboard reads moved off the server-action queue onto `lib/client-reads` (ADR-004, ARC-01), `staleTimes.dynamic` 0 → 30. Open items in In Progress.
- [x] **Motion pass: every page** (2026-10-16) — one motion vocabulary (MOTION SYSTEM in `globals.css`, `useRouteArrival`) for all 55 routes; 0 `animate-spin`/`animate-bounce` left; reduced-motion overrides throughout. Not checked in a browser.
- [x] **Landing page: six Impeccable passes** (2026-10-16) — 14 of 15 LAND findings: invented testimonials and unbuilt claims removed (FAQ JSON-LD too), AA button labels, `--brand-ink`, `/privacy` + `/terms` drafted, skip link.
- [x] **Orange text contrast + data palette** (2026-10-16) — 131 `text-brand` → `text-brand-ink` in 76 files; chart tokens re-stepped, `--status-*`/`--overdue-*` added, `lib/constants/chart-palette.ts` is the only colour source for charts (`/reports` and superadmin colours changed too).
- [x] **`PRODUCT.md` + `DESIGN.md`** (2026-10-16) — Impeccable product record and the incumbent design system, kept in `apps/web/` ([[strict-rules]] §2).
- [x] **Repo root cleanup** (2026-10-16) — root holds config and tool-mandated files only (32 → 25 items).
- [x] **Onboarding audit ONB-01…09** (2026-10-16) — public paths in middleware, `/book/*` embeddable via `frame-ancestors *`, IPv6-aware SSRF validator, schedule events per trigger step, impersonation guard + `/respond` hardened, `/events?tenantId` admin-gated.
- [x] **Job Time Tracking** (2026-08-15) — `job_time_entries` (migration applied, confirmed 2026-10-16), `jobs.actual_hours` derived, labour costed at each entry's own rate, 7 endpoints, running-timer bar + Time tab, completion stops the clock, 12h auto-stop sweep.
- [x] **Workflow P7b/P7c, P9, P10 written** (2026-08-15) — CRM pickers 3 → 13, nodes 23 → 54, webhooks + schedules, templates 7 → 10, `http.request`/`webhook.send` with SSRF defences, `{{token}}` validation on text fields, ADR-003. P9 migration applied (22/22).
- [x] **Template gallery redesign** (2026-08-15) — index + sheet; Start from blank is a peer row, not a footer link.
- [x] **ESLint installed, `pnpm lint` green** (2026-08-15) — eslint had never been installed. Flat config in `packages/config` with rules for `as unknown`, server actions as `mutationFn`, `z.coerce.boolean()`; 110 errors → 0, 70 warnings kept on purpose; `lint:fix` split out. Typecheck 9/9, unit tests 235/235.
- [x] **`db:apply` added, `db:migrate` disabled** (2026-08-15) — `db:generate` diffs against the journal, not the database, and `db:migrate` replays from 0000.
- [x] **Vercel Speed Insights** (2026-08-15) — real-user Core Web Vitals in production.
- [x] **P7a: one path for job writes** (2026-08-10) — `moveJobStage`, `assignJob`, bulk move, `createJob`/`updateJob` shared by routes and workflow executors, plus the causation-depth loop guard; 88 assertions against Neon. Two fail-open membership checks became one `isOrgMember`.
- [x] **API error handler** (2026-08-10) — a 5xx returns a reference instead of SQL; the real error is logged with its `cause`.
- [x] **Workflow automation: first runtime proofs** (2026-08-09) — first event-triggered run (fixed the matcher's `22P02` array binding), P6 gate, `split.branch`, `goal.event` (migration applied), typecheck green across 7 packages, `pnpm dev` boots the API again (`node --watch`, not `tsx watch` under turbo).
- [x] **Costs tab `22P02`** (2026-08-09) — `ANY(${array}::uuid[])` bound one scalar; now `ARRAY[...]` via `sql.join`.
- [x] **Workflow P0–P1 + migrations** (2026-08-08) — vitest harness, `packages/workflow-nodes`, E-15, schema; opt-out + authorship migrations applied (17/17). Fixed notification emails that never sent, refused sends read as success, and the missing customer email opt-out (DF-NOT-01).
- [x] **Job Costing & Profitability** (2026-08-07) — Costs tab and Profitability report; an unknown cost makes a total incomplete, never lower. Migration applied.
- [x] **Settings sidebar render delay** (2026-08-06) — role resolved server-side (`getServerOrgRole()`), `settings/loading.tsx` added.
- [x] **Security audit remediation** (2026-08-06) — `/api/auth/admin/*` closed at the proxy (2 HIGH), login open redirect (LOW), ownership checks on conversations, checklists and calendar events in `lib/tenant-guards.ts`.
- [x] **Date range persistence** (2026-08-02) — ranges stored as absolute dates; `use-stored-date-range.ts` backs dashboard and `/reports` (2026-08-06) under separate keys.
- [x] **Architecture audit, 14 of 21** (2026-08-02) — `lib/api-fetch.ts`, ADR-002, dead hooks and deps removed, `packages/ui` deleted, ARC-08 withdrawn. Remainder in Backlog.
- [x] **Production build repair** (2026-08-02) — stale lockfile, `radix-ui` importers, `QuoteFormData`, and 8 typecheck errors behind them.
- [x] **Landing page de-slop** (2026-08-02) — eyebrows retired, fabricated rating removed from page and JSON-LD, one accent family, scroll listener → IntersectionObserver.
- [x] **Dashboard charts** (2026-08-01) — Billed vs Collected, Week Ahead, Active Customers KPI, date range picker fixed; 18/18 against Neon.
- [x] **Quotes audit + remediation** (2026-08-01) — 35 of 35 ([[quotes]]); 32/32 verified, migration applied.
- [x] **Demo data seed** (2026-07-31) — `pnpm seed:demo`; Shihab Roofing Corp seeded, 18/18 verified.
- [x] **Landing page redesign + navbar** (2026-07-31) — overflow 491px → 0, app-wide scroll-lock fix, warm neutral ramp.
- [x] **Invoices audit + remediation** (2026-07-29) — 42 of 42 ([[invoices]]); status derived from payments; migration applied, 79/79.
- [x] **Jobs audit + remediation** (2026-07-29) — 48 fixed ([[jobs]]); stage/lifecycle split, `job-stages.service.ts`; 45/45.
- [x] **Customers audit + remediation** (2026-07-27) — 35 of 35 ([[customers]]); 28/28.
- [x] **Bookings & Calendar audit + remediation** (2026-07-27) — 34 of 34 ([[bookings-calendar]]); `availability.service.ts`; migration applied, 105/105.
- [x] **Reports audit + remediation** (2026-07-27) — 28 of 28 ([[reports-page]]).
- [x] **Dashboard audit + remediation** (2026-07-27) — 29 of 29 ([[dashboard]]).
- [x] **Drop Supabase** (2026-07-26) — R2 storage + SSE realtime ([[decisions|ADR-001]]).
- [x] **Neon migration + env audit** (2026-07-26) — `DATABASE_URL` on Neon, env split by boundary, web env validation.

<details>
<summary>Earlier: Phase 1 and its follow-ups (2026-03-24 → 2026-04-17)</summary>

All 14 Phase 1 features shipped except #13 Affiliate Program (needs Lemon Squeezy). Then: dashboard redesign (04-17), TanStack Query migration (04-15), deferred tenant fixes DF-TEN-01…12 (04-14), jobs / job API / customer-to-job / booking-and-tenant audits (04-13), public quote acceptance portal (04-11), bulk actions (04-10), job assignee (04-07), conversations (04-06), job photos and the Zod schema migration (04-05), EntityDetailShell, page headers, performance pass, kanban redesign and the Groq chatbot upgrade (04-04), reports page and multi-pipeline (04-03), security hardening, landing page and help chatbot (04-02), notifications and assets (04-01), email templates and team management (03-31), super admin and enterprise UI (03-30), calendar (03-29), booking portal (03-28), KPI dashboard (03-27), quote builder (03-26), invoicing (03-25), custom pipeline stages (03-24).
</details>
