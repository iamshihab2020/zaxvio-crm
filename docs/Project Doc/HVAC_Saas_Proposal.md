**HVAC FIELD SERVICE MANAGEMENT**

SaaS Platform - Zero Budget Edition

Stack · Features · Super Admin · Affiliate Program · Real Costs · Profit Projections

| **Version**            | 5.0 - With Super Admin + Affiliate Program            |
| ---------------------- | ----------------------------------------------------- |
| **Date**               | March 2026                                            |
| **Developer Location** | Bangladesh                                            |
| **Target Market**      | Solo HVAC contractors, Texas & Florida                |
| **Tech Stack**         | Next.js · Fastify · Supabase · Mapbox · Lemon Squeezy |
| **Subscription**       | \$49 / month per tenant (via Lemon Squeezy)           |
| **Starting Budget**    | \$0 Required                                          |
| **Build Timeline**     | 4 Weeks to Beta-Ready MVP                             |

# **1\. What Is New in This Version**

Version 5.0 adds two major platform capabilities to the original validated MVP: a Super Admin Dashboard for internal operations and support, and an Affiliate Program to drive customer acquisition from Day 1.

| **Addition**          | **What It Is**                                              | **Why It Was Added**                                                               |
| --------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Super Admin Dashboard | Internal control panel - separate app at /admin             | Support customers by accessing their accounts; monitor platform health and revenue |
| Tenant Impersonation  | Admin can log into any tenant account (with reason + audit) | Resolve support tickets in minutes instead of emailing back and forth              |
| Platform Analytics    | MRR, signups, churn, active user tracking                   | Know if the business is growing without exporting data manually                    |
| Affiliate Program     | Referral links via Lemon Squeezy - 25% recurring commission | Turn every happy customer into a sales channel from Day 1                          |

All original features - booking portal, job management, invoicing, customer database, refrigerant tracking, maintenance contracts - remain unchanged.

# **2\. Customer Validation Results**

Before writing any code, customer discovery interviews were conducted with real HVAC business owners. Every Phase 1 feature was confirmed as a daily pain point:

**Confirmed by Real HVAC Owners - Build This**

✅ Online booking / self-scheduling portal - they hate managing calls on personal phones

✅ Job management dashboard - no visibility into job status across the day

✅ Auto-invoicing - manually writing invoices wastes 15-30 min per job

✅ Customer database - service history scattered across texts, notebooks, memory

✅ Refrigerant tracking - EPA compliance risk is real and owners know it

✅ Warranty management - equipment serial numbers tracked manually or not at all

✅ Maintenance contract reminders - renewals forgotten, recurring revenue lost

**All Phase 1 MVP features were confirmed as real, daily pain points.**

# **3\. Technology Stack - Zero Budget, Solo Developer**

## **3.1 Full Stack Overview**

| **Layer**                 | **Technology**                      | **Cost**         | **Why This Choice**                                                    |
| ------------------------- | ----------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Frontend (Tenant)         | Next.js 14 (App Router)             | \$0              | Dashboard UI, booking portal, auth pages, realtime Kanban              |
| Frontend (Admin)          | Next.js 14 - separate app at /admin | \$0              | Isolated super admin dashboard; separate deployment + auth             |
| Backend API               | Fastify (Node.js)                   | \$0              | Multi-tenant middleware, admin routes, webhooks, background cron jobs  |
| Database + Auth + Storage | Supabase Free Tier                  | \$0              | PostgreSQL + auth + file storage + realtime in one platform            |
| Maps & GPS                | Mapbox                              | \$0              | 50,000 map loads/month free. No credit card required to start          |
| Email Notifications       | Resend                              | \$0              | 3,000 emails/month free                                                |
| Subscription Billing      | Lemon Squeezy                       | 5% + \$0.50/sale | Works from Bangladesh. No upfront cost. Has built-in affiliate program |
| Hosting (Frontend)        | Vercel Hobby                        | \$0              | Free tier - acceptable for MVP validation phase                        |
| Hosting (Backend)         | Render Free Tier                    | \$0              | Free Node.js hosting - acceptable for MVP                              |
| Realtime                  | Supabase Realtime                   | \$0              | Built into Supabase free tier                                          |

**→ Total monthly cost at launch: \$0. Your first \$49 customer covers all future infrastructure upgrades.**

