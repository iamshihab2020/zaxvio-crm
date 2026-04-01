# Field Service Management SaaS Platform

### Multi-Industry Edition — Zero Budget

Stack · Features · Industry Verticals · Super Admin · Affiliate Program · Real Costs · Profit Projections

| Field | Details |
|-------|---------|
| **Version** | 7.0 — Multi-Industry Platform |
| **Date** | April 2026 |
| **Developer Location** | Bangladesh |
| **Initial Vertical** | HVAC contractors — Texas & Florida (1–3 person teams) |
| **Expansion Verticals** | Plumbing, Electrical, Roofing, Landscaping, Cleaning, Pest Control, General Handyman |
| **Tech Stack** | Next.js 14 · Fastify · Supabase · Better Auth · Drizzle ORM · Mapbox · Lemon Squeezy · Groq AI |
| **Subscription** | $49/month per tenant (via Lemon Squeezy) |
| **Starting Budget** | $0 Required |
| **Build Timeline** | 8 weeks to full-featured platform |

---

# 1. The Multi-Industry Opportunity

## 1.1 Why Go Multi-Industry

Every solo service contractor — whether they fix AC units, unclog drains, or mow lawns — shares the same operational pain:

- **Bookings** managed on a personal phone
- **Invoices** handwritten or texted as photos
- **Customer records** scattered across texts, notebooks, and memory
- **Scheduling** done in their head or on a paper calendar
- **Estimates** given verbally and forgotten

The core platform (job management, invoicing, booking portal, customer database, quoting, checklists, calendar) solves 90% of these problems identically across all service industries. The remaining 10% is industry-specific configuration — not new code.

## 1.2 Total Addressable Market

| Vertical | US Businesses (solo/micro) | Shared Pain Points | Industry-Specific Needs |
|----------|---------------------------|-------------------|------------------------|
| **HVAC** | ~120,000 | Scheduling, invoicing, customer records | Refrigerant tracking (EPA), equipment serial #s, seasonal contracts |
| **Plumbing** | ~130,000 | Scheduling, invoicing, customer records | Permit tracking, backflow certification, camera inspection reports |
| **Electrical** | ~95,000 | Scheduling, invoicing, customer records | Permit tracking, panel schedules, NEC code compliance |
| **Roofing** | ~85,000 | Scheduling, invoicing, customer records | Insurance claim tracking, before/after photos, material calculators |
| **Landscaping** | ~600,000 | Scheduling, invoicing, customer records | Recurring route scheduling, chemical logs, seasonal adjustments |
| **Cleaning** | ~900,000 | Scheduling, invoicing, customer records | Room-by-room checklists, key/access management, recurring schedules |
| **Pest Control** | ~35,000 | Scheduling, invoicing, customer records | Chemical application logs, bait station tracking, treatment schedules |
| **General Handyman** | ~250,000 | Scheduling, invoicing, customer records | Multi-trade jobs, simple permit tracking, photo documentation |
| **Total** | **~2.2 million** | | |

Capturing just 0.01% = 220 customers = **$10,780/month MRR**. The HVAC-only market caps at ~120K businesses. Going multi-industry multiplies the addressable market by 18x.

## 1.3 Platform Strategy

**Phase 1 (Now):** Launch with HVAC. Prove product-market fit. The architecture is already industry-agnostic — service types, pipeline stages, checklists, and catalogs are all configurable per tenant.

**Phase 2 (After PMF):** Add industry-specific onboarding templates (pre-built checklists, catalogs, pipeline stages) and compliance modules. Zero core code changes needed.

**Phase 3 (Scale):** Industry-specific landing pages, vertical-targeted marketing, specialized features (permit tracking, chemical logs, insurance claims).

---

# 2. Industry Vertical Analysis

## 2.1 What Every Industry Shares (Already Built)

These features work identically for HVAC, plumbing, electrical, roofing, landscaping, cleaning, pest control, and handyman:

| Feature | How It Applies Across Industries |
|---------|--------------------------------|
| **Online Booking Portal** | Customer picks a service type, date, and time slot. Works for "AC repair" and "drain cleaning" equally. |
| **Job Management (Kanban + Calendar)** | Visual job tracking. Custom pipeline stages mean each industry defines their own workflow. |
| **Invoicing + PDF** | Professional branded invoices. Line items from service catalog. Tax rates per tenant. |
| **Quote Builder** | Estimates with line items. Convert to job. Works for a $200 plumbing call or a $15,000 roof replacement. |
| **Customer Database** | Name, address, phone, email, notes, tags, equipment records, activity timeline. Universal. |
| **Service Catalog** | Define services and parts with prices. "AC Tune-Up $95" or "Drain Cleaning $150" — same system. |
| **Job Checklists** | Per-service-type checklists. "AC Installation: 12 steps" or "Bathroom Remodel: 8 steps" — same engine. |
| **Service Agreements** | Recurring contracts with frequency (weekly to annual). Works for maintenance contracts and mowing schedules. |
| **Calendar + Scheduling** | Month/week/day views. Drag-to-reschedule. Priority color coding. |
| **Team Management** | Owner/admin/member roles. Invitation flow. Works whether it's 2 HVAC techs or a 3-person cleaning crew. |
| **Notifications** | Real-time in-app + email. New booking, job complete, invoice paid — same events for all industries. |
| **Review Automation** | Google Review request after paid invoice. Reviews matter for every local service business. |
| **AI Help Chatbot** | Answers questions, creates entities. Industry-agnostic by design. |
| **KPI Dashboard** | Jobs today, open invoices, revenue, active customers — universal business health metrics. |

## 2.2 What Each Industry Needs Specifically

### HVAC — Heating, Ventilation & Air Conditioning

**Already Built:**
- Equipment/asset tracking with serial numbers, brand, model, install date
- Refrigerant logging (type, amount added/recovered — EPA compliance)
- Service agreements with seasonal frequency (spring AC tune-up, fall heating check)
- Emergency priority flag (no AC in Texas summer = emergency)

**Phase 2 Opportunities:**
- Load calculation templates
- Permit tracking for installations
- Warranty certificate generation
- EPA Section 608 certification tracking per technician

