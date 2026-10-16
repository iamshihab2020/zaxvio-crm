# Landing Page — Technical Design Audit

> Related: [[reports/README|Page Reports]] | [[design]] | [[security-rules]] | [[frontend-nextjs]] | [[codebase-onboarding]] | [[todo]]

**Date:** 2026-10-16 · **Scope:** `/` — `apps/web/src/app/(landing)/page.tsx`, the 16 files in
`apps/web/src/components/landing/`, `lib/landing/faq-data.ts`, the shared primitives it renders
(`ui/tabs`, `animate-ui` tabs/accordion, `theme-toggle`, `logo`) and the tokens in `globals.css`.
**Method:** Impeccable `audit` — code-level and measurable, no fixes made. The Impeccable detector
was run over the landing components and the page (**0 findings**). Contrast ratios were
**computed** from the HSL tokens (WCAG 2.x relative luminance, opacity modifiers composited onto
their real background). Product claims were checked against the API and schema by search.
**Not done:** no browser was opened, so rendered layout at 360/390px, touch scrolling of the two
horizontal strips, measured LCP and visual focus order are **untested** and listed in §6.
**Severity:** Impeccable's scale — P0 fix immediately · P1 major or WCAG AA failure · P2 minor ·
P3 polish. Finding IDs are `LAND-NN`.

---

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2** | Every primary CTA is white on orange at **2.85:1** (light) / **2.68:1** (dark) — fails AA |
| 2 | Performance | **2** | The hero `<h1>` and CTAs are `opacity: 0` until React hydrates, so LCP waits on the JS bundle |
| 3 | Theming | **3** | Full token system, dark mode complete, no hard-coded colours — but the brand pair fails contrast at the token level |
| 4 | Responsive | **3** | Fluid, tap targets 40–52px, overflow traps fixed; narrow-phone rendering unverified |
| 5 | Implementation integrity | **2** | Visual system coherent; **content is not** — invented testimonials and five features the product does not have |
| | **Total** | **12/20** | **Acceptable — significant work needed** |

## Implementation Integrity Verdict

**Split: the visual system passes; the content fails.**

The design is coherent and product-specific. One ruled-sheet motif runs from the hero wash to the
closing slab (`globals.css` `.sheet-wash`, `section.tsx` `SectionHeading`), there is one accent
colour, time is the unit of measure on the page as in the product (`day-sheet.tsx`, the `0:00 /
0:02 / 0:10` rail), and the detector found nothing. Earlier passes already removed a fabricated
4.9★ rating, an invented revenue chart and dead footer links, and left comments explaining why.

The same discipline did not reach the words. The testimonials are invented people at invented
businesses, and the page sells online payments, spreadsheet import, data export, recurring
bookings and one-click cancellation, none of which exists. The FAQ claims are also published as
`FAQPage` structured data (`json-ld.tsx:38-58`), so search engines receive them as answers.

---

## Executive Summary

- **Score: 12/20 (Acceptable).**
- **15 issues:** P0 ×1 · P1 ×4 · P2 ×5 · P3 ×5.
- **Top issues:**
  1. **LAND-01 (P0)** — three named testimonials with no customer behind them.
  2. **LAND-02 (P1)** — five advertised capabilities the codebase does not have.
  3. **LAND-03 (P1)** — the page's one action, "Start free trial", fails AA contrast in both themes.
  4. **LAND-04 (P1)** — the hero is invisible until hydration.
  5. **LAND-05 (P1)** — no privacy policy or terms on a page that collects sign-ups.
- **Next:** fix the content first (LAND-01/02), since no visual work makes untrue copy safe to ship.
  Then the brand token pair (LAND-03/06), then un-gate the hero (LAND-04).

---

## Detailed Findings by Severity

### P0

**[P0] LAND-01 · Fabricated testimonials**
- **Location:** `components/landing/testimonials-section.tsx:24-51`
- **Category:** Implementation integrity
- **Evidence:** three quotes attributed to named people, businesses and cities (*James Whitfield,
  Whitfield Electrical, Dallas*; *Mike Torres*; *Priya Raghunathan, Clearwater Plumbing, Tampa*).
  The database has one tenant (the owner's), and the file's own comment records that the star
  ratings were removed because "we have no review system". The quotes are the same invention with
  names attached.
- **Impact:** this is the most persuasive block on a Persuade-mode page, and it is untrue. It is
  also a legal exposure: the FTC's rule on fake reviews and testimonials (16 CFR Part 465, in
  force since October 2024) prohibits testimonials from people who do not exist or did not have
  the experience, with civil penalties per violation.
- **Recommendation:** remove the section until there are real customers who have agreed to be
  quoted, or replace it with something true, such as an early-access offer or the founder's own
  reason for building it. Do not swap in different invented names.
- **Command:** `/impeccable clarify`

### P1

**[P1] LAND-02 · Features advertised that do not exist**
- **Category:** Implementation integrity