# **4\. Product Features - Phase 1 Specification**

Every feature below was confirmed by real HVAC business owner conversations. Sections 4.1-4.4 are the original core features. Sections 4.5-4.6 are new additions in this version.

## **4.1 Customer Self-Scheduling Portal**

| **Feature**                | **What It Does**                                                | **Pain It Solves**                                   |
| -------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| Public Booking Page        | Customer visits a URL, picks service, date, available time slot | Owner stops getting calls on personal iPhone all day |
| Live Availability Calendar | Shows only open slots based on owner's schedule                 | Zero double-bookings                                 |
| Service Type Selection     | Customer picks: AC Repair, Installation, Maintenance, Emergency | Technician prepares right tools before arriving      |
| Email Confirmation         | Auto email to customer after booking (via Resend, free)         | Professional - builds trust instantly                |
| 24-Hour Reminder Email     | Auto email reminder sent day before appointment                 | Reduces no-shows by ~30%                             |
| Custom Branding            | Booking page shows contractor's logo and business name          | Looks like their own system, not a third-party tool  |

## **4.2 Job Management Dashboard**

| **Feature**              | **What It Does**                                                     | **Pain It Solves**                                |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------- |
| Kanban Board             | Visual columns: New → Scheduled → In Progress → Completed → Invoiced | Full job visibility - no spreadsheet needed       |
| Job Cards                | Each card: customer name, address, service type, time, notes, status | All job info in one place                         |
| Manual Job Creation      | Create jobs from phone-in bookings too                               | Handles customers who prefer calling              |
| Job History Per Customer | Full past job list per customer - dates, notes, photos               | Diagnose recurring issues, know equipment history |
| Search & Filter          | Find any job by customer, date, status                               | Instant lookup - no scrolling                     |
| Priority Flags           | Mark: Standard / Urgent / Emergency                                  | Owner prioritizes emergency calls first           |

## **4.3 Invoicing & Payment Tracking**

At launch, contractors collect payment themselves (cash, card reader, bank transfer). They mark the invoice as paid in the app. Online payment via the app will be added in Phase 3 once Stripe Atlas is funded by revenue.

| **Feature**                  | **What It Does**                                            | **Pain It Solves**                                 |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| One-Click Invoice Generation | Auto-generates professional PDF invoice from job details    | Saves 15-30 min per job on paperwork               |
| Invoice PDF Download         | Contractor downloads and sends PDF to customer              | Professional invoice without printing anything     |
| Payment Status Tracking      | Mark invoices: Unpaid / Partially Paid / Paid / Method      | Know at a glance who owes money                    |
| Overdue Invoice View         | Dashboard showing all overdue invoices sorted by age        | No more mental tracking of who hasn't paid         |
| Payment Reminder Emails      | Auto email to customer at 3, 7, 14 days for unpaid invoices | Reduces manual chasing by 70%                      |
| Revenue Reports              | Monthly revenue chart by service type                       | Owner understands profitability without accountant |

## **4.4 Customer Database**

| **Feature**                 | **What It Does**                                             | **Pain It Solves**                                   |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Customer Profiles           | Name, address, phone, email, preferred contact, billing info | Central record - no digging through texts            |
| Equipment Records           | Brand, model, serial number, install date per customer       | Technician knows what is in the home before arriving |
| Service History             | All past jobs per address - complete record                  | Diagnose recurring issues quickly                    |
| Notes & Tags                | Internal tags per customer                                   | 'Has dog', 'prefers morning', 'pay by cash only'     |
| Maintenance Contract Status | Active contracts and expiry per customer                     | Proactive renewal before contract expires            |

## **4.5 KPI Dashboard Homepage**

The dashboard currently lands on the Kanban board. Owners need a home page that answers 'how is my business doing today?' in one glance - without opening any other screen.

| **KPI Card**        | **What It Shows**                                                     | **Data Source**                        |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| Jobs Today          | Count of jobs scheduled for today - emergency badge if any are urgent | jobs, scheduled_date = today           |
| Open Invoices       | Number of unpaid / overdue invoices                                   | invoices, status not in (paid, void)   |
| Outstanding Balance | Total \$ owed across all unpaid invoices                              | SUM(balance_due) on open invoices      |
| This Month Revenue  | Total payments recorded in current calendar month                     | SUM(invoice_payments.amount) for month |
| Active Customers    | Total customers with at least one job in last 90 days                 | customers joined with jobs             |
| Upcoming Bookings   | Unconfirmed booking requests waiting for owner action                 | bookings, status = pending             |