**Service Types:** AC Repair, AC Installation, Heating Repair, Furnace Installation, Duct Cleaning, Maintenance Tune-Up, Emergency Service, Mini-Split Install, Thermostat Install, Indoor Air Quality

**Checklist Example — AC Tune-Up (12 steps):**
1. Check thermostat operation and calibration
2. Inspect and replace air filter
3. Clean condenser coils
4. Check refrigerant levels and pressures
5. Inspect electrical connections and tighten
6. Lubricate all moving parts
7. Check capacitor and contactor
8. Inspect drain line and clear if needed
9. Measure airflow across evaporator coil
10. Check ductwork for visible leaks
11. Test safety controls
12. Record all readings and recommendations

---

### Plumbing

**What Plumbers Need (Shared features cover 85%):**
- Job management for service calls (leak repair, fixture install, drain cleaning)
- Customer database with property plumbing details (pipe material, water heater age)
- Invoicing with parts + labor line items from catalog
- Emergency service scheduling (burst pipe at 2 AM)

**Industry-Specific (Phase 2):**
- **Permit tracking**: Most jurisdictions require permits for any plumbing work beyond minor repairs. Track permit #, status (applied/approved/inspected/closed), inspection dates.
- **Backflow testing & certification**: Annual requirement for commercial properties. Track test dates, certification expiry, device serial numbers.
- **Camera inspection reports**: Sewer camera inspections generate reports. Store report files + screenshots linked to the job.
- **Water heater tracking**: Brand, model, serial #, install date, warranty expiry — per customer address.

**Service Types:** Drain Cleaning, Leak Repair, Pipe Replacement, Water Heater Install, Water Heater Repair, Fixture Install, Sewer Line Repair, Garbage Disposal, Toilet Repair, Faucet Install, Gas Line, Sump Pump, Water Softener, Backflow Testing, Emergency Plumbing

**Checklist Example — Water Heater Installation (10 steps):**
1. Shut off water and gas/electric supply
2. Drain existing water heater
3. Disconnect and remove old unit
4. Inspect and update supply lines if needed
5. Position new unit and level
6. Connect water supply lines (hot and cold)
7. Connect gas line / electrical (per fuel type)
8. Fill tank and check for leaks at all connections
9. Light pilot / power on and verify operation
10. Set thermostat to 120°F, test hot water at fixture

---

### Electrical

**What Electricians Need (Shared features cover 80%):**
- Job management for service calls and projects
- Quoting for larger jobs (panel upgrades, rewiring)
- Customer database with property electrical details (panel type, voltage)
- Service agreements for generator maintenance

**Industry-Specific (Phase 2):**
- **Permit tracking**: Electrical work almost always requires permits. Track permit applications, inspection scheduling, pass/fail status.
- **Panel schedule documentation**: Record circuit assignments when working on panels.
- **NEC code references**: Quick reference for common code requirements (wire gauge, breaker sizing).
- **License tracking**: Journeyman/master electrician license numbers per technician, expiry dates.
- **Safety compliance checklists**: GFCI testing, arc fault verification, grounding checks.

**Service Types:** Outlet Install/Repair, Panel Upgrade, Circuit Breaker Replacement, Lighting Install, Ceiling Fan Install, Wiring Repair, EV Charger Install, Generator Install, Generator Maintenance, Smoke/CO Detector, Surge Protector, Whole-House Rewiring, Inspection, Emergency Electrical

**Checklist Example — Panel Upgrade (11 steps):**
1. Verify permit is pulled and approved
2. De-energize existing panel at meter
3. Document existing circuit layout
4. Remove old panel and wiring connections
5. Mount new panel and verify level
6. Connect main feed wires
7. Reconnect branch circuits per schedule
8. Install new breakers per load calculation
9. Verify all connections torqued to spec
10. Energize panel and test each circuit
11. Label all breakers, provide panel schedule to homeowner

---

### Roofing

**What Roofers Need (Shared features cover 75%):**
- Quote builder is critical — roofing jobs are always quoted first
- Photo documentation (before/after is essential for insurance)
- Customer database with property roof details (type, age, last service)
- Job management for multi-day projects

**Industry-Specific (Phase 2):**
- **Insurance claim tracking**: Claim #, insurance company, adjuster name/phone, claim status (filed/approved/supplemented/paid). This is a major workflow for storm damage roofers.
- **Supplement tracking**: Insurance supplement requests with amounts and status.
- **Material calculator**: Square footage → bundles of shingles, rolls of underlayment, ridge cap, nails. Quick estimation tool.
- **Before/after photo sets**: Organized photo galleries per job section (front slope, back slope, gutters, flashings). Critical for insurance approval.
- **Warranty certificates**: Generate manufacturer warranty + workmanship warranty PDFs.
- **Weather delay tracking**: Mark jobs as weather-delayed with expected resume date.

**Service Types:** Roof Inspection, Shingle Repair, Full Roof Replacement, Flat Roof Repair, Gutter Install, Gutter Cleaning, Flashing Repair, Skylight Install, Ventilation Install, Emergency Tarp, Storm Damage Assessment, Insurance Claim Roofing

**Checklist Example — Roof Replacement (14 steps):**
1. Verify permit pulled and materials delivered
2. Set up safety equipment (harnesses, toe boards)
3. Protect landscaping and property below
4. Remove existing shingles and underlayment
5. Inspect decking — replace damaged sections
6. Install ice and water shield at eaves and valleys
7. Install synthetic underlayment on remaining area
8. Install drip edge (eaves first, then rakes)
9. Install starter strip shingles
10. Install field shingles per manufacturer spec
11. Install ridge cap and ventilation
12. Flash all penetrations (vents, pipes, chimney)
13. Clean up all debris and nails (magnetic sweep)
14. Final inspection — photograph all completed work

---

### Landscaping & Lawn Care

**What Landscapers Need (Shared features cover 80%):**
- Recurring service agreements are the core business model (weekly/biweekly mowing)
- Calendar view is essential — route planning by day of week
- Customer database with property details (lot size, irrigation type)
- Invoicing (often monthly batch invoicing for recurring clients)

