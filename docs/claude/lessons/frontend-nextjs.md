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
- ~~**Persist a date range as the *preset* the user chose, not the dates it resolved to.**~~
  **WRONG — reversed 2026-08-02.** This was written from the implementation rather than from
  observing it, and it is the exact reasoning that made a saved range move on its own. Store two
  absolute dates, always. The full account is below, under "a shortcut is a way of entering a
  value, not a standing subscription to one".
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
- **A required prop can manufacture a design problem across a whole page.** The landing
  page's `SectionHeading` took `label` as a *required* string, so all ten sections
  rendered a mono uppercase eyebrow whether or not one helped. No individual section was
  wrong; the uniformity was. That one signature did more to make the page read as
  machine-generated than any component in it. When a presentational prop is required,
  every consumer is forced into the same rhythm, and "templated" is exactly what a forced
  rhythm looks like. Default decorative props to optional.
- **Deleting a decorative element is often the fix for a colour-system violation.** The
  page had four accent families against a one-accent rule. Three of them lived inside two
  small diagrams: a fake revenue chart used `emerald` for an invented "+18%", kanban
  column dots used `sky` and `emerald`, and star rows used `amber`. None survived the
  question "what does this tell the reader that the text beside it does not?" Chasing the
  colours would have meant recolouring; chasing the *purpose* deleted them.
- **Invented numbers on a marketing page can be a compliance problem, not a taste one.**
  The hero claimed "4.9 from 500+ service businesses" and `json-ld.tsx` mirrored it into
  `aggregateRating`. A prior fix had made the two agree, which addressed the smaller
  issue: asserting a review count you do not have is a Google rich-results violation
  whether or not the visible page repeats it. Before styling a metric, check it exists.
  This one was checkable in seconds: the database has one tenant and no seeded users.
- **`window.addEventListener("scroll", ...)` to set a boolean is always the wrong tool.**
  A continuous input driving React state re-renders on every frame. For "has the page
  scrolled at all", put a zero-height sentinel at the top of the document and observe it:
  the callback fires twice per session instead of hundreds of times per scroll.
- **Two pages sharing a persistence hook must not share its storage key.** When /reports needed
  the same remembered date range as /dashboard, the hook was parameterised by key rather than
  copied — one implementation, `DATE_RANGE_KEYS.dashboard` and `DATE_RANGE_KEYS.reports`. The
  tempting simplification is one key for "the date range", since it is visibly the same control
  with the same expectation. It is not the same *selection*: the pages answer different questions
  at different cadences, and a shared key means narrowing Reports to last quarter silently
  narrows the Dashboard too, with no visible cause on the page that changed.
- **Restore persisted state in an effect, not a lazy `useState` initialiser.** The initialiser
  runs during render, where `localStorage` does not exist on the server, so the markup React
  hydrates against would disagree with the client's. The cost is one extra fetch on a visit with
  saved state; the alternative is a hydration error. Same reason `useDashboardWidgetPrefs` reads
  in an effect and exposes `hydrated`.
- **A `useEffect` fetch cannot gate what the server renders — so anything it hides is guaranteed
  to pop in.** `SettingsNav` filtered Business and Billing on `useOrgRole()`, a bare
  `useState`/`useEffect` calling `authClient.organization.getActiveMember()`. `orgRole` is `null`
  through the entire server render *and* the first client paint, so the HTML always shipped a nav
  missing two items, then reflowed the groups below them 300–960ms later (browser → Vercel rewrite
  → Render → Neon). The hook even returned `isLoading`, which the nav destructured as `roleLoading`
  and never used, so there was not so much as a placeholder holding the space. The fix is not a
  skeleton: resolve role-gated data in the server layout and pass it down as a prop. Rule of thumb —
  **if a value decides what is on screen at first paint, it cannot be fetched from the client.**
- **`session.user.role` is the platform role, not the organization role.** Better Auth keeps them in
  different places: `admin | null` on the session user, versus `owner | admin | member` on the
  membership row behind `/organization/get-active-member-role`. `getServerSession()` gives you the
  first and never the second, which is why the org role needed its own server helper. Prefer
  `get-active-member-role` over `get-active-member` — same round trip, returns `{ role }` instead of
  the whole membership row, and the role was all any caller wanted.
- **A segment with no `loading.tsx` makes its *siblings* look broken.** Six of the twelve settings
  pages are async server components awaiting a server action, and `/settings` was the only route
  under `(dashboard)` without a `loading.tsx`. Next.js will not commit a client-side navigation
  until the RSC payload lands, so clicking a sidebar link left the old page up with the old item
  still highlighted — `usePathname()` had not changed yet. The sidebar was reported as "slow to
  render" when it had never unmounted and was not re-rendering at all; the missing Suspense
  boundary was one directory away. When a nav feels frozen, check whether the *destination* is
  blocking the transition before touching the nav.

## Rendering a number you cannot fully back up

- **A blank cell reads as zero, and zero cost reads as pure profit.** Where a
  cost is genuinely unset, print "no cost" rather than leaving the cell empty —
  on job line items and in the catalog table both. This is the cheapest place in
  the whole costing feature to prevent a wrong conclusion.
- **Put the uncertainty in the shape, not in a warning icon.** `job-cost-stack.tsx`
  hatches the *margin* segment when the cost side is incomplete, because that
  remainder is profit **or** a cost nobody entered — two different claims. A
  solid green bar with a caveat underneath still reads as a solid green bar; the
  caveat is the part people skip.
- **Scale a comparison bar to `max(revenue, cost)` and rule the smaller one.**
  Scaling to revenue alone means an over-budget job and a break-even job both
  draw a full bar, and the overrun is only visible as a minus sign you have to
  read. With the larger side as 100% and a rule at what was billed, the overrun
  has length.
