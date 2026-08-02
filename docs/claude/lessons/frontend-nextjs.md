# Lessons: Frontend (Next.js, UI/UX, Calendar, Charts)

> Related: [[design]] | [[architecture]] | [[strict-rules]] | [[lessons]]

## Next.js 14

- **Next.js never reads the monorepo root `.env`** — It only loads `.env*` from its own project directory (`apps/web`). The API opts into the root file explicitly (`apps/api/src/lib/env.ts` calls `config({ path: "../../../../.env" })`); Next.js has no equivalent hook, so `apps/web/.env.local` is mandatory and separate. This is why the two env files exist — it is not duplication for its own sake. Keep `FRONTEND_URL` and `NEXT_PUBLIC_SUPABASE_URL` in sync across both; everything else belongs to exactly one side.
- **`instrumentation.ts` is dead code on Next 14 without `experimental.instrumentationHook: true`** — `register()` is silently never called, so any boot-time validation or startup banner in it does nothing and gives zero feedback that it was skipped. The hook became stable (and default) in Next 15. Symptom: no startup banner, and bad env vars surface as runtime errors instead of at boot.
- **`NEXT_PUBLIC_*` must be referenced as a literal `process.env.X`** — The compiler substitutes these at build time by textual match. A dynamic lookup like `process.env[key]` is not replaced and resolves to `undefined` in the browser bundle. Build the object for Zod validation with explicit literal keys (see `apps/web/src/lib/env.ts`).
- **A `@types/react` v19 in ANY workspace package poisons React 18 JSX across the monorepo** — `apps/api` declared `@types/react@^19` alongside `react@^18`, and tsc resolved v19 when compiling into the workspace-linked `packages/email` source. Result: 167 `TS2786 "cannot be used as a JSX component"` errors ("`bigint` is not assignable to `ReactNode`" — `ReactNode` gained `bigint` in types v19), which broke `pnpm build` and `pnpm typecheck` at the `@hvac-saas/email` step. Fix is version alignment, not type casts. When you see TS2786 en masse, check every package's `@types/react` before touching any component.
- **`useSearchParams()` without a `<Suspense>` boundary breaks `next build`, never `next dev`** — The page prerenders fine in dev and fails only at static export ("should be wrapped in a suspense boundary"), so it hides until a deploy. `/login` had the boundary and `/signup` didn't; the fix is to extract the body into an inner component and wrap it in the default export. Run `pnpm build` — not just `pnpm dev` — before assuming a route works.
- **Running `pnpm build` while `pnpm dev` is live corrupts the dev server** — both write the same `apps/web/.next` directory. The running server starts throwing `TypeError: __webpack_modules__[moduleId] is not a function` on every route, which looks like a code bug but isn't. Stop dev first, or `rm -rf apps/web/.next` and restart after building.
- **next.config.ts not supported in Next.js 14** — Must use `.mjs` or `.js` extension. TypeScript config support was added in Next.js 15.
- **Tailwind CSS v3 required for classic PostCSS plugin** — Tailwind v4 moved the PostCSS plugin to `@tailwindcss/postcss`. Use `tailwindcss@3` with `postcss.config.mjs` + `tailwind.config.ts` pattern.
- **React 18 required for Next.js 14** — `pnpm add react react-dom` defaults to React 19, but Next.js 14 needs React 18. Explicitly install `react@18 react-dom@18`.
- **`staleTimes` does NOT fix back/forward navigation** — `experimental.staleTimes: { dynamic: 0, static: 0 }` only disables Router Cache for forward navigations (link clicks). Back/forward (popstate) still serves stale cached RSC payloads. Fix: add a client component that listens for `popstate` and calls `router.refresh()` to force a server re-fetch. See `src/components/refresh-on-nav.tsx`.
- **Never use `template.tsx` for route group layouts** — `template.tsx` remounts on every navigation, destroying browser history state and breaking back/forward. Always use `layout.tsx` for route groups. Only use `template.tsx` for rare cases like per-page entry animations.
- **Route groups for organization only, not competing layouts** — Auth pages (`(auth)/`) should NOT have their own `layout.tsx` if there's already a root layout. Competing layout trees cause rendering conflicts. Use a shared wrapper component (e.g., `AuthShell`) instead.

## Dashboard data consolidation (2026-04-17)

- **Colocate related data in one backend endpoint rather than 3 client hooks.** `AgendaTimeline` originally fired `useCalendarEvents` + `useJobs` + `useBookings` on mount — three parallel REST calls, each ~1-3s on the `/jobs` list (which hydrates assignees, tags, pipeline stages). Net: ~10s to render agenda while the rest of the dashboard loaded instantly from a single `/dashboard/stats` call. **Fix:** added `getUpcomingEvents` / `getUpcomingJobs` / `getUpcomingBookings` queries to `dashboard-only.ts` and returned them as `stats.agenda` from `/dashboard/stats`. Client drops the 3 hooks and consumes the prop directly. One cache entry, one roundtrip, no waterfall. **When to do this:** a client page renders multiple independent lists/objects fetched on mount — fold them into the page's primary server call.

## Dashboard audit fixes (2026-07-27)

