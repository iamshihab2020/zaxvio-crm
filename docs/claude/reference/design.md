# Frontend Design System

> **Source of truth** for all frontend design patterns, component conventions, layout structures, and UI/UX principles in the Zaxvio CRM web app (`apps/web/`).

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System & Tokens](#color-system--tokens)
3. [Typography](#typography)
4. [Icon System](#icon-system)
5. [Dark Mode](#dark-mode)
6. [Animation System](#animation-system)
7. [Component Architecture](#component-architecture)
8. [Reusable Component Library](#reusable-component-library)
9. [Page Layout Patterns](#page-layout-patterns)
10. [Component Conventions](#component-conventions)
11. [Data Fetching & State](#data-fetching--state)
12. [Performance Rules](#performance-rules)
13. [Z-Index Layers](#z-index-layers)
14. [Stage Color Presets](#stage-color-presets)

---

## Design Philosophy

- **"Industrial Warmth" / "Desert Heat"** — Brand orange for CTAs/accents, midnight navy for dark sections, warm off-white (`surface`) for body. No generic AI aesthetics (no purple gradients on white).
- **No hardcoded colors** — ALL colors via CSS variables in `globals.css` mapped to Tailwind tokens (`bg-brand`, `text-ink`, `bg-surface`). Never raw hex/rgb/hsl.
- **Semantic HTML** — `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>` for SEO. Sections need `aria-labelledby`.
- **Component-first** — shadcn/ui pattern (Radix primitives + CVA + tailwind-merge). Always check `components/ui/` and `components/reusable/` before building anything. Never hand-roll HTML when a shadcn equivalent exists. Never duplicate UI patterns.
- **Skeleton loaders, never spinners** — All loading states use `<Skeleton>` from `@/components/ui/skeleton`. No `<Loader2 className="animate-spin" />`.

---

## Color System & Tokens

All colors defined as CSS variables (HSL) in `apps/web/src/app/globals.css`, mapped to Tailwind tokens in `tailwind.config.ts`.

### Brand Palette

| Variable | HSL | Tailwind Token | Usage |
|----------|-----|----------------|-------|
| `--brand` | `24 95% 53%` | `bg-brand`, `text-brand`, `border-brand` | CTAs, accents, primary actions |
| `--brand-light` | `24 100% 96%` | `bg-brand-light` | Subtle backgrounds, hover states |
| `--brand-foreground` | `0 0% 100%` | `text-brand-foreground` | Text on brand backgrounds |

### Semantic Tokens (auto-switch light/dark)

| Variable | Tailwind Token | Usage |
|----------|----------------|-------|
| `--background` / `--foreground` | `bg-background`, `text-foreground` | Page background & primary text |
| `--card` / `--card-foreground` | `bg-card`, `text-card-foreground` | Card surfaces & card text |
| `--muted` / `--muted-foreground` | `bg-muted`, `text-muted-foreground` | Subdued backgrounds & secondary text |
| `--accent` / `--accent-foreground` | `bg-accent`, `text-accent-foreground` | Hover highlights |
| `--destructive` / `--destructive-foreground` | `bg-destructive`, `text-destructive-foreground` | Error/delete states |
| `--border` | `border-border` | Borders |
| `--input` | `bg-input` | Input backgrounds |
| `--ring` | `ring-ring` | Focus rings (brand orange) |

### Custom Tokens

| Variable | Tailwind Token | Usage |
|----------|----------------|-------|
| `--midnight` | `bg-midnight` | Dark navy sections, landing page |
| `--midnight-light` | `bg-midnight-light` | Lighter navy |
| `--surface` | `bg-surface` | Warm off-white body background |
| `--surface-alt` | `bg-surface-alt` | Alternate surface shade |
| `--ink` | `text-ink` | Primary text on light backgrounds |

### Chart Colors (5-series)

| Token | Color |
|-------|-------|
| `--chart-1` | Orange (brand) |
| `--chart-2` | Teal |
| `--chart-3` | Navy |
| `--chart-4` | Gold |
| `--chart-5` | Green |

### Admin Theme

| Variable | Tailwind Token | Usage |
|----------|----------------|-------|
| `--admin-accent` | `bg-admin-accent` | Red accent for superadmin |
| `--admin-sidebar-bg` | `bg-admin-sidebar-bg` | Dark red sidebar |

---

## Typography

### Fonts

| Role | Font | CSS Variable | Tailwind Class | Loaded In |
|------|------|-------------|----------------|-----------|
| Headings | Space Grotesk | `--font-heading` | `font-heading` | `app/layout.tsx` via `next/font/google` |
| Body | DM Sans | `--font-body` | `font-body` | `app/layout.tsx` via `next/font/google` |

**NEVER** use Inter, Roboto, Arial, or system defaults.

### Text Scales

| Element | Classes |
|---------|---------|
| Page title | `font-heading text-2xl font-bold text-foreground` |
| Page subtitle | `mt-1 text-sm text-muted-foreground font-body` |
| Section header (sidebar) | `text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading` |
| Card title | `font-heading text-lg font-semibold` |
| Body text | `font-body text-sm text-foreground` |
| Muted/secondary text | `text-sm text-muted-foreground` |

---

## Icon System

### Library

**Primary: Tabler Icons (`@tabler/icons-react`)**. Used in all application components.

**Secondary: Lucide React** — used only internally within shadcn/ui primitives (calendar, select, command). Never import lucide-react in application code.

### Rules

- **NEVER wildcard import** icon libraries (`import * as Icons`). This bundles the entire library and causes OOM build failures.
- Always import individual icons: `import { IconUsers, IconMail } from "@tabler/icons-react"`

### Size Scale

| Context | Classes |
|---------|---------|
| Labels, inline | `h-3.5 w-3.5` |
| Buttons, inline actions | `h-4 w-4` |
| Section headers | `h-5 w-5` |
| Empty states, hero | `h-8 w-8` |

---

## Dark Mode

### Implementation

- **Engine**: `next-themes` with `attribute="class"` and `defaultTheme="system"`
- **Provider**: `<ThemeProvider>` wraps app in `layout.tsx`
- **Toggle**: `<ThemeToggle>` cycles light → dark → system. Uses hydration-safe `mounted` check.
- **CSS**: `.dark` class on `<html>` triggers dark variable overrides in `globals.css`

### Rules

- All status/badge colors MUST have `dark:` variants
- Card backgrounds auto-adapt via `bg-card` CSS variable
- Invoice/PDF preview paper stays `bg-white dark:bg-white`
- Sidebar detail sections use `bg-muted/50` for content boxes
- **Never** hardcode `gray-xxx` — use `text-muted-foreground`, `bg-muted`, `border-border`

---

## Animation System

### Library: `motion/react` (Framer Motion v12+)

Used for declarative component animations throughout the app.

### Standard Transitions

| Component | Animation | Config |
|-----------|-----------|--------|
| Button | Hover scale + tap scale | `spring: stiffness 400, damping 25` |
| Dialog/AlertDialog | Scale (0.95→1) + blur (4px→0) | `spring: stiffness 200, damping 24` |
| Sheet | Slide from side + fade | `spring: stiffness 150, damping 22` |
| Tabs highlight | Animated underline (brand color) | `spring: stiffness 300, damping 30` |
| Kanban cards | Staggered entrance | CSS `--enter-delay` variable |

### CSS Animations (globals.css)

| Keyframe | Duration | Usage |
|----------|----------|-------|
| `fade-in-up` | 0.6s | Scroll-reveal |
| `card-enter` | 0.3s | Kanban card stagger |
| `pulse-emergency` | 2s infinite | Urgent job indicators (red glow) |
| `aurora` | 15s infinite | Landing page gradient |
| `accordion-down/up` | — | Radix accordion |

### Scroll Reveal

Uses `IntersectionObserver` via `useIsInView` hook. Classes: `.reveal-hidden` → `.reveal-visible`.

### Rules

- Use `motion/react` for component mount/unmount animations
- Use CSS `@keyframes` for micro-interactions and persistent animations
- Landing page components use `SectionReveal` wrapper
- Dynamic import heavy animation components with `next/dynamic`

---

## Component Architecture

### Directory Structure

```
apps/web/src/components/
├── ui/                          # shadcn/ui primitives (34 components)
│   ├── button.tsx               # Enhanced with motion/react scale
│   ├── dialog.tsx               # Animated scale + blur
│   ├── sheet.tsx                # Animated side drawer
│   ├── tabs.tsx                 # Animated underline indicator
│   ├── badge.tsx                # Added "brand" variant
│   ├── table.tsx, card.tsx, input.tsx, skeleton.tsx, ...
│   └── (all standard shadcn)
│
├── reusable/                    # Cross-entity shared components
│   ├── page-header.tsx          # Title + subtitle + action button
│   ├── search-input.tsx         # Controlled search with icon
│   ├── status-filter-tabs.tsx   # Animated sliding pill filter tabs
│   ├── empty-state.tsx          # No-data state with icon + CTA
│   ├── table-skeleton.tsx       # Loading skeleton for tables
│   ├── pagination.tsx           # Page navigation
│   ├── delete-confirm-dialog.tsx # Destructive confirmation modal
│   ├── confirm-action-dialog.tsx # Generic confirmation modal
│   ├── view-mode-toggle.tsx     # Sidebar/dialog/page toggle
│   ├── editable-field.tsx       # Inline edit suite (text, textarea, select, date, time)
│   ├── scroll-fade-area.tsx     # Scrollable area with bottom fade
│   └── convert-to-job-dialog.tsx # Quote → Job conversion
│
├── dashboard/
│   ├── sidebar.tsx              # Main navigation (collapsible)
│   ├── navbar.tsx               # Fixed top header
│   ├── dashboard-shell.tsx      # Flex wrapper with sidebar padding
│   ├── sidebar-provider.tsx     # Context for sidebar state
│   │
│   ├── reusable/
│   │   └── stats-cards.tsx      # Status count grid, optional click-to-filter
│   │
│   ├── customers/               # Entity-specific (16 files)
│   ├── jobs/                    # Entity-specific (23 files, most complex)
│   ├── invoices/                # Entity-specific
│   ├── quotes/                  # Entity-specific
│   ├── bookings/                # Entity-specific
│   ├── catalog/                 # Entity-specific
│   ├── checklists/              # Entity-specific
│   ├── equipment/               # Entity-specific
│   ├── service-agreements/      # Entity-specific
│   ├── home/                    # Dashboard KPI (11 files)
│   ├── reports/                 # Report charts
│   ├── schedule/                # Calendar view
│   ├── notifications/           # Notification bell + panel
│   ├── chatbot/                 # AI help panel (z-40)
│   ├── pipelines/               # Pipeline configuration
│   └── settings/                # Settings forms (19 files)
│
├── animate-ui/                  # motion/react animation primitives
│   ├── primitives/effects/      # fade, slide, auto-height, particles
│   ├── primitives/texts/        # rotating, typing
│   └── components/              # animated buttons, backgrounds
│
└── theme-provider.tsx           # next-themes wrapper
```

### Organization Rules

1. **NEVER** place components inside route/page folders (e.g., `app/(dashboard)/customers/components/` is FORBIDDEN)
2. Entity-specific components → `components/dashboard/<entity>/`
3. Reusable components → `components/reusable/` (or `components/dashboard/reusable/` for dashboard-only)
4. Route folders contain only `page.tsx`, `*-page-client.tsx`, and `loading.tsx`
5. UI primitives (shadcn) → `components/ui/`
6. Landing page components → `app/(landing)/_components/`

---

## Reusable Component Library

### PageHeader

```tsx
<PageHeader
  title="Customers"
  subtitle="Manage your customer database."
  action={<Button>+ New Customer</Button>}
  className="mb-4"
/>
```

**Props**: `title: string`, `subtitle?: string`, `action?: ReactNode`, `children?: ReactNode`, `className?: string`

### StatsCards

```tsx
<StatsCards
  stats={[
    { label: "Total", count: 42, icon: IconUsers, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active", count: 30, icon: IconCheck, color: "text-green-600", bg: "bg-green-50", filterValue: "active" },
  ]}
  activeFilter={statusFilter}
  onFilterChange={setStatusFilter}
  className="mb-4"
/>
```

**Props**: `stats: StatItem[]`, `activeFilter?: string`, `onFilterChange?: (filter: string) => void`, `className?: string`

Use `filterValue` when label doesn't match filter value (e.g., "Under Warranty" → `"under_warranty"`).

### SearchInput

```tsx
<SearchInput value={search} onChange={setSearch} placeholder="Search customers..." />
```

**Props**: `value: string`, `onChange: (value: string) => void`, `placeholder?: string`, `className?: string`

Note: Debouncing is handled by the page (300ms `setTimeout`), not by SearchInput.

### StatusFilterTabs

```tsx
<StatusFilterTabs
  options={[
    { value: "", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
  ]}
  value={filter}
  onChange={setFilter}
/>
```

**Props**: `options: FilterOption[]`, `value: string`, `onChange: (value: string) => void`, `className?: string`

Features animated underline indicator with `ResizeObserver`.

### EmptyState

```tsx
<EmptyState
  icon={IconUsers}
  title="No customers yet"
  description="Add your first customer to get started."
  actionLabel="Add Customer"
  onAction={() => setDialogOpen(true)}
/>
```

**Props**: `icon: React.ElementType`, `title: string`, `description: string`, `subtitle?: string`, `actionLabel: string`, `onAction: () => void`

### TableSkeleton

```tsx
<TableSkeleton columns={5} rows={8} />
```

**Props**: `columns: number`, `rows?: number` (default 5)

### Pagination

```tsx
<Pagination
  page={pagination.page}
  totalPages={pagination.totalPages}
  total={pagination.total}
  onPageChange={handlePageChange}
  entityName="customers"
/>
```

**Props**: `page: number`, `totalPages: number`, `total: number`, `onPageChange: (page: number) => void`, `entityName?: string`

### DeleteConfirmDialog

```tsx
<DeleteConfirmDialog
  entityName="customer"
  itemLabel={customer.name}
  open={deleteOpen}
  onOpenChange={setDeleteOpen}
  onConfirm={handleDelete}
  loading={deleting}
/>
```

### ViewModeToggle

```tsx
<ViewModeToggle value={viewMode} onChange={setViewMode} />
```

Three modes: `"sidebar"`, `"dialog"` (center modal), `"page"` (full page). Persisted to localStorage via `useViewPreference` hook.

### EntityDetailShell (MANDATORY for entity detail views)

Reusable shell for entity detail views in `components/dashboard/reusable/entity-detail-shell/`. Handles all shared boilerplate: sidebar/dialog mode switching, drag-to-resize, loading skeleton, header toolbar, and tab rendering.

**RULE: When to use EntityDetailShell — you MUST use it when ALL of these conditions are met:**

1. The view displays a **single entity's detail** (not a list, not a create/edit form)
2. The view opens as a **sidebar (Sheet) or dialog** triggered by clicking a row/card in a list page
3. The view shows **read-only or inline-editable fields** (not a form with Save/Cancel buttons)
4. The entity has a **dedicated `[id]` detail page** that the shell can link to via "Open full page"

**Currently used by**: Jobs, Invoices, Quotes, Bookings — these are the 4 entities with sidebar/dialog detail views.

**Do NOT use EntityDetailShell for:**
- Simple **create/edit form dialogs** (Customers, Assets, Catalog, Checklists, Service Agreements) — these are plain `<Dialog>` with form fields and a Submit button
- **Full page detail views** only (e.g., Customer detail page at `/customers/[id]`) — these use the 3-panel layout pattern directly
- **Confirmation dialogs** or **action modals** — use `DeleteConfirmDialog` or `ConfirmActionDialog`

**When adding a NEW entity**: If the entity needs a click-to-preview panel from a list/table/kanban page (like Jobs or Invoices), use `EntityDetailShell`. If it only needs a form dialog for create/edit, use a plain `<Dialog>`.

```tsx
import { EntityDetailShell } from "@/components/dashboard/reusable/entity-detail-shell";

<EntityDetailShell
  entityType="jobs"
  entityRoute="/jobs"
  entityLabel="Job"
  entityId={jobId}
  open={open}
  onOpenChange={onOpenChange}
  loading={loading}
  hasData={!!job}
  onDelete={() => onDelete(job)}
  renderTitle={() => <span className="font-heading text-xl tracking-tight">{job.jobNumber}</span>}
  renderDescription={() => <span>{customerName}</span>}
  renderActions={() => <Button>Move to Next</Button>}
  tabs={[
    { value: "details", label: "Details", content: <DetailsTab /> },
    { value: "line-items", label: "Line Items", count: 3, content: <LineItemsTab /> },
  ]}
/>
```

**Props**: `entityType`, `entityRoute`, `entityLabel`, `entityId`, `open`, `onOpenChange`, `loading`, `hasData`, `renderTitle`, `renderDescription?`, `renderActions?`, `renderToolbarExtras?`, `onDelete?`, `tabs?`, `children?`

**Sub-components**: `DetailRow` (icon + label + value), `EntityDetailShellSkeleton`, `EntityDetailShellHeader`

**Performance**: Only the active tab content is mounted (lazy rendering). Tab count badges use `<Badge variant="secondary">`.

### EditableField Suite

Six inline-edit components in `editable-field.tsx`:

```tsx
<EditableText value={title} onSave={async (v) => await update({ title: v })} />
<EditableTextarea value={notes} onSave={async (v) => await update({ notes: v })} />
<EditableSelect value={status} options={STATUS_OPTIONS} onSave={async (v) => await update({ status: v })} />
<EditableDate value="2025-03-15" onSave={async (v) => await update({ date: v })} />
<EditableTime value="14:30" onSave={async (v) => await update({ time: v })} />
```

Click → input appears → Enter/blur to save → Escape to cancel. All handle async save with toast errors.

### Settings Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SettingsSection` | `components/dashboard/settings/settings-section.tsx` | Card with icon + title + description + action |
| `SettingsFormMessage` | `components/dashboard/settings/settings-form-message.tsx` | Success/error inline message |
| `SettingsPageHeader` | `components/dashboard/settings/settings-page-header.tsx` | Description + action button row |

---

## Page Layout Patterns

### 1. List Pages (MANDATORY pattern)

Every entity list page (customers, invoices, quotes, bookings, service-agreements, catalog, checklists, assets) MUST follow this exact structure:

```tsx
<section className="p-6">
  {/* 1. PageHeader — ALWAYS visible, even in empty state */}
  <PageHeader
    title="Entity Name"
    subtitle="Description of this section."
    action={<Button>+ New Entity</Button>}
    className="mb-4"
  />

  {/* 2. StatsCards — show status counts, optionally clickable for filtering */}
  {!showEmptyState && (
    <StatsCards
      stats={[{ label, count, icon, color, bg, filterValue? }]}
      activeFilter={statusFilter}
      onFilterChange={setStatusFilter}
      className="mb-4"
    />
  )}

  {/* 3. EmptyState — only when no data AND no active filters */}
  {showEmptyState && <EmptyState icon title description actionLabel onAction />}

  {/* 4. Card wrapper — single-row header with filter tabs LEFT, search + controls RIGHT */}
  {!showEmptyState && (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <StatusFilterTabs options={STATUS_OPTIONS} value={filter} onChange={setFilter} />
        <div className="ml-auto flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search..." />
          {/* Optional: SortPopover, ViewModeToggle, CategoryFilter, etc. */}
        </div>
      </div>

      {loading && <div className="p-4"><TableSkeleton /></div>}
      {showNoResults && <p className="py-12 text-center ...">No results</p>}
      {!loading && hasData && <DataTable />}
    </div>
  )}

  {/* 5. Pagination — outside card, below */}
  {!loading && hasData && pagination.totalPages > 1 && <Pagination />}
</section>
```

**Key rules:**
- `PageHeader` always renders (never hidden by empty state)
- Filter tabs + search + controls in ONE row (never two rows)
- `StatusFilterTabs` LEFT, search + extra controls RIGHT with `ml-auto`
- Pages without status filtering still use `SearchInput` in the card header
- Debounce: 300ms `setTimeout` in the page component

### 2. Detail Pages

```
flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface
  header bar
  flex flex-col lg:flex-row gap-4
    left panel: w-full lg:w-80 shrink-0
    center tabs: flex-1 min-w-0
    right sidebar: hidden xl:block w-72 shrink-0
  all panels: rounded-lg border border-border bg-card shadow-sm
```

Detail views support three modes via `useViewPreference`:
- **Sidebar**: `<Sheet>` at 520px width
- **Dialog**: `<Dialog>` center modal
- **Page**: Full page with URL routing

### 3. Settings Pages

```
grid grid-cols-1 gap-6 lg:grid-cols-3
  form: lg:col-span-2 (SettingsSection wrappers)
  sidebar: lg:col-span-1
```

Settings layout uses `<SettingsNav>` sidebar + `<SettingsContent>` wrapper.

### 4. Kanban / Dual-View (Jobs)

View toggle + board (`flex gap-4 overflow-x-auto`) or table (same card wrapper as list pages).

- Kanban uses `@dnd-kit/core` (PointerSensor + KeyboardSensor)
- `DragOverlay` for drag preview
- `ScrollArea` with horizontal scroll for columns
- Dynamically imported with `next/dynamic` (heavy library)

### 5. Dashboard / KPI

Grid of `KpiCard` components + chart panels:
- 4-column responsive grid for KPI cards
- Chart components use shadcn `Chart` (recharts wrapper)
- `loading.tsx` renders matching skeleton layout

---

## Component Conventions

### Tables

shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`. Never raw `<table>`. Wrap in card container.

### Buttons

`<Button>` from shadcn (with motion/react hover/tap animations built in).
- CTA: `className="bg-brand text-brand-foreground hover:bg-brand/90"`
- Ghost icon: `variant="ghost" size="icon"`
- **NEVER** use raw `<button>` — always `<Button>` from shadcn

### Badges

`<Badge>` with variants (`default`, `secondary`, `destructive`, `outline`, `brand`).
- Status badges: mapped color configs with `dark:` variants
- Pattern: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium`

### Dialogs & Sheets

- Center modal (`<Dialog>`) for confirmations and forms
- Side drawer (`<Sheet side="right">`) for detail views
- Both have motion/react open/close animations

### Inline Table Dropdowns

Use `<Popover>` instead of `<Select>` for inline table dropdowns to prevent layout shift. Radix `Select` causes scroll locking issues.

### Filters

- `<StatusFilterTabs>` for status/type filtering (animated pill tabs)
- `<Popover>` + `<Command>` for searchable dropdowns (category, service type)
- Extra filter controls sit in the card header row alongside `SearchInput`

### Forms

- Grid: `grid grid-cols-1 gap-4 sm:grid-cols-2`
- Label + input: `space-y-2`
- Settings forms use `<SettingsSection>` wrapper
- Plain React state for form management (no react-hook-form)
- Manual validation with error state objects
- Toast notifications (`sonner`) for success/error feedback

### Row Actions

`<DropdownMenu>` with ghost icon button trigger. Always `e.stopPropagation()` on trigger click.

### Loading States

- Always skeleton loaders, never spinners
- `<TableSkeleton>` for table loading
- `loading.tsx` in every `(dashboard)/` route for Suspense boundaries
- Skeletons mirror actual layout structure

### Inline Editing

Use `<EditableText>`, `<EditableSelect>`, etc. from `components/reusable/editable-field.tsx` for detail page fields. Click-to-edit with async save.

---

## Data Fetching & State

### Server → Client Pattern

```tsx
// page.tsx (server component)
export default async function CustomersPage() {
  const result = await getCustomers({ page: 1, limit: 15 });
  return <CustomersPageClient initialCustomers={result.data ?? []} />;
}

// customers-page-client.tsx (client component)
"use client"
export function CustomersPageClient({ initialCustomers }) {
  const [customers, setCustomers] = useState(initialCustomers);
  // ... client-side state management
}
```

### Server Actions

All API calls go through server actions in `apps/web/src/actions/`. Pattern:

```typescript
"use server"
export async function getCustomers(params?) {
  const res = await fetch(`${API_URL}/customers?${qs}`, {
    headers: { cookie: await getCookieHeader() },
    cache: "no-store",
  });
  return { data, pagination, error };
}
```

**NEVER** call the API directly from client components.

### State Management

- **Local state** (`useState`) for UI (dialogs, filters, loading, form data)
- **Server actions** for data persistence
- **localStorage** for UI preferences (view mode, sidebar collapse) via custom hooks
- **Context API** for sidebar state (`SidebarProvider` → `useSidebar()`)
- **No global state library** (no Redux, no Zustand)

### View Preferences

`useViewPreference(entity)` hook stores detail view mode (sidebar/dialog/page) and sidebar width in localStorage. Returns `{ mode, sidebarWidth, mounted, setMode, setSidebarWidth }`.

**Sidebar width rules:**
- **Default**: 40% of the viewport width (computed on first load, stored as pixels)
- **Range**: 400px min, 1200px max
- **Shared per entity**: The width is stored per entity type (e.g., `zaxvio-job-detail-prefs`). When the user resizes a sidebar on the Jobs page, that width applies to BOTH the detail sheet AND the create dialog on that same page.
- **Drag-to-resize**: All sidebar sheets MUST have a drag handle on the left edge for resizing. The handle is a 1.5px invisible strip that shows `bg-brand/40` on hover.
- **Persistence**: Width saves to localStorage on `mouseup` (not during drag, to avoid storage thrashing).
- **All sidebar sheets are resizable**: Detail sheets (via `EntityDetailShell`) and create/edit sheets (via inline drag handler) both use the same `useViewPreference` for their entity type.

---

## Performance Rules

1. **Server-side prefetch for initial data** — Every `page.tsx` in `(dashboard)/` MUST prefetch data and pass as props to the client component. NEVER render an empty wrapper that delegates all fetching to useEffect.

2. **Parallel fetches with `Promise.all()`** — When a page needs multiple data sources, fetch them in parallel. NEVER chain sequential awaits unless one depends on the other.

3. **Stats via single backend query** — Status counts MUST use a single `/stats` endpoint with SQL `COUNT(*) FILTER (WHERE ...)`. NEVER make N separate API calls.

4. **No `limit: 9999` for counting** — NEVER fetch all records to count client-side. Use `pagination.total` or a `/stats` endpoint.

5. **Dynamic imports for heavy libraries** — Libraries over 30KB (recharts, react-big-calendar, @dnd-kit, motion) MUST use `next/dynamic` with loading skeleton fallback.

6. **`loading.tsx` for every route** — Every page directory in `(dashboard)/` MUST have a `loading.tsx` that renders an appropriate skeleton.

7. **Client components only for interactivity** — `"use client"` components receive initial data as props. The initial render MUST NOT depend on `useEffect`.

---

## Z-Index Layers

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base content | `z-10` | Relative positioned elements (tabs, nav items) |
| Navbar | `z-20` | Fixed top navigation bar |
| Sidebar | `z-30` | Fixed side navigation |
| Floating UI | `z-40` | Chatbot panel, impersonation indicator |
| Overlays | `z-50` | Dialogs, dropdowns, tooltips, sheets |

---

## Stage Color Presets

Reference: `apps/web/src/lib/constants/stage-color-presets.ts`

Eight presets, each with light + dark mode variants:

| Key | Color | Usage |
|-----|-------|-------|
| `blue` | Blue | Default pipeline stages |
| `brand` | Orange | Brand-highlighted stages |
| `green` | Green | Success/completed stages |
| `red` | Red | Blocked/failed stages |
| `purple` | Purple | Custom stages |
| `amber` | Amber | Warning/pending stages |
| `gray` | Gray | Inactive/archived stages |
| `teal` | Teal | Custom stages |

Each preset provides: `dot`, `bg`, `text`, `border`, `borderTop`, `ring` classes.

Helper: `getStageColors(colorKey)` returns the preset or gray fallback.
