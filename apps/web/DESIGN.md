---
name: Zaxvio CRM
description: Field service software where the day, the job and the bill sit on one ruled sheet.
colors:
  safety-orange: "hsl(24 95% 53%)"
  safety-orange-tint: "hsl(24 100% 96%)"
  orange-wash: "hsl(24 100% 95%)"
  orange-deep: "hsl(24 90% 30%)"
  work-order-paper: "hsl(32 24% 98%)"
  second-sheet: "hsl(32 18% 95%)"
  card-white: "hsl(0 0% 100%)"
  carbon-ink: "hsl(25 20% 12%)"
  pencil: "hsl(28 8% 42%)"
  rule-line: "hsl(30 14% 89%)"
  field-line: "hsl(30 12% 80%)"
  night-shift: "hsl(25 14% 9%)"
  night-shift-raised: "hsl(25 12% 14%)"
  night-shift-text: "hsl(30 20% 94%)"
  stop-red: "hsl(0 78% 51%)"
  booking-teal: "hsl(175 77% 32%)"
  event-indigo: "hsl(243 75% 59%)"
  chart-teal: "hsl(173 58% 39%)"
  chart-rust: "hsl(18 62% 38%)"
  chart-blue: "hsl(212 70% 48%)"
  chart-green: "hsl(142 65% 40%)"
  status-good: "hsl(152 62% 36%)"
  status-warning: "hsl(40 95% 48%)"
  status-critical: "hsl(0 72% 48%)"
  status-good-ink: "hsl(152 70% 27%)"
  status-critical-ink: "hsl(0 72% 40%)"
  overdue-1: "hsl(4 80% 66%)"
  overdue-2: "hsl(2 75% 55%)"
  overdue-3: "hsl(0 72% 45%)"
  overdue-4: "hsl(358 75% 34%)"
  admin-red: "hsl(0 72% 51%)"
  admin-sidebar: "hsl(0 55% 14%)"
  safety-orange-dark: "hsl(24 95% 56%)"
  orange-wash-dark: "hsl(24 40% 16%)"
  orange-wash-text-dark: "hsl(24 90% 82%)"
  background-dark: "hsl(25 12% 6%)"
  surface-dark: "hsl(25 12% 7%)"
  second-sheet-dark: "hsl(25 11% 10%)"
  card-dark: "hsl(25 10% 13%)"
  ink-dark: "hsl(30 20% 94%)"
  pencil-dark: "hsl(28 8% 64%)"
  rule-line-dark: "hsl(25 9% 19%)"
  field-line-dark: "hsl(25 9% 24%)"
  night-shift-dark: "hsl(25 13% 10%)"
  stop-red-dark: "hsl(0 62% 42%)"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  display-phone:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  title-small:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.429
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
  body-lead:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.05em"
  eyebrow:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.18em"
  data:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "\"tnum\""
  data-dense:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.333
    fontFeature: "\"tnum\""
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  rule-row: "48px"
components:
  button-primary:
    backgroundColor: "{colors.safety-orange}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "hsl(24 95% 53% / 0.9)"
  button-hero:
    backgroundColor: "{colors.safety-orange}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "0 28px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.work-order-paper}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.orange-wash}"
    textColor: "{colors.orange-deep}"
  button-ghost:
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.md}"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.orange-wash}"
    textColor: "{colors.orange-deep}"
  input:
    backgroundColor: "{colors.work-order-paper}"
    textColor: "{colors.carbon-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  job-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.xl}"
    padding: "14px"
  stats-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  badge-brand:
    backgroundColor: "{colors.safety-orange-tint}"
    textColor: "{colors.orange-deep}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  filter-tabs:
    backgroundColor: "{colors.second-sheet}"
    rounded: "{rounded.full}"
    padding: "4px"
  filter-tab-active:
    backgroundColor: "{colors.safety-orange}"
    textColor: "{colors.carbon-ink}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  nav-item:
    textColor: "{colors.pencil}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.safety-orange-tint}"
    textColor: "{colors.orange-deep}"
  slab:
    backgroundColor: "{colors.night-shift}"
    textColor: "{colors.night-shift-text}"
