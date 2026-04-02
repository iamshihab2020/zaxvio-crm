export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: "business-tips" | "guides" | "industry-insights";
  categoryLabel: string;
  date: string;
  readTime: string;
  coverGradient: string;
  content: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "streamline-service-business-operations",
    title: "5 Ways to Streamline Your Service Business Operations",
    excerpt:
      "From digital scheduling to automated invoicing, discover how top service businesses eliminate paperwork and win back hours every week.",
    category: "business-tips",
    categoryLabel: "Business Tips",
    date: "2026-03-28",
    readTime: "5 min read",
    coverGradient: "from-brand/80 to-orange-600/80",
    content: `Running a service business means juggling a lot — scheduling, customer communication, invoicing, and actually doing the work. Here are five proven ways to streamline your operations and reclaim your time.

## 1. Digitize Your Scheduling

Paper calendars and phone-based booking are relics of the past. With online scheduling, customers can see your real-time availability and book appointments without calling. This eliminates phone tag and reduces no-shows with automated reminders.

## 2. Automate Your Invoicing

Stop writing invoices by hand. Digital invoicing lets you create and send professional invoices on-site, the moment a job is done. Customers can pay online instantly, which means faster cash flow and fewer collection headaches.

## 3. Centralize Your Customer Database

Every customer interaction — past jobs, equipment notes, communication history — should live in one place. When a repeat customer calls, you should know their full history instantly.

## 4. Use a Job Dashboard

A visual Kanban board showing every job's status (scheduled, in-progress, complete) gives you and your team instant clarity. No more wondering what's next or what's falling through the cracks.

## 5. Track Your Numbers

Revenue, completion rates, and job trends should be visible at a glance. You can't improve what you don't measure. A KPI dashboard helps you spot problems early and make data-driven decisions.

The best part? All five of these improvements can be achieved with a single platform. No need to cobble together multiple tools.`,
  },
  {
    slug: "complete-guide-digital-invoicing",
    title: "The Complete Guide to Digital Invoicing for Field Service",
    excerpt:
      "Stop chasing payments. Learn how field service professionals use on-site invoicing to get paid the same day.",
    category: "guides",
    categoryLabel: "Guides",
    date: "2026-03-22",
    readTime: "7 min read",
    coverGradient: "from-blue-500/80 to-cyan-500/80",
    content: `Getting paid shouldn't be the hardest part of your job. Yet for many field service professionals, chasing invoices takes up hours every week. Digital invoicing changes everything.

## Why Digital Invoicing Matters

Traditional invoicing means writing up a bill after you leave, mailing or emailing it days later, and then waiting — sometimes weeks — for payment. Digital invoicing flips this timeline on its head.

## Same-Day Payment Is Possible

With on-site invoicing, you generate a professional invoice on your phone the moment a job is complete. The customer receives it instantly with a link to pay online. Many service professionals report getting paid the same day.

## What to Include on Every Invoice

- Your business name, logo, and contact info
- Customer name and service address
- Detailed line items with quantities and prices
- Tax calculations (automated)
- Payment terms and online payment link
- Job reference number for easy tracking

## PDF Export for Records

Both you and your customer should have a permanent record. PDF export ensures invoices are professional, printable, and easy to file.

## Quote-to-Invoice Workflow

The most efficient workflow starts with a quote. Once the customer approves, convert the quote to a job with one click. When the job is done, convert it to an invoice — all line items carry over automatically.

## Getting Started

If you're still using paper invoices or generic spreadsheet templates, the switch to digital invoicing is the single highest-ROI improvement you can make. Most service professionals recover the cost of their software in the first week through faster payments alone.`,
  },
  {
    slug: "paper-to-digital-service-businesses",
    title: "Why Service Businesses Are Switching from Paper to Digital",
    excerpt:
      "The clipboard-and-carbon-copy era is ending. Here's why the smartest service businesses are going digital — and how to make the switch.",
    category: "industry-insights",
    categoryLabel: "Industry Insights",
    date: "2026-03-15",
    readTime: "6 min read",
    coverGradient: "from-emerald-500/80 to-teal-500/80",
    content: `The service industry is undergoing a quiet revolution. While big tech companies grab headlines, thousands of HVAC technicians, plumbers, electricians, and cleaning professionals are quietly replacing their clipboards with smartphones.

## The Paper Problem

Paper-based workflows create three major problems:

1. **Lost information** — Scribbled notes get misplaced. Customer details fall through the cracks.
2. **Slow payments** — Paper invoices mean delayed billing, which means delayed revenue.
3. **No visibility** — Without a central system, you can't see your schedule, revenue, or performance at a glance.

## The Digital Advantage

Service businesses that go digital report significant improvements:

- **30% faster payments** through online invoicing
- **15-30 minutes saved per job** on paperwork
- **Zero lost customer records** with a digital database
- **Higher customer satisfaction** from professional, timely communication

## Making the Switch

The transition doesn't have to be painful. Modern service management platforms are designed for people who aren't tech experts. Most are mobile-first, meaning your phone becomes your office.

Here's a simple migration plan:

1. **Week 1**: Sign up and add your services and pricing
2. **Week 2**: Import your existing customer list (CSV upload)
3. **Week 3**: Start scheduling new jobs through the platform
4. **Week 4**: Begin invoicing digitally for all completed jobs

By the end of the first month, you'll wonder how you ever managed with paper.

## The Bottom Line

Going digital isn't about being trendy — it's about being efficient. Every hour you spend on paperwork is an hour you're not spending on billable work. The math is simple: a $49/month tool that saves you 5+ hours per week pays for itself many times over.`,
  },
  {
    slug: "customer-self-booking-guide",
    title: "How Customer Self-Booking Grows Your Service Business",
    excerpt:
      "Let customers book their own appointments. Less phone tag, more jobs, happier customers.",
    category: "guides",
    categoryLabel: "Guides",
    date: "2026-03-08",
    readTime: "4 min read",
    coverGradient: "from-violet-500/80 to-purple-500/80",
    content: `Phone tag is the enemy of growth. Every missed call is a potential lost customer. Self-booking portals solve this by letting customers schedule appointments on their own time.

## How Self-Booking Works

You set your availability — the days and hours you're open for business. Customers visit your booking page (a simple link you can share anywhere) and pick a time that works for both of you.

## Benefits for Your Business

- **Never miss a lead** — Customers can book at 10 PM on a Sunday
- **Reduce no-shows** — Automated confirmation and reminder emails
- **Save time** — No more back-and-forth phone calls to find a time
- **Look professional** — A branded booking page builds trust

## Where to Share Your Booking Link

- Your website
- Google Business Profile
- Social media profiles
- Email signatures
- Business cards (QR code)

## Tips for Success

1. Keep your availability updated — nothing frustrates customers more than booking a slot that turns out to be unavailable
2. Set buffer time between appointments for travel
3. Use the booking confirmation to set expectations (what to prepare, estimated duration)

Self-booking isn't just a convenience — it's a competitive advantage. The easier you make it for customers to hire you, the more jobs you'll book.`,
  },
  {
    slug: "field-service-kpi-dashboard",
    title: "The KPIs Every Field Service Business Should Track",
    excerpt:
      "Revenue, job completion rate, average ticket size — the numbers that actually matter for growing your business.",
    category: "business-tips",
    categoryLabel: "Business Tips",
    date: "2026-03-01",
    readTime: "5 min read",
    coverGradient: "from-amber-500/80 to-yellow-500/80",
    content: `You can't improve what you don't measure. Yet most field service businesses operate on gut feeling. A KPI dashboard changes that by putting your most important numbers front and center.

## The Essential KPIs

### 1. Monthly Revenue
Track your total revenue month-over-month. Look for trends — is revenue growing, flat, or declining?

### 2. Job Completion Rate
What percentage of scheduled jobs actually get completed? A low completion rate signals scheduling problems or too many cancellations.

### 3. Average Ticket Size
How much revenue does each job generate on average? This helps you understand which services are most profitable.

### 4. Jobs Per Day/Week
Are you running at capacity? This number helps you decide when to hire or when to raise prices.

### 5. Customer Acquisition Cost
How much does it cost you to win a new customer? Factor in advertising, time spent on estimates, and any discounts.

### 6. Repeat Customer Rate
Your best customers are the ones who come back. A high repeat rate means you're delivering great service.

## Using Your Dashboard

Check your KPIs weekly, not daily. Daily fluctuations are noise — weekly trends are signal. Set targets for each metric and track your progress.

The goal isn't to obsess over numbers. It's to make informed decisions about pricing, marketing, hiring, and operations.`,
  },
  {
    slug: "checklist-templates-field-service",
    title: "Using Checklist Templates to Deliver Consistent Service",
    excerpt:
      "Never miss a step. How checklists help field service teams deliver reliable, professional results every time.",
    category: "industry-insights",
    categoryLabel: "Industry Insights",
    date: "2026-02-22",
    readTime: "4 min read",
    coverGradient: "from-rose-500/80 to-pink-500/80",
    content: `Airline pilots use checklists. Surgeons use checklists. Field service professionals should too. A simple checklist ensures every job is done right, every time.

## Why Checklists Matter

Even experienced technicians can forget a step when they're rushing between jobs. A checklist catches these gaps before they become callbacks or complaints.

## Building Effective Templates

A good checklist template includes:

- **Pre-job tasks** — Safety checks, equipment verification, customer greeting
- **Core service steps** — The actual work, broken into verifiable steps
- **Post-job tasks** — Cleanup, customer walkthrough, invoice generation

## Digital vs. Paper Checklists

Paper checklists get lost. Digital checklists are attached to the job record forever. They also:

- Auto-add line items when specific checklist items are marked (e.g., "replaced filter" automatically adds a filter charge)
- Create an audit trail for compliance
- Help new team members follow your standard procedures

## Getting Started

Start with your most common job type. List every step you'd want a new hire to follow. That's your first template. Refine it after a few weeks, then create templates for your other service types.

Consistency is what separates amateur operations from professional ones. Checklists make consistency automatic.`,
  },
];

export function getPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getPostsByCategory(category: string): BlogPost[] {
  if (category === "all") return BLOG_POSTS;
  return BLOG_POSTS.filter((post) => post.category === category);
}

export function getRelatedPosts(currentSlug: string, limit = 3): BlogPost[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return BLOG_POSTS.slice(0, limit);

  const sameCategory = BLOG_POSTS.filter(
    (p) => p.category === current.category && p.slug !== currentSlug
  );
  const others = BLOG_POSTS.filter(
    (p) => p.category !== current.category && p.slug !== currentSlug
  );

  return [...sameCategory, ...others].slice(0, limit);
}