| Claim | Where | What the code has |
|---|---|---|
| "Customers pay from the email" · "Invoicing and online payments" · "Customers can pay online instantly" | `features-section.tsx:166`, `pricing-section.tsx:21`, `faq-data.ts:25` | No payment processor, no payment link. Payments are recorded by hand. |
| "Import customers from a spreadsheet (CSV/Excel). We also offer free migration help" · "Bring your customer list over from a spreadsheet" | `faq-data.ts:45`, `how-it-works-section.tsx:24` | No import path anywhere. The only CSV code is the `/reports` **export**. |
| "Your data: Export any time" · "export your data whenever you want it" · "Your data is always exportable" | `pricing-section.tsx:104`, `final-cta-section.tsx:73`, `faq-data.ts:20` | No account or data export route. |
| "Recurring bookings repeat themselves" · "Recurring booking automation" | `industry-showcase.tsx:71,73` (Cleaning) | No recurring bookings. The only "recurring" in the API is weekly availability hours. |
| "Cancel anytime with one click" · "stays active at $49/month" | `faq-data.ts:20` | No billing exists: Lemon Squeezy is deferred and `settings/billing/` is an empty directory. Nobody can pay or cancel. |

- **Impact:** a trial user goes looking for import on day one, or tells customers to pay online,
  and finds out the page was wrong. Three of these are also in the `FAQPage` JSON-LD.
- **Recommendation:** for each claim, either build it or remove the sentence. Removing is the
  same-day fix. Keep `faq-data.ts` as the single source, since it feeds both the accordion and the
  JSON-LD.
- **Command:** `/impeccable clarify`

**[P1] LAND-03 · Primary CTA text fails WCAG AA in both themes**
- **Location:** every "Start free trial" button — `hero-section.tsx:74-83`, `navbar.tsx:201`,
  `navbar.tsx:255`, `pricing-section.tsx:86`, `final-cta-section.tsx:48`. The cause is the tokens:
  `--primary`/`--brand` `24 95% 53%` with `--primary-foreground: 0 0% 100%` (`globals.css:145-148`),
  and `24 95% 56%` in dark (`globals.css:211-214`).
- **Category:** Accessibility · Theming
- **Measured:** white on brand is **2.85:1** in light and **2.68:1** in dark. The label is 16px
  semibold, which is not "large text" (that needs 18.66px bold or 24px), so the requirement is 4.5:1.
- **Impact:** the one action the page exists to drive is hard to read for low-vision users and in
  sunlight, which is the "phone in the truck" scene this page is written for. Because `--primary`
  is shared, every default `<Button>` in the dashboard fails the same way.
- **WCAG:** 1.4.3 Contrast (Minimum), AA.
- **Recommendation:** fix the token pair rather than each button. Either darken the fill until white
  clears 4.5:1 (roughly `24 90% 40%`), or keep the orange and set `--primary-foreground` to the dark
  ink (`25 20% 12%`), which clears about 7:1. Check `--ring` at the same time (LAND-06).
- **Command:** `/impeccable colorize`

**[P1] LAND-04 · The hero is invisible until hydration**
- **Location:** `hero-section.tsx:50-100` wraps the eyebrow, `<h1>`, lede, CTAs and the day sheet
  in `<Reveal>`. `globals.css:306-309` sets `.js .reveal { opacity: 0 }`, and `html.js` is added
  by an inline script before first paint (`app/layout.tsx:71`).
- **Category:** Performance
- **Impact:** the server-rendered headline arrives in the HTML but is painted at opacity 0. It
  becomes visible only after the client bundle downloads, React hydrates, `Reveal`'s effect runs,
  and its `IntersectionObserver` fires, followed by a 0.55s transition with delays up to 200ms
  (`reveal.tsx:43-57`). Chrome does not count an `opacity: 0` element as an LCP candidate, so LCP
  is tied to hydration. On the mid-range phones this audience uses, that is the difference between
  a fast page and a slow one. The fail-open design protects a reader with no JS but not one with
  slow JS.
- **Recommendation:** render the above-the-fold hero without `Reveal`. Either animate it with a
  CSS-only entrance that starts at first paint (a keyframe on load, not gated on JS), or don't
  animate it. Keep `Reveal` for everything below the fold.
- **Command:** `/impeccable optimize`

**[P1] LAND-05 · No privacy policy or terms**
- **Location:** `footer.tsx:5-14`. The comment records that Privacy and Terms were removed because
  they pointed at `#`. That was right, but the pages behind them were never written.
- **Category:** Implementation integrity
- **Impact:** the page sends visitors to `/signup`, which collects names and emails. California's
  CalOPPA requires a conspicuously linked privacy policy for that. The tenant data in the product
  is also customer PII, and the page claims "we never share your customer data" (`faq-data.ts:30`)
  with no policy behind it.
- **Recommendation:** publish `/privacy` and `/terms`, then link them from the footer and from the
  signup form.
- **Command:** `/impeccable harden`

### P2

**[P2] LAND-06 · Orange text and the focus ring fall below contrast minimums in light mode**
- **Location:**
  - the hero eyebrow, 11px (`hero-section.tsx:51`);
  - the step timestamps, 14px (`how-it-works-section.tsx:63`);
  - the active nav link (`navbar.tsx:170`);
  - the `$49` total cell, 13px (`pricing-section.tsx:172`);
  - avatar initials (`testimonials-section.tsx:67`);
  - `--ring` (`globals.css:139`), which is the brand orange.
- **Category:** Accessibility
- **Measured:** brand on `--surface` **2.73:1**, on `--card` **2.85:1**. Dark mode passes at 6–7:1.
- **WCAG:** 1.4.3 for the text (needs 4.5:1). 1.4.11 Non-text Contrast for the focus ring (needs
  3:1 against the adjacent colour), which is 2.73:1 here.
- **Recommendation:** add a text-safe brand token for light mode (around `24 90% 36%`, ≥4.5:1 on
  `--surface`) and use it wherever brand is a text colour. Keep the bright orange for fills and
  large display. Give `--ring` the same darker value.