**Industry-Specific (Phase 2):**
- **Route scheduling**: Group customers by geography for efficient daily routes.
- **Chemical/fertilizer application logs**: Product name, amount applied, EPA registration #, weather conditions. Required for pesticide applicator compliance.
- **Seasonal service adjustments**: Automatically adjust service frequency by season (weekly summer → biweekly winter).
- **Irrigation system tracking**: Zone maps, controller model, head types per zone.
- **Property measurements**: Lot square footage, turf area, bed area — for pricing accuracy.
- **Crew assignment**: Which crew/truck handles which route on which day.

**Service Types:** Lawn Mowing, Edging/Trimming, Leaf Removal, Mulching, Hedge Trimming, Tree Trimming, Fertilization, Weed Control, Aeration, Overseeding, Irrigation Repair, Irrigation Install, Landscape Design, Hardscaping, Spring Cleanup, Fall Cleanup, Snow Removal

**Checklist Example — Full Lawn Service (8 steps):**
1. Mow turf areas at correct height for grass type
2. Edge all walkways, driveways, and bed lines
3. Trim around obstacles (trees, fences, AC units)
4. Blow all clippings from hard surfaces
5. Inspect irrigation heads for damage
6. Note any turf disease or pest issues
7. Check flower beds for weeds (pull if under 5 min)
8. Photograph completed property for records

---

### Cleaning Services (Residential & Commercial)

**What Cleaners Need (Shared features cover 85%):**
- Recurring service agreements (weekly, biweekly, monthly)
- Checklists are the core workflow — room-by-room completion
- Calendar for crew scheduling
- Customer database with property access details

**Industry-Specific (Phase 2):**
- **Key/access code management**: Secure storage of customer keys, gate codes, alarm codes. Audit trail of who accessed which property.
- **Room-by-room checklists**: Configurable per property — some customers want oven cleaned weekly, others monthly.
- **Supply tracking**: Track cleaning supply inventory and per-job usage.
- **Quality inspection checklists**: Separate checklist for supervisor spot-checks.
- **Move-in/move-out service templates**: Specialized deep-clean checklists for real estate turnover.
- **Recurring schedule exceptions**: "Skip next Tuesday — client on vacation."

**Service Types:** Standard Cleaning, Deep Cleaning, Move-In/Move-Out, Post-Construction, Office Cleaning, Commercial Cleaning, Carpet Cleaning, Window Cleaning, Pressure Washing, Organizing, Laundry Service

**Checklist Example — Standard Residential Cleaning (12 steps):**
1. Kitchen — wipe counters, stovetop, appliance fronts
2. Kitchen — clean sink, empty/load dishwasher
3. Kitchen — sweep and mop floor
4. Bathrooms — clean toilet, tub/shower, sink
5. Bathrooms — wipe mirrors and counters, mop floor
6. Bedrooms — make beds, dust surfaces
7. Living areas — dust all surfaces and electronics
8. Living areas — vacuum carpets / mop hard floors
9. All rooms — empty trash cans, replace liners
10. All rooms — spot-clean light switches and door handles
11. Entry areas — sweep/mop, organize shoes/coat area
12. Final walkthrough — check all rooms, lock up

---

### Pest Control

**What Pest Control Needs (Shared features cover 75%):**
- Recurring service agreements (quarterly treatments are standard)
- Customer database with property details and pest history
- Invoicing with service + material line items
- Calendar for route scheduling

**Industry-Specific (Phase 2):**
- **Chemical application logs**: Product name, EPA registration #, amount applied, target pest, application method, weather conditions. Required for state pesticide applicator compliance.
- **Bait station tracking**: Station ID, location on property, bait type, last service date, activity level.
- **Treatment schedules**: Automated recurring treatment reminders (quarterly, monthly, as-needed).
- **Pest activity reports**: Document pest types found, severity, treatment plan — shareable with customer.
- **License/certification tracking**: State pesticide applicator license per technician, continuing education credits, expiry dates.
- **Safety data sheets (SDS)**: Quick access to SDS for all chemicals in use.

**Service Types:** General Pest Treatment, Termite Inspection, Termite Treatment, Rodent Control, Mosquito Treatment, Bed Bug Treatment, Wildlife Removal, Ant Treatment, Cockroach Treatment, Flea Treatment, Commercial Pest Service, Lawn Pest Treatment

**Checklist Example — Quarterly Pest Treatment (9 steps):**
1. Interview customer — any new pest activity since last visit?
2. Inspect exterior perimeter for entry points
3. Check and refresh all bait stations (log activity levels)
4. Apply exterior barrier treatment (record product + amount)
5. Inspect interior focus areas (kitchen, bathrooms, garage)
6. Apply interior treatment as needed (record product + amount)
7. Inspect and treat attic/crawlspace if accessible
8. Document all findings and treatments on job record
9. Provide customer with treatment summary and next visit date

---

### General Handyman

**What Handymen Need (Shared features cover 90%):**
- Multi-trade flexibility — one day is drywall repair, next day is deck staining
- Quote builder for larger projects
- Photo documentation (before/after for every job)
- Customer database and service history

**Industry-Specific (Phase 2):**
- **Multi-trade service types**: Widest variety of service types of any vertical.
- **Project milestone tracking**: Larger handyman jobs (bathroom remodel, deck build) need phase tracking.
- **Simple permit awareness**: Flag which job types typically need permits (deck over 200 sq ft, electrical, plumbing).
- **Material receipts**: Photograph and attach material purchase receipts to jobs for transparency.

**Service Types:** Drywall Repair, Painting, Deck Repair, Deck Staining, Fence Repair, Door Install, Window Repair, Shelving Install, Furniture Assembly, TV Mounting, Caulking, Weatherstripping, Pressure Washing, Tile Repair, Flooring Install, Gutter Cleaning, Minor Plumbing, Minor Electrical, General Repair

**Checklist Example — Interior Painting (8 steps):**
1. Move/cover furniture and protect floors with drop cloths
2. Remove outlet covers, switch plates, and fixtures
3. Fill holes and cracks with spackle, sand smooth when dry
4. Apply painter's tape to trim, ceiling edges, and windows
5. Apply primer to repaired areas and bare surfaces
6. Apply first coat of paint, maintain wet edge
7. Apply second coat after dry time per manufacturer spec
8. Remove tape, reinstall covers/fixtures, touch up edges

---

