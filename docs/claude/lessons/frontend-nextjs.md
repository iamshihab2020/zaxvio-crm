# Lessons: Frontend (Next.js, UI/UX, Calendar, Charts)

> Related: [[design]] | [[architecture]] | [[strict-rules]] | [[lessons]]

## Next.js 14

- **next.config.ts not supported in Next.js 14** — Must use `.mjs` or `.js` extension. TypeScript config support was added in Next.js 15.
- **Tailwind CSS v3 required for classic PostCSS plugin** — Tailwind v4 moved the PostCSS plugin to `@tailwindcss/postcss`. Use `tailwindcss@3` with `postcss.config.mjs` + `tailwind.config.ts` pattern.
- **React 18 required for Next.js 14** — `pnpm add react react-dom` defaults to React 19, but Next.js 14 needs React 18. Explicitly install `react@18 react-dom@18`.
- **`staleTimes` does NOT fix back/forward navigation** — `experimental.staleTimes: { dynamic: 0, static: 0 }` only disables Router Cache for forward navigations (link clicks). Back/forward (popstate) still serves stale cached RSC payloads. Fix: add a client component that listens for `popstate` and calls `router.refresh()` to force a server re-fetch. See `src/components/refresh-on-nav.tsx`.
- **Never use `template.tsx` for route group layouts** — `template.tsx` remounts on every navigation, destroying browser history state and breaking back/forward. Always use `layout.tsx` for route groups. Only use `template.tsx` for rare cases like per-page entry animations.
- **Route groups for organization only, not competing layouts** — Auth pages (`(auth)/`) should NOT have their own `layout.tsx` if there's already a root layout. Competing layout trees cause rendering conflicts. Use a shared wrapper component (e.g., `AuthShell`) instead.

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