---

# Design System: Zaxvio CRM

## Overview

**Creative North Star: "The Work Order"**

Field service runs on paper: the work order, the day sheet, the estimate pad. Zaxvio is
the digital version of that paper, and the system keeps its manners. Surfaces are warm
off-white paper. Text is near-black carbon ink. Times, money and counts are typed
figures that line up in columns. One Safety Orange mark shows what to do next or where
you are, the way a marker circles the job that matters on a printed sheet. On the landing
page the ruling is literal: hairlines every 3rem behind the headline and the closing band,
and a time-ruled day sheet as the hero. Inside the app the same idea shows up as order:
bordered cards, one-row toolbars, mono figures and pill-shaped status.

The density is a working tool's, not a brochure's. Body text is 14px, and toolbars, filter
tabs and table rows are compact so a day's worth of jobs fits on one screen. Expression
lives in the details: the orange hairline across the top of the navbar, the orange glow when
you pick up a job card, a status pill's colour. Dark mode is a full peer, not an inversion:
the warm neutral ladder is restepped so every surface still rises in the right order.

Rejected on purpose, and recorded in the code where each was removed: "AI startup" gloss
(purple-on-white gradients, aurora or nebula backdrops, glow used as decoration), device
mockups around the product, spinners, and cool blue-slate greys or generic system fonts.

**Key Characteristics:**
- Warm paper neutrals (hue 25–32, low saturation) that rise in four tonal steps.
- One accent, Safety Orange, used for action, location and the current hour.
- Three faces with fixed jobs: Space Grotesk for headings and labels, DM Sans for prose and
  controls, DM Mono for anything read as data.
- Hairline borders and gentle corners. Pills mean state, rectangles mean containers and actions.
- Motion that explains a change and then stops. Under `prefers-reduced-motion` the movement goes
  and the fade stays.

**The Motion Explains a Change Rule.** Things animate when they appear, move or change state,
then stop. A resting screen is still. Nothing animates while it's being dragged or panned, and
every keyframe has a `prefers-reduced-motion` override. The only continuous motions allowed
are signals: the emergency-priority pulse, the empty automation canvas's slow breath, the help
assistant's typing dots while a reply is pending, and the impersonation bar's live dot. Each of
the last two stops for reduced motion.

**Motion vocabulary** (the MOTION SYSTEM block in `globals.css`, 2026-10-16). There is one
curve, `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`), and four durations: `--dur-feedback`
120ms, `--dur-state` 200ms, `--dur-arrive` 280ms, `--dur-focal` 700ms. New motion uses these.
- **Route arrival.** Every dashboard, superadmin, blog and legal route rises 8px into place on
  navigation, never on first paint. It is one hook, `useRouteArrival`, in the shells
  (`PageContent`, `RouteStage`), so a new route inherits it. It uses no remount and leaves no
  transform behind, so `position: fixed` children are never captured.
- **Step travel.** In the booking portal the next step slides in from the direction of travel
  (`.motion-step-forward` / `-back`) with no wait before it. In the quote portal, Respond and
  Confirmation arrive (`.motion-arrive`), and both only ever mount after a click.
- **Appearance in place.** An empty result or a load error fades in (`.motion-appear`, opacity
  only, so it never stacks with a route arrival).
- **Feedback.** Every `Button` presses to 98% (`active:scale-[0.98]`), with no scale under
  reduced motion. The running-timer bar drops in once per timer (`.motion-drop-in`), not on every
  route.
- **Focal moment.** The landing day sheet's now-line, drawn once.
- **Reduced motion is fewer and gentler, not none.** Arrivals become fades. tailwindcss-animate
  overlays keep their fade and lose their zoom and slide through its `--tw-enter-*`/`--tw-exit-*`
  variables, never a global 0.01ms kill. The emergency pulse becomes a steady ring, so the state
  survives without the motion.

## Colors

A warm, paper-and-ink palette with a single orange voice. Every other hue is data, not decoration.