- **Command:** `/impeccable colorize`

**[P2] LAND-07 · Motion that ignores `prefers-reduced-motion`**
- **Location:**
  - `animate-ui/primitives/radix/tabs.tsx:56` (spring underline) and `:105-112` (each panel
    cross-fades through `blur(4px)` for 0.5s, plus an animated auto-height);
  - `animate-ui/primitives/radix/accordion.tsx:96-139` (animated height, opacity and Y);
  - `animate-ui/primitives/effects/theme-toggler.tsx:102-120` (a 700ms full-viewport clip-path
    wipe on every theme change);
  - `navbar.tsx:109,127`: `scrollIntoView({ behavior: "smooth" })`. JS smooth scrolling ignores
    the `scroll-behavior: auto` override in `globals.css:324-327`.
- **Category:** Accessibility
- **Impact:** `Reveal` is handled correctly (`globals.css:324-336`), but nothing else on the page
  is. The theme wipe is the largest motion on the page and runs on demand. No `MotionConfig
  reducedMotion="user"` exists anywhere in `apps/web`.
- **WCAG:** 2.3.3 Animation from Interactions (AAA); the expectation behind 2.2.2.
- **Recommendation:** wrap the app in `MotionConfig reducedMotion="user"`. Skip the view transition
  when reduced motion is set. Pass `behavior: "auto"` when
  `matchMedia("(prefers-reduced-motion: reduce)")` matches.
- **Command:** `/impeccable animate`

**[P2] LAND-08 · No skip link**
- **Location:** `page.tsx:39` gives `<main id="main">`, but nothing links to it.
- **Category:** Accessibility
- **Impact:** a keyboard user tabs through the logo, five nav links, the theme toggle, Log in and
  Start free trial (9 stops) before reaching content, on every visit. Landmarks technically satisfy
  2.4.1, but a skip link is the expected affordance on a page with a fixed header.
- **Recommendation:** add a visually hidden "Skip to content" link as the first focusable element,
  shown on focus.
- **Command:** `/impeccable harden`

**[P2] LAND-09 · The motion runtime ships anyway**
- **Location:** `reveal.tsx:17-24` says `Reveal` replaced framer-motion so "a marketing page [no
  longer] shipped a full animation runtime". But `industry-showcase.tsx` (Tabs) and
  `faq-section.tsx` (Accordion) import `animate-ui` components built on `motion/react`, so the
  runtime is still in the landing bundle. It is used for a 2px underline, a blur cross-fade and an
  accordion height.
- **Category:** Performance
- **Recommendation:** use plain shadcn Radix Tabs and Accordion on the landing page, with CSS
  `data-[state]` transitions. The underline can be a CSS transform. Or load the two sections with
  `next/dynamic` so the runtime stays off the critical path.
- **Command:** `/impeccable optimize`

**[P2] LAND-10 · Promises with nothing behind them**
- **Location:**
  - "Support from a person" (`pricing-section.tsx:30`) and "Every plan includes support from a
    person" (`faq-section.tsx:18`). There is no contact link, email or form anywhere on the page.
  - "Everyone sees the same schedule and job statuses in real time" (`faq-data.ts:35`). The SSE bus
    carries notifications, conversations, quotes and impersonation, not jobs.
  - "Drag a card to move it; the customer gets told automatically" (`features-section.tsx:151`).
    Only completion sends an email (E-05), and no email has ever been delivered because there is no
    verified Resend domain.
- **Category:** Implementation integrity
- **Recommendation:** add a real contact route if support is offered, and narrow the other two
  sentences to what happens: the customer is emailed when the job is completed, and the board
  updates when you refresh it.
- **Command:** `/impeccable clarify`

### P3

- **LAND-11 · A blur filter on a 68rem layer.** `hero-section.tsx:39` puts `blur-3xl` on a
  1088×576px element whose radial gradient already fades to transparent. The filter adds GPU raster
  cost and nothing visible, and the fixed navbar's `backdrop-blur-md` recomposites over it on every
  scroll frame. Remove the `blur-3xl`. → `/impeccable optimize`
- **LAND-12 · The blog preview is a second copy of the posts.** `blog-preview-section.tsx:9-37`
  re-declares the titles, excerpts and dates that `lib/blog/posts.ts` already holds, and they have
  already drifted: "5 ways to streamline…" here, "5 Ways to Streamline…" there. Derive the preview
  from `BLOG_POSTS`. → `/impeccable polish`
- **LAND-13 · Three answers to "which trades".** The trust bar's sixth item is "Handyman"
  (`trust-bar.tsx:18`). The industry tabs say "Any trade" (`industry-showcase.tsx:95`). The footer
  lists five trades (`footer.tsx:86`). The trust bar's docblock also says "the count now lives in
  the hero", and the hero has no count (`trust-bar.tsx:27-29`). → `/impeccable clarify`
- **LAND-14 · The pricing ledger is a table with no headers.** `pricing-section.tsx:146-177` has a
  caption and no `<TableHeader>` or row headers, so a screen reader announces bare cells. Mark the
  first column as `<th scope="row">`. Separately, "$150 per month, typical" is an unsourced figure
  in the page's most persuasive table. → `/impeccable harden`