- **`initialData` applies to EVERY query key, not just the one the server rendered.** `useQuery({ queryKey: [...dateParams], initialData })` seeds whatever key is currently active. Switching the date range creates a new key, which gets seeded with the *old* payload and — because `initialDataUpdatedAt` defaults to "now" — is considered fresh under `staleTime`, so **no fetch is issued at all**. `isLoading` is false too, so there is no skeleton: the user sees month-to-date numbers labelled "1Y" for 60 seconds. Guard it: only pass `initialData` when the params deep-equal what the server fetched, and always pass `initialDataUpdatedAt`. `HydrationBoundary` + `prefetchQuery` on the identical key avoids the trap entirely.
- **A Postgres `time` column reaches the client as `"09:00:00"`, and `parseISO` returns Invalid Date for it.** `jobs.scheduled_start` is `time`, not `timestamp`. The agenda called `parseISO(j.scheduledStart)`, got Invalid Date, fell through to `parseISO(j.scheduledDate)` and rendered **12:00 AM for every job** — while the events and bookings paths, which combined date + time correctly, looked fine right next to it. Check the Drizzle column type before choosing a parser; `date` and `time` columns need to be recombined, only `timestamp` is self-contained.
- **When you make an untimed item parse successfully, remember it now has a *time*.** Routing everything through `parseDateAt(date, time)` fixed the times but made items with no time render "12:00 AM" instead of nothing, because midnight is a valid Date. Carry an explicit `hasTime` flag: `start` still needs the date for grouping and sorting, but the label must say "All day".
- **Colour maps drift from the database enum silently.** Two dashboard components hard-coded `urgent | high | normal | low` while `jobPriorityEnum` is `standard | urgent | emergency` — so `high`/`normal`/`low` were dead branches and **`emergency` rendered identically to `standard`**, the least alarming possible treatment for the most urgent job type. Type the map as `Record<JobPriority, string>` off the enum so adding a value is a compile error instead of a silently grey bar.
- **`toast.error` inside `queryFn` fires once per retry.** With the default retry count that is up to four identical toasts for one outage. Surface errors from the `error`/`data.error` state in an effect, deduped by message.
- **Returning a `hydrated` flag from a localStorage hook is useless unless the consumer gates on it.** `useDashboardWidgetPrefs` exposed one specifically to prevent a flash; the page never read it, so all eleven widgets painted and the hidden ones then vanished. If a hook exports a readiness flag, something must branch on it.
- **Recharts renders SVG with no accessible structure.** Legends distinguished by colour alone also fail WCAG 1.4.1. Cheapest fix that changes nothing visually: mark the chart container `aria-hidden` and render an `sr-only` `<table>` beside it with the same values (`ChartDataTable`, now in `components/reusable/`).
- **One widget throwing unmounts the whole page.** Ten working widgets disappear because the eleventh hit a null. Error boundaries are per-widget or they are decorative — and they must be class components, React still has no hook form.

## Reports audit fixes (2026-07-27)

- **Throwing inside `queryFn` and having no error branch means every failure renders as "empty".** `/reports` did `if (res.error) throw` with no `onError` and no `isError` check, so `data` was `undefined`, the page fell through to `<EmptyTabState />`, and a 500 / expired session / dropped connection all displayed **"No data available for this period."** On a page about money that is worse than a blank screen — it is a confident wrong answer. Return the `{ data, error }` envelope and make *empty* reachable only from a successful response. The only signal anything was wrong had been a greyed-out Export button.
- **Put the error boundary inside the shared card, not in every page that uses it.** `ReportChartCard` already wrapped all 13 charts; moving `WidgetErrorBoundary` in there isolated every one of them without touching five tab files, and future charts inherit it. Same for `ReportDataTable`.
- **`placeholderData: (prev) => prev` is wrong across a tab switch unless the payload is self-describing.** Keeping the previous response is what makes changing the date range feel instant, but the previous *tab's* payload has a different shape and would blow up the chart. Have the API echo a discriminant (`section`) and render only when it matches the active tab; the same field also catches a server/client disagreement before a chart reads undefined fields.
- **A five-key map where four keys are `null` by construction is not state, it is indirection.** The page built a `TabDataMap`, populated one key from the active tab, then `switch`ed over the map — which also hid five `as RevenueReportData` casts over an `any`. Switching over the response's own discriminant deleted the map, the casts and the `eslint-disable` together.
- **CSV cells beginning `= + - @ TAB CR` execute as formulas.** RFC-4180 quoting does nothing about it. Guard **strings only** — prefixing a `number` would turn `-250.5` into text and corrupt the export. See [[security-rules]] §7.
- **`URL.revokeObjectURL` immediately after `a.click()` on a detached anchor is Chromium-only behaviour.** Append the anchor, click, remove, and defer the revoke. And put the report's date range in the filename: `report-{section}-{today}.csv` means exporting Q1 then Q2 on the same day produces two identically-named files that the browser silently renames `(1)`.
- **Excel needs a UTF-8 BOM or it guesses the system codepage.** `Café` exports as `CafÃ©` without it — invisible in the CSV, obvious to the contractor.
- **A "+100%" badge from a zero baseline is a real number that happens to be wrong** — it means "doubled". £0 → £4,000 is *new*. This logic existed twice (`KpiPill` and `ReportKpiRow`) and only one copy got fixed; if you find duplicated display logic, fix both or delete one.
- **Let the server own "what range is this?"** The browser cannot compute month-to-date in the tenant's timezone. Send no range, have the API resolve and echo `range` back, and render the picker from the echo — the same pattern the dashboard uses. Keep the user's explicit pick in separate state so the echo never fights it and causes a refetch loop.

## TanStack Query + server-action envelopes (2026-04-17)

- **Two consumers of the same `queryKey` MUST agree on the cached value shape.** `usePipelines()` (hook) and the `/jobs` page's inline `useQuery` both use `queryKeys.pipelines.list()`. One returned the raw server-action envelope `{ data: Pipeline[], error: string | null }`; the other unwrapped to `Pipeline[]`. Whichever mounted first poisoned the cache for the other, causing `pipelines.find is not a function` at runtime. **Rule:** inside any `queryFn` that calls a server action, always do `const res = await action(); return res.data ?? [];` — never let the envelope leak into the cache. The `.data?.data` ternary in the consumer is a workaround, not a fix.

## Dashboard Redesign (2026-04-17)