## 2.3 Industry Onboarding Templates (Phase 2)

When a new tenant signs up, they select their industry. The system pre-populates:

| What Gets Pre-Populated | Example (HVAC) | Example (Plumbing) | Example (Landscaping) |
|------------------------|----------------|--------------------|-----------------------|
| **Service types** | AC Repair, Installation, Tune-Up, Emergency | Drain Cleaning, Leak Repair, Water Heater | Mowing, Trimming, Fertilization, Cleanup |
| **Pipeline stages** | New → Scheduled → In Progress → Completed | Received → Diagnosed → In Progress → Done | Scheduled → In Route → Completed → Billed |
| **Checklist templates** | AC Tune-Up (12 items), Installation (15 items) | Water Heater Install (10 items), Drain Clean (6 items) | Full Service (8 items), Spring Cleanup (10 items) |
| **Catalog items** | Service Call $95, Diagnostic $75, Filter $25 | Service Call $120, Snake Drain $150, Camera $250 | Weekly Mow $45, Fertilize $85, Mulch/yd $75 |
| **Default tax rate** | 8.25% (Texas) or 6% (Florida) | Same | Same |

The tenant can customize everything after signup — templates are just a starting point that gets them productive in minutes instead of hours.

---

# 3. Customer Validation Results

Before writing any code, customer discovery interviews were conducted with real HVAC business owners. Every Phase 1 feature was confirmed as a daily pain point.

**Confirmed by Real Contractors — Build This**

- Online booking / self-scheduling portal — they hate managing calls on personal phones
- Job management dashboard — no visibility into job status across the day
- Auto-invoicing — manually writing invoices wastes 15-30 min per job
- Customer database — service history scattered across texts, notebooks, memory
- Equipment/asset tracking — serial numbers and warranty dates tracked manually or not at all
- Recurring service contracts — renewals forgotten, recurring revenue lost
- Professional estimates — verbal pricing leads to disputes and lost jobs

**Cross-Industry Validation:** These exact pain points were confirmed by plumbers, electricians, and landscapers in online forums (r/Plumbing, r/electricians, r/lawncare). The problems are identical — only the service types differ.

---

# 4. Technology Stack — Zero Budget, Solo Developer

| Layer | Technology | Cost | Why This Choice |
|-------|-----------|------|-----------------|
| Frontend | Next.js 14 (App Router) | $0 | Dashboard UI, booking portal, auth, super admin — all in one app |
| Backend API | Fastify (Node.js) | $0 | Multi-tenant middleware, admin routes, webhooks, cron jobs |
| Database + Storage | Supabase Free Tier | $0 | PostgreSQL + file storage + realtime in one platform |
| Auth | Better Auth (unified) | $0 | Email/password + organization plugin + admin plugin — single system |
| ORM | Drizzle ORM | $0 | Schema-as-code, type-safe queries, zero runtime overhead |
| Maps & GPS | Mapbox | $0 | 50,000 map loads/month free, no credit card required |
| Email | Resend + React Email | $0 | 3,000 emails/month free, branded HTML templates |
| Billing | Lemon Squeezy | 5% + $0.50/sale | Works from Bangladesh, no upfront cost, built-in affiliate program |
| AI / Chat | Groq + Vercel AI SDK v6 | $0 | Groq free tier for LLM inference (llama-3.3-70b-versatile) |
| Realtime | Supabase Realtime | $0 | Real-time in-app notifications bundled with Supabase |
| Hosting (Frontend) | Vercel Hobby | $0 | Free tier — acceptable for MVP validation phase |
| Hosting (Backend) | Render Free Tier | $0 | Free Node.js hosting — acceptable for MVP |

**Total monthly cost at launch: $0. Your first $49 customer covers all future infrastructure upgrades.**

---

# 5. Product Features — Full Platform Specification

Every feature below was confirmed by real contractor conversations or driven by real usage patterns post-launch.

## 5.1 Customer Self-Scheduling Portal

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Public Booking Page | Customer visits a URL, picks service, date, available time slot | Owner stops getting calls on personal phone all day |
| Live Availability Calendar | Shows only open slots based on owner's schedule | Zero double-bookings |
| Service Type Selection | Customer picks from tenant's configured service types | Technician prepares right tools before arriving |
| Email Confirmation | Auto email to customer after booking (via Resend) | Professional — builds trust instantly |
| 24-Hour Reminder Email | Auto email reminder sent day before appointment | Reduces no-shows by ~30% |
| Custom Branding | Booking page shows contractor's logo and business name | Looks like their own system, not a third-party tool |

## 5.2 Job Management Dashboard

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Kanban Board | Visual columns with custom pipeline stages per tenant | Full job visibility — organized exactly how the contractor thinks |
| Dual View (Kanban + Table) | Toggle between visual board and spreadsheet-style table | Contractors choose the view that fits their workflow |
| Job Cards | Customer name, address, service type, time, priority, status | All job info in one place |
| Manual Job Creation | Create jobs from phone-in bookings | Handles customers who prefer calling |
| Job History Per Customer | Full past job list per customer — dates, notes, photos | Diagnose recurring issues, know equipment history |
| Search & Filter | Find any job by customer, date, status, priority, service type | Instant lookup — no scrolling |
| Priority Flags | Standard / Urgent / Emergency with color coding | Owner prioritizes emergency calls first |
| Asset Linking | Optionally link job to a specific piece of customer equipment | Know exactly which unit was serviced |

## 5.3 Invoicing & Payment Tracking

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| One-Click Invoice Generation | Auto-generates professional branded PDF from job details | Saves 15-30 min per job on paperwork |
| PDF Customization | License #, payment terms, instructions, T&C, footer per tenant | Professional documents without custom design |
| Invoice PDF Download + Email | Download PDF or send directly to customer via Resend | Professional invoice without printing anything |
| Payment Status Tracking | Mark invoices: Unpaid / Partially Paid / Paid / Method | Know at a glance who owes money |
| Overdue Invoice Reminders | Auto email at 3, 7, 14 days for unpaid invoices (cron) | Reduces manual chasing by 70% |
| Default Tax Rate | Tenant-level rate auto-fills, overridable per invoice | Set once in settings, never think about it again |