- **Mount a derived-data tab only while it is selected.** `Costs` recomputes its
  summary on every read, so rendering it behind an inactive tab issues that query
  for every job the user clicks through. Radix `Tabs` unmounts inactive content
  by default — the trap is a tabs API that builds its `content` array eagerly and
  then force-mounts.
- **Never type a server action with a Drizzle row type — declare the wire shape.**
  `Workflow`, `Customer`, `Job` and every other `$inferSelect` type declares
  timestamps as `Date`. Nothing that crosses a server action is a `Date`: the
  boundary is JSON, so they arrive as strings. Typing an action's return with the
  row type type-checks the entire page against a shape it never receives, and
  then every date helper — all of which take `string` — needs a cast to compile.
  The tell is reaching for `as unknown as X`, which strict-rules §4 forbids and
  which is the type system correctly refusing an impossible conversion. Declare
  the serialized shape once in the action file where the boundary actually is;
  consumers then need no casts at all.
- **`formatDateOnly` is for `date` columns and nothing else.** It anchors at UTC
  noon and formats in UTC, which is exactly right for a `date` and exactly wrong
  for a `timestamptz`, whose instant it discards. For an "updated 2 hours ago"
  column use `formatRelativeTime`; for a displayed timestamp use the tenant zone
  via `lib/tenant-time.ts`. The repo-wide sweep counting these still has 20 open
  sites, so the wrong one is currently the more common one to copy.