- **Use a pub/sub "bus" to trigger a singleton client component from other pages** — `HelpChatbot` is mounted once in `(dashboard)/layout.tsx`, so each call to `useChatbot()` elsewhere creates its own independent state. To let a button on any page open the already-mounted chatbot, created `lib/chatbot/bus.ts` that dispatches a `chatbot:open` CustomEvent; the chatbot component listens and flips `isOpen`. **Why:** lifting `useChatbot` to a React context would force every page to re-render on message state changes.
- **Recharts revenue chart granularity must match the generate_series step** — When toggling 1D/1W/1M/6M/1Y/ALL tabs, switch BOTH the date range AND the SQL `date_trunc` bucket (`day`/`week`/`month`). If they mismatch, the chart shows either a single flat bar or a jagged line. **How to apply:** always derive granularity from the selected range length — see `rangeFromPreset()` in `dashboard-page-client.tsx`.
- **AgendaTimeline auto-picks mode from date-range span, not a user toggle** — 1 day → hourly layout, 2–14 days → grouped list with day headers, >14 days → condensed list. **Why:** keeps the widget useful across every range the revenue chart supports without adding a second control the user has to learn.
- **localStorage widget prefs must hydrate after first render** — `useDashboardWidgetPrefs` initializes with defaults and only reads localStorage in `useEffect`. If you read localStorage during render (SSR/CSR mismatch), Next hydration will throw "text content did not match." The `hydrated` flag is returned for consumers that care; most widgets just use `visible` (it flips from default to stored value on first client paint — visually harmless).

## Frontend Architecture (2026-04-04)

- **Page titles are decentralized after navbar cleanup** — Titles moved from a central `pageTitles` map in `navbar.tsx` to individual `<PageHeader>` components per page. New pages can easily miss adding a header. No compile-time check catches this.
- **EditableField state is local, not synced to parent** — `EditableText`, `EditableSelect` etc. manage their own `draft` state. If the parent re-fetches data after a save, the editable field doesn't re-sync unless the `value` prop changes. Two tabs editing the same field can show stale drafts.
- **`docs/design.md` is the frontend source of truth** — Extracted from CLAUDE.md (2026-04-04) to reduce CLAUDE.md size. All frontend patterns, component APIs, layout rules, and performance rules live there. Update `docs/design.md` when changing frontend conventions.

## UI/UX Design Patterns