### Primary
- **Safety Orange** (`safety-orange`; `safety-orange-dark` in dark mode): the primary action
  button, the selected filter tab, the current-hour marker, the navbar's top hairline, the
  identifying glyph beside a card or section heading, the first chart series and the job series in
  schedules. The brand key for the dashboard, charts, PDFs and emails. It must not drift.
- **Safety Orange Tint** (`safety-orange-tint`): the background behind the active nav item,
  brand badges and the empty-state icon disc.
- **Orange Wash** (`orange-wash`) with **Orange Deep** (`orange-deep`) text: hover state for
  outline and ghost controls. Orange Deep is the accessible way to write in orange on light
  surfaces (about 6.6:1 on the tint). Since 2026-10-16 it is also the token `--brand-ink`
  (`text-brand-ink`): orange **text** and the **focus ring** use it in light mode, and in dark mode
  `--brand-ink` is Safety Orange itself, which already reads at 6–7:1 there.

### Neutral
- **Work Order Paper** (`work-order-paper`): the page background and the default surface.
  The two are identical in light mode and separate by one step in dark.
- **Second Sheet** (`second-sheet`): alternate sections, muted fills, secondary buttons and the
  filter-tab track.
- **Card White** (`card-white`): cards, popovers and panels. The highest surface in light mode.
- **Carbon Ink** (`carbon-ink`): all primary text and headings.
- **Pencil** (`pencil`): secondary text, idle nav items, timestamps and captions.
- **Rule Line** (`rule-line`): every 1px border and divider, plus the landing page ruling.
- **Field Line** (`field-line`): input borders and hovered scrollbar thumbs. One step darker than
  Rule Line, so form fields read as fields.
- **Night Shift** (`night-shift`, raised step `night-shift-raised`, text `night-shift-text`): the
  always-dark slab used by the auth shell, the public booking portal, the quote page and the
  landing page's closing band. It is dark in both themes on purpose.

### Semantic and data
- **Stop Red** (`stop-red`): destructive buttons and errors only.
- **Booking Teal** (`booking-teal`) and **Event Indigo** (`event-indigo`): schedule series.
  A job is always orange, a booking always teal, an event always indigo, here and in the agenda's
  type badges. Read them through the tokens, never Tailwind's teal-500 or indigo-500.
- **Chart Teal, Rust, Blue, Green** (`chart-teal`, `chart-rust`, `chart-blue`, `chart-green`;
  `--chart-2..5`): categorical series 2–5 after Safety Orange, in that fixed order. Validated
  with the dataviz script in both themes (lightness band, chroma, colour-blind separation of
  neighbours). Dark mode has its own steps, including a deeper `--chart-1` than the UI brand.
  Rust and Blue replaced an umber that read as grey and an amber that collapsed into the
  green for protanopes (2026-10-16).
- **Status** (`status-good`, `status-warning`, `status-critical`): reserved meaning (accepted
  vs declined quotes, current invoices, up vs down). Never a series colour, and never shown
  without a label or icon (warning is 2.15:1 on white by design). Words use the `-ink` pair
  (`text-status-good-ink`, `text-status-critical-ink`), which clear 5:1 even on their own 10%
  tint.
- **Overdue 1–4** (`overdue-1`…`overdue-4`): invoice aging, one red that darkens with age, so
  the order reads from the colour. In dark mode the anchor flips and the oldest is brightest.
- **Admin Red** (`admin-red`, `admin-sidebar`): the super-admin area only, so staff always know
  they are outside a tenant's workspace.

### Named Rules
**The Validated Data Colour Rule.** Data colours come from `lib/constants/chart-palette.ts`, which
reads only tokens: categorical slots in fixed order and never cycled (past the fifth, a bucket
folds into a neutral "Other"), status for good or bad, overdue for age. A single series is one
hue, not a colour per bar. No hex in a chart: a colour that is not a token is a colour nobody
validated.

**The One Mark Rule.** Safety Orange is the only accent. It marks the next action, the current
place, or now. If a screen has orange in more than a handful of places, one of them is lying.

**The Rising Sheet Rule.** Surfaces must rise in this order in both themes: background ≤ surface
< second sheet < card. In dark mode borders stay lighter than cards (19% against 13%), or the
borders vanish. Any neutral change has to keep this order.