## 5.4 Customer Database

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Customer Profiles | Name, address, phone, email, preferred contact, billing info | Central record — no digging through texts |
| Equipment/Asset Records | Brand, model, serial number, install date per customer | Technician knows what's on-site before arriving |
| Service History | All past jobs per address — complete record | Diagnose recurring issues quickly |
| Notes & Tags | Internal tags ('VIP', 'Commercial', 'Has Dog') + timestamped notes | Context that prevents problems and personalizes service |
| Activity Timeline | Automated log of every interaction (created, updated, job, invoice, note) | Complete audit trail without manual effort |
| Service Agreements | Active recurring contracts and expiry per customer | Proactive renewal before contract expires |

## 5.5 KPI Dashboard Homepage

| KPI Card | What It Shows | Data Source |
|----------|--------------|-------------|
| Jobs Today | Jobs scheduled for today — emergency badge if any are urgent | jobs.scheduled_date = today |
| Open Invoices | Unpaid / overdue invoices count | invoices.status not in (paid, void) |
| Outstanding Balance | Total $ owed across all unpaid invoices | SUM(balance_due) |
| This Month Revenue | Total payments in current calendar month | SUM(invoice_payments.amount) |
| Active Customers | Customers with at least one job in last 90 days | customers joined with jobs |
| Upcoming Bookings | Unconfirmed booking requests pending action | bookings.status = pending |

Plus: Revenue area chart (6 months), job pipeline bar chart, recent activity feed, quick action buttons.

## 5.6 Service Catalog & Price Book

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Catalog item creation | Name, type (labor/part/service call), default price, unit | Define pricing once — never re-type it |
| Line item autocomplete | Typing on a job/invoice line item triggers catalog search | Saves 5-10 min per job, consistent pricing |
| Catalog management page | Full CRUD: add, edit, archive items | Keep pricing current as costs change |
| Item categories | Group by category — filter autocomplete to relevant items | Find the right item faster |

## 5.7 Customer Review Request

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Auto review request (E-12) | Sent 2 hours after invoice marked paid | Owner never remembers to ask — automation does it |
| Google Business URL setting | Paste once in settings, works forever | Zero ongoing configuration |
| Review request toggle | Enable / disable per tenant | Full control for owners who prefer not to automate |
| Manual trigger button | "Request Review" on any paid invoice | Use after jobs where customer seemed especially happy |
| Sent tracking | Prevents duplicate sends | Never spam the same customer twice |

## 5.8 Job Checklists & Service Templates

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Checklist template builder | Templates per service type, each item: label, required/optional, catalog item link | Define once — attaches to every job automatically |
| Auto-attach on job creation | Job's service type checklist attaches automatically | Tech sees exactly what to do — no calls to the office |
| Technician checklist UI | Tap-to-check, required items must be done before "Complete Job" | Prevents jobs being marked complete with steps undone |
| Auto line item generation | Checked items with catalog link auto-add to job line items | Invoice populates itself from work actually done |
| Completion log | Timestamped record of who checked each item and when | Legal protection — proof the work was performed |

## 5.9 Quick Estimate & Quote Builder

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Quote creation | Same interface as invoices, line items from catalog, status flow | Professional estimates instead of verbal price guesses |
| Quote PDF generation | Branded PDF with "Estimate" header, expiry date, custom T&C | Looks professional — builds trust |
| Email quote (E-13) | Send quote from app, customer receives branded PDF | One clean professional workflow |
| One-click convert to job | Copies line items, customer, service type → creates job | Zero re-entry of data |
| Quote list view | Status badges, filters, search, pagination, sort options | Track which estimates converted |
| Expiry auto-decline | Quotes auto-expire after 30 days | Prevents stale quotes accepted at old prices |
| Activity timeline | Automated log of quote events (created, sent, accepted, etc.) | Full audit trail per quote |

## 5.10 Calendar View

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Month / Week / Day views | Toggle between views with react-big-calendar | Plan the week — Kanban doesn't show empty days |
| Color-coded events | Emergency = red, Urgent = amber, Standard = blue, Bookings = teal | Spot critical jobs at a glance |
| Click to open job | Opens job detail side panel — same component as Kanban | Consistent UX |
| Drag to reschedule | Updates scheduled date/time in DB instantly | Rescheduling in 2 seconds |
| Availability overlay | Grey out unavailable time slots | See booking capacity at a glance |

## 5.11 Custom Pipeline Stages

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Per-tenant Kanban columns | Each tenant defines: name, label, color, sort order | "Waiting for Parts" or "Inspection Needed" — whatever fits |
| 8 color presets | Blue, brand, green, red, purple, amber, gray, teal | Visual distinction between stages |
| Manage Pipeline dialog | Drag reorder, add, rename, recolor, delete stages | Owner rearranges workflow in 30 seconds |
| Default stages on signup | 4 defaults seeded (New, Scheduled, In Progress, Completed) | Working Kanban immediately |
| Dynamic status badges | All badges across the app reflect pipeline config colors | Consistent visual language everywhere |

## 5.12 Team Management & Roles

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Organization roles | Owner (full), admin (manage team + settings), member (day-to-day) | Owner controls who sees billing vs. who completes jobs |
| Email invitation flow | Send invite via Resend, 7-day expiry, recipient clicks link | No shared passwords |
| Invitation acceptance | /invite/[id] — branded page to create account and join org | Clean onboarding in 2 minutes |
| Role-based settings | Business: owner + admin only, Billing: owner only | Office manager can't change the credit card |
| Team settings page | Member list, roles, pending invites, revoke access | Remove departed employees instantly |

## 5.13 Multi-Channel Notifications

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| In-app notifications | Real-time bell icon with unread count | Never miss an event while using the app |
| Supabase Realtime delivery | Instant via subscriptions — no polling | Zero delay between event and notification |
| Email channel | Critical events also sent via Resend | Get notified when the app is closed |
| Per-user preferences | Each team member controls their notification types | Office manager gets bookings; tech gets job updates |
| SMS / Voice stubs | Architecture ready for Twilio expansion | Future-proof without rewriting |