- **Customer table card pattern is the standard** — All list/table pages should use a single `rounded-lg border border-border bg-card overflow-hidden` div wrapping both the filters (as a `border-b border-border px-4 py-3` header) and the table. Don't wrap filters and tables separately. Reference: `customers-page-client.tsx`.
- **Sidebar cards should NOT have special backgrounds** — Don't add `bg-muted/50` or other background overrides to sidebar summary cards. They should use the same default `<Card>` background as all other cards on the page.
- **Use shadcn Table components, not raw `<table>`** — Always use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table` for consistency. Never write raw `<table>` elements.
- **Never use raw `<button>`, always use `<Button>`** — Use shadcn's `Button` component with appropriate `variant` and `size` props. For icon-only buttons: `<Button variant="ghost" size="icon">`. For eye toggles in password fields: `<Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2">`.
- **3-panel detail page layout** — Entity detail pages (customer, invoice, job) use a consistent pattern: page header with breadcrumb + actions, then a grid with info panel (left), tabs panel (center), sidebar panel (right). Components: `*-detail-header.tsx`, `*-info-panel.tsx`, `*-tabs-panel.tsx`, `*-sidebar-panel.tsx`.
- **EntityDetailShell eliminates sidebar/dialog boilerplate** — The shell in `components/dashboard/reusable/entity-detail-shell/` handles all shared logic (mode toggle, drag-resize, Sheet/Dialog wrapping, skeleton, toolbar). Entity-specific files only provide render callbacks for title, badges, actions, and tab content. Reduced 4 files from ~1,850 total lines to ~500. Always use this shell for new entity detail views instead of copy-pasting the pattern.
- **Lazy tab rendering for performance** — Only the active tab's content should be mounted. Previous pattern mounted all tabs simultaneously, causing unnecessary fetches and renders. The shell uses `{activeTab === tab.value && tab.content}` to defer rendering.
- **Reusable settings components** — Use `SettingsSection` (Card with icon + title), `SettingsFormMessage` (success/error with icons), `SettingsPageHeader` (description + action) from `components/dashboard/settings/` instead of hand-rolling Card boilerplate.
- **Dual-view pages (Kanban + Table)** — Job page supports both Kanban board and table view with a toggle. Stats bar shows KPI summary above the content.
- **Dark mode: always add `dark:` variants** — Badge colors, success/error messages, and any hardcoded light-mode colors need explicit `dark:` variants. Invoice preview paper stays `bg-white dark:bg-white` (it's a PDF preview, not a UI element).
- **All status badges must use shadcn `<Badge>`** — Never use raw `<span>` for status/priority indicators. Use `<Badge>` with subtle-fill pattern (no borders). The `outline` variant with visible borders looks AI-generated.
- **Settings sidebar > horizontal tabs for enterprise** — Grouped sidebar scales to 10+ items, horizontal tabs break at 6+. Groups: Account, Organization, Documents, Scheduling.
- **Catalog and Checklists are operational tools, not settings** — They belong as top-level sidebar items, not buried in Settings. They're core business data managed daily.

## react-big-calendar Integration

- **Use react-big-calendar ONLY as layout engine** — Strip ALL default styles (toolbar, event colors, grid lines) via CSS overrides. Replace toolbar with custom shadcn components (Button, Popover, Calendar). Replace event cells with custom components using project color tokens. Hide default toolbar with `display: none`. Reset events with `background: transparent; border: none`.
- **`withDragAndDrop` generic types are broken** — Cast `withDragAndDrop(BigCalendar as any) as any` to avoid impossible TypeScript generic constraints. Use `eslint-disable` for the `any` casts. Type the event handlers manually in your wrapper.
- **`overflow: overlay` is deprecated, don't use it** — For fixing header/grid column alignment caused by scrollbar width, disable rbc's internal scroll entirely (`overflow-y: visible` on `.rbc-time-content`) and wrap the whole calendar in shadcn `ScrollArea`. This way there's no scrollbar width mismatch between header and body.
- **Month view needs `height: 100%`, week/day needs `height: auto`** — Month view fills the container (no time grid). Week/day views render at natural height (all 24h) and scroll via external ScrollArea. Conditionally render different wrappers based on `currentView`.
- **`resizable={false}` but also hide resize anchors via CSS** — Setting `resizable={false}` isn't enough, the DnD addon still renders resize handles. Hide `.rbc-addons-dnd-resize-ns-anchor` and `.rbc-addons-dnd-resize-ew-anchor` with `display: none`. Do NOT hide `.rbc-addons-dnd-resizable` — that's the event content wrapper, hiding it hides all events.
- **Events overlay blocks hover on time slots** — `.rbc-events-container` is absolutely positioned over `.rbc-timeslot-group`, intercepting all pointer events. Fix: `pointer-events: none` on `.rbc-events-container`, `pointer-events: auto` on `.rbc-event` inside it. This lets hover pass through to time slots while keeping events clickable/draggable.
- **Light vs dark mode need different border opacities** — Use full `hsl(var(--border))` for main grid lines (the CSS variable already adapts). Only reduce opacity for subtle secondary lines (half-hour marks), and use `:is(.dark)` selector for theme-specific overrides. Don't use a global `* { border-color }` reset — it kills visibility in one mode.
- **CSS animations don't trigger on rbc date changes** — react-big-calendar updates content in-place without remounting. CSS `animation` on `.rbc-month-view` only runs once on mount. Fix: use `useEffect` watching a `transitionKey` (view + date), imperatively set `opacity: 0` + `transform`, force reflow with `void el.offsetHeight`, then set end state with `transition`. The reflow forces the browser to paint the start state before transitioning.
- **"+N more" popup overlay needs explicit styling** — The default popup has a white background that clashes with dark mode. Override `.rbc-overlay` with `background: hsl(var(--popover))`, proper border-radius, shadow, and `z-index: 50`.

## TanStack Query + Next.js Server Actions (2026-04-15)

- **NEVER pass server actions directly as `mutationFn`** — `mutationFn: createCustomer` breaks because TanStack Query stores variables in its internal state, altering the object's prototype chain. When React's server action serializer later tries to send the arguments, it rejects them with *"Only plain objects, and a few built-ins, can be passed to Server Actions. Classes or null prototypes are not supported."* Always wrap in an arrow function: `mutationFn: (data) => createCustomer(data)`. This applies to ALL mutations — create, update, delete, bulk ops. Queries already use this pattern (`queryFn: () => getCustomers(params)`) so they're unaffected.
- **Arrow wrapper is mandatory for every mutation, no exceptions** — Even single-arg mutations like `deleteCustomer(id)` must use `(id: string) => deleteCustomer(id)`. The issue is not about argument count — it's about TQ's internal state management corrupting the object identity before React serializes it.
- **Reusable hooks live in `hooks/queries/use-*.ts` with barrel export from `index.ts`** — 18 hook files covering all domains. Each hook handles toast + cache invalidation in `onSuccess`. Pages import from `@/hooks/queries` and provide per-call `onSuccess` callbacks for UI state (close dialogs, reset forms) via `mutation.mutate(data, { onSuccess: (res) => { if (!res.error) closeDialog(); } })`.
- **Query keys are centralized in `lib/query-keys.ts`** — Factory pattern: `queryKeys.customers.list(params)`, `queryKeys.customers.detail(id)`, `queryKeys.customers.all` (for invalidation). Never define keys inline in components.
- **`staleTime` is domain-specific** — Pipelines, tenant settings, tags, catalog categories: 5min (rarely change). Detail views: 30s (enables prefetch benefit). Lists, notifications, conversations: 0 (must be fresh). Dashboard: 60s. Reports: 5min.
- **Hover-prefetch on table rows** — Use `queryClient.prefetchQuery()` with `staleTime: 30_000` on `onMouseEnter`. No debounce needed — `prefetchQuery` is a no-op when data is cached and fresh.
- **Pagination prefetch** — `useEffect` watching `page` and `totalPages` to prefetch page N+1 via the reusable `prefetchX(qc, params)` helpers exported from each hook file.
- **Bulk action response shape** — Bulk server actions return `{ succeeded, failed, errors, message? }` at the top level, NOT `{ data: { message } }`. Toast with `res.message`, not `res.data?.message`.
- **Global background refetch indicator** — `GlobalFetchIndicator` in `components/dashboard/global-fetch-indicator.tsx` uses `useIsFetching()` with a 300ms delay to show a thin progress bar. Uses `motion/react` (NOT `framer-motion`).

## Kanban & Animation (2026-04-04)

- **`motion/react` stagger is per-card, not batched** — Each kanban card gets its own `transition={{ delay: index * 0.04 }}`. With 50+ cards, that's 50 separate animation tasks. Unlike CSS `@keyframes` with `animation-delay`, motion/react doesn't batch these. Consider limiting stagger to the first ~10 cards.
- **Removing priority border-left breaks light mode scannability** — The old kanban card used `border-l-[3px]` with dynamic priority colors. The redesign removed this for a cleaner look with shadow/ring, but subtle shadows are nearly invisible in light mode. Priority is only visible via badge text now.

## Recharts & Reports (2026-04-03)

- **Chart config objects must be memoized with `useMemo`** — Recharts compares config object identity (not deep equality). Inline config objects cause re-initialization every render, resulting in animation jank. Always wrap dynamic `ChartConfig` in `useMemo`.
- **Y-axis `tickFormatter` rounds aggressively** — `v >= 1000 ? \`$${(v/1000).toFixed(0)}k\` : \`$${v}\`` turns $1,800 into "$2k". Users may perceive inaccurate revenue. Use `.toFixed(1)` for "$1.8k" or switch to full numbers below $10k.

## Performance Optimization (2026-04-04)

- **Server-side `Promise.all()` is all-or-nothing** — If any prefetch action fails in `Promise.all([getJobs(), getPipelines(), getTenant()])`, the entire page fails with no graceful degradation. Consider wrapping individual calls in try-catch with fallback defaults for non-critical data.
- **Initial props are snapshots, not live data** — `initialJobs` passed from server to client is stale after any user action. The client must re-fetch via server actions after mutations. If the server prefetch logic diverges from the client action logic (different filters, different fields), you get inconsistent state.
- **Batch stats endpoints (`/stats`) are fast but not cached** — `COUNT(*) FILTER (WHERE ...)` queries are efficient, but no HTTP cache headers or `revalidateTag` calls were added. The browser/CDN doesn't know it can serve stale, causing redundant API calls on every navigation.

## Vercel AI SDK v6 + Groq (2026-04-02)

- **AI SDK v6 uses `inputSchema` not `parameters` for tool definitions** — Old Vercel AI SDK used `parameters` (Zod schema). v6 renamed it to `inputSchema`. Both compile but `parameters` is silently ignored in v6, making tools accept no input.
- **`maxOutputTokens` not `maxTokens`** — v6 renamed the token limit parameter. Using `maxTokens` may be silently ignored depending on the provider adapter.
- **LLM tool call inputs are not validated against schema by default** — The LLM may return wrong field names or types. The SDK validates structure but not semantic correctness. Always validate tool inputs before execution, especially for DB mutations.

## Bookings & Calendar Audit (2026-07-27)

From [[bookings-calendar|the report]] — the front-end half.

- **A detail deep-link param name got spelled wrong three separate times.** The dashboard
  agenda emitted `?job=` at a page reading `jobId`; the agenda emitted `?booking=` at a
  page reading `bookingId`; the schedule's hover card emitted *both* wrong ones. Each
  time the symptom is identical and silent — the link navigates, the sheet stays shut, no
  error anywhere. `lib/entity-links.ts` (`jobLink()`, `bookingLink()`, …) is now the only
  place the name is written. **When the same trivial mistake recurs, the fix is deleting
  the opportunity to make it, not making it correctly again.**
- **A deep-link `useState` initializer only fires on a cold load.**
  `useState(!!searchParams.get("bookingId"))` opens the sheet when the URL is the entry
  point and does nothing when the same page is already mounted — so in-app navigation from
  the calendar or a notification silently no-ops. Pair the initializer with a
  `useEffect` on the param.
- **A calendar that renders in browser time disagrees with everything else.**
  Events are built as `new Date(\`${date}T${time}\`)` — no offset — so their *local*
  fields carry the appointment's wall-clock time, which is right: a 09:00 job should read
  09:00 anywhere. What was wrong was everything compared against it — `isToday()`, the
  scroll-to-now offset, the initial date, the Today button — all using the browser's
  clock. `lib/tenant-time.ts` returns "now" in the same wall-clock space the events live
  in, so `getHours()`/`isToday()` compare like with like.
- **`?? []` on a query result turns a failure into an empty state.** On a *scheduling*
  page an empty week reads as "you have nothing on" — the same class as REP-01, on the
  surface where being wrong costs a missed appointment. Surface partial failures too: if
  jobs load and bookings 500, the calendar is not empty, it is *incomplete*, and it must
  say so.
- **A silent `limit: 200` is worse than a visible one.** The calendar fetched each of
  three sources with a cap and no indication when it was hit, so a busy month simply
  omitted appointments. If a view bounds its data, it has to say "showing the first 200".
- **SSR prefetch that isn't seeded into the exact query key is wasted work.** The bookings
  page ran three server fetches, passed all three down as props, and the client never read
  them — a skeleton on every visit anyway. Seed with `queryClient.setQueryData` under a
  key built from *identical* params, once, guarded by a ref.
- **`resizable={false}` with a live `onEventResize` is a path that can never run.** It was
  wired through three files and read like a feature. Dead code that looks live is worse
  than no code — delete it and leave a comment saying what re-enabling it requires.

## SSR seeding + query-key hygiene (2026-07-29, Jobs audit)

- **A query key that takes params must not be seeded unconditionally.** `initialData` attaches to *whichever key is mounted right now* and TanStack stamps it fresh at `Date.now()`, so it also suppresses the refetch. On `/jobs` this meant switching pipeline rendered the previous pipeline's cards and columns for the full `staleTime` and never corrected itself, and typing a search showed the unfiltered list. Guard the seed on "are the current params the ones the server actually rendered", and pass `initialDataUpdatedAt` with the server's timestamp so a seed older than `staleTime` refetches on mount. This is the third page to need the same fix (dashboard → reports → jobs); when adding SSR seeding, copy `useDashboardStats`'s `canSeed` shape rather than reaching for bare `initialData`.
- **Verify cache behaviour with a real `QueryObserver`, not by reading the options.** A 40-line node script with two `QueryClient`s — one seeded the old way, one the new — reproduces "switching pipeline shows stale rows and issues 0 fetches" and proves the fix in the same run. Fetch counts are the assertion that matters; rendered data alone can look right for the wrong reason.
- **One query key, one payload shape — enforced by using the shared hook, never a local `useQuery` on a shared key.** `/jobs` defined its own query on `queryKeys.tenant.settings()` that stored a bare tax-rate **string**, while `useTenantSettings()` stores the whole `{data, error}` under that key and has five other readers doing `data?.data?.…`. Last mount wins, so Jobs → Invoices inside the 5-minute `staleTime` fed those readers a string and `("0.08").data` was `undefined` — silently undoing a timezone fix from the previous audit. The collision is invisible in both files individually; it only exists in the key. **If a key already has a hook, use the hook.**

## Invoices audit — the propagation problem (2026-07-29)

- **Fixing a defect on the page being audited does not fix the defect.** Of **17 remediation patterns** established by the five prior audits, exactly **one** (`bulkToast`) had reached `/invoices`. `LoadErrorState` had 0 imports there; `EntityDetailShell.loadError` was ignored; the 404-vs-500 split, the deep-link bounce guard, the `initialData` seeding rule, `escapeLike`, the tenant-timezone rule — none had propagated. The one that *did* hold was the tenant-filter sweep, which the bookings audit ran **repo-wide and reported a count for**. That is the difference: an audit should end with a grep for the class it just fixed and the sweep result written into the report. `escapeLike` was in `lib/search.ts` for months and used by exactly one route file; the sweep found **seven** more.
- **`useX` with zero callers is a migration that silently didn't happen.** `useInvoice` existed, was correct, and nothing imported it — the sheet and the detail page each called the server action into `useState`. Two consequences that don't look related: the hover prefetch filled a cache nothing read (pure waste, looked like a feature), and a mutation made from the sheet could not invalidate anything, so the list stayed stale. **Grep for `export function use` against its own import count** — it is a one-line check that finds dead migrations.
- **Fetching data on the server and not using it is worse than not fetching it.** `invoices/page.tsx` fetched invoices + stats + tenant, passed all three down, and the client destructured all three and referenced **none**. Every load paid for the data twice and still showed a skeleton. The prop names made it look wired up.
- **`initialData` must be seeded only for the exact key the server rendered.** Seeding unconditionally means changing a filter shows the previous filter's rows for the whole `staleTime` and never refetches — the JOB-05 defect. `canSeed` guards on every parameter that is part of the key, and `initialDataUpdatedAt` is what lets the seed age.
- **`new Date("2026-07-29")` is UTC midnight, and then `toLocaleDateString` shifts it again.** Anywhere west of UTC that renders a `date` column a day early — on the table, in the payments list, and **on the customer's PDF**. Anchor at noon UTC and format in UTC: `new Date(`${v}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", … })`. Four files had four hand-rolled copies of this function, all wrong the same way.
- **A hand-rolled `` `$${n.toFixed(2)}` `` has no thousands separator.** `$1234.50` on a document you email to a customer. `toLocaleString("en-US", { style: "currency" })` costs the same to write and is right.
- **`toFixed(1)` on a tax percentage makes the document contradict itself.** "Tax (8.3%)" beside a correctly-computed 8.25% amount. Round display precision to the *column's* precision (`numeric(5,4)` → 4 decimals, trailing zeros trimmed), never to what looks tidy.
- **A guard that lives only in the browser is not a guard.** The payments tab hid the delete button for void invoices; the endpoint had no status check at all. Anything reachable by URL is reachable.
- **Rows that are `onClick`-only are invisible to a keyboard.** No `tabIndex`, no Enter/Space handler, no `aria-sort` on the headers. The customers audit made rows reachable and it did not propagate — same class as everything above.
- **A `Record<string, unknown>` callback prop forces a double cast at every call site.** `onSaved?: (updated: Record<string, unknown>) => void` is why both settings pages wrote `as unknown as TenantData`, which [[strict-rules]] §4 bans. The type already existed (`Tenant`, inferred from the Drizzle schema) — the prop just wasn't using it.
- **Pointing `window.open` at the API origin is the one request that relies on a cross-origin cookie.** It works in development because everything is `localhost` and breaks the moment the API is on another domain. Fetch it in a server action, where the cookie header is set explicitly, and hand the browser a blob.

## Landing redesign — layout, theming and Radix internals (2026-07-31)

- **`overflow-x-auto` does not clip inside a grid or flex item.** Grid and flex items default to
  `min-width: auto`, which is *content* width, so the track grows to fit the scroller instead of the
  scroller clipping. On `/` the industry tab strip lived in a grid column and pushed the document to
  **976px on a 390px viewport** — every section on the page scrolled sideways because of one element.
  Any scroll container inside a grid/flex parent needs `min-w-0` on the item, or the container must be
  full-width and not a track child. Measure with
  `document.documentElement.scrollWidth - clientWidth`, not by eye.
- **`body { overflow: hidden }` locks nothing in this app — `<html>` is the scroll container.**
  globals.css sets `overflow-y: scroll` on `<html>`, so Radix's RemoveScroll (which locks `<body>` and
  sets `data-scroll-locked`) has no CSS effect. Radix still intercepts wheel/touch, so a mouse user is
  mostly held, but programmatic and keyboard scrolling walk straight through. This affected **every
  Dialog and Sheet in the app**, not just the landing nav. Fixed once in globals.css with
  `html:has(body[data-scroll-locked]) { overflow: hidden }`; `scrollbar-gutter: stable` means no layout
  shift. Verify with `window.scrollTo()` while the dialog is open, not by trying to scroll by hand.