**The Same-Hue Rule.** Neutrals stay on the orange's side of the colour wheel (hue 25–32, under
25% saturation). A cool grey makes the orange read as an intrusion instead of an accent.

**The Fill, Not the Text Rule.** Safety Orange is a fill. On it, labels are Carbon Ink
(`--brand-foreground`/`--primary-foreground`): 5.8:1 in light and 6.2:1 in dark, where white was
2.85:1 and 2.68:1. When orange has to be read, it is Orange Deep through `text-brand-ink`, never
`text-brand` (2.7:1 on light surfaces). "Read" means words and numbers, the focus ring, and any icon
that carries meaning on its own: a selection check, an icon-only button, a toggled toolbar icon, a
scroll hint (WCAG 1.4.11 asks 3:1 of those). Bright `text-brand` is kept for exactly three things: a
decorative glyph beside a heading that names the same thing (section-header, empty-state and
activity-type icons, icon tiles), the logotype, and orange on the always-dark Night Shift slab,
where Orange Deep would fail instead. In dark mode `--brand-ink` is Safety Orange, so the split
only shows in light mode. Fixed in the tokens and swept through the product on 2026-10-16
(landing audit LAND-03/06).

## Typography

**Display Font:** Space Grotesk (with sans-serif)
**Body Font:** DM Sans (with sans-serif)
**Label/Mono Font:** DM Mono (with ui-monospace, monospace), weights 400 and 500

**Character:** Space Grotesk's squared, engineered shapes give headings a workshop tone. DM Sans
keeps prose and controls quiet. DM Mono is DM Sans's sibling, so the data face pairs with the
body face instead of arriving as an unrelated third typeface.

### Hierarchy
- **Display** (700, 2.5rem → 3rem at `sm` → 3.75rem at `lg`, line-height 1.05, tight tracking):
  the landing page `<h1>` only. Balanced wrapping. `display-phone` in the frontmatter is its 2.5rem
  base.
- **Section** (700, 1.75rem → 2.25rem at `sm`, line-height 1.15, tight tracking): every landing
  `<h2>` (`SectionHeading`), the closing band (which alone rises to 3rem at `lg`), and the page
  title on `/privacy` and `/terms`. The closing band was 2rem on phones until 2026-10-16, a 1.14×
  step from the other section headings, too close to read as a different role, so it shares this
  one.
- **Headline** (700, 1.5rem): dashboard page titles in the page header.
- **Title** (600, 1.125rem): card titles, the navbar page name and empty-state headings.
- **Title Small** (600, 0.875rem): headings inside cards and panels. The most-used heading size
  in the app.
- **Body** (400, 0.875rem): the app's default text, controls and table cells, including the
  landing page's pricing ledger. The landing page uses Body Lead (1.125rem, relaxed leading,
  `max-w-xl`) for ledes. Text people read at length on a public page, such as the FAQ answers and
  the legal pages, is 1rem at a measure of at most 68ch. There is no 13px step: it sat 1px from
  Body and Data in four components and was folded onto them.
- **Label** (600, 11px, 0.05em tracking, uppercase): sidebar group headers and table-adjacent
  section labels.
- **Eyebrow** (DM Mono 500, 11px, 0.18em tracking, uppercase): the day sheet's date field only.
  The landing page carries no eyebrow above any heading; the hero's was removed on 2026-10-16 and
  `SectionHeading` no longer accepts one.
- **Data** (DM Mono 400, 12px, tabular figures): times, money, counts, IDs and the day sheet's
  hour column. Drops to 10–11px inside dense job cards (`data-dense`), which includes the landing
  page's illustrative day sheet and kanban diagram.

### Named Rules
**The Figures Rule.** Anything read as a number (a time, an amount, a count, a job number) is set
in DM Mono with tabular figures (the `.tnum` utility), so columns line up and values don't jitter
as they change.

**The Three Faces Rule.** Space Grotesk, DM Sans and DM Mono, each with its own job. There is no
fourth face, and Inter, Roboto, Arial or system defaults are never used.

## Layout