## 5.14 AI Help Chatbot

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Groq LLM inference | llama-3.3-70b-versatile via Vercel AI SDK v6 | AI responses in <2 seconds, $0 cost |
| 10 AI tools | Greet, answer help, create 8 entity types | "Create a job for John Smith" — done |
| ~30 FAQ knowledge base | 9 categories covering all features | Accurate answers without hallucination |
| Floating chat panel | 380x520px, mobile full-screen, always accessible | Help without leaving the current page |
| Entity creation via chat | Creates real DB records, confirms before executing | Natural language replaces form filling |

## 5.15 Service Agreements

| Feature | What It Does | Pain It Solves |
|---------|-------------|----------------|
| Service frequency options | Weekly, biweekly, monthly, quarterly, semiannual, annual | Covers every recurring pattern across industries |
| Full CRUD | Create, read, update, delete agreements linked to customer | Manage all recurring commitments in one place |
| Customer tab integration | Agreements tab on customer detail page | See agreements alongside job history |
| Standalone page | /service-agreements with status filters and search | Quick overview of all recurring revenue |
| Renewal reminders | Cron email 30 days before expiry | Never lose a renewal |

## 5.16 Enterprise UI/UX

| Feature | What It Does | Why It Matters |
|---------|-------------|----------------|
| Stats cards as page headers | KPI summary above every list page | Key metrics visible without scrolling |
| Grouped sidebar | Planning → Work → Revenue → Configuration | 30+ pages organized logically |
| 3-panel detail layout | Info panel + tabbed content + sidebar | All relevant info visible at once |
| Full dark mode | Class-based via next-themes, every component covered | Contractors working late choose their preference |
| Badge system | All status badges use consistent subtle-fill pattern | Same visual language everywhere |

## 5.17 React Email Template System

14 branded templates covering the entire customer lifecycle:

| ID | Template | Trigger |
|----|----------|---------|
| E-01 | Welcome / Signup | User creates account |
| E-02 | Booking Confirmation | Customer submits booking |
| E-03 | Booking Reminder (24h) | Cron: 24h before appointment |
| E-04 | Job Scheduled | Job created / scheduled |
| E-05 | Job Completed | Job marked complete |
| E-06 | Invoice Sent | Invoice emailed to customer |
| E-07 | Payment Received | Invoice marked paid |
| E-08 | Overdue Invoice Reminder | Cron: 3, 7, 14 days after due |
| E-09 | Contract Renewal Reminder | Cron: 30 days before expiry |
| E-10 | Trial Expiry Warning | Cron: 3 days before trial ends |
| E-11 | Welcome (First Paid) | First subscription payment |
| E-12 | Review Request | 2 hours after invoice paid |
| E-13 | Quote Sent | Quote emailed to customer |
| E-14 | Team Invitation | Owner invites team member |

5 shared brand components (layout, button, data-table, info-row, heading). 3 automated cron jobs. @hvac-saas/email monorepo package.

## 5.18 Super Admin Dashboard

**Access & Security:**

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| super_admin | Everything — full platform control | Nothing restricted |
| support | Impersonate, extend trials, view analytics, search | Delete tenants, override billing |
| billing_admin | View/override subscriptions, revenue analytics | Impersonate, delete data |

**Every admin action writes an immutable audit log entry.**

**Features:**

| Feature | What It Does |
|---------|-------------|
| Tenant List | Searchable table: business name, email, plan, last active, MRR |
| Tenant Detail | Full profile, usage stats, subscription status, impersonation |
| Impersonation | Log into any tenant, requires reason, red banner, full audit |
| Activate / Deactivate | Instantly gate or restore tenant access |
| Extend Trial | Bump trial end date — logged to audit |
| MRR Dashboard | Current MRR, 30-day delta, trend chart |
| Signup Chart | New tenants per day/week/month (90 days) |
| Trial Conversion Funnel | Trial starts vs. paid conversions |
| Active User Tracking | DAT/WAT/MAT from platform events |
| Global Search | Search any tenant, customer, job #, invoice # |
| Audit Log | All admin actions — immutable, no delete |

## 5.19 Affiliate Program

| Component | What It Does | Effort |
|-----------|-------------|--------|
| LS Affiliate Setup | 25% recurring commission via Lemon Squeezy | 20 min — no code |
| /ref/[code] route | Sets aff_code cookie (30-day), redirects to homepage | ~10 lines |
| Webhook capture | Extracts affiliate_id from LS payload, saves to tenants | ~15 lines |
| Refer & Earn widget | Card in settings showing affiliate link + commission | ~2 hours |
| Welcome email (E-11) | Includes affiliate signup link for new paid customers | 1 template |
| Admin affiliate view | Referred tenants by affiliate, MRR attributed | ~3 hours |

**Referral Flow:** Affiliate shares link → visitor lands on /ref/[code] → cookie set → signup → checkout → LS tracks conversion → affiliate gets 25% recurring → new subscriber gets their own referral link.

---

# 6. How You Get Paid — Full Money Flow

## 6.1 Net Income Per Customer

| Fee Layer | Amount | Running Total |
|-----------|--------|---------------|
| Customer pays | $49.00 | $49.00 |
| Lemon Squeezy fee (5% + $0.50) | -$2.95 | $46.05 |
| Wise transfer fee (approx) | -$0.50 | $45.55 |
| **You receive per customer/month** | | **~$45.55** |

| Scale | Monthly Revenue (USD) | Monthly Revenue (BDT) |
|-------|----------------------|----------------------|
| 10 customers | ~$455 | ~55,770 BDT |
| 50 customers | ~$2,278 | ~278,000 BDT |
| 100 customers | ~$4,555 | ~555,710 BDT |

## 6.2 Multi-Industry Revenue Impact

Going multi-industry doesn't change the price — $49/month regardless of vertical. But it massively expands the addressable market:

| Scenario | Customers | MRR | Annual Revenue |
|----------|-----------|-----|----------------|
| HVAC only (realistic ceiling) | 50 | $2,278 | $27,336 |
| HVAC + Plumbing + Electrical | 120 | $5,466 | $65,592 |
| All 8 verticals (conservative) | 250 | $11,388 | $136,650 |
| All 8 verticals (optimistic) | 500 | $22,775 | $273,300 |

Same product, same infrastructure, same support cost — just different customers finding you through different channels.