- **A `Tooltip` on a disabled control never opens** — a disabled element fires no
  pointer events. Wrap it in a plain `<span>` and put the trigger on that. This
  bites precisely where it matters most, because a disabled control is the one a
  user most needs an explanation for ("Publish this automation before switching
  it on").
- **`type` and `interface` are not interchangeable where an index signature is
  needed.** A type alias gets an implicit index signature and is assignable to
  `Record<string, unknown>`; an interface does not and is not. Query-key
  factories take `Record<string, unknown>`, so params declared as an `interface`
  need a cast at every call site. Declare params objects as `type`. Related: this
  is why adding `[key: string]: unknown` to `ScheduleEventProps` backfired — the
  workaround made the library's own props unassignable to it.
- **A canvas library is a view over your store, except for drag position.**
  React Flow owns the frames of a drag; write to the store on drag *stop*, not
  on `onNodesChange`. Committing every frame puts one undo entry on the history
  stack per pixel moved, so Ctrl+Z undoes the animation instead of the move —
  the rule "undo covers node changes" is then satisfied and useless. The same
  reasoning applies to text: coalesce parameter edits on `(nodeId, field)` within
  ~600ms or undo becomes a character-by-character eraser.
- **Turn off the canvas library's own delete key when deletion has invariants.**
  React Flow's `deleteKeyCode` removes the node and its edges, which silently
  severs a graph that needed its neighbours relinked. Set `deleteKeyCode={null}`
  and handle Delete yourself so removal and relink are one store action. The
  catch to remember: that also disables *edge* deletion, so the handler has to
  cover selected edges too or connections become undeletable.
- **Load an editor's state keyed on the record id, not on the fetched payload.**
  A `useEffect` that re-seeds a store whenever `data` changes will reset the
  canvas on any background refetch — including one returning an identical
  graph — discarding whatever the user had drawn since. Guard with a ref holding
  the id already loaded. This is the most damaging thing a builder can do and it
  produces no error.
- **`nodeTypes` / `edgeTypes` must be module-scope constants.** A fresh object
  literal on each render makes React Flow tear down and rebuild every node, which
  shows up as node state resetting while you type.
- **The repo's CSS tokens are raw HSL triplets, so `var(--brand)` is not a
  colour.** Tailwind wraps them (`hsl(var(--brand))`). Inline SVG attributes and
  `style` props do not, so `stroke: "var(--border)"` silently renders black. Any
  colour set outside a Tailwind class needs the `hsl()` wrapper.
- **React Flow's `OnNodeDrag` passes a DOM `MouseEvent | TouchEvent`**, not a
  React synthetic event, unlike `NodeMouseHandler` which does. Type handlers with
  the library's own exported types rather than hand-writing the signature.
- **Every product category has a default look, and reaching for a library's
  demo styling lands you in it.** A node editor built from React Flow's examples
  is a rounded card with a tinted icon tile, grey bezier wires and the stock
  Controls/MiniMap — i.e. n8n, Zapier, Make and every clone. It is not neutral;
  it is a specific look that arrives whether or not it suits the product. The
  way out is to ask what the thing being drawn actually *is* in the user's world.
  An automation in this CRM is a **dispatch rule** for a contractor, which is a
  routing diagram — so: right-angled `smoothstep` paths instead of beziers, a
  category **spine** down the node's left edge instead of a tinted tile, branch
  labels on the wire rather than the handle. Same components, same tokens,
  entirely different read.
- **Colour-coding survives better as an edge than as a fill.** Six category
  colours rendered as filled icon tiles turn a canvas into a bag of sweets and
  fight a single-accent brand. The same six as a 3px spine carry identical
  information at a fraction of the chroma, and scale to twenty nodes on screen.
- **Keep one marker vocabulary per concept across every surface.** "Draft" was a
  badge on the list and a different badge in the toolbar; "Live" was a badge in
  one place and a dot-and-label in another. One system — ● live · ○ off ·
  ◌ draft · – archived, shape carrying the meaning so it survives greyscale —
  means a state is one thing in the product. Check the *other* screen whenever
  you restyle a status.
- **Mono is for identifiers, not for atmosphere.** This repo's `font-mono` is
  documented as the face for "times, counts and money — anything read as data
  rather than as prose", and the landing-page work deleted 12 of 15
  `uppercase tracking` declarations as the loudest generic signal on the page.
  So `v3`, a branch name and an `off` chip earn mono; a tracked-caps section
  eyebrow reintroduces exactly what was removed.
- **A workspace package written with ESM `.js` specifiers breaks the Next build,
  and nothing else notices.** `packages/workflow-nodes` writes its internal
  imports as `./node-definition.js`. That is correct for `tsx` (which runs the
  API's raw TypeScript), it type-checks under the repo's
  `moduleResolution: "bundler"` where the extension is permitted, and vitest
  resolves it — so three of the four consumers are happy. Webpack takes the
  specifier literally, looks for a `.js` that was never emitted, and fails with
  `Can't resolve './node-definition.js'`. Fix in `next.config.mjs`:
  `config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] }`, keeping
  `.js` last so real JS in `node_modules` still resolves. Note it is a *webpack*
  option — Turbopack needs its own setting, and at that point the honest fix is
  to drop the extensions so every bundler agrees without configuration. Every
  other package in this monorepo already omits them; workflow-nodes is the
  outlier.
- **An unrun page hides a whole package's build breakage.** This error was
  reachable from `lib/phone.ts` — which re-exports from the same package and is
  used by the customer pages — since P3. It surfaced only when a new route
  imported the package and someone finally ran `next dev`. "It type-checks" and
  "the tests pass" say nothing about whether the bundler can resolve it; those
  are three different resolvers with three different rules.
- **This app forces a scrollbar on every page on purpose — theme it, do not
  delete it.** `globals.css` sets `overflow-y: scroll` plus
  `scrollbar-gutter: stable` on `<html>` so an opening Radix dialog cannot shift
  the layout. The visible cost is the browser's own chrome sitting on screen
  permanently, and in dark mode a light OS scrollbar against a near-black app is
  the loudest thing in the window. The fix is `scrollbar-width: thin` plus
  `::-webkit-scrollbar-thumb` on the border token with a transparent
  `background-clip: padding-box` border, so the thumb reads as a floating pill.
  Do not reach for `scrollbar-width: none`: most pages genuinely scroll, and the
  scrollbar is the only signal of how much is left.
- **A full-viewport surface opts out via an attribute, not by editing the global
  rule.** `html:has([data-fills-viewport]) { overflow: hidden }` lets one route
  (the automation builder) stop the page scrolling while every other page keeps
  the anti-shift behaviour. `:has()` was already used in this file for the
  scroll-lock fix, so it is an established pattern rather than a new dependency.
- **The dashboard navbar is `h-14` (3.5rem), not 4rem.** Any full-height page
  computing `calc(100vh - 4rem)` is 8px short of the fold and will not line up.
  Use `100dvh` rather than `100vh` too — on mobile the collapsing address bar
  makes `vh` taller than the visible viewport, which clips a fixed toolbar.
- **Persist a dragged panel width on pointer-UP, never on move.** Writing to
  `localStorage` on every `pointermove` is ~60 synchronous writes a second and
  the drag visibly stutters on them. Keep a live value in state, mirror it in a
  ref, and write once on release — the pattern `use-detail-shell.ts` already
  uses. Three details that are easy to miss: set `cursor`/`user-select` on
  `<body>` rather than the handle (once the pointer leaves the 6px strip a
  handle-scoped cursor reverts and the drag looks dead); listen for
  `pointercancel` as well as `pointerup` or a browser gesture leaves the whole
  document unselectable; and **re-clamp the stored width on load**, because a
  width chosen on a 27" monitor restored on a laptop leaves no room for content.
- **A resize handle inside an `overflow-hidden` shell must not be centred on the
  border.** The usual `-translate-x-1/2` puts half the grab area outside the
  panel, where it is clipped — so the target is half the size it looks and the
  cursor only changes on one side. Keep it fully inside, or move the overflow
  clipping to an inner element.
- **Suppress a width transition while dragging.** A panel with
  `transition-[width]` for its open/close animation will lag the pointer by that
  duration during a resize, which reads as the panel resisting. Same for the
  first frame after mount when restoring a saved width — otherwise the panel
  animates from its default to the stored value on every page load.
- **Check a new surface's type conventions against the codebase before trusting
  your eye.** A feature built in isolation drifts from the app around it in ways
  that are obvious on screen and invisible in review. Measure rather than guess:
  `grep -rho 'text-\[[0-9]*px\]' | sort | uniq -c` against the same for
  `text-xs|sm|base` shows what the app's scale actually is. In this repo it is
  `text-xs`/`text-sm` (903 uses) with `text-[11px]`/`text-[10px]` as an accepted
  small-chrome vocabulary (149 uses) — so those brackets are fine and
  `text-[13px]` is not, because it lands between two established steps.
- **The dashboard's section-label pattern is
  `text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading`**
  (63 uses), and its form labels are `<Label className="font-body">` and nothing
  more (59 uses) — size and weight come from the primitive. Writing a group
  heading as ordinary body text, or a field label at a custom size, is what makes
  a new panel look like it belongs to a different application than the one beside
  it. Note this is the *dashboard's* convention: the landing page deliberately
  retired tracked-caps eyebrows, and the two surfaces do not share a rule.
- **`<body>` already carries `font-body`, so explicit `font-body` is redundant —
  but write it anyway.** The codebase does, 800 times. Consistency with the
  surrounding code beats a technically-minimal class list; a file that omits it
  reads as having been written by someone who did not check.
- **React Flow ships no `font-family`.** If canvas text looks wrong, the cause is
  the classes on your own nodes, not the library's stylesheet — worth confirming
  with `grep font-family` in its `dist/` before going looking for an override to
  fight.
- **If the server validates persisted state, the action that triggers it must
  persist first.** Publish loads the draft graph from the database and validates
  that — correct, because a publish trusting a client's "it's valid" would
  publish whatever the client claimed. But with Save as a separate button,
  pressing Publish after adding a step reported "Nothing starts this automation":
  true of the stored draft, and obviously false to the person looking at the
  trigger they had just placed. The user reads that as "it didn't save". Publish
  now saves first and aborts if the save fails — a failed save (a 409) must never
  be followed by publishing someone else's graph. The general rule: any button
  whose server-side check reads persisted state either writes first or is
  disabled while dirty; leaving it to report on stale data is a bug that reads as
  a lie.
- **A silent success needs somewhere else to show.** Save deliberately has no
  toast — a builder saves constantly and a toast per save buries the 409 that
  matters. That is right, but it means the only feedback is the button changing
  to "Saved", and if anything downstream then contradicts it the user concludes
  the save failed. Removing confirmation and leaving a downstream action to
  disagree is worse than the toast would have been.
- **A node card that describes a step by its mode switch describes nothing.**
  The automation builder derives each card's caption from the first configured
  property, and `delay.wait` declares `mode` first and required — so every wait
  read "for a length of time", which is exactly what the title "Wait" already
  said. The fix is derivable rather than a per-node exception: a mode switch is
  precisely a property that *other* properties key their `displayOptions` off,
  so those are skipped on a first pass and used only as a fallback. Anything
  that would need a `switch (nodeType)` in the builder has broken the property
  the whole feature rests on — that adding a node is "write a definition, write
  an executor".
- **Build a URL from state, never by reading the current URL back.**
  `router.replace` is not synchronous, so a `useSearchParams()` round trip means
  two quick changes — open a detail sheet, then switch a filter — can both read
  the same stale query string and the second silently drops the first. If the
  values are already in component state, the URL is an *output* of that state,
  not a second source of it.
- **A dialog handed the list page's rows is reading a filtered, paginated
  answer.** The template gallery was passed `workflows` to decide which
  templates were already installed — that array is whatever the current search
  and status filter left, so a tenant who had searched would be told they do not
  have templates they do. Let the dialog ask its own bounded question and mount
  it only while open. Same defect class as a stats row computed from the twenty
  rows on screen.
- **A guard that protects the user's work will also block your write.** The
  builder loads the graph into its store **once per workflow id**, so a
  background refetch cannot reset the canvas and discard what somebody drew.
  That same guard silently swallowed the version restore: the new draft landed
  in the database and the canvas kept showing the graph the user was replacing.
  The fix is a callback fired **only on the actual write** — clearing the marker
  on every sheet close would have restored the bug the guard exists to prevent,
  for anybody who opened it, looked, and closed it again.
- **A params type passed to a query key must be a `type`, never an `interface`.**
  TypeScript gives a type alias an implicit index signature and an interface
  none, because an interface is open to declaration merging and the compiler
  cannot promise its keys are only the declared ones. So an interface is not
  assignable to `Record<string, unknown>`, which is what most `queryKeys.*`
  entries take. `WorkflowRunsParams` shipped as an interface and failed;
  `WorkflowListParams` beside it is a type alias and compiles. This is the third
  appearance of the same rule — `ScheduleEventProps` grew a hand-written
  `[key: string]: unknown` to work around it, which then made the library's own
  props unassignable to it. Do not add the index signature by hand; change the
  declaration to `type`.

- **`resolveNodeIcon` takes an icon NAME, not a node type.** It falls back to a
  question mark rather than throwing — deliberately, so a missing map entry is
  not fatal — which means a wrong name renders a node with no icon and nothing
  else. `IconBriefcasePlus` is not a Tabler icon and the definition using it
  looked entirely correct. **Check the name exists in the installed package**
  (`grep` the package's `icons/index.mjs`); there is now a test that asserts
  every definition's icon is in the map, but only the package can say whether
  the name is real.
- **A declared property type with no renderer case draws "this kind of field
  isn't available yet".** Honest, and invisible until somebody opens that exact
  node — `serviceTypeSelect` sat like that for two phases. Adding a
  `NodePropertyType` is a case in `config-renderer.tsx` and a component, in the
  same commit. `apps/web/src/__tests__/node-ui-coverage.test.ts` diffs the two.
- **A picker stores an id and must be able to render a label for it with no
  search term.** On open, a saved config holds a uuid and nothing else, so the
  control shows a bare uuid — or worse, an empty trigger, which reads as *not
  configured* on a step that is configured, and gets "fixed" by picking
  something else. The searchable pickers take an `ids` parameter for this
  rehydrate path, separate from the search path.
- **Debounced search needs a generation counter, not just a timer.** Responses
  arrive out of order, so a slow result for "sm" lands after "smith" and
  replaces the right list with a stale one. The timer bounds the request count;
  only the counter bounds *which answer wins*.

- **Radix focuses the first tabbable control when a Dialog opens — check what
  that is before shipping the dialog.** The redesigned template gallery pins
  **Start from blank** at the top of its index, which made it the first button
  in DOM order: the dialog opened with a focus ring on the option that discards
  every template, while the pane beside it showed a template. Enter creates the
  wrong thing, and nothing about that reads as a bug in review. Fixed with
  `onOpenAutoFocus={(e) => { e.preventDefault(); ...focus the content }}` — the
  title and description are still announced and Tab still walks into the list.
  The general rule: whenever a dialog's first tabbable control is destructive,
  irreversible, or simply not the likely intent, focus the container instead.
- **`a?.length || b?.length` in JSX renders a literal `0`.** It is a *number*,
  not a boolean, so two empty arrays print `0` into the layout where you meant
  to render nothing. `undefined` and `null` are skipped by React; `0` is not.
  Wrap each side in `Boolean()`. Same family as the `z.coerce.boolean()` bug —
  a value that is falsy in JS but not absent.
- **Don't lean on TypeScript's aliased-condition narrowing across JSX.**
  `const isBlank = sel === BLANK || item === null` then `isBlank ? … : use(item)`
  compiles today, but the narrowing is fragile — it breaks the moment the alias
  stops being `const`, gains a third clause, or moves into a child component's
  props. Derive the whole branch once off the nullable value itself
  (`const action = item ? {...} : {...}`) so there is one narrowing point and
  the JSX carries none.

## Middleware and headers vs links that arrive from outside (2026-10-16)
- **Every path a person reaches from an email, a crawler or someone else's website belongs in
  `publicPaths`.** The list grew one page at a time and missed `/unsubscribe` (every marketing
  email's footer and `List-Unsubscribe` header), `/invite` (team invitations), `/blog`,
  `/robots.txt`, `/sitemap.xml` and `/widget.js` — all redirected a logged-out visitor to `/login`
  (ONB-02/03). Nothing failed loudly because every developer testing them was logged in. When you add
  a URL that goes into an email or onto a third-party page, open it in a private window.
- **A blanket `X-Frame-Options: DENY` breaks the product's own embed.** `/:path*` covered
  `/book/<slug>?embed=1`, so the booking widget opened a blank modal on every customer site (ONB-04).
  Scope the header with a negative lookahead (`/:path((?!book(?:/|$)).*)`) and give the exempt tree
  `Content-Security-Policy: frame-ancestors *`. Send `frame-ancestors` beside XFO everywhere — modern
  browsers obey the CSP directive and ignore XFO when both are present. Exempt the whole `/book/*`
  tree, not just `?embed=1`: the form `router.push`es to `/status/<id>` without the query string.

## Landing page passes (2026-10-16)
- **Never wrap above-the-fold content in a JS-gated reveal.** `.js .reveal` is `opacity: 0` from
  first paint until React hydrates and an IntersectionObserver fires. Chrome does not treat an
  `opacity: 0` element as an LCP candidate, so wrapping the hero `<h1>` tied LCP to the client
  bundle. "Fails open" protected readers without JS, not readers with slow JS. Reveal is for
  below the fold only.
- **A brand colour that is a fill, a text colour and a focus ring can only be good at one of
  them.** The orange was 2.85:1 under white labels and 2.7:1 as text and as the ring. The fix is
  a second token (`--brand-ink`) plus a dark `--brand-foreground`, not per-component overrides.
  After any foreground-token change, grep for hard-coded `bg-brand text-white`: six sites had
  been bypassing the token, and they would have been the only buttons left failing.
- **A shared navbar's `#anchor` handler must check the element exists.** `preventDefault()` plus
  `scrollIntoView` on `#features` is right on `/` and does nothing on `/blog`, where the same
  bar renders. Fall back to `router.push("/#features")`.
- **Check every import before planning a bundle saving.** The audit proposed swapping the
  landing tabs and accordion off `motion/react`, but `ui/sheet.tsx` (the mobile menu) imports it
  too, so the swap would have saved nothing. Grep the whole import graph of the page first.
- **`MotionConfig reducedMotion="user"` belongs in the layouts that use motion, NOT the root.**
  Every animate-ui component arrived with its own motion and none consulted the preference. The
  first fix put the provider at the root, which put `motion/react` into the bundle of every route,
  including the booking portal, quote page and auth pages, none of which import anything from it.
  It now wraps the five route groups that do (corrected 2026-10-16, LAND-09). A new route that
  renders a dialog, sheet, tabs, accordion, checkbox, switch or toggle needs it added. CSS reveals, WAAPI or View Transitions (the theme wipe) and
  `scrollIntoView({ behavior: "smooth" })` each need their own check, since `MotionConfig`
  reaches none of them.
- **Marketing copy is a claim, and the FAQ is also structured data.** Once PRODUCT.md lists
  what is not built, check every sentence against it. `faq-data.ts` feeds the `FAQPage` JSON-LD,
  so an untrue answer is also served to search engines as fact.

- **Never fade text with `opacity` on top of an already-muted colour.** `opacity-70` over
  `text-muted-foreground` on a muted fill multiplied down to 2.78:1. Fade by choosing the muted
  token, which is a single measured value (4.7:1 or better here), not a product of two.
- **A detector measures sizes, not measure.** The type scan found every off-ramp size and never
  the FAQ answers running about 100 characters a line at 14px. For reading text, check the
  container width against the font size, and cap prose at about 68ch.
- **Check the scale for steps too close to be roles.** 2rem against 1.75rem (1.14×) was a closing
  heading that could not be told apart from a section heading, and at `sm` the two were already
  identical. Fold a near-duplicate step into its neighbour rather than documenting it.

## Orange as a fill vs orange as text (2026-10-16)

- **A contrast fix at the token level does not reach utilities that name the fill.** Changing
  `--brand-foreground` to ink fixed every button, but `text-brand` is the *fill* colour used as
  text, and 213 of those (115 files) still printed 2.7:1 orange. The fix is two tokens with two
  jobs, `--brand` to fill and `--brand-ink` to be read, and then a sweep. In dark mode `--brand-ink`
  is `--brand`, so the swap is invisible there; don't verify it in dark mode and call it done.
- **Flipping a `*-foreground` token silently changes everything that borrowed it as "white".**
  `bg-brand-foreground text-brand` was a white pill with orange digits. It became a dark pill,
  nearly invisible in dark mode. After changing a foreground token, grep for it as a *background*
  and as text that is not on its own fill.
- **"Has to be read" includes some icons.** A selection check, an icon-only button and a toggled
  toolbar icon carry meaning alone, so they need 3:1 (WCAG 1.4.11). A glyph beside a heading that
  names the same thing does not. That split is what lets the bright orange survive as a mark.
- **A dimmed ink is only for hover.** `text-brand-ink/80` is about 4.4:1 on paper, so it's fine as
  a transient hover but not as resting text. A `text-brand/70` hint failed at any size and became
  full ink.
- **Codemod a class sweep with a keep-list, not a find-and-replace.** Default to converting and name
  every exception by `file:line` with a reason (glyph tile, Night Shift slab, logotype). That makes
  each surviving bright orange a decision someone can audit, not a miss.

## Data colours are computed, not chosen (2026-10-16, dashboard polish)

- **Run the dataviz validator on the tokens you already have before trusting them.** The
  hand-rolled hex on the dashboard looked like the problem, but `--chart-3` (umber, chroma 0.04)
  read as grey and `--chart-4` (amber, L 0.81) sat above the lightness band and collapsed into
  `--chart-5` for protanopes. The hex wasn't covering for a working token set; there was none.
- **`${color}1a` only works while the colour is a hex string.** The quote funnel tinted its
  chips by appending an alpha byte. The moment the colour became `hsl(var(--x))`, that produced
  invalid CSS. Keep the token *name* and build the tint with `hsl(var(--x) / 0.1)`
  (`tokenColor(name, alpha)`).
- **A donut has one more adjacent pair than a stacked bar: its last slice touches its first.**
  Validate the wrap pair. Here it landed in the 6–8 floor band, legal only because the donut has
  gaps (`paddingAngle`) and a labelled list beside it.
- **More than three nominal types can't have fixed colours in a form where the present set
  varies.** Seven service types against five validated slots, keyed to the type, puts unchecked
  pairs next to each other whenever a type is absent. All-pairs validation caps at about three.
  The compromise that stays valid is count order (touching slices are always neighbouring slots)
  plus a neutral "Other". Never `i % palette.length`.
- **A single series is one hue.** Colouring nominal bars by rank spends the colour channel on
  what length already says, and repaints a bar whenever its rank changes.
- **An ordinal ramp flips its anchor in dark mode.** On a dark card the darkest red would be the
  quietest, so the oldest debt is the *brightest* there. Re-step each mode against its own
  surface; never invert the light ramp.
- **A colour that means "good" in one widget and "booking" in the next is two meanings.** The KPI
  pills borrowed booking-teal and event-indigo as decoration beside the widget where those hues
  are identities. Decoration takes the brand, and identity hues stay with what they identify.


## App-wide motion pass (2026-10-16)
- **Animate a route change on the shell, not on 55 pages, and never with a remount.** A layout
  effect on `usePathname()` that calls `el.animate()` on the content container plays on every
  navigation, inherits to new routes, and remounts nothing (strict-rules §7's `template.tsx`
  problem). It must be a *layout* effect, or the new page paints at rest for a frame and then
  snaps back to start the animation. It must also skip the initial path, or it delays the
  server-rendered first paint.
- **Never leave a transform on a container that has `position: fixed` children.** Any non-`none`
  transform, including one held by `animation-fill-mode: both`, makes the element the containing
  block for its fixed descendants, so a bulk-action bar or a dnd-kit drag overlay inside the page
  is quietly mispositioned. CSS arrivals use `backwards`, and WAAPI arrivals use no fill.
- **Reduced motion for tailwindcss-animate is a variables problem.** Its `enter`/`exit` keyframes
  read movement from `--tw-enter-scale`, `--tw-enter-translate-*` and friends. Zeroing those
  under the media query keeps the fade and drops the zoom and slide, where the common global
  `animation-duration: 0.01ms` kills the fade that tells someone a menu opened.
- **An inline `style={{ animation: "name …" }}` can't be overridden by a stylesheet, so redefine
  the keyframes.** A later `@keyframes` with the same name inside
  `@media (prefers-reduced-motion: reduce)` wins while the query matches. That was the only way to
  reach the chatbot's inline animations without rewriting the component.
- **A component inside a pathname-keyed `<main>` remounts on every navigation, so "play once" needs
  module scope.** The running-timer bar would have dropped in on every page. A module variable
  holding the announced timer's id survives the remount; component state cannot.
- **Sweep for loops, not just for spinners.** Six spinners broke DESIGN.md's rule. So did two
  decorative rings spinning forever, a scroll hint bouncing forever, and a chatbot launcher that
  pulsed forever on every page load, because its "has opened" flag is not persisted. Give each a
  finite iteration count or stop it.

## Server actions are a queue, not a transport (2026-10-16, app-wide slowness)

- **Next 14.2 runs server actions strictly one at a time.** That's
  `next/dist/shared/lib/router/action-queue.js`: an action that arrives while one
  is pending waits for it. So a page whose TanStack queries call server actions
  loads its data in sequence. The calendar's five reads took the *sum* of their
  latencies (~10s), and the jobs board fired twelve back to back; the dev log
  showed it as a run of `POST /jobs?pipeline=…`. Reads now go through
  `lib/client-reads` → `/api/v1/*` (ADR-004). Only mutations belong on actions.
- **A navigation does not wait behind the queue. It discards the pending action
  and flags a refresh.** So "the click doesn't go" was never the queue itself. It
  was the reads it fills in behind, plus `staleTimes.dynamic: 0`, which
  re-rendered every page on the server on every click, back/forward included.
  The Next default is 30s, and it's safe here because TanStack ignores a seeded
  `initialData` that is older than its cache.
- **A server action can't hand the API's `Set-Cookie` to the browser.** Any
  cookie the API sets on a read (Better Auth's refreshed session cache) dies at
  the Next server. A fetch through a rewrite passes it straight through.
- **A mirrored read must send exactly what the action sent.** `pickQuery` skips
  `false`, as the raw actions did, but `getCustomers` sends `optedOut=false` and
  `getMaintenanceContracts` sends `isActive=false`. Dropping those silently
  turns "inactive" into "all". And `useBookings` passes a `schedule` key that
  `getBookings` never forwarded, so a generic params-to-query would have
  started sending it. List the keys; don't spread the object.
- **Measure concurrency on a warm pool.** The first concurrent burst after
  sequential traffic paid for new Neon connections (~2.7s each from the dev
  machine), so it looked no faster than sequential. Three more rounds showed
  the real number (~2.0s against 4.7s).

## Responsive shell + dashboard redesign (2026-10-18)

- **The chatbot said "fully responsive" while the shell had no breakpoint at all.** The
  sidebar was always fixed at 224/64px and every page was always padded by it, so a phone
  got ~150px of content, yet `tips-mobile` promised a hamburger menu and tables that adapt.
  A knowledge-base answer is a product claim: check it against the code, not against what
  the feature was meant to be.
- **Never build a translucent colour by appending hex alpha to a colour string.**
  `` `${color}10` `` only works when `color` is six-digit hex; `hsl(var(--brand))10` is not a
  colour, the browser drops the declaration, and the element silently loses its background.
  `agenda-hover-card.tsx` broke this way the moment the agenda moved from hex to tokens. Use
  `color-mix(in srgb, ${color} 6%, transparent)`, which takes any colour form.
- **`h-full` on a card inside a flex stack inside a grid cell stretches the card.** A grid
  item stretched by its row has a definite height, so the child's `height: 100%` resolves
  against it and the card grows to the bottom of the taller neighbouring zone. `h-full` is
  right for row-mates in a two-up grid and wrong in a stacked column.
- **DM Mono ships only 400 and 500.** `font-mono font-semibold` or `font-bold` gets a
  browser-synthesised bold. Pair `font-mono` with `font-medium` at most.
- **Recharts tick text inherits the container's font.** Put `font-mono` on the chart wrapper
  to set axis figures in DM Mono, then reset the tooltip (it mounts inside the same
  wrapper) with `font-body`.
- **A portal-or-inline switch on a media query does not flash on desktop.** `PageActions`
  returns null until the navbar slot exists, and the slot is set from a ref during commit.
  The re-render that follows is an update, where `useSyncExternalStore` reads the real
  snapshot rather than the server one, so the first render with a slot already knows the
  width. Keep the `if (!slot) return null` before any branching on the query.

## Responsive pass across the app (2026-10-18, Phase 3)

- **A motion `layout` element only animates a position that actually changes.** `ui/switch.tsx`
  swapped shadcn's `translate-x` thumb for `<motion.span layout>` and moved nothing, so every
  switch in the app changed colour and kept its thumb on the left (reported by the user). The
  track has to move the thumb (`data-[state=checked]:justify-end`); `layout` then springs it.
  Don't add `translate-x` instead: motion writes `transform` inline and fights it.
- **`text-base md:text-sm` in a primitive is not a safe mobile-font fix.** About 70 call sites
  pass their own `text-xs`, and tailwind-merge does not treat `md:text-sm` as conflicting with an
  unprefixed `text-xs`, so desktop inputs would have grown. iOS zoom-on-focus is fixed once in
  `globals.css` (16px for fields below `md`, `!important` to beat the utilities).
- **Same rule for any responsive default in a shared primitive.** tailwind-merge resolves
  conflicts per variant: an unprefixed caller class never removes a prefixed base class.
  `SheetContent`'s `sm:max-w-lg` survives a caller's `max-w-full`, so the caller needs
  `sm:max-w-full` too.
- **A `fixed` box at `left: 50%` shrink-wraps into the right half of the screen** unless it has
  `w-max` (bulk-action bar). Its labels then overflow on a phone.
- **A focus ring with `ring-offset` is clipped inside an `overflow-x-auto` list.** Scrollable
  tab lists use an inset ring.
- **`touch-action` is limited by every element between the finger and its scroll container.**
  `pan-y` on kanban cards blocked the sideways swipe that is the only way to reach other columns
  on a phone, whatever the board allowed. With a press-and-hold `TouchSensor`, cards can be
  `manipulation` and swipes belong to scrolling.
- **dnd-kit's `MouseSensor` fails when children stop `mousedown` propagation** (the kanban
  card's inline editors do). A `PointerSensor` subclass that ignores `pointerType === "touch"`
  keeps mouse/pen behaviour, and a separate `TouchSensor` with a delay takes touch.
- **React Flow: never pass `undefined` for `onNodesChange` to make a canvas read-only.**
  `adoptUserNodes` drops `measured` on every re-seed, and an unmeasured node is drawn hidden, so
  nodes flash or vanish on tap. Keep the handlers and turn off dragging and connecting instead.
- **A breakpoint read in JS is `false` during hydration.** Anything that would shift the layout
  on desktop (hiding editing buttons, choosing a column count) goes in CSS (`max-md:hidden`); JS
  decides only what the server never renders (a sheet's open state, a default view chosen after
  mount, a portal target).
- **`hidden xl:block` on a detail page's sidebar hid real data below 1280px**: the customer's
  contact details, the linked job and Generate Invoice on every laptop. Never hide a panel to
  save width; stack it.

## Rebrand: Deep Sea Blue + Inter (2026-10-18)

- **A palette's navies make a blue theme, not a dark mode.** The first dark pass used the
  palette's own #001233/#002855 as page and card; the user rejected it on sight ("doesn't look
  like a dark mode"). Dark surfaces need low saturation (here ~20% at 7–11% lightness) so the
  brand has something to stand out against; keep the saturated navy for the always-dark slab.
- **A surface that is dark in both themes needs its own accent token.** `--brand-ink` flips
  per theme, so on the navy slab in LIGHT mode it was the dark text blue at 2.5:1. Theme-agnostic
  surfaces get theme-agnostic accents (`--midnight-accent`).
- **Changing the font family: repoint the Tailwind slots, then grep raw CSS.** Keeping
  `font-heading`/`font-body`/`font-mono` and pointing all three at `--font-sans` changed every
  component with zero edits, but `calendar-styles.css` read `var(--font-body)` directly; once
  that variable stopped existing the declaration silently fell back to inheritance. After any
  font change, `grep -r "var(--font-"`.
- **Flip the label colour with the fill.** Orange needed dark text (white was 2.85:1); the
  blue takes white (5.6:1). The token `--brand-foreground` carried that, so the only risk was a
  hard-coded `text-foreground` on `bg-brand`; grep for it before trusting a token swap.
- **A new brand hue can collide with a data slot.** The old chart slot 4 was a blue, which
  would have sat next to the brand blue as a second blue. Re-run the dataviz validator for the
  whole categorical order whenever the brand changes, not only slot 1.
- **The brand lives outside the web app too.** Emails (React Email components and nine
  templates) and the API's react-pdf invoices/quotes hard-coded the old orange `#E8652D` in ~30
  places. A rebrand isn't done until `grep` for the old hex across `packages/` and `apps/api`
  is empty.

## Motion foundation (2026-10-18)

- **Radix only plays an exit if it can see a CSS animation.** Its `Presence` unmounts portal
  content the moment `open` turns false unless the element has a running CSS `animation`. The
  dialog, alert-dialog and sheet exits were `motion` springs inside `AnimatePresence`, so they
  never played at all. Overlay enter/exit belongs in CSS (tailwindcss-animate) on Radix.
- **Centre an animated dialog with the `translate` property, not `transform`.** The zoom
  keyframes write `transform`, which wipes a `-translate-x-1/2 -translate-y-1/2` centring.
  `[translate:-50%_-50%]` is a separate property and composes with the keyframes.
- **animate-ui's Tabs wrote `opacity:0; filter:blur(4px)` into the server HTML**, so the first
  panel was invisible until hydration, and it left `filter: blur(0px)` behind, which turns the
  panel into a containing block for `position: fixed` children. Override the primitive's
  `initial` so the first panel is at rest, and never leave a `filter` on a resting element.
- **A stagger key is the whole API.** `useStagger` keys on what is SHOWN (page, filter, tab),
  `null` while loading, never the data array: a background refetch would otherwise replay the
  entrance every 30 seconds.

## Animating every page (2026-10-18)

- **A route-change hook can't see a page behind `loading.tsx`.** On an uncached visit the
  pathname changes while the skeleton is on screen; the real page arrives a round trip later.
  `useRouteArrival` now watches `<main>` with a MutationObserver for a few seconds after a
  navigation and staggers `data-stagger` blocks that mount late. The observer's callback runs
  before the next paint, so the late block is never shown at rest first.
- **A CSS animation class on server-rendered markup plays on page load.** A draw-in or pop on
  SSR content needs a "came by client navigation" gate, not a mount check.
- **Recharts restarts a `Pie` whenever its children aren't shallow-equal.** A fresh `data` array
  or an inline `content={<Tooltip />}` replays every pie on each refetch. Memoise pie data and
  hoist tooltip elements; Area/Bar/Line charts only replay when the root `data` changes.
- **Stagger table rows with opacity only.** `ui/table` wraps `<table>` in an `overflow-auto`
  box exactly its height, so a row starting 6px low makes a scrollbar flash for the length of the
  animation (and reflows the table on Windows).
- **A stagger key must treat placeholder data as not ready** (`isPlaceholderData` → `null`), or
  the previous page's rows animate just before being replaced.
- **Mutation hooks don't await invalidation**, so a "just created" row mounts only when the
  refetch lands. Hold the highlight id for ~3s, longer than the animation.
- **A save handler that toasts and resolves breaks feedback.** `EditableField` played its
  "saved" wash over a refused job-field save because `handleFieldSave` toasted the error and
  returned normally. Throw `new Error(message)` and let the field show the one toast and shake.
- **Several agents wrote the same small hook.** "Did this mount by client navigation?" now
  exists twice (`superadmin/use-arrived-by-navigation.ts`, `settings/use-arrival-stagger.ts`),
  and "flash a changed row" three ways (`use-row-flash`, `use-new-ids`, `useChangeFlash`).
  Consolidate before adding a fourth.

## Dashboard layout + landing redesign (2026-10-18)

- **Two independent column stacks leave a hole under the shorter one.** The dashboard's main and
  side zones each stacked their own widgets, so the side column ended halfway down the page.
  Put only the paired pieces in a band (Up next beside Revenue) and every other widget in one
  grid, and span the last card (`fillLastRow`) so an odd count never ends a row early.
- **To make a list card match its neighbour's height, give it `contain: size` in a stretched
  grid cell.** `h-full` alone lets the longer list set the row height. `[contain:size]` with
  `flex-1` makes the card take the row height from Revenue and scroll its own list inside it.
- **A "colour change" on the closing band was a structural change.** The navy slab carried the
  section's weight; making it neutral without changing anything else left a weak ending. Scale did
  the job instead: the page's biggest headline in one bordered card, with one blue button.
- **Landing sample visuals need a visible label, not just `aria-hidden`.** PRODUCT.md forbids
  anything that reads as a real customer. Every composite says "Example data" or "sample data" in
  text a sighted reader sees, and avatars are initials for roles, never names.

## Vercel build failure after the unchecked passes (2026-10-18)

- **`next build` stops at the first type error, so one fix is not proof the next build passes.**
  Commit `9893fa9` failed on Vercel at `admins-page-client.tsx:136` (an implicit `any`); that is
  the only error the log can show. After ~300 unchecked files, run `pnpm typecheck` before the
  next push instead of fixing one error per deploy.
- **An untyped server action makes every callback on its result an implicit `any`.** Actions that
  return `json.data` straight from `res.json()` hand back `any`; `setState(result.data)` compiles,
  but `result.data.filter((a) => …)` does not. Assign it to a typed local first
  (`const rows: AdminUser[] = result.data`), no cast needed.
- **Tailwind drops an arbitrary `duration-[…]` or `ease-[…]` class as "ambiguous" when
  `tailwindcss-animate` is installed**, because both plugins claim the prefix. The build only
  warns, and the transition silently falls back to 150ms and the default curve. Write the property
  out: `[transition-duration:var(--dur-arrive)]`, `[transition-timing-function:var(--ease-out)]`.