**App shell.** From `lg` (1024px) up, a fixed left sidebar on Card White: 224px expanded, 64px
collapsed, with its width animating over 300ms. Nav groups have collapsible Label headers. Below
`lg` the sidebar leaves the flow: the same navigation opens as a left sheet (288px, at most 85% of
the screen) from a 40px menu button at the navbar's left edge, and closes when a page is picked.
A 56px top navbar carries the page name in Title and a 2px Safety Orange hairline that fades out
toward both edges; below `lg` it spans the full width, the user's name appears from `md`, and the
theme toggle moves into the account menu below `sm`. Page actions that portal into the navbar
render at the top of the page instead below `md`, where the navbar has no room for them. Page
content sits in a 16px gutter on phones and 24px from `sm`.

**Dashboard.** An overdue banner, then four KPI tiles (two by two on a phone, four across from
`lg`), then two zones. The side zone (Up next, Week Ahead) comes first in the DOM so a phone reads
today's work before the money; from `xl` it takes the right third and the main zone (Revenue, then
a two-up grid of everything else) the left two. Zones are stacks, so hiding a widget in Customize
never leaves a hole, and an odd last widget in the grid spans its row. Up next is a day sheet:
today first, an hour column in DM Mono, and each row marked by its kind (job orange, booking teal,
event indigo).

**List pages** (customers, invoices, quotes, bookings, assets, catalog, checklists, agreements)
share one structure: page header (Headline title, Pencil subtitle, action on the right) → a row
of stats cards that double as filters → one bordered card whose single header row puts filter
tabs on the left and search plus controls on the right → the table → pagination below the card.

**Detail pages** use three panels on Work Order Paper: a 320px left panel, flexible tabs in the
middle, and a 288px right sidebar from `xl` up, each a bordered card. Below `xl` the sidebar is
never hidden: it runs as a full-width card under the tabs (its sections side by side at `lg`),
and on phones every panel stacks in reading order. The same record can open as a 520px side
sheet, a dialog, or a full page, depending on the user's preference; below `md` the side sheet is
full width and loses its resize handle.

**Tables on phones.** Secondary columns hide below `md` (the least important below `lg` or `xl`)
on both the header and the cell, and what a phone still needs folds under the first cell as a
`md:hidden` sub-line. The selection checkbox, the identifier, status, the money figure and the row
menu always stay. Line-item tables keep every column and scroll sideways inside their card.

**Settings** use a two-thirds form column and a one-third side column at `lg`, under a settings
sub-nav.

**Landing page.** A 72rem container with 20 / 24 / 32px gutters, a 12-column grid at `lg`, and
generous vertical rhythm (96–128px above the hero). The ruling repeats every 48px.

**Rhythm.** A 4px base. 16px gaps between cards, 24px padding inside them (16px on phones), 12px
between a toolbar's controls. Breakpoints follow Tailwind (640 / 768 / 1024 / 1280 / 1536px), and
classes are written phone-first: the base class is the phone, `sm:` and up add to it.

**The Phone Is a Peer Rule.** The work happens on job sites, on a phone. Every screen has to work at
375px with no horizontal page scroll. On phones, touch targets are at least 40px and step back to
their dense desktop size from `sm`. Anything shown on hover (a hover card, a tooltip) has to be
reachable another way too, through a label, a link or a screen-reader table.

**The One Row Rule.** A list's filter tabs, search and extra controls share one header row:
tabs on the left, everything else pushed right. Never two stacked toolbars. The row is one
component, `ListToolbar` (`components/reusable/list-toolbar.tsx`), and below `sm` it is the one
place the row may stack: the tabs scroll sideways on their own line, then search at full width,
then the buttons. It is still one toolbar, laid out for a narrow screen, not a second one.

## Elevation & Depth

Depth is tonal first. Four surfaces rise from Work Order Paper to Card White (and from 6% to 13%
lightness in dark mode), and hairline Rule Line borders do most of the separating. Shadows are
quiet, small and neutral at rest. The one coloured shadow is an orange glow that appears only on
something you can pick up.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): cards, stats cards and detail
  panels.
- **Button** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): the
  filled primary button. Outline and secondary buttons use the resting-card shadow.