- **The dark-mode elevation ramp must ascend, and it did not.** `--card` was `10%` while `--surface-alt`
  was `12%`, so every card sitting on an alt-coloured section was *darker* than the section behind it
  and visually sank. The ordering `background ≤ surface < surface-alt < card`, with `--border` above
  `--card`, has to hold in both themes. Assert it by reading the lightness channel out of the custom
  properties rather than trusting the swatches.
- **`AutoHeight` (animate-ui `TabsContents`) measures its child, so a top margin on that child collapses
  out of the measured box.** `TabsContent className="mt-6"` made the panel render exactly 24px short and
  clip its own last row of bullets, with `overflow: hidden` hiding the evidence. Put the gap on a
  wrapper *outside* `TabsContents`, never as a margin on the measured child.
- **`h-full` plus a top margin makes a card overhang its own grid item by exactly the margin.** `h-full`
  resolves against the item's full height while the element starts lower. Use `flex flex-col` on the
  item and `flex-1` on the card.
- **A scroll-reveal whose hidden state lives in the React tree turns a slow bundle into a blank page.**
  The old `Fade` mounted a framer-motion component per card at `opacity: 0`; if the bundle was slow or
  failed, the fully server-rendered page stayed invisible. Scope the hidden state to `html.js`, set by a
  one-line inline script in `<head>`, so it fails open. Confirm with
  `curl localhost:3000/ | grep '<your headline>'` that the copy is in the HTML at all.