- **LAND-15 · Small text on the dark foot and in the illustrations.** The copyright line is
  `midnight-foreground/40` at 11px, **3.5:1** (`footer.tsx:82-86`). The day-sheet hour labels are
  `muted-foreground/70` at **2.88:1** (`day-sheet.tsx:142`), and the kanban counts are **2.41:1**.
  The kanban is `aria-hidden` and the day sheet has an sr-only caption, so this is legibility, not
  a blocker. The copyright line is real text and should reach 4.5:1. → `/impeccable polish`

---

## Patterns & Systemic Issues

- **The honesty pass stopped at the numbers.** Earlier passes removed every invented figure on the
  page: the 4.9★ rating, "500+ businesses", the `$2,480` badge, the "+18%" chart. They left the
  invented people and the invented features. The rule the comments already follow ("a figure we
  cannot support") needs to cover sentences too. Five of the 15 findings are about what the page
  says rather than how it looks (LAND-01, 02, 05, 10, 13), and they include the P0 and two of the
  four P1s.
- **One brand token is doing three jobs.** `--brand`/`--primary` is a fill, a text colour and the
  focus ring. It can only be good at the first. LAND-03 and LAND-06 are the same defect, and the
  fix is a second token rather than per-component overrides.
- **Reduced motion was solved for the component that was written in-house and nowhere else.**
  Every `animate-ui` import arrived with its own motion, and none of them consults the user's
  preference.

## Positive Findings

- **Fails open.** The reveal hidden state is CSS scoped to `html.js`, so a reader with no JS gets the
  whole page (`reveal.tsx`, `globals.css:297-336`). Reduced motion is handled properly for it.
- **Observers, not listeners.** Both the scrolled state and the section highlight use
  `IntersectionObserver` (`navbar.tsx:61-100`), and the highlight tracks the visible set rather
  than the last change, which is a subtle bug the code already avoided.
- **The mobile menu is a real dialog.** A Radix `Sheet` provides the focus trap, Escape handling and
  scroll lock, with 44–52px targets. The `html:has(body[data-scroll-locked])` fix landed globally
  for every dialog in the app.
- **No horizontal overflow traps.** The industry strip moved out of a grid item, and both strips
  use `min-w-0` with a `-mx-5 px-5` bleed (`industry-showcase.tsx:130`, `trust-bar.tsx:49`).
- **Tokens all the way down.** No hard-coded colour on the page. Both themes have complete token
  sets, and the dark mode elevation ramp (surface < alt < card) is correct.
- **Tabular numerals** on every time, count and price (`.tnum`).
- **Derived, not typed.** The day sheet's job count comes from its rows (`day-sheet.tsx:118`), and
  its "now" marker is client-only to avoid a hydration mismatch.
- **Semantics:** one `<h1>`, labelled sections, `figure`/`blockquote`/`figcaption` used correctly,
  a stretched-link card pattern that announces only the title, and `aria-hidden` on every diagram.
- **Detector clean:** 0 findings on the landing components.

## Recommended Actions

1. **[P0] `/impeccable clarify`** — remove or replace the testimonials (LAND-01), then cut or narrow
   every unbacked claim in LAND-02, LAND-10 and LAND-13. `faq-data.ts` first, since it also feeds
   the JSON-LD. This changes factual copy, so the replacements are the owner's call.
2. **[P1] `/impeccable colorize`** — split the brand token: one for fills, one text-safe, and a
   darker ring (LAND-03, LAND-06).
3. **[P1] `/impeccable optimize`** — take the hero out of `Reveal` (LAND-04), get the motion
   runtime off the landing bundle (LAND-09), drop the hero `blur-3xl` (LAND-11).
4. **[P1] `/impeccable harden`** — privacy and terms pages linked from the footer and signup
   (LAND-05), a skip link (LAND-08), row headers on the ledger (LAND-14).
5. **[P2] `/impeccable animate`** — reduced-motion alternatives for the tabs, accordion, theme wipe
   and anchor scrolling (LAND-07).
6. **`/impeccable polish`** — the derived blog preview, footer contrast, and a final pass (LAND-12,
   LAND-15).

## 7. Resolution (2026-10-16)

All six recommended commands were run in order: clarify, colorize, optimize, harden, animate,
polish. Four decisions were the owner's and were asked first:
- remove the testimonials rather than replace them;
- dark labels on the unchanged orange rather than a darker orange;
- no public support email yet, so the support promise goes;
- draft the legal pages from the code.

`PRODUCT.md`, written by `/impeccable init` during the run, was the source of truth for every
copy change. Its "Not built" list is the list LAND-02 removed.

| ID | Status | What changed |
|---|---|---|
| LAND-01 | **FIXED** | `testimonials-section.tsx` deleted, not emptied, so it can't be refilled with new invented names. FAQ and Blog swapped surfaces to keep the base/alt alternation. |
| LAND-02 | **FIXED** | Payments, spreadsheet import, data export, recurring bookings and one-click cancel removed from features, pricing, how-it-works, industries, the closing band and `faq-data.ts`, which also feeds the JSON-LD. Replacements describe what the product does: emailed PDF invoices, recorded part payments, booking-page customers added automatically, service agreements. `faq-data.ts` now carries a header pointing at PRODUCT.md. |
| LAND-03 | **FIXED** | `--primary-foreground`/`--brand-foreground` are the ink in both themes: 5.8:1 light, 6.2:1 dark. The 6 hard-coded `bg-brand text-white` sites (booking portal ×5, dashboard avatar) now use the token. 0 left in `apps/web`. |
| LAND-04 | **FIXED** | The hero is no longer wrapped in `<Reveal>`, so the headline paints with the HTML. The component's docblock says not to re-wrap it. |
| LAND-05 | **FIXED (draft)** | `/privacy` and `/terms` in a new `(legal)` group, drafted from the code. `lib/legal.ts` holds the processor list, the date, and `LEGAL_CONTACT_EMAIL` (null; the pages say so honestly). They are in `publicPaths` and the sitemap, linked from the footer, and linked beside the signup button. **Needs legal review, a contact address and a governing-law clause before launch.** |
| LAND-06 | **FIXED** | New `--brand-ink`, set in light mode to DESIGN.md's Orange Deep (24 90% 30%, 6.5–7.2:1 on every light surface) so the theme has one readable orange; in dark mode it is the brand itself. used for orange text, the `brand` Badge variant, the signup "Sign in" link, and `--ring` (6.9:1). |
| LAND-07 | **FIXED** | `MotionProvider` (`MotionConfig reducedMotion="user"`) at the root covers every `motion/react` animation. The theme wipe and the navbar's `scrollIntoView` read the preference themselves. |
| LAND-08 | **FIXED** | `SkipLink` on the landing, blog and legal pages; the blog `<main>` gained `id="main"`. |
| LAND-09 | **OPEN, re-scoped** | The fix this report proposed would not have worked. `motion/react` is also imported by `ui/sheet.tsx` (the navbar's mobile menu) and `ui/accordion.tsx`, so swapping the landing tabs and accordion alone keeps the runtime on the page. Getting it off needs all three replaced or the Sheet lazy-loaded, and without a build the saving can't be measured, so it was not done blind. `MotionProvider` also now imports `MotionConfig` at the root. |
| LAND-10 | **FIXED** | The "support from a person" promise removed from pricing and the FAQ lede. "Real time" became "the same schedule and job board". The drag claim now says the customer is emailed when the job is complete. |
| LAND-11 | **FIXED** | `blur-3xl` removed from the hero wash. |
| LAND-12 | **FIXED** | The blog preview reads the three newest posts from `BLOG_POSTS`. It had drifted: casing, excerpts, and "6 min" against "5 min read". |
| LAND-13 | **FIXED** | "Any trade" in the trust bar, matching the tabs. The footer names five trades plus "any other service trade". The stale trust-bar comment was corrected. |
| LAND-14 | **FIXED** | Ledger rows headed by `<th scope="row">`. Both cost figures are now labelled "estimated". |
| LAND-15 | **FIXED** | Copyright and tagline raised from `/40` to `/60` (6.3:1), and the closing-band footnote from `/50` to `/60`. Day-sheet hour labels raised from `/70` to full muted. |

**Found while fixing:**
- **The navbar's section links were dead off the landing page.** `handleAnchorClick` called
  `preventDefault()` and scrolled to `#features` and the rest, which exist only on `/`. On
  `/blog`, and on the new legal pages, every one of them did nothing. They now route to
  `/#section`.
- **The closing band promised an open-ended trial** ("Keep the free trial running until you
  know it works for you"). The trial is 14 days, and the copy now says two weeks.
- **The Cleaning panel claimed per-property checklists and property profiles**, which the
  product does not model. It now names checklists on jobs and history on the customer.
- **"Today's schedule" over invented jobs** read as a live screenshot. Now "Example schedule",
  per PRODUCT.md's rule that sample data is labelled.

**Polish beyond the findings:**
- The hero eyebrow was removed; the craft floor bans eyebrows.
- `SectionHeading` lost its unused eyebrow `label` option.
- Mono was dropped from two non-data badges.
- Text selection is now brand-tinted.
- One authored motion was added: the day sheet's "now" line draws in after mount, with nothing
  under reduced motion.

**Still not verified by rendering:** everything in §6 stands. Re-run `/impeccable audit` for a
new score. This section records changes, not a re-measurement.

## 6. Untested, and how to close it

| What | Why it matters | How |
|---|---|---|
| Layout at **360px** and 390px | The mobile header row (logo, theme toggle, "Start free trial", menu) is all `whitespace-nowrap` flex items with no shrink. My arithmetic puts it at roughly 400px of content, so the narrowest Android phones may overflow. The 2026-07-31 pass measured 0 overflow at 390px only. | Render at 360/375/390 and check `document.documentElement.scrollWidth` |
| Touch scroll of the trust and industry strips | Both are `overflow-x-auto` strips; layout says fine, the gesture is unexercised | A real device or synthesized touch |
| LCP | LAND-04 is derived from the CSS and the render path, not measured | Speed Insights is installed, so production field data will show it |
| Focus order and visibility | Order reads correctly from the DOM; the ring's visibility depends on LAND-06 | Tab through once in both themes |

---

## 8. Re-audit (2026-10-16, after §7)

Same method as the first pass: code-level, contrast computed from the tokens, no browser. This time
it is measured against `PRODUCT.md` and `DESIGN.md`, which did not exist at the first audit. The
detector ran over the landing components, the page, `(legal)`, the blog layout and the two new
modules.

### Every §7 fix is present

Each was checked by search, not taken from §7:
- **Copy:** 0 false claims left (the 6 search hits are explanatory comments), and the
  testimonials file is gone.
- **Colour:** 0 `bg-brand text-white` anywhere in `apps/web`, and `--brand-ink` is defined in both
  themes.
- **Hero:** no `<Reveal>` and no `blur-3xl` (both hits are comments). The only eyebrow left on the
  landing page is the day sheet's date field, which `DESIGN.md` keeps.
- **Structure:** `SkipLink` plus `main#main` on all three public layouts, `/privacy` and `/terms`
  in `publicPaths`, and `MotionProvider` wired at the root.

### Audit Health Score

| # | Dimension | Before | Now | Key finding now |
|---|---|---|---|---|
| 1 | Accessibility | 2 | **3** | The FAQ accordion's focus ring is 2.37:1. Everything else computed passes AA in both themes |
| 2 | Performance | 2 | **3** | The hero paints with the HTML; the motion runtime is still on the bundle (LAND-09) |
| 3 | Theming | 3 | **4** | Every landing colour is a token; fill, text and ring roles are separate; dark mode has its own pairs |
| 4 | Responsive | 3 | **3** | Unchanged in code; 360px still unrendered |
| 5 | Implementation integrity | 2 | **3** | Content matches PRODUCT.md; two trade bullets still overstate; type sizes are off the documented ramp |
| | **Total** | **12** | **16/20** | **Good: address the weak dimensions** |

**Verdict: pass.** The visual system and the copy now agree with the product. What remains is a
shared-component focus ring, a deferred bundle cut, and two promises that depend on infrastructure
rather than on copy.

**Issues:** 7 in total (P0 0, P1 1, P2 2, P3 4).

### Findings

**[P1] LAND-16 · The FAQ accordion's focus ring is under 3:1**
- **Where:** `animate-ui/components/radix/accordion.tsx:47`, the shared `AccordionTrigger`.
- **Category:** Accessibility. **WCAG:** 1.4.11 Non-text Contrast.
- **Measured:** the trigger's focus state is `focus-visible:ring-ring/50`, a 3px ring at half
  opacity. That is **2.37:1** on `--surface` in light and **2.59:1** in dark. Its
  `focus-visible:border-ring` draws nothing, because the trigger has no border, so the faded ring
  is the only focus cue. Keyboard users tabbing through the nine questions can lose their place.
- **Scope:** the first audit missed it because it measured tokens, not this component's alpha.
  The component is shared, so any dashboard accordion has the same ring.
- **Fix:** a full-strength `ring-2 ring-ring ring-offset-2`, which is 6.9:1, in the component.
- **Command:** `/impeccable harden`.

**[P2] LAND-09 · The motion runtime is still on the landing bundle** (carried, re-scoped in §7)
- **Where:** `motion/react` comes in through `ui/sheet.tsx` (the mobile menu), `ui/tabs.tsx`,
  `ui/accordion.tsx`, and now `MotionProvider` at the root.
- **Category:** Performance.
- **Trade-off:** that last import is the cost of LAND-07. `MotionConfig` is now in the shared root
  bundle for every route, including the auth and booking pages.
- **Fix:** a measured build first. Then lazy-load the Sheet's content, which only matters after a
  tap, and give the landing tabs and accordion CSS transitions.
- **Command:** `/impeccable optimize`.

**[P2] LAND-17 · Promises that need infrastructure which is not live**
- **Category:** Implementation integrity.
- **Email:** the page says invoices "go out by email as a PDF" (`features-section.tsx`,
  `faq-data.ts`), customers "get an email when the job is complete", and lists "Email
  notifications". PRODUCT.md records that no sender domain is verified in Resend, so none of these
  is delivered today.
- **Files:** "Photo documentation per job" and the HVAC and Landscaping photo bullets need
  Cloudflare R2, which is not provisioned.
- **What fixes it:** these features are built, so the copy is right and the deployment isn't. The
  fix is to verify the Resend domain and provision R2 before sending traffic to `/`, not a design
  command. It is listed so it isn't mistaken for done.

**[P3] LAND-18 · The theme toggle has no focus style of its own**
- **Where:** `theme-toggle.tsx`. The button sets hover only, so focus falls back to the browser's
  default outline.
- **Impact:** it is visible, but it is the one control in the navbar that doesn't use `--ring`.
- **Fix:** add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- **Command:** `/impeccable harden`.

**[P3] LAND-19 · Finished jobs on the day sheet fade their small text too far**
- **Where:** `day-sheet.tsx`. Finished jobs set their service line and time at `opacity-70` over
  `bg-muted/60`.
- **Measured:** **2.78:1** at 10–11px in light, 3.79:1 in dark. Booked and on-site jobs measure
  5.8–7.6:1.
- **Why P3:** the sheet is a labelled sample figure with an sr-only caption, so this is legibility
  rather than lost information. Fading by colour alone (`text-muted-foreground`, 4.9:1) still reads
  as finished.
- **Command:** `/impeccable polish`.

**[P3] LAND-20 · Two trade bullets name features the product doesn't model**
- **Where:** "Panel and circuit records" (Electrical) and "Seasonal job planning" (Landscaping) in
  `industry-showcase.tsx:60,87`.
- **What exists:** generic equipment records and ordinary scheduling, with nothing
  circuit-specific and nothing seasonal. PRODUCT.md principle 1 is "claim only what is built".
- **Fix:** narrow them, for example to "Equipment records for every customer" and "Jobs scheduled
  across the season".
- **Command:** `/impeccable clarify`.

**[P3] LAND-21 · Type sizes off the documented ramp (14 detector advisories)**
- **Counts:** 13px ×7, 10px ×3, 2rem ×2, 1.75rem ×1, 2.5rem ×1.
- **Mostly prose drift:** `DESIGN.md`'s prose already permits 2.5rem (the display base) and 10–11px
  data in dense cards, but its frontmatter ramp doesn't list them. 13px (the ledger, trust bar and
  day-sheet names), 2rem (closing band and legal titles) and 1.75rem (section heading base) are in
  neither.
- **Fix:** either fold them onto ramp steps or document them as steps in `DESIGN.md`.
- **Command:** `/impeccable typeset`.

### Recommended actions
1. **[P1] `/impeccable harden`:** full-strength ring on the shared `AccordionTrigger` (LAND-16) and
   the theme toggle (LAND-18).
2. **[P2] `/impeccable optimize`:** LAND-09, with a build measured before and after.
3. **[P3] `/impeccable clarify`:** the two trade bullets (LAND-20).
4. **[P3] `/impeccable typeset`:** reconcile the 13px, 2rem and 1.75rem steps with `DESIGN.md`
   (LAND-21).
5. **`/impeccable polish`:** the day sheet's finished-job text (LAND-19), then a final pass.

Outside Impeccable, before launch: verify the Resend domain and provision R2 (LAND-17), and finish
the legal pages (§7).

§6's untested list still stands: 360/375/390px, touch scrolling of the strips, and a keyboard pass
in both themes.

---

## 9. Second pass (2026-10-16, after §8)

The five §8 recommendations, run in order: harden, optimize, clarify, typeset, polish. A final
detector pass over every changed file returned **0 findings**, advisories included (14 at §8),
and the type-scoped scan also returned 0.

| ID | Status | What changed |
|---|---|---|
| LAND-16 | **FIXED** | The shared `AccordionTrigger` now uses `ring-2 ring-ring ring-offset-2 ring-offset-background`, which is 6.9:1, in place of the 50% ring and a `border-ring` that drew nothing. The landing FAQ is the component's only user; the plain `ui/accordion.tsx` has no importers. |
| LAND-18 | **FIXED** | The theme toggle has its own `focus-visible` ring from `--ring`. |
| LAND-09 | **PARTLY FIXED** | **Found:** the booking portal, quote page, auth pages and unsubscribe page import nothing from `motion/react`, checked against all 11 shared components that use it. So §7's root `MotionProvider` had put motion into those bundles for nothing. **Changed:** the provider now sits in the five route-group layouts that do use motion (`(dashboard)`, `(superadmin)`, `(blog)`, `(legal)` and the `(landing)` page), which takes the library off those customer-facing pages for certain, without needing a build to prove it. **Still open:** getting motion off the landing page itself (Sheet, tabs, accordion) needs a measured build. |
| LAND-20 | **FIXED** | "Panel and circuit records" became "Equipment records for every customer". "Seasonal job planning" became "Drag-and-drop calendar for the season". Landscaping's description and bullets now say "service agreements" and "before-and-after photos", which are the product's terms and features. Electrical's "so nothing ships out of code", which read as a compliance guarantee, now names the real mechanism: a job can't be marked complete without its required checklist. |
| LAND-21 | **FIXED** | **Folded:** 13px went into the system. The ledger is now Body at 14px, as a table cell. Trust-bar chips are 12px/600, the chip spec, with 14px icons. Day-sheet names are 14px at `sm`. Footer legal links are 14px. **Unified:** the closing band and legal page titles now share Section (1.75rem → 2.25rem), since 2rem against 1.75rem was too close to read as a separate role. **Documented in `DESIGN.md`:** `display-phone` (2.5rem), `section` (1.75rem) and `data-dense` (10px), all of which its prose already allowed. |
| LAND-19 | **FIXED** | Secondary job lines use the muted colour instead of `opacity-70`: 4.74–6.43:1 on all three job fills, both themes (was 2.78:1). |
| LAND-17 | **OPEN, by design** | An infrastructure task (the Resend domain and R2). The copy is correct for what is built. |

**Found by the typographic assessment, not the detector:** FAQ answers were 14px across roughly
⅔ of a 72rem container, about 95–100 characters a line on desktop. They are now 16px at a 68ch
cap, and the questions are 16px too, so a question is never smaller than its own answer.

**Correction to §7:** LAND-07's root `MotionProvider` was the wrong place. See LAND-09 above.

**Coordination:** a parallel session (zaxvio-crm-03) is converting the dashboard's remaining
`text-brand` text to `text-brand-ink`, the debt recorded in `DESIGN.md` under "The Fill, Not the
Text Rule". This pass made no other edits in that scope beyond the `(dashboard)` and
`(superadmin)` layout wrappers, and told that session about them.

**Still unrendered:** §6 stands.

---

## 10. Third audit (2026-10-16, after §9)

Same method: code-level, contrast computed from the tokens, no browser. Measured against
`PRODUCT.md` and the current `DESIGN.md`, which now carries a parallel session's sharper
"Fill, Not the Text" rule: bright orange is kept for decorative glyphs beside headings, the
logotype and the Night Shift slab, and nothing else.

### Every §9 fix is present

Each was checked by search:
- the accordion and theme-toggle rings are full strength;
- no 13px or 2rem sizes are left;
- the day sheet's `opacity-70` and the two overstated bullets survive only in explanatory
  comments;
- no `<MotionProvider>` is left in the root layout.

The detector found **0 findings** on the landing, legal and blog-layout files. Its 3 findings in
the shared `globals.css` are older and off this surface: the builder's bounce curve, and `#000`
in the quote print styles.

### Audit Health Score

| # | Dimension | §8 | Now | Key finding now |
|---|---|---|---|---|
| 1 | Accessibility | 3 | **3** | The industry tabs' selected underline is 2.56:1 in light; no P1 remains |
| 2 | Performance | 3 | **3** | Motion is off the booking, quote and auth bundles, but still on the landing page (LAND-09) |
| 3 | Theming | 4 | **4** | Tokens throughout; dark mode composed |
| 4 | Responsive | 3 | **3** | The mobile menu's close button is a 16px target; 360px still unrendered |
| 5 | Implementation integrity | 3 | **3** | The landing page matches PRODUCT.md; LAND-17 is still infrastructure |
| | **Total** | **16** | **16/20** | **Good** |

**Why the total held while six findings closed.** This pass went a layer deeper: a
component-level state indicator, the mobile menu's own controls, and the posts the landing page
links to. What it found is smaller than what closed. §8 had a P1; this pass has none, and every
open item is P2 or P3.

**Verdict: pass.** **Issues:** 6 in total (P0 0, P1 0, P2 4, P3 2).

### Findings

**[P2] LAND-22 · The industry tabs' selected underline is under 3:1 in light** — **FIXED (2026-10-16)** by the parallel session zaxvio-crm-03: `TabsHighlight` is now `bg-brand-ink`, which is 6.47:1 in light and 6.51:1 in dark. Verified in `ui/tabs.tsx:40`.
- **Where:** `ui/tabs.tsx` `TabsList`: `TabsHighlight className="bg-brand"`, a 2px bar.
- **Measured:** **2.56:1** against the Industries section's `--surface-alt`, under the 3:1 that
  WCAG 1.4.11 asks of a state indicator. 6.51:1 in dark.
- **Mitigation:** the selected tab's label also darkens from muted (4.72:1) to ink, so the state
  is not lost, only weakly shown.
- **DESIGN.md:** a selection indicator "carries meaning on its own", which the current rule puts
  on `--brand-ink` (6.47:1 here).
- **Scope:** shared, so the dashboard's tabs have the same bar. `components/ui/` is outside the
  parallel session's scope.
- **Command:** `/impeccable harden`.

**[P2] LAND-23 · The two posts the landing page links to promise online payment**
- **Where:** `lib/blog/posts.ts`, in the first two of the three posts the landing preview shows.
  - "5 Ways to Streamline…" (line 32): "Customers can pay online instantly."
  - "The Complete Guide to Digital Invoicing" (lines 66 and 74): "a link to pay online" and
    "online payment link". It also states unsourced figures ("Many service professionals report
    getting paid the same day", "Most service professionals recover the cost of their software…").
- **Why it counts:** both are framed as general advice, but they describe Zaxvio's workflow ("All
  five of these improvements can be achieved with a single platform", "convert the quote to a job
  with one click"). They are what a reader reaches from `/`.
- **Scope:** the post bodies are not on the landing page, so this does not count toward its
  score. But it is the same claim LAND-02 removed from it, and PRODUCT.md principle 1 applies to
  every surface.
- **Command:** `/impeccable clarify`.

**[P2] LAND-09 · The motion runtime is still on the landing bundle** (carried)
- **Status:** half done in §9; the rest is unchanged.
- **Fix:** lazy-load the Sheet's content and give the landing tabs and accordion CSS transitions,
  measured before and after.
- **Command:** `/impeccable optimize`.

**[P2] LAND-17 · The email and photo promises need the Resend domain and R2** (carried)
- **What fixes it:** an infrastructure task, not copy.

**[P3] LAND-24 · The mobile menu's close button is a 16px target**
- **Where:** `ui/sheet.tsx:112`. `SheetPrimitive.Close` wraps a 16px `IconX` with no padding.
- **WCAG:** it passes 2.5.8 AA only through the spacing exception, since nothing else sits within
  24px.
- **Why it matters:** it is the main dismiss control of a menu used one-handed on a phone.
  Escape and an overlay tap also close it, but the X is the obvious one. The trigger beside it was
  deliberately made 44×44.
- **Fix:** give it `size-11` and centre the icon. Shared, so it applies to every Sheet with
  `showCloseButton`.
- **Command:** `/impeccable harden`.

**[P3] LAND-25 · The check-mark list markers use bright orange**
- **Where:** the `IconCheck` beside each "Included" item (`pricing-section.tsx:146`) and each
  industry bullet (`industry-showcase.tsx:189`), at 2.85:1.
- **The conflict:** `DESIGN.md` keeps bright `text-brand` for decorative glyphs beside headings,
  the logotype and the Night Shift slab only. A list marker is none of those.
- **Fix:** they are `aria-hidden` and the text carries the meaning, so either move them to
  `text-brand-ink` or add "list markers" to the exceptions in `DESIGN.md`. One or the other, so
  the code and the rule agree.
- **Command:** `/impeccable colorize`.

### Recommended actions
1. **[P2] `/impeccable harden`:** `--brand-ink` underline on the shared tabs (LAND-22) and a 44px
   Sheet close (LAND-24).
2. **[P2] `/impeccable clarify`:** remove the online-payment claims and unsourced figures from the
   two linked posts (LAND-23).
3. **[P2] `/impeccable optimize`:** LAND-09, measured.
4. **[P3] `/impeccable colorize`:** reconcile the check markers with `DESIGN.md` (LAND-25).
5. **`/impeccable polish`:** final pass.

Outside Impeccable: LAND-17 (Resend, R2), and the legal review, contact address and governing law
for `/privacy` and `/terms` (§7). §6's render checks still stand.