- **Grab glow** (`box-shadow: 0 6px 24px 0 hsl(var(--brand) / 0.25)`, 0.35 in dark): a job card on
  hover, together with an orange-tinted border.
- **Lifted** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`,
  plus a 2px orange ring at 30%, rotated 2° and scaled 1.03): a job card while it's being dragged.
- **Showcase** (the same extra-large shadow tinted with Carbon Ink at 5%): the landing page's
  day sheet only.

### Named Rules
**The Tonal-First Rule.** Separate things with the surface ladder and a hairline before reaching
for a shadow. A shadow at rest never goes above "resting card".

**The Grab Glow Rule.** The orange glow means "you can pick this up". It belongs on draggable or
grabbable objects (job cards), never on static cards for decoration.

## Shapes

Gentle corners and hairline edges. The base radius is 8px (`--radius`), with buttons and inputs at
6px, small inner elements at 4px, kanban job cards at 12px, and the navbar's control cluster at 12px.
Everything else that is round is fully round: badges, status pills, filter tabs, avatars, the
current-hour dot and scrollbar thumbs. Borders are always 1px in Rule Line (Field Line for inputs).
Scrollbars are themed rather than hidden: a thin transparent track with a floating pill thumb.

**The Pill Means State Rule.** Full-round shapes carry state, filters, counts and people. Containers
and actions are gently cornered rectangles. A pill-shaped container or a square status tag breaks
the reading.

## Components

Sturdy and plain, like good work gear: solid fills, clear outlines, nothing ornamental. Orange marks
the one thing to do next.

### Buttons
- **Shape:** gently rounded (6px), 36px tall (32px small, 40px large, 48px on the landing hero).
- **Primary:** Safety Orange fill with a Carbon Ink label at 500 weight and the button shadow.
  Hover drops to 90% opacity. Focus shows the ring in Orange Deep (`--ring`).
- **Outline:** 1px Field Line border on Work Order Paper. Hover switches to Orange Wash with Orange
  Deep text.
- **Secondary / Ghost / Link:** Second Sheet fill; transparent with an Orange Wash hover for icon and
  row actions; or orange text with an underline on hover.
- **Destructive:** Stop Red fill, for deletes and other irreversible actions, which go through the
  shared confirmation dialogs.

### Chips: badges and status pills
- **Style:** full-round, 12px text at 600 weight (500 for status pills), 2px × 10px padding.
  The brand badge is Orange Deep on Safety Orange Tint. Outline badges use a Rule Line border.
- **Status and priority:** colour-mapped pills, each with an explicit dark-mode pair. Priority
  runs standard (blue) → urgent (amber) → emergency (red, with a slow 2s pulse ring). Pipeline
  stages pick from eight presets (blue, brand, green, red, purple, amber, gray, teal), each defining
  dot, background, text, border and ring.

### Cards / Containers
- **Corner Style:** 8px (12px for job cards).
- **Background:** Card White, on Work Order Paper or Second Sheet.
- **Shadow Strategy:** the resting card shadow (see Elevation & Depth).
- **Border:** 1px Rule Line, always.
- **Internal Padding:** 24px for content cards, 12px × 16px for stats cards, 14px for job cards, and
  16px × 12px for a list card's header row.

### Inputs / Fields
- **Style:** 40px tall, 1px Field Line border, Work Order Paper fill, 6px corners, 14px DM Sans
  text (16px below `md`, set once in `globals.css`, because iOS Safari zooms the page on focus
  under 16px), Pencil placeholder.
- **Focus:** a 2px Safety Orange ring offset 2px from the field.
- **Disabled:** 50% opacity, not-allowed cursor. Forms lay out as one column, two from `sm` up.

### Navigation
- **Sidebar items:** 40px tall, 6px corners, 14px DM Sans at 500, 20px Tabler icon. Idle items are
  Pencil, turning Orange Deep over a faint tint on hover. The active item is Orange Deep on Safety
  Orange Tint, icon included.
- **Navbar:** 56px, the page name in Title, actions in a Second Sheet cluster with 12px corners, and
  the orange hairline across the top.
- **Icons:** Tabler throughout the app (lucide only inside shadcn primitives). 14px inline, 16px in
  buttons, 20px in navigation and section headers, 32px in empty states.

### Filter Tabs
A full-round Second Sheet track with 4px padding. The selected option sits on a Safety Orange pill
that slides between options over 300ms, with a Carbon Ink label. Options are 12px DM Sans at 500.

### Stats Cards
Compact cards (12px × 16px padding) with a 36px round icon disc, the count in Space Grotesk bold
and a Pencil label. When used as filters, hovering tints the border orange at 40%, and the active
card gets a Safety Orange border plus a soft 20% orange ring.

### Job Card (signature)
The kanban card: Card White, 12px corners, 14px padding, a Rule Line border at 60%, and the resting
shadow. Priority and stage pills sit at the top in 10px uppercase. Then the title (14px DM Sans 500,
two lines max), the customer and schedule in Pencil, a 24px round assignee initial on Safety Orange
Tint, and a footer separated by a half-opacity hairline. On hover it takes the grab glow and an
orange-tinted border. While dragged it lifts, tilts 2° and gains an orange ring. Cards enter in a
300ms staggered rise.

### Day Sheet (landing signature)
The landing hero: a time-ruled card showing one working day. A mono date field, an hour column in
tabular DM Mono, jobs placed at their real start time and duration, and a Safety Orange dot and rule
on the current hour. The same object at every width, never a screenshot in a device frame. It is
titled "Example schedule", because the jobs are sample data. The current-hour rule is the landing
page's one authored motion: after mount, the dot lands and the line draws across the day once, and
under reduced motion it is simply there. The hero around it is never wrapped in a scroll reveal, so it
paints with the HTML.

### Skeletons
Every loading state is a skeleton shaped like the content it replaces, and every dashboard route has
a matching `loading.tsx`. No spinners.

## Do's and Don'ts

### Do:
- **Do** take every colour from the tokens (`bg-card`, `text-ink`, `border-border`, `bg-brand`) so
  both themes stay correct. Status colours always get an explicit `dark:` pair.
- **Do** keep Safety Orange to action, location and now (The One Mark Rule).
- **Do** set times, money and counts in DM Mono with tabular figures (The Figures Rule).
- **Do** keep the surface ladder rising in both themes when touching any neutral (The Rising Sheet
  Rule).
- **Do** use the Night Shift slab for customer-facing portals and the auth shell, and keep printed
  quotes ink-on-white with no dark band and no buttons.
- **Do** use skeletons shaped like the content for every loading state.
- **Do** use the motion vocabulary's curve and durations, and attach new arrivals to a shell or a
  shared primitive rather than to one page.
- **Do** give every animation a `prefers-reduced-motion` override, and stop motion while the user
  drags or pans.
- **Do** write orange text and meaningful orange icons with `text-brand-ink`, put Carbon Ink labels
  on orange fills, and keep bright `text-brand` for decorative glyphs beside a heading, the logo
  and the Night Shift slab (The Fill, Not the Text Rule).

### Don't:
- **Don't** use "AI startup" gloss: no purple-on-white gradients, aurora or nebula backdrops, or glow
  as decoration.
- **Don't** put the product in a laptop or phone frame. Show the real object, like the day sheet.
- **Don't** use spinners (`animate-spin`, `Loader2`) for loading, or for "working". A busy
  control changes its label and disables itself, and a wait on a person shows an hourglass. The
  last six spinners were removed on 2026-10-16.
- **Don't** loop anything that isn't a signal. A hint nudges twice and rests, and an attention
  cue pulses three times and rests.
- **Don't** use cool blue-slate neutrals or raw `gray-*` classes, and never Inter, Roboto, Arial or
  system defaults.
- **Don't** add a second accent colour. Teal, indigo and the chart hues are data identity, not UI
  chrome.
- **Don't** put the orange grab glow on anything that can't be picked up.
- **Don't** stack two toolbars on a list page (The One Row Rule).
- **Don't** put white text on Safety Orange, or use `text-brand` for anything that has to be read
  (LAND-03, LAND-06).