Pure frontend - all data already exists. No new tables or API endpoints. Estimated build time: 4-6 hours.

## **4.6 Service Catalog & Price Book**

Owners define their standard services and parts once - with names, prices, and item types. These appear as autocomplete suggestions when adding line items to any job or invoice. Consistent pricing, faster data entry, fewer errors.

| **Feature**             | **What It Does**                                                    | **Pain It Solves**                                               |
| ----------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Catalog item creation   | Add: item name, type (labor/part/service call), default price, unit | Define pricing once - never re-type 'AC Service Call \$95' again |
| Line item autocomplete  | Typing on a job line item triggers suggestions from the catalog     | Saves 5-10 min per job. Consistent pricing across all invoices.  |
| Catalog management page | /settings/catalog - full CRUD: add, edit, archive items             | Keep pricing current as costs change seasonally                  |
| Bulk CSV import         | Upload existing price list CSV to populate catalog on setup         | Contractors with Excel price sheets migrate in minutes           |
| Item categories         | Group items: Labor, Parts, Materials, Service Calls, Contracts      | Filter autocomplete to relevant items faster on the job screen   |

New DB table: catalog_items (tenant_id, name, item_type, unit_price, unit, category, is_active). Optional FK from job_line_items.catalog_item_id. Estimated: 1 day.

## **4.7 Customer Review Request (Post-Job)**

After an invoice is marked paid, the system automatically sends a short email asking the customer to leave a Google Review. HVAC owners live and die by Google reviews - one new review per week compounds into a dominant local presence within months.

| **Feature**                      | **What It Does**                                                                                     | **Pain It Solves**                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Auto review request email (E-12) | Sent 2 hours after invoice marked paid. Short friendly tone. Direct link to Google Business profile. | Owner never remembers to ask - automation does it every single time |
| Google Business URL setting      | /settings/business - one field: 'Your Google Review Link'. Paste once, works forever.                | Zero ongoing configuration required                                 |
| Review request toggle            | Enable / disable per tenant in settings                                                              | Full control for owners who prefer not to automate this             |
| Manual trigger button            | 'Request Review' button on any paid invoice                                                          | Use after jobs where the customer seemed especially happy           |
| Sent tracking                    | review_requested_at timestamp on invoices - prevents duplicate sends                                 | Never spam the same customer twice                                  |

1 new React Email template (E-12). 1 new column on invoices (review_requested_at). 1 field on tenants (google_review_url). Fastify trigger on invoice status → paid. Estimated: 3-4 hours.

## **4.8 Job Checklists & Service Templates**

Owners create reusable checklists per service type - the technician ticks them off on the job. This standardises service quality, protects the owner legally, and auto-populates line items from completed checklist steps.

| **Feature**                 | **What It Does**                                                                                                    | **Pain It Solves**                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Checklist template builder  | /settings/checklists - templates per service type. Each item: label, required/optional, optional catalog item link. | Define 'AC Tune-Up: 12 steps' once - attaches to every tune-up job automatically |
| Auto-attach on job creation | When a job is created, its service type checklist attaches automatically                                            | Tech opens the job and sees exactly what to do - no calls to the office          |
| Technician checklist UI     | Tap-to-check on job detail. Required items must be done before 'Complete Job' enables.                              | Prevents jobs being marked complete with steps undone                            |
| Auto line item generation   | Checked items with a catalog link auto-add to job line items on completion                                          | Invoice populates itself from work actually done - no manual entry               |
| Checklist completion log    | Timestamped record of who checked each item and when                                                                | Legal protection - proof the work was performed correctly                        |

New tables: checklist_templates, checklist_items (with catalog_item_id FK), job_checklist_completions (job_id, item_id, completed_by, completed_at). Estimated: 2 days.

## **4.9 Quick Estimate & Quote Builder**

Fills the gap between a customer call and a created job. Owner sends a professional PDF quote before any commitment. On customer acceptance, one click converts the quote into a job with all line items carried over.