- **Verify reveal state in a focused tab.** A backgrounded or unfocused Chrome throttles
  `requestAnimationFrame`, CSS transitions and IntersectionObserver delivery, so a fast programmatic
  scroll loop reports elements as never revealed and stuck at `opacity: 0` when they are fine for a real
  user. Park the element mid-viewport, wait, and re-read — do not trust a tight `scrollTo` sweep.
- **Never run `next build` while `next dev` is serving the same app.** The build overwrites `.next/`
  under the dev server and every request then 500s with `Cannot find module './NNNN.js'`. Recovery is
  stop dev → delete `.next` → restart.
- **Structured data that contradicts the visible page is a rich-results violation.** `json-ld.tsx`
  claimed `4.8` from `127` ratings while the hero rendered `4.9` from `500+`. If a number appears in
  both places, it has one source.
- **A rotating word inside the `<h1>` is measurable layout shift on the page's largest text**, and it
  makes the heading's text content unstable for crawlers and screen readers. State the varying part in
  an eyebrow and let a dedicated section carry the proof.
- **`react-day-picker` v9 folds every click into the range already selected, so a picker that always
  has a complete range applied can never start a new one.** `addToRange` treats a click on either
  endpoint as "collapse to that day" — with `Jan 1 – Aug 1` selected, clicking Aug 1 returns
  `{from: Aug 1, to: Aug 1}`. That is what makes a range control look jammed on a single date. Pass
  `resetOnSelect` so a click begins a fresh range, and hold the half-finished selection in local
  state: `onSelect` fires on the first click with `to: undefined`, and pushing that partial value to
  the page makes consumers read it as "no range" and refetch their default.