## 6.3 Affiliate Commission Impact

| Scenario | Referred (25% commission) | Direct | Net Revenue |
|----------|--------------------------|--------|-------------|
| 50 customers — all direct | 0 | 50 | $2,278/month |
| 50 customers — 20 via affiliate | 20 ($245/mo cost) | 30 | $2,033/month |
| 200 customers — 80 via affiliate | 80 ($980/mo cost) | 120 | $8,108/month |

Affiliate-referred customers cost $12.25/month each but require $0 in sales effort.

---

# 7. Infrastructure Costs — Zero to Scale

| Service | Plan | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Vercel (Frontend + Admin) | Hobby (Free) | $0 | Single deployment for all UI |
| Render (Backend) | Free Tier | $0 | Spins down after 15 min idle — OK for MVP |
| Supabase (Database) | Free Tier | $0 | 500MB DB + 1GB storage + realtime |
| Mapbox (Maps) | Free Tier | $0 | 50,000 map loads/month |
| Resend (Email) | Free Tier | $0 | 3,000 emails/month |
| Groq (AI Chat) | Free Tier | $0 | LLM inference for chatbot |
| Lemon Squeezy | % per sale | $0 fixed | Only costs when you earn |
| Domain Name | Annual | ~$1 | ~$12/year |
| **TOTAL** | | **$1/month** | Zero until paying customers |

---

# 8. Profit Projections — Multi-Industry

## 8.1 Month-by-Month (Conservative — Multi-Vertical Launch)

| Month | Customers | Verticals Active | MRR (Gross) | Infra Cost | LS Fees | Net Profit |
|-------|-----------|-------------------|-------------|------------|---------|------------|
| 1 | 3 | HVAC only | $147 | $1 | $9 | ~break even |
| 2 | 8 | HVAC only | $392 | $1 | $24 | +$367 |
| 3 | 15 | HVAC + Plumbing | $735 | $1 | $44 | +$690 |
| 4 | 25 | + Electrical | $1,225 | $55 | $74 | +$1,096 |
| 5 | 38 | + Landscaping | $1,862 | $60 | $112 | +$1,690 |
| 6 | 55 | + Cleaning | $2,695 | $65 | $162 | +$2,468 |
| 9 | 100 | All verticals | $4,900 | $100 | $294 | +$4,506 |
| 12 | 160 | All verticals | $7,840 | $150 | $470 | +$7,220 |
| 18 | 280 | All verticals | $13,720 | $250 | $823 | +$12,647 |
| 24 | 450 | All verticals | $22,050 | $400 | $1,323 | +$20,327 |

## 8.2 Unit Economics

| Metric | Value | Notes |
|--------|-------|-------|
| Price per customer/month | $49 | Flat rate, unlimited users |
| Lemon Squeezy fee | ~$2.95 | 5% + $0.50 |
| You receive (net) | ~$45.55 | After all fees |
| Infrastructure per customer (Month 12) | ~$0.94 | Total infra / customer count |
| Net profit per customer/month | ~$44.61 | After all fees and infra |
| Gross margin | ~91% | Excellent for SaaS |
| CAC (outreach only) | $0-5 | Time cost, no paid ads |
| Payback period | < 1 month | First $49 covers acquisition |
| LTV at 5% churn | ~$892 | ~20 months average lifetime |

---

# 9. Go-To-Market Strategy

## 9.1 Phase 1 — HVAC Launch (Months 1-3)

**Ideal First Customer:**
- Location: Houston TX, Dallas TX, Miami FL, Tampa FL
- Size: 1-3 people including the owner
- Current booking: Personal phone number, no "Book Online" button
- Current invoicing: Paper, texted photos, or verbal agreements
- Current software: None, or just Excel
- How to find them: Google Maps → "HVAC contractor Houston" → businesses with <50 reviews

**Outreach Sequence:**
1. Collect 30 HVAC business emails from Google Maps
2. Send validation email — get 3-5 replies
3. Ship MVP to respondents as free 30-day trial
4. Fix complaints within 48 hours
5. Convert to $49/month paid

## 9.2 Phase 2 — Multi-Vertical Expansion (Months 3-6)

**Expansion Order (by market size and shared pain intensity):**

| Order | Vertical | Why Now | GTM Channel |
|-------|----------|---------|-------------|
| 1st | **Plumbing** | Most similar to HVAC — emergency calls, equipment tracking, permits | Same Google Maps outreach, r/Plumbing |
| 2nd | **Electrical** | High-value jobs, quote builder critical, permit tracking | Electrical contractor forums, trade schools |
| 3rd | **Landscaping** | Massive market (600K+), recurring revenue via agreements | r/lawncare, lawn care forums, supply stores |
| 4th | **Cleaning** | Largest market (900K+), checklist-driven, recurring schedules | Cleaning business Facebook groups, Nextdoor |
| 5th | **Roofing** | High-ticket jobs, quote builder critical | Storm chaser groups, roofing supply houses |
| 6th | **Pest Control** | Recurring quarterly contracts, compliance needs | Pest control associations, trade publications |
| 7th | **Handyman** | Broadest service range, lowest barrier to entry | Handyman forums, TaskRabbit-to-independent groups |

**Per-Vertical Launch Playbook:**
1. Create industry-specific landing page ("/for-plumbers", "/for-electricians")
2. Pre-build onboarding template (service types, checklists, catalog items)
3. Find 10 contractors in that vertical via Google Maps
4. Offer 30-day free trial with industry template pre-loaded
5. Get 3 paying customers, then enable affiliate for that vertical

## 9.3 Affiliate Strategy — Multi-Industry

| Affiliate Type | Works For | How to Reach |
|----------------|-----------|--------------|
| Supply house reps | HVAC, Plumbing, Electrical, Roofing | Visit local supply houses — they talk to dozens of contractors daily |
| YouTube/TikTok creators | All verticals | Every trade has a creator community. Offer trial + 25% commission |
| Trade associations | HVAC, Plumbing, Electrical, Pest Control | Sponsor one newsletter issue, offer affiliate deal |
| Facebook groups | Landscaping, Cleaning, Handyman | Active communities. Offer value first (tips), then link |
| Business coaching | All verticals | Service business coaches recommend tools to clients |
| Software partners | All verticals | Accounting tools, payment processors — cross-promote |