| **Feature**                    | **What It Does**                                                                                                 | **Pain It Solves**                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Quote creation                 | Same interface as invoice editor. Line items from catalog. Status: draft → sent → accepted → declined → expired. | Send professional estimates instead of verbal price guesses on the phone |
| Quote PDF generation           | Same pdfkit engine as invoices. Tenant branding. 'Estimate' header. Expiry date.                                 | Looks professional - builds trust before the job starts                  |
| Email quote to customer (E-13) | Send quote from app. Customer receives branded PDF via Resend.                                                   | No WhatsApp screenshots - one clean professional workflow                |
| One-click convert to job       | 'Accept & Create Job' button. Copies line items, customer, service type. Job created in scheduled status.        | Zero re-entry of data - quote becomes job in one click                   |
| Quote list view                | /quotes - status badges: pending, accepted, declined, expired. Filter + search.                                  | Owner tracks which estimates converted and which didn't                  |
| Expiry auto-decline            | Quotes older than 30 days auto-expire. Owner notified.                                                           | Prevents stale quotes accepted months later at old prices                |

New tables: quotes (tenant_id, customer_id, quote_number QT-YYYY-XXXX, status, dates, totals, pdf_path, converted_to_job_id) + quote_line_items. Estimated: 2 days.

## **4.10 Calendar View**

A date-based view of scheduled jobs - toggled alongside the Kanban board. HVAC owners think in terms of 'what's on Tuesday' as much as 'what's in progress'. The calendar makes scheduling gaps and busy days immediately visible.

| **Feature**              | **What It Does**                                                                                                | **Pain It Solves**                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Month / Week / Day views | Toggle between views. Built with react-big-calendar.                                                            | Plan the week ahead - Kanban doesn't show empty days                       |
| Colour-coded job events  | Each job is a colour block: Emergency = red, Urgent = orange, Standard = blue. Customer name + time slot shown. | Spot critical jobs and free slots at a glance                              |
| Click to open job        | Click any calendar event to open the job detail side panel - same panel as Kanban                               | Consistent UX - calendar is just another view of the same data             |
| Drag to reschedule       | Drag a job to a different date/time - updates scheduled_date + scheduled_start in DB instantly                  | Rescheduling takes 2 seconds instead of opening the job and editing fields |
| Kanban / Calendar toggle | Toggle switch in dashboard header. Preference persisted per user.                                               | Owner picks their preferred daily view - both always available             |

No new DB tables. Uses existing jobs data. Library: react-big-calendar (MIT). Drag-to-reschedule calls existing PATCH /jobs/:id. Estimated: 1-2 days.

## **4.11 Super Admin Dashboard**

A completely separate internal control panel - deployed at a different URL, with its own authentication system independent of tenant accounts. This is the operations hub for running the SaaS business.

A completely separate internal control panel - deployed at a different URL, with its own authentication system independent of tenant accounts. This is the operations hub for running the SaaS business.

**4.11.1 Why This Is Essential**

Without a super admin dashboard, every support request requires manual database queries, guesswork about what the customer did, and slow email back-and-forth. With impersonation, a 30-minute support call becomes a 3-minute fix.

**The analytics module answers the most important question every week: Is the business growing?**

**4.11.2 Access & Security Model**

| **Role**      | **What They Can Do**                                              | **What They Cannot Do**                            |
| ------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
| super_admin   | Everything - full platform control                                | Nothing restricted                                 |
| support       | Impersonate tenants, extend trials, view analytics, global search | Delete tenants, override billing, access audit log |
| billing_admin | View/override subscriptions, view revenue analytics               | Impersonate tenants, delete data                   |

**Every single admin action writes an immutable entry to the audit log - including who did it, when, what tenant was affected, and why. The audit log has no delete policy.**

**4.11.3 Tenant Management Features**

| **Feature**           | **What It Does**                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Tenant List           | Searchable table: business name, email, plan status, signup date, last active, MRR contribution       |
| Tenant Detail View    | Full profile with subscription status, usage stats, impersonation button                              |
| Tenant Impersonation  | Log into any tenant account. Requires typed reason. Red warning banner shown. Full session audit log. |
| Activate / Deactivate | Instantly gate or restore tenant access without touching Lemon Squeezy                                |
| Extend Trial          | Bump trial end date for a specific tenant - logged to audit                                           |
| Subscription Override | Manually correct subscription status for edge cases (payment disputes, etc.)                          |