- **Persist a date range as the *preset* the user chose, not the dates it resolved to.** Storing
  `2026-07-25 → 2026-08-01` for "last 7 days" means next week the dashboard opens on a stale window
  still labelled last 7 days. Recompute presets against today on load; store absolute dates only for
  a hand-picked custom range.
- **A default of "month-to-date" renders as a single day on the 1st of the month**, which reads as a
  broken page: one chart bucket, no trend, and a range picker that appears stuck on today.
- **Render the window the payload reports, not the number in the widget's title.** The dashboard
  agenda's `from → to` is today *plus seven* — eight calendar days — so a "next 7 days" strip built
  from a hardcoded `7` silently dropped work that the Agenda beside it still listed. Derive the
  column count from `differenceInCalendarDays(to, from) + 1`.
- **A `calc(100vh - Nrem)` panel height is a constant standing in for four measurements, and it drifts.**
  The Kanban board reserved `12.5rem` for navbar + page padding + toolbar + scrollbar; the real total was
  about `9rem`, so the columns stopped ~60px short of the fold and clipped a card mid-row while empty
  space sat below them. The column's inner scroller then repeated the same constant with a second `- 60px`
  fudge for its own header, so the two had to be kept in agreement by hand. Measure with
  `getBoundingClientRect().top` (`use-fill-viewport-height`) and let the inner scroller be `flex-1 min-h-0`
  — it already knows its room, because it is a stretched flex child of a fixed-height row.
- **A segment's `loading.tsx` applies to its children, so a detail route inherits the *list* page's
  skeleton.** `/jobs/[id]` rendered four columns of Kanban card placeholders and then swapped them
  for a three-panel detail page — a loading state that shows the wrong page is worse than none,
  because it tells the reader they opened something they did not. Every `[id]` route under a segment
  that has its own `loading.tsx` needs one too; `/jobs`, `/quotes`, `/invoices`, `/assets` and
  `/customers` were all doing it. One `DetailPageSkeleton` with `info`/`sidebar` props covers all
  five, and its panel widths must match the detail client's (`lg:w-80`, `xl:block w-72`) or the
  content lands somewhere the skeleton never was.
- **A combobox inside a Radix Dialog will not scroll with the wheel.** The Dialog mounts
  `react-remove-scroll` with its own content as the only permitted scrollable shard, and the
  Popover renders in a portal *outside* that subtree — so wheel events over the list are swallowed
  while its scrollbar sits there visibly, which reads as a broken list rather than a locked one.
  Fix is `<Popover modal>`: a modal Popover registers its own content as a shard. Applied to the
  catalog, customer, asset and assignee pickers — all four were affected, only one was reported.
- **A quick-add field inside a form must flush on submit, not only on Enter.** The Line Items price
  input committed on Enter or its + button, so typing `500` and clicking "Create Job" created a job
  worth **$0.00** — verified in the database: the job existed with `subtotal 0.00` and zero line
  items, no error and no warning anywhere. Blur-commit alone does not fix it: clicking the submit
  button races the state update, and the button's own `onClick` fires after the input's blur has
  already cleared the field (commit from `onMouseDown` instead). The reliable fix is to lift the
  pending value into the parent and append it inside the submit handler, reading the local variable
  rather than state.
- **A layout component that reads localStorage once on mount never sees a later write.** The sidebar
  builds its Jobs link from `jobs-pipeline-id`, read in a `useEffect([])` — but the sidebar lives in
  the dashboard layout and does not remount on client navigation, so visiting /jobs seeded the value
  and the link still read a bare `/jobs` for the rest of the session. `storage` events do not help:
  the browser only fires those in *other* tabs. Pair the write with a `CustomEvent` on `window` and
  have the reader subscribe (`lib/jobs-pipeline-preference.ts`).
- **`new Date("2026-08-01")` is UTC midnight, so every US timezone renders the day before.**
  A bare `YYYY-MM-DD` from a Postgres `date` column hits the ISO-date branch of the JS
  parser, which is UTC; `.toLocaleDateString()` then converts *back* into local time and
  loses a day. Proven with `TZ=America/Chicago`: the quotes dashboard prints **Jul 31**
  where the customer's portal prints **Aug 1** for the same `expiry_date`, because the
  portal happens to use the correct form. Always `new Date(val + "T00:00:00")` for a
  date-only column, or the shared `formatDateOnly`. This is separate from tenant-timezone
  plumbing — it is wrong even when the tenant and the browser agree.
- **A "0 imports" dead-dependency count is only as good as the import forms it searched for.**
  The architecture audit removed `radix-ui` (the meta-package) from `apps/web` on a measured
  count of 0 importers. The real count was 2: `animate-ui/primitives/radix/tabs.tsx` and
  `.../accordion.tsx` do `import { Tabs as TabsPrimitive } from 'radix-ui'`, the namespace
  form, while the other ~20 Radix consumers use scoped `@radix-ui/react-*` paths. Searching
  for the scoped prefix finds the 20 and silently reports the meta-package as unused. Before
  deleting a dependency, grep for the **bare package name as a quoted import specifier**
  (`from ['"]<name>['"]`), not just for a path prefix — and remember a package can be
  consumed under more than one form in the same app.