---

# 10. Build Timeline — 8 Weeks

| Week | Focus | Deliverables | Done When |
|------|-------|-------------|-----------|
| **Week 1** | Infrastructure + Auth + DB + KPI Dashboard | Turborepo, Better Auth, customer CRUD, KPI homepage, admin login + tenant list | Owner signs up, sees dashboard; admin can list tenants |
| **Week 2** | Booking + Kanban + Calendar + Impersonation | Booking portal, Kanban with realtime, calendar with drag-reschedule, admin impersonation | Customer books; owner uses Kanban + calendar; admin impersonates |
| **Week 3** | Invoicing + Quotes + Catalog + Review + Analytics | Invoice PDF + email, quote builder + convert-to-job, catalog autocomplete, review email, MRR dashboard | Owner sends invoices and quotes; price book live |
| **Week 4** | Equipment + Checklists + Contracts + Affiliate | Equipment records, job checklists with auto line items, service agreements, LS affiliate integration | Full job lifecycle works; checklists auto-populate invoices |
| **Week 5** | Team + Notifications + Custom Pipeline | Org roles, invitations, notification bell with Realtime, pipeline stage CRUD | Owner invites team; notifications fire; Kanban customizable |
| **Week 6** | Tags + Activity + Tax Rate + PDF Customization | Tags, notes, activity timelines, tenant tax rate, invoice/quote PDF settings | Customers have full history; PDFs show business details |
| **Week 7** | Enterprise UI/UX + Service Agreements | Stats cards, grouped sidebar, 3-panel layouts, dark mode, agreements page | Every page looks enterprise-grade; dark mode works |
| **Week 8** | Email Templates + AI Chatbot + Assets + Polish | 14 branded emails, 3 crons, Groq chatbot, asset-job linking, QA | All emails branded; chatbot works; assets linked to jobs |

---

# 11. Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Supabase free tier pauses (7d inactivity) | Low in production | Upgrade to Pro ($25/mo) at first revenue |
| Render free tier cold starts | High on free tier | Upgrade to $7/month at first revenue |
| Admin impersonation misuse | Low | Mandatory reason + immutable audit log + role restrictions |
| Affiliate commission reduces margins | Low impact | 25% = $12.25/month cost per referred customer. Still net $30+. Growth > cost. |
| Safari ITP blocks affiliate cookies | Medium | Lemon Squeezy server-side attribution as backup |
| Solo developer burnout | Medium | Build P0 features only for MVP. Real feedback keeps motivation high |
| Free trial won't convert to paid | Medium | Ask: "What would make this worth $49/month?" Fix that. Ask again. |
| Groq API rate limits or downtime | Medium | Fallback to client-side FAQ matching. Chatbot degrades gracefully |
| Multi-industry pivot dilutes positioning | Low | HVAC is launch vertical. Prove PMF first. Expand only after confirmed. Industry-agnostic architecture = zero code changes when expanding |
| Competitor launches similar product | Medium | Speed + niche focus wins. First-mover in "multi-industry FSM for solo contractors" at $49. Enterprise tools are $200+/month |
| Different industries need different features | Medium | 90% of features are shared. Industry templates handle the 10%. Phase 2 adds compliance modules only when validated by paying customers |

---

# 12. Competitive Landscape

| Competitor | Price | Target | Why We Win |
|-----------|-------|--------|-----------|
| Housecall Pro | $79-$199/mo | Established teams | 2-4x our price. Overkill for solo contractors. Complex onboarding. |
| Jobber | $69-$249/mo | Growing businesses | Minimum $69/mo. Too many features for a 1-person shop. |
| ServiceTitan | $200+/mo | Large operations | Enterprise pricing. Requires sales call. Not for solo contractors. |
| FieldPulse | $99/mo | Small teams | Double our price. No AI chatbot. No multi-industry templates. |
| Workiz | $65-$195/mo | Service businesses | Higher entry price. Limited customization. |
| **Our Platform** | **$49/mo** | **Solo contractors (1-3 people)** | **Lowest price. AI chatbot. Multi-industry templates. Custom pipeline. All-in-one.** |

The gap in the market: **no one serves the solo contractor at $49/month with a modern, AI-assisted interface**. Enterprise tools are too expensive and complex. Free tools are too limited. We sit in the sweet spot.

---

# 13. Conclusion

**The Platform Is Built. The Market Is Massive.**

**Core platform — works for every industry:**
- Online booking portal — customers self-schedule
- Job management — Kanban + calendar + custom pipeline
- Invoicing — branded PDFs with payment tracking
- Quote builder — professional estimates that convert to jobs
- Customer database — profiles, tags, notes, activity timeline
- Equipment/asset tracking — per-customer with service history
- Service catalog — consistent pricing, catalog autocomplete
- Job checklists — standardized quality, auto line items
- Service agreements — recurring contracts with frequency options
- Calendar — month/week/day with drag-to-reschedule
- KPI dashboard — business health in one glance
- Review automation — Google Review request after every paid job

**Platform capabilities — competitive advantage:**
- AI help chatbot — instant answers + entity creation via natural language
- Multi-channel notifications — real-time in-app + email
- Team management — roles, invitations, access control
- Custom pipeline stages — every contractor defines their own workflow
- Enterprise UI/UX — dark mode, grouped navigation, 3-panel layouts
- 14 branded email templates — professional at every touchpoint
- Super admin dashboard — impersonation, analytics, audit log
- Affiliate program — 25% recurring commission, zero manual effort

**Multi-industry ready:**
- 8 target verticals — 2.2 million potential customers
- Industry onboarding templates — productive in minutes
- Phase 2 compliance modules — permits, chemical logs, insurance claims
- Same $49/month price — same product, 18x larger market

**Zero budget stack — $0/month until first paying customer.**

**Start with HVAC in Texas and Florida. Prove it works. Expand to plumbing, then electrical, then landscaping. Each vertical is a new revenue stream with zero additional product cost.**

**10 customers = $455/month. 100 customers = $4,555/month. 500 customers = $22,775/month.**

That's where it starts.

---

*Field Service Management SaaS · Multi-Industry Platform · v7.0 · April 2026*