**4.11.4 Impersonation Flow**

**How Impersonation Works**

1\. Admin opens tenant → clicks Impersonate → enters required reason

2\. Fastify generates a 15-minute scoped JWT for that tenant

3\. Admin browser opens the tenant dashboard with a red banner: ⚠️ You are viewing as \[Business Name\] - \[Admin Name\]

4\. All actions during the session are logged

5\. Admin clicks Exit Impersonation → returns to admin dashboard

6\. Full session written to audit log: start time, end time, reason, actions taken

**4.11.5 Platform Analytics (Phase 1)**

| **Metric**                  | **What It Shows**                                | **How It's Calculated**              |
| --------------------------- | ------------------------------------------------ | ------------------------------------ |
| MRR Dashboard               | Current MRR, 30-day delta                        | Count of active subscriptions × \$49 |
| Signup Chart                | New tenants per day/week/month (last 90 days)    | Bar chart from tenants.created_at    |
| Trial Conversion Funnel     | Trial starts vs trial-to-paid conversions        | Subscription status transitions      |
| Churn List                  | Tenants who cancelled in last 30/60/90 days      | tenant_subscriptions.cancelled_at    |
| Daily/Weekly/Monthly Active | How many tenants are actively using the platform | platform_events table aggregations   |
| Inactive Tenant Alert       | Tenants with no activity in 14 days - churn risk | Last platform_event per tenant       |

**4.11.6 Support Tools**

| **Tool**                | **What It Does**                                                               |
| ----------------------- | ------------------------------------------------------------------------------ |
| Global Search           | Search any tenant, customer, job number, or invoice across the entire platform |
| Tenant Activity Log     | See every action a specific tenant has taken - for debugging issues            |
| Impersonation Audit Log | Full history of all admin access sessions with reasons and durations           |
| Webhook Log             | Last 100 Lemon Squeezy webhooks - status, timestamp, payload preview           |
| Cron Job History        | Last run time and result for each background job - confirm reminders fired     |

## **4.12 Affiliate Program - End of Phase 1**

HVAC contractors talk to other HVAC contractors constantly - at supply houses, in trade groups, on Reddit and Facebook. The affiliate program turns every happy customer into a sales channel with zero ongoing effort.

**4.12.1 Strategy: Use Lemon Squeezy's Built-in Affiliate System**

**Zero custom payout infrastructure needed.**

Lemon Squeezy has a built-in affiliate dashboard that handles tracking links, conversion attribution, commission calculation, and payouts. Setup takes 20 minutes in their admin panel - no code required for the core system.

Commission: 25% recurring per referred subscriber = \$12.25/month per referred customer. This is strong enough to motivate HVAC YouTube creators, supply house reps, and trade association newsletters.

**4.12.2 What Gets Built (End of Week 4)**

| **Component**             | **What It Does**                                                                                                          | **Effort**             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| LS Affiliate Setup        | Enable affiliate program in Lemon Squeezy admin. Set commission to 25% recurring.                                         | 20 min - no code       |
| /ref/\[code\] route       | Sets aff_code cookie (30-day expiry), redirects to homepage. Survives multi-page navigation.                              | ~10 lines of Next.js   |
| Webhook affiliate capture | Extend subscription_created handler: extract affiliate_id from LS payload, save to tenants table.                         | ~15 lines of Fastify   |
| Refer & Earn widget       | Card in /settings/billing showing affiliate link + 25% commission details. Deep-links to LS affiliate portal.             | ~2 hours frontend      |
| Welcome email (E-11)      | Sent on first paid subscription. Contains affiliate signup link. Converts happy new customers into referrers immediately. | 1 React Email template |
| Admin affiliate overview  | Table in super admin showing referred tenants by affiliate, MRR attributed, conversion rate.                              | ~3 hours               |

**4.12.3 Referral Flow**

**How a Referral Converts**

1\. Affiliate shares link: yourapp.com/?aff=ABC123

2\. Visitor lands on /ref/\[code\] → aff_code cookie set (30 days) → redirected to homepage

3\. Visitor signs up → goes through onboarding → hits Lemon Squeezy checkout

