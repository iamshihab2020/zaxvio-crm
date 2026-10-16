# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** owner-operators and 1–3 person teams in field service who do the work themselves and
run the business around it. They book jobs, show up, do the work, quote, invoice and chase payment,
usually with no office staff. Today they do this with a personal phone, handwritten or
spreadsheet invoices, and customer history kept in notebooks or memory. They will not sit through
an onboarding call or training.

**Beachhead:** HVAC is the first market and the source of trade-specific depth (equipment records,
refrigerant logs, service agreements). The product and its language stay trade-neutral: plumbing,
electrical, cleaning, landscaping and any other service trade must be able to use every feature
without reading HVAC terms.

**Secondary audiences, confirmed by the product's own surfaces:**
- **Team members** (`member` role) such as a helper or an office manager, invited into the
  owner's workspace. Roles are owner / admin / member.
- **The contractor's customers.** They never log in, but they see the public booking portal
  (`/book/[slug]`, also embeddable on the contractor's own website via `widget.js` or an iframe),
  the online quote page (`/quote/[token]`), the unsubscribe page, and every email and PDF the
  contractor sends. These surfaces carry the contractor's business, not Zaxvio's.
- **Platform staff** (super admins) use a separate `/superadmin` area for tenant support,
  impersonation and platform analytics.

## Product Purpose

Zaxvio CRM replaces the phone-and-paper workflow of a small service business with one web app:
a booking comes in, it becomes a job, the job gets quoted, done and invoiced, and payment is
recorded, with the customer's full history kept in one place.

Success means a contractor can run a whole working day from it and knows whether they're making
money on the work. The Phase 1 goal was 3–5 beta customers actively using it.

## Positioning

The four edges the owner claims, all four confirmed:

1. **One flat price per business, not per user.** $49 a month covers the whole business. Bringing on
   a helper or an office manager costs nothing extra.
2. **Booking to paid in one place.** A customer self-booking portal the contractor can embed on
   their own site, a job board, quotes customers accept online, invoices and customer history all
   share the same records, so nothing gets retyped between tools.
3. **Automations built on the CRM's own records.** A built-in automation builder triggered by real
   events (a quote sent, a job completed, an invoice overdue, a booking coming up). It chases quotes,
   reminds customers before appointments and stops when the invoice is paid. It respects email
   consent and the business's working hours.
4. **Numbers that admit their gaps.** Job costing and margins show when a figure is incomplete
   instead of reading a missing cost as profit. Hours come from timers and logged entries, not a
   number typed in after the fact.

## Operating Context

- **Where the work happens:** on job sites and between them, on a phone, with the office work
  (quoting, invoicing, reports, settings) done on a laptop or desktop.
- **The core loop:** booking → customer → job (on a Kanban board with custom stages per pipeline,
  or a calendar) → checklist and time on site → quote and/or invoice (PDF and email) → payment
  recorded → review request.
- **Customer touchpoints:** the booking link or embedded widget, quote acceptance links, and
  transactional and automated emails (React Email templates). All of them are sent in the
  contractor's name.
- **Account lifecycle:** sign up with email and password (no card), a 14-day free trial
  (`trialEndsAt` set at org creation), then $49/month.

## Capabilities and Constraints

**Built:** customers with tags, notes and activity timelines; jobs on a Kanban board with custom
pipelines and stages, plus calendar and drag-to-reschedule; job checklists, photos and file
attachments; job time tracking with a running timer; job costing and profitability; service
catalog and price book; quotes with PDF and online accept/decline; invoices with PDF and manually
recorded payments; the public booking portal with availability, capacity and an embeddable widget;
assets and equipment with service agreements; email conversations with customers; in-app and email
notifications; dashboard and reports; team invitations and roles; the automation builder with
templates and run history; an AI help chatbot (Groq); and the super admin panel.

**Not built. Never claim these** (the landing audit LAND-02 found them advertised):
- online payments or pay-from-email links (payments are recorded by hand);
- importing customers from a spreadsheet;
- account or data export (the only CSV is the `/reports` export);
- recurring bookings;
- billing, paying, or "cancel with one click" (Lemon Squeezy is deferred and nobody can pay yet);
- an affiliate program (deferred until Lemon Squeezy exists);
- SMS (shown as "Coming Soon" in conversations).

**Pending infrastructure that limits what works live:** no verified sender domain in Resend, so
customer emails are not delivered yet. File storage (Cloudflare R2) is not provisioned yet.

**Terminology in the product:** Jobs, Customers, Quotes, Invoices, Bookings, Schedule, Assets
(equipment), Service Agreements, Catalog, Checklists, Conversations, Automations, Pipelines and
Stages, Reports.

**Constraint:** every feature and every piece of copy must work for any service trade. The in-app
help knowledge base (`apps/web/src/lib/chatbot/knowledge-base.ts`) must change with features, in
industry-agnostic language.

## Brand Commitments

- **Name:** Zaxvio (product: Zaxvio CRM). The logo lives in `apps/web/src/components/logo.tsx`.
- **Voice in the shipped copy:** plain, short, contractor-direct. It names the job in the user's own
  terms ("Book a job, finish it, get paid.", "If you can use a phone, you can use Zaxvio.") with no
  jargon, no hype and no claims the product can't back up.

## Evidence on Hand

**None.** There are no customers, no testimonials, no reviews or ratings, no case studies, no usage
or outcome metrics, and no real job-site photography. The only tenant is the owner's own.
Future work must not invent any of these. The landing page's testimonials (`testimonials-section.tsx`)
are fabricated and flagged P0 in the landing audit (LAND-01), and an invented 4.9★ rating and
revenue chart were removed earlier for the same reason.

**What is real and usable:**
- the product itself and screenshots of it;
- the demo dataset from `pnpm seed:demo`, which is fictional and must be labelled as demo data
  wherever it's shown;
- the logo;
- the stated price ($49 per business per month) and the 14-day, no-card trial.

**Open:** there are no Privacy Policy or Terms pages yet (LAND-05), although signup collects
personal data.

## Product Principles

1. **Claim only what is built.** No invented proof, people, ratings or features. If the product
   doesn't do it today, the page doesn't say it does.
2. **Unknown is not zero.** A missing cost, an unsent email or an unrun automation is shown as
   missing, never as a clean number or a success.
3. **One place from booking to paid.** A step that forces the user into a second tool or makes them
   retype a record is a defect, not a missing feature.
4. **Trade-neutral by default, HVAC-deep where it earns it.** Trade-specific depth is added without
   making any other trade feel like a guest.
5. **Priced for the business, not the headcount.** Adding a teammate should never cost more or need
   setup that a solo owner doesn't.

## Accessibility & Inclusion

The repo's audits use WCAG 2.x AA as the working bar (contrast, keyboard reach, screen-reader
tables for charts, reduced motion). No standard has been formally adopted beyond that. The phone-on-site
scene, often in bright light, makes contrast and tap-target size practical requirements, not
polish.