- **Deleting a dep from `package.json` without regenerating the lockfile changes nothing, then
  changes everything at once.** For four days CI kept installing `radix-ui` because
  `pnpm-lock.yaml` still listed it, so the broken imports resolved and every deploy was green.
  The moment the lockfile was regenerated — for an unrelated reason — `next build` failed on
  imports that had been wrong since the cleanup. Two consequences: (1) a green deploy after a
  dependency change proves nothing until the lockfile is regenerated in the same commit;
  (2) a stale local `node_modules` hides the same class of break, because it holds packages
  the manifest no longer declares. `pnpm install --frozen-lockfile` is the check that
  reproduces CI, and Vercel applies it implicitly — `ERR_PNPM_OUTDATED_LOCKFILE` fails the
  build before a single file is compiled.
- **Prefer the scoped Radix package over the `radix-ui` meta-package.** `import * as X from
  '@radix-ui/react-tabs'` is a drop-in for `import { Tabs as X } from 'radix-ui'` — the
  members are identical (`Root`, `List`, `Trigger`, `Content`, `Item`, `Header`) — and the
  scoped packages are already direct dependencies, so it pulls nothing new in. The
  meta-package re-exports every primitive, most of which this app never uses.
- **Persisting a relative preset as a preset makes a user's explicit choice move on its own.**
  The dashboard range picker stored "last 7 days" as `{preset: "1W"}` and recomputed it against
  today on every load, reasoning that replaying stored dates would show a stale window still
  labelled "last 7 days". The reasoning is defensible; the behaviour is not what anyone wants.
  Worse, the page could not tell a *shortcut* click from a *calendar* pick — `DateRangePicker`
  emits a bare `DateRange` for both — so it guessed with `inferPreset()`, which maps any span of
  0, 6 or 29 days onto `1D`/`1W`/`1M`. A hand-drawn Jul 20–Jul 26 was therefore saved as `1W`
  and came back as the seven days ending today: the user's deliberate choice of an *earlier*
  week silently jumped forward. Rule: **a shortcut is a way of entering a value, not a standing
  subscription to one.** Resolve it to concrete dates at click time and store those. Keep the
  preset name if you need it to highlight a tab, but never let it be the source of truth.
- **Deriving a control's displayed value from the server response makes it flicker to the
  default.** The picker rendered `stats.range` — what the API resolved — so that display always
  matched the query. But `stats` is empty during a refetch, and the SSR payload always carries
  the tenant's month-to-date default regardless of what was restored from localStorage. On the
  2nd of a month that default renders as "Aug 1 – Aug 2", which reads exactly like the saved
  range resetting itself. Show the user's own selection when there is one and fall back to the
  server's resolved range only when there isn't.
- **A build that dies at `pnpm install` never type-checks, so the next green install surfaces
  errors from commits you thought were fine.** `02d4441` failed on `ERR_PNPM_OUTDATED_LOCKFILE`
  before a single file compiled. Fixing the lockfile two commits later made the build reach
  `tsc`, which immediately failed on a type error that had shipped in `02d4441` itself. When a
  build fails at an early stage, nothing after that stage has been verified — treat the whole
  commit as unchecked rather than assuming only the reported step is broken.
- **A form's "empty" is not the API's "absent".** The quote dialog stores an unselected catalog
  item as `null` and every other empty input as `""`. `POST /quotes` declares
  `catalogItemId: z.string().uuid().optional()` — optional but *not* nullable — so `null` is a
  400, and `""` fails the uuid and numeric-string checks too. `/quotes` had the conversion
  written inline in its `handleCreate`; `/customers/[id]` passed the form state straight to
  `createQuote`, which did not compile and would have been rejected at runtime if it had. The
  conversion now lives in `lib/quote-payload.ts`. Any form whose fields are optional server-side
  needs one of these, and it belongs beside the type, not in whichever page happened to be
  written first.
- **A cast that drops a type argument relocates the error, it does not remove it.**
  `schedule-calendar.tsx` wrapped react-big-calendar as
  `withDragAndDrop(BigCalendar as ComponentType<Record<string, unknown>>) as unknown as
  ComponentType<DnDCalendarProps>`, on the stated belief that the addon "erases the generics".
  It does not: `withDragAndDrop<TEvent extends object, TResource extends object>` returns
  `CalendarProps<TEvent, TResource>` plus the drag props. The cast is what erased `TEvent`, to
  the library default `Event` — after which `components`, `eventPropGetter`, `onSelectEvent` and
  `draggableAccessor` were all checked against `object` and every `CalendarEvent` handler in the
  file failed. `withDragAndDrop<CalendarEvent, object>(BigCalendar)` needs no cast at either
  end. Before reaching for a cast on a third-party component, read its `.d.ts` — the generic you
  need is often already there. (Note `as unknown as` was itself against strict-rules §4.)
- **Never put `[key: string]: unknown` on a component's props to "accept" a caller's extra
  props.** A callee does not declare the caller's extras — passing more props than a component
  reads is always fine. What the index signature *does* do is break assignability in the other
  direction: TypeScript gives implicit index signatures to type aliases but **not to
  interfaces**, so `ScheduleEventProps` having one made react-big-calendar's `EventProps`
  interface unassignable to it. The widening intended as permissive was the thing rejecting the
  library's own type.
- **Type arguments on the API client are load-bearing, not decoration.** `apiGet<unknown[]>` and
  a bare `apiSend` (where `T` silently resolves to `unknown`) left `actions/tags.ts` returning
  values that narrow to `{}` after a truthy check, so every `res.data.id` in the consuming
  component failed to compile. The shared client can only carry a shape across the
  server-action boundary if the call site names it — prefer the Drizzle-inferred row from
  `@hvac-saas/types` so it tracks the schema.