4\. LS detects affiliate cookie → tracks conversion automatically

5\. On subscription_created webhook: affiliate_id captured → saved to tenants.referred_by_affiliate_id

6\. LS pays affiliate 25% recurring every month automatically

7\. New subscriber receives welcome email with their own referral link to share

**4.12.4 Target Affiliates**

| **Affiliate Type**     | **Why They Work**                                                | **How to Reach**                                       |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| HVAC supply house reps | Talk to dozens of contractors daily - organic trust              | Visit local supply houses in Houston/Miami             |
| HVAC YouTube creators  | Solid DIY/pro HVAC YouTube community with loyal audiences        | Email creators directly - offer trial + commission     |
| Trade associations     | ACCA Texas chapter, Florida HVAC associations - newsletter reach | Sponsor newsletter for one issue, offer affiliate deal |
| Complementary software | Accounting tools, estimating apps that HVAC owners already use   | Partner deal - cross-promote to each other's lists     |

# **5\. How You Get Paid - Full Money Flow**

## **5.1 The Complete Payment Flow**

| **HVAC Owner**       | **Lemon Squeezy**                 | **You Receive**        | **Transfer**                          | **Bangladesh Bank**   |
| -------------------- | --------------------------------- | ---------------------- | ------------------------------------- | --------------------- |
| Visits checkout page | Processes \$49/month subscription | ~\$46 net per customer | Wise or Payoneer transfers USD to BDT | Money in your account |

## **5.2 Real Net Income Per Customer**

| **Fee Layer**                            | **Amount Deducted** | **Running Total**              |
| ---------------------------------------- | ------------------- | ------------------------------ |
| Customer pays                            | \$49.00             | \$49.00                        |
| Lemon Squeezy fee (5% + \$0.50)          | \-\$2.95            | \$46.05                        |
| Wise transfer fee (approx)               | \-\$0.50            | \$45.55                        |
| You receive per customer per month (USD) | -                   | ~\$45.55                       |
| At 1 USD = 122 BDT                       | -                   | ~5,577 BDT/month/customer      |
| 10 customers                             | -                   | ~\$455/month \| ~55,770 BDT    |
| 50 customers                             | -                   | ~\$2,278/month \| ~278,000 BDT |
| 100 customers                            | -                   | ~\$4,555/month \| ~555,710 BDT |

## **5.3 Affiliate Commission Impact on Revenue**

| **Scenario**                    | **Referred Customers (25% affiliate)** | **Direct Customers (no affiliate)** | **Net Revenue Difference**                                                        |
| ------------------------------- | -------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| 10 customers - all direct       | 0                                      | 10                                  | \$455/month net                                                                   |
| 10 customers - 5 via affiliate  | 5 (you pay \$12.25/mo each = \$61.25)  | 5                                   | \$393/month net - still worth it for growth                                       |
| 50 customers - 20 via affiliate | 20 (\$245/mo affiliate cost)           | 30                                  | \$1,788/month net vs \$2,278 direct - affiliate customers still highly profitable |

→ Affiliate-referred customers cost you \$12.25/month each but require \$0 in sales effort. At any scale, the growth benefit exceeds the commission cost.

# **6\. Infrastructure Costs - Zero to Scale**

## **6.1 MVP Phase - \$0/Month (0-10 Customers)**

| **Service**                         | **Plan**          | **Monthly Cost** | **Notes**                                                             |
| ----------------------------------- | ----------------- | ---------------- | --------------------------------------------------------------------- |
| Vercel (Tenant Frontend)            | Hobby (Free)      | \$0/month        | Deploy Next.js tenant app                                             |
| Vercel (Admin Frontend)             | Hobby (Free)      | \$0/month        | Deploy super admin app - separate Vercel project                      |
| Render (Backend)                    | Free Tier         | \$0/month        | Deploy Fastify. Spins down after 15 min idle - OK for MVP             |
| Supabase (Database)                 | Free Tier         | \$0/month        | 500MB DB + 1GB file storage + auth + realtime                         |
| Mapbox (Maps)                       | Free Tier         | \$0/month        | 50,000 map loads/month free. No credit card required                  |
| Resend (Email)                      | Free Tier         | \$0/month        | 3,000 emails/month                                                    |
| Lemon Squeezy (Billing + Affiliate) | Free (% per sale) | \$0/month fixed  | Only costs when you earn. Affiliate program included at no extra cost |
| Domain Name                         | Annual            | ~\$1/month       | ~\$12/year from Namecheap or Cloudflare                               |
| TOTAL                               |                   | \$1/month        | Essentially zero until you have paying customers                      |

# **7\. Profit Projections - Real Numbers**

## **7.1 Month-by-Month Net Profit**

| **Month** | **Customers** | **MRR (Gross)** | **Infra Cost** | **LS Fees (~5%)** | **Net Profit** |
| --------- | ------------- | --------------- | -------------- | ----------------- | -------------- |
| 1         | 3             | \$147           | \$1            | \$9               | ~break even    |
| 2         | 6             | \$294           | \$1            | \$18              | +\$275         |
| 3         | 10            | \$490           | \$1            | \$29              | +\$460         |
| 4         | 15            | \$735           | \$55           | \$44              | +\$636         |
| 5         | 20            | \$980           | \$60           | \$59              | +\$861         |
| 6         | 28            | \$1,372         | \$65           | \$82              | +\$1,225       |
| 9         | 46            | \$2,254         | \$75           | \$135             | +\$2,044       |
| 12        | 70            | \$3,430         | \$90           | \$206             | +\$3,134       |
| 18        | 110           | \$5,390         | \$200          | \$323             | +\$4,867       |
| 24        | 155           | \$7,595         | \$300          | \$456             | +\$6,839       |

## **7.2 Unit Economics Summary**

| **Metric**                                 | **Value** | **Notes**                                 |
| ------------------------------------------ | --------- | ----------------------------------------- |
| Price per customer/month                   | \$49      | Flat rate, unlimited users                |
| Lemon Squeezy fee per \$49                 | ~\$2.95   | 5% + \$0.50                               |
| You receive per customer (net)             | ~\$46.05  | Before transfer fees                      |
| After Wise/Payoneer transfer fee           | ~\$45.55  | Approximately 1.1% transfer cost          |
| Infrastructure cost per customer (Month 6) | ~\$2.50   | Total infra / customer count              |
| Net profit per customer per month          | ~\$43.05  | After all fees and infra                  |
| Gross margin                               | ~88%      | Excellent for a SaaS product              |
| CAC (email outreach only)                  | \$0-5     | Time cost only, no paid ads               |
| Payback period                             | < 1 month | First \$49 covers all acquisition cost    |
| Customer LTV at 5% churn                   | ~\$861    | \$43.05 net × ~20 months average lifetime |

# **8\. Go-To-Market Strategy**

## **8.1 Target Customer - Be Specific**

**Ideal First Customer Profile**

📍 Location: Houston TX, Dallas TX, Miami FL, Tampa FL

👤 Business size: 1-3 people including the owner

📞 Current booking: Personal phone number listed on website - no 'Book Online' button

💸 Current invoicing: Paper, texted photos of handwritten invoices, or verbal agreement

💻 Current software: None, or just Excel

🔧 Services: Residential AC repair, installation, tune-ups

🔎 How to find them: Google Maps → 'HVAC contractor Houston' → small businesses with under 50 reviews

## **8.2 Outreach + Affiliate Sequence**

| **Week / Month** | **Action**                                                                                | **Goal**                             |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| Week 1           | Collect 30 HVAC business emails from Google Maps. Send validation email.                  | Build outreach list, get 3-5 replies |
| Week 2           | Reply to everyone who responds. Ask discovery questions. Listen.                          | Understand their real pain           |
| Week 3-4         | Build MVP. Ship to respondents as free beta.                                              | Have something real to show          |
| Month 2          | Email beta users: 'I built something based on what you told me. Free 30-day trial.'       | Get first 3-5 beta users             |
| Month 2-3        | Fix everything they complain about within 48 hours.                                       | Reduce churn, build loyalty          |
| Month 3          | Ask: 'Would you pay \$49/month?' If yes, send Lemon Squeezy payment link.                 | First paying customers               |
| Month 3-4        | Enable affiliate program. Every new paid customer gets welcome email with referral link.  | Turn customers into a sales channel  |
| Month 4+         | Post in r/HVAC and HVAC Facebook groups. Reach out to HVAC YouTubers for affiliate deals. | Scale to 20-30 customers             |

# **9\. Build Timeline - 4 Weeks**

| **Week** | **Focus**                                                               | **Deliverables**                                                                                                                                                                                                 | **Done When**                                                                             |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Week 1   | Infrastructure + Auth + DB + Admin Scaffold + KPI Dashboard             | Turborepo setup, multi-tenant auth, customer CRUD, KPI homepage (jobs today, open invoices, revenue, bookings), admin app login + tenant list                                                                    | Owner can sign up, sees KPI dashboard; admin can log in and list tenants                  |
| Week 2   | Booking Portal + Kanban + Calendar View + Impersonation                 | Public booking portal, availability calendar, Kanban board with realtime, Calendar View with drag-to-reschedule, admin tenant detail + working impersonation                                                     | Customer can book; owner sees calendar + Kanban; admin can impersonate any tenant         |
| Week 3   | Invoicing + Quotes + Service Catalog + Review Request + Admin Analytics | Invoice generation + PDF + Resend, Quote builder (QT-YYYY) with convert-to-job, Service Catalog with line item autocomplete, Review request email (E-12), MRR dashboard + active user tracking                   | Owner sends invoices, creates quotes, has a price book; admin sees live MRR               |
| Week 4   | Equipment + Refrigerant + Checklists + Contracts + Affiliate + Polish   | Equipment records, refrigerant logs, job checklists with auto line items, maintenance contracts, Lemon Squeezy + affiliate capture, /ref/\[code\], Refer & Earn widget, E-11 + E-13 emails, admin affiliate view | Full end-to-end flow works; checklists auto-populate invoices; affiliate referral tracked |

# **10\. Risks & Mitigation**

| **Risk**                                         | **Likelihood**    | **Mitigation**                                                                                                          |
| ------------------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Supabase free tier pauses (7 days inactivity)    | Low in production | Once you have users, there will always be activity. Upgrade to Pro (\$25/mo) at first revenue.                          |
| Render free tier spins down - slow first request | High on free tier | Acceptable for MVP. Upgrade to \$7/month paid tier at first revenue.                                                    |
| Admin impersonation misused internally           | Low               | Mandatory reason field + immutable audit log + role restrictions prevent abuse                                          |
| Affiliate commission reduces margins             | Low impact        | 25% commission = \$12.25/month per referred customer. You still net \$30+ per customer. Growth value exceeds cost.      |
| Affiliate link cookie blocked (iOS Safari ITP)   | Medium            | Lemon Squeezy handles server-side attribution as backup. LS affiliate tracking is more robust than first-party cookies. |
| Solo developer burnout                           | Medium            | Build only the P0 features for MVP. Ship in 4 weeks maximum. Real user feedback keeps motivation high.                  |
| Contractor happy with free trial but won't pay   | Medium initially  | Ask directly: 'What would make this worth \$49/month?' Fix that thing. Then ask again.                                  |

# **11\. Conclusion**

**You Have Everything You Need to Start**

✅ Market validated - real HVAC owners confirmed all Phase 1 features

✅ Zero budget stack - \$0/month until first paying customer

✅ Payment solved - Lemon Squeezy works from Bangladesh, no upfront cost

✅ Money transfer solved - Wise or Payoneer sends USD to Bangladesh bank or bKash

✅ Maps solved - Mapbox free tier, no credit card required

✅ Super admin built in - impersonate any tenant, resolve support tickets in minutes

✅ KPI dashboard - owners see their business health in one glance

✅ Service catalog - consistent pricing, faster invoicing

✅ Review automation - every paid job requests a Google review

✅ Job checklists - standardised service, legal protection, auto line items

✅ Quote builder - professional estimates convert to jobs in one click

✅ Calendar view - schedule gaps visible, drag-to-reschedule in 2 seconds

✅ Affiliate program ready - Lemon Squeezy handles all tracking and payouts

**The only thing left is to build it.**

Start with Week 1. Ship a working product in 4 weeks.

Give it to 3-5 people who replied to your validation emails.

Fix what they complain about. Charge \$49/month.

**10 customers = \$455/month = ~55,000 BDT/month.**

That's where it starts.

- End of Proposal -

HVAC SaaS | Zero Budget Edition | Solo Developer | Bangladesh | March 2026