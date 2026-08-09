import type { KnowledgeEntry } from "./types";

const entries: KnowledgeEntry[] = [
  // ═══════════════════════════════════════
  // ── Navigation & Getting Started ──
  // ═══════════════════════════════════════
  {
    id: "general-navigation",
    category: "general",
    keywords: ["navigate", "find", "where", "sidebar", "menu", "page", "go to"],
    question: "How do I navigate the app?",
    answer:
      "Use the **sidebar** on the left to navigate. It's organized into groups:\n\n• **Dashboard** — Your home overview\n• **Conversations** — Send emails to customers, view message history\n• **Schedule** group — Calendar, Bookings\n• **Manage** group — Customers, Jobs\n• **Finance** group — Quotes, Invoices, Service Agreements\n• **Automate** group — Automations\n• **Reference** group — Catalog, Checklists, Assets\n• **Settings** — at the bottom\n\nYou can collapse the sidebar by clicking the toggle at the top for more screen space.",
  },
  {
    id: "conversations-feature",
    category: "general",
    keywords: ["message", "email", "sms", "conversation", "chat", "contact customer", "send email", "inbox", "messaging"],
    question: "Can I send messages to my customers?",
    answer:
      "Yes! Use the **Conversations** page (in the sidebar) to send emails directly to your customers and view the full message history in a chat-style interface.\n\n**How it works:**\n1. Click **Conversations** in the sidebar\n2. Click **+ New** to start a conversation with a customer\n3. Select a customer and choose **Email** as the channel\n4. Type your message and press Send (or Ctrl+Enter)\n\n**SMS** is coming soon — you'll see it in the channel selector marked as \"Coming Soon\".\n\nConversations update in real-time, so new replies appear instantly without refreshing the page.",
  },
  {
    id: "general-getting-started",
    category: "general",
    keywords: ["getting started", "start", "begin", "new", "setup", "first", "onboard"],
    question: "How do I get started?",
    answer:
      "Welcome! Here's the recommended setup order:\n\n1. **Settings > Business** — Add your business name, phone, address, and logo\n2. **Settings > Business** — Set your default tax rate\n3. **Catalog** — Add your common parts, labor items, and services with prices\n4. **Checklists** — Create checklist templates for your service types\n5. **Customers** — Add your existing customers\n6. **Settings > Scheduling** — Set your weekly availability hours\n7. **Jobs** — Create your first job and try the Kanban board\n\nYou're ready to start managing your service business!",
  },
  {
    id: "general-automations",
    category: "general",
    keywords: [
      "automation",
      "automate",
      "workflow",
      "trigger",
      "auto send",
      "automatic email",
      "follow up automatically",
      "sequence",
    ],
    question: "Can I automate things like follow-up emails?",
    answer:
      "Yes. Go to **Automations** in the sidebar, under the **Automate** group.\n\n**How to build one:**\n1. Click **New automation** and give it a name\n2. Choose what starts it — a job being completed, or an invoice being paid in full\n3. Click the **+** under a step to add the next one: send an email, notify your team, or add a note to the customer\n4. Press **Save**, then **Publish**\n5. Switch it **on**\n\n**Saving is not publishing.** Save keeps your work; Publish is what makes the new version the one that actually runs. And a published automation still does nothing until you switch it on — that's deliberate, so nothing starts emailing customers while you're still building it.\n\nTwo things worth knowing:\n\n• **Customers can unsubscribe** from marketing messages. Every Send email step asks whether it's *a marketing or follow-up message* or *about a transaction they are party to* — the first is skipped for anyone who unsubscribed, the second still goes. The rest of the automation runs either way, and you'll see the reason on the run.\n• **Estimates, invoices and receipts are never affected** by an unsubscribe. Those aren't marketing, so they always go out.",
  },
  {
    id: "automations-draft-vs-published",
    category: "general",
    keywords: [
      "automation not running",
      "automation broken",
      "publish automation",
      "draft automation",
      "automation off",
      "switch on automation",
      "why isn't my automation working",
    ],
    question: "I built an automation but it isn't doing anything",
    answer:
      "Almost always one of two things, and the Automations list tells you which:\n\n**It says Draft.** Drawing an automation isn't the same as publishing it. Open it and press **Publish** — until you do, it has no published version and cannot run at all. The on/off switch stays disabled and will tell you the same thing if you hover it.\n\n**It says Off.** It's published but switched off. Flip the toggle on the list, or open it — there's a banner saying so.\n\nA third possibility if it says **Live**: the automation ran but a step was skipped. Common reason is the customer having unsubscribed from non-essential email.\n\nNew automations are **always created switched off** on purpose. Nothing starts emailing your customers the moment you build it.",
  },
  {
    id: "automations-wait-until-date",
    category: "general",
    keywords: [
      "appointment reminder",
      "remind customer before appointment",
      "reminder before booking",
      "day before appointment",
      "wait until date",
      "wait until appointment",
      "reduce no shows",
      "remind before visit",
    ],
    question: "Can an automation remind customers before their appointment?",
    answer:
      "Yes. Add a **Wait** step and set it to *until a date on the record* — then pick the date it should count from, like the booking date, and how far before.\n\n**The quickest way:** open **Automations → New automation** and choose the **Remind customers before their appointment** template. It waits until 9am the day before and sends the customer the date, time and what they booked.\n\n**How the Wait step works:**\n\n• **For a length of time** — counted from when the automation reaches that step. Good for \"three days after the job\".\n• **Until a date on the record** — the appointment, the due date, the expiry. Different for every customer, which is what a reminder needs.\n• **Until a specific date** — one fixed day you type in.\n\nOnly dates your trigger actually provides are offered, so you can’t accidentally wait for something that isn’t there.\n\n**If that moment has already passed** — say a booking is made for tomorrow and you asked for a reminder the day before — you choose what happens. **Stop here** is the default and is right for reminders: a \"we’re coming tomorrow\" note that arrives late is worse than none. **Carry on straight away** is right for chasing, where late still beats never. Either way the run history says which happened.",
  },
  {
    id: "automations-triggers",
    category: "general",
    keywords: [
      "what can start an automation",
      "automation trigger",
      "trigger list",
      "when a job moves",
      "stage change automation",
      "quote sent automation",
      "job assigned automation",
      "booking cancelled automation",
    ],
    question: "What can start an automation?",
    answer:
      "Twelve things, grouped by what they are about.\n\n**Jobs**\n\u2022 **Job Created** \u2014 any new job, however it was added. Filter by priority or service type.\n\u2022 **Job Moves Stage** \u2014 a job moves to a different column on the board. Filter by what the new stage *means* (scheduled, in progress, completed, cancelled) rather than its name, so renaming a column never quietly stops it. You can also skip bulk moves, which matters if the automation emails somebody.\n\u2022 **Job Assigned** \u2014 a job is given to someone, or taken off them.\n\u2022 **Job Completed** \u2014 a job is marked done.\n\n**Quotes**\n\u2022 **Quote Sent** \u2014 you send a quote out. Pair it with a Wait step to chase anything unanswered.\n\u2022 **Quote Accepted** \u2014 the customer presses Accept on the portal link.\n\n**Invoices**\n\u2022 **Invoice Paid** \u2014 paid in full.\n\u2022 **Invoice Overdue** \u2014 checked once a day, so you can chase at 1, 7 and 14 days.\n\n**Bookings and customers**\n\u2022 **Booking Created**, **Booking Cancelled**, **New Customer**.\n\n**And by hand** \u2014 **Run Manually**, for testing or for a one-off.\n\nMost triggers have filters, and leaving a filter empty means \u201crun every time\u201d rather than \u201cnever run\u201d.",
  },
  {
    id: "automations-publish-blocked",
    category: "general",
    keywords: [
      "can't publish",
      "publish blocked",
      "publish error",
      "automation errors",
      "fix automation",
    ],
    question: "Why can't I publish my automation?",
    answer:
      "Publishing checks the whole automation first and refuses if something would stop it working. You'll get a list of exactly what to fix — click any item to jump to the step it's about.\n\n**The usual ones:**\n\n• **Nothing starts it** — add a trigger step.\n• **A step is missing something** — a required field is empty.\n• **A step isn't connected** — nothing above it, so it could never run.\n• **A branch goes nowhere** — one side of a split has no next step.\n• **The step needs a different kind of record** — e.g. a job step under a trigger that gives you a customer.\n\nYou'll also see **warnings**. Those don't block publishing — they're things worth a look, like a step nothing can reach.\n\nPublishing never changes a run that's already going. Anything mid-flight finishes on the version it started with.",
  },
  {
    id: "automations-wait-step",
    category: "general",
    keywords: [
      "wait step",
      "delay automation",
      "wait 3 days",
      "follow up later",
      "automation timing",
      "quiet hours",
      "middle of the night",
      "working hours automation",
    ],
    question: "How do I make an automation wait before the next step?",
    answer:
      "Add a **Wait** step. Everything below it happens later, not straight away — so \"three days after the job, ask for a review\" is one automation rather than something you have to remember.\n\n**Two ways to set it:**\n\n• **For a length of time** — minutes, hours, days or weeks, counted from the moment the automation reaches that step.\n• **Until a specific date** — a fixed point, with a time of day. Read in your business's timezone, not the customer's.\n\n**It won't wake up in the middle of the night.** A wait set in days will land at whatever hour the automation started, which is often 2am. By default the automation holds until your next working hours before carrying on — it's never cancelled, just moved. Working hours come from **Settings → Scheduling**, the same hours your booking page uses, so a day you're closed is a day it won't resume.\n\nSwitch that off per step with **Resume → as soon as the wait is up**. Useful for internal steps like notifying your team, where the hour doesn't matter.\n\nA \"wait until\" date is always honoured exactly as you set it — if you name a time, that's the time.\n\n**Waits survive restarts.** A three-day wait really does wait three days, and it finishes on the version of the automation it started on, even if you edit and republish while it's waiting.",
  },
  {
    id: "automations-branches",
    category: "general",
    keywords: [
      "automation branch",
      "only if",
      "split automation",
      "wait for all branches",
      "merge branches",
      "automation stuck",
      "automation stopped halfway",
      "two paths",
      "do several things",
      "run both branches",
      "fan out",
    ],
    question: "How do branches work in an automation?",
    answer:
      "There are two ways to branch, and they are opposites.\n\n**Only if** picks **one** side. Steps on the **Yes** side run when the check passes, steps on the **No** side when it doesn't — never both.\n\n**Do several things** runs **every** branch. Use it when finishing a job needs two unrelated things to happen — tell the customer *and* raise the invoice — rather than one or the other. Choose how many branches you want, up to five; each one runs in turn.\n\n**Where branches come back together:** a step with more than one arrow into it runs on the **first branch to reach it**, once. That's usually what you want — an Only if where both sides end in \"send the follow-up\" sends one follow-up, whichever way the check went. Every step with more than one incoming arrow says which rule it follows, right under its name.\n\n**Wait for all branches** is the exception: it waits for every arrow into it. Put it under a Do several things when the next step needs all the branches finished.\n\n**Don't put it after an Only if.** One side of an Only if never runs, so it would wait forever and the automation would stop with nothing marked as failed. Publishing catches this and tells you which step to unhook.",
  },
  {
    id: "automations-run-history",
    category: "general",
    keywords: [
      "run history",
      "automation log",
      "did my automation run",
      "automation history",
      "why did it fail",
      "automation failed",
      "what did the automation do",
      "automation runs",
    ],
    question: "How do I see whether my automation actually ran?",
    answer:
      "Open the automation and click the **clock icon** in the toolbar, or pick **Run history** from the ⋯ menu on the Automations list.\n\n**The list** shows every run, newest first: what happened, which customer it ran for, when it started, how many steps it took and how long it took. The four counts at the top cover the whole history, not just the page you're looking at.\n\n**Filter it** with the tabs — **Needs a look** is failed and stopped runs together, which is usually what you came for.\n\n**Click any run** to see every step in the order it ran, each with what happened to it. A step that was skipped says why in plain language — \"this customer unsubscribed on 12 July, so we didn't email them\". A step that failed says what to fix. Expand **Details** on a step to see what it actually tried to do after your variables were filled in — that's where a mail merge that came out blank becomes obvious.\n\n**Waiting isn't failed.** A run sitting on **Waiting** is paused at a Wait step and tells you when it carries on. It survives restarts, so leave it be.\n\n**Stopped isn't failed either.** That's a Stop step doing its job — \"this invoice is already paid, stop chasing it\".\n\nThe filter and the open run are both in the page address, so you can copy the link and send someone the exact run you're looking at.",
  },
  {
    id: "automations-overdue-chasing",
    category: "general",
    keywords: [
      "chase overdue invoice",
      "invoice reminder automation",
      "overdue automation",
      "payment reminder",
      "days overdue",
      "chase sequence",
    ],
    question: "Can I automatically chase overdue invoices?",
    answer:
      "Yes. Build an automation starting with the **Invoice Overdue** trigger.\n\n**Set \"Days overdue\"** to the exact day you want it to run — it fires when the invoice is that many days past due, not every day after. So a chase sequence is three separate automations, or three triggers: one at **1** day, one at **7**, one at **14**, each with its own message.\n\nLeave the days field empty and it fires on the first day only.\n\n**\"Only invoices of at least\"** skips small balances, so you're not chasing someone for $12.\n\n**What counts as overdue:** past its due date and not settled. Part-paid invoices count — someone who paid half and stopped is exactly who you want to chase. Draft and voided invoices never do.\n\n**Timing:** checked hourly against your own timezone, so it fires shortly after the due date passes rather than at midnight somewhere else. It runs at most once per invoice per day, so you won't double-send.\n\nThis is separate from the built-in overdue reminder emails in Settings — turning those off doesn't affect your automations, and vice versa.",
  },
  {
    id: "automations-templates",
    category: "general",
    keywords: [
      "automation template",
      "ready made automation",
      "template gallery",
      "where do i start automation",
      "example automation",
      "start from template",
    ],
    question: "I don't know where to start with automations",
    answer:
      "Start with a template. Click **New automation** on the Automations page and you'll get a list of ready-made ones you can use as they are:\n\n• **Chase overdue invoices** — three reminders, gentle at 1 day, firmer at 7, direct at 14. Anyone who pays stops hearing from it.\n• **Ask for a review after the job** — waits three working days after you mark a job complete, then asks.\n• **Follow up an accepted quote** — confirms it straight away and flags the big ones for a personal call.\n• **Know about new bookings** — a notification the moment somebody books through your website.\n• **Welcome a new customer** — a short hello, so the first email they get from you isn't an invoice.\n\n**Nothing sends when you add one.** It opens in the builder as a draft, switched off. Read what it will send, change any wording you like, then Publish and switch it on.\n\nEvery step can be changed or removed, and you can add your own. If you'd rather build from scratch, **Start from blank** is at the bottom of the list.\n\nA template already added shows **Already added** — you can still add a second copy if you want two versions.",
  },
  {
    id: "automations-version-history",
    category: "general",
    keywords: [
      "undo automation",
      "automation version",
      "revert automation",
      "restore automation",
      "i broke my automation",
      "previous version",
      "version history",
    ],
    question: "I changed an automation and broke it — can I go back?",
    answer:
      "Yes. Open the automation and click the **versions icon** in the toolbar, next to the run history clock.\n\nEvery time you publish, a version is saved. The one currently running is marked **Live** — note that isn't always the highest number, since restoring an older one and publishing it makes that the live one.\n\nClick **Restore** on any version and it comes back onto your canvas.\n\n**Two things to know:**\n\n• **Restoring doesn't change what's running.** It puts the old version on your canvas so you can look at it. Press **Publish** when you're happy, and that's when it goes live.\n• **It replaces what's on your canvas now**, saved or not. You'll be asked to confirm first.\n\nPublishing a restored version creates a **new** version rather than rewriting the old one, so the history stays a true record of what was live and when.\n\nRuns already in progress finish on the version they started with — restoring never disturbs them.",
  },
  {
    id: "automations-history-retention",
    category: "general",
    keywords: [
      "how long is run history kept",
      "old runs missing",
      "automation history disappeared",
      "run history gone",
      "automation records deleted",
    ],
    question: "How long is automation run history kept?",
    answer:
      "**90 days.** After that, finished runs are removed to keep things fast — so an automation that last ran months ago will show an empty history even though it worked.\n\n**What is never removed on age:**\n\n• **Runs still waiting.** A three-month Wait step is a run in progress, not old history, and it carries on as normal.\n• **The version that's live**, and your ten most recent versions, so you can always go back.\n\nAnything an automation actually *did* stays where it belongs — a note added to a customer, an email that was sent, a job that was moved. Only the log of the run itself is cleaned up.",
  },
  {
    id: "general-capabilities",
    category: "general",
    keywords: ["what can you do", "help", "capabilities", "features", "chatbot", "assistant"],
    question: "What can you help me with?",
    answer:
      "I can help in two ways:\n\n**Ask questions** — Ask me how to use any feature: jobs, customers, invoices, quotes, bookings, schedule, equipment, catalog, checklists, settings, notifications, team management, and more.\n\n**Quick actions** — I can create things for you:\n• \"Create customer name: John Smith, phone: 555-1234, email: john@email.com\"\n• \"Create an event tomorrow at 3PM for team meeting\"\n• \"Create a job for John Smith, repair, tomorrow\"\n• \"Create an invoice for John Smith\"\n• \"Create a quote for Jane Doe\"\n• \"Add catalog item: Filter, $25, parts\"\n• \"Add equipment for John: Unit Type A, Brand X\"\n• \"Book a service for John, repair, next Monday\"",
  },
  {
    id: "general-dark-mode",
    category: "general",
    keywords: ["dark mode", "light mode", "theme", "toggle", "appearance", "night"],
    question: "How do I switch between dark and light mode?",
    answer:
      "Click the **theme toggle** button in the top-right navbar (sun/moon icon). It switches between light mode, dark mode, and system default. Your preference is saved automatically.",
  },
  {
    id: "general-search",
    category: "general",
    keywords: ["search", "find", "look up", "lookup", "filter"],
    question: "How do I search for things in the app?",
    answer:
      "Every list page (Customers, Jobs, Invoices, Quotes, Bookings, Assets, Catalog) has a **search bar** at the top. Type to search — results update in real-time. You can also use **filter buttons** next to the search bar to narrow by status, type, priority, and more.",
  },

  // ═══════════════════════════════════════
  // ── Dashboard ──
  // ═══════════════════════════════════════
  {
    id: "dashboard-overview",
    category: "dashboard",
    keywords: ["dashboard", "home", "overview", "stats", "metrics", "kpi"],
    question: "What does the dashboard show?",
    answer:
      "The **Dashboard** is your home page. Six panels are shown by default:\n\n• **Overdue Alert** — A banner when any invoice is past its due date\n• **KPI Pills** — Jobs today (with an emergency count), total outstanding across unpaid invoices, and quote conversion rate\n• **Agenda** — Events, jobs, and bookings for the next 7 days with real start/end times. Hover any row for a detail preview\n• **Revenue Chart** — Area chart with **1D / 1W / 1M / 6M / 1Y / ALL** tabs\n• **Invoice Aging** — Current / 1-30 / 31-60 / 61-90 / 90+ days outstanding, with $ per bucket. Click a bucket to open the matching invoices\n• **Jobs Management** — Status / Priority / Service tabs, plus a pipeline selector. Click a bucket to open those jobs\n\nFour more are available under **Customize Widget**: Quote Funnel, Retention Rate, Revenue by Service, Top Customers, and the Activity Feed.\n\n**Ask AI** opens this chatbot. Archived jobs are excluded from every count.",
  },
  {
    id: "dashboard-customize",
    category: "dashboard",
    keywords: ["customize", "hide", "show", "widget", "layout", "personalize", "preferences"],
    question: "Can I customize the dashboard?",
    answer:
      "Yes. Click **Customize Widget** in the dashboard toolbar for a toggle list of all eleven widgets. Six are on by default (overdue alert, KPI pills, agenda, revenue chart, invoice aging, jobs management); the more analytical ones — quote funnel, retention rate, revenue by service, top customers, activity feed — are off until you turn them on. Your choices are saved in this browser and survive reloads. Click **Reset** to restore defaults.",
  },
  {
    id: "dashboard-date-range",
    category: "dashboard",
    keywords: ["date range", "period", "filter", "picker", "window", "badge", "timezone"],
    question: "Which dashboard widgets follow the date range picker?",
    answer:
      "Only some of them, and the ones that don't say so on the card.\n\n**Follow the picker:** Revenue chart (both the collected and the billed figure), Jobs Management, Quote Funnel, Revenue by Service, Top Customers.\n\n**Fixed window** (marked with a small grey badge): Agenda and Week Ahead (*next 7 days*), Invoice Aging and Outstanding (*All open*), Active Customers (*Last 90 days*), Retention Rate (*Last 6 months*), Activity Feed (*Latest 10*), and Jobs Today (always today).\n\nYour selection is **remembered exactly** — come back tomorrow, next week or next month and the dashboard opens on the same range you left it on, until you change it yourself. That applies to shortcuts too: clicking *Last 7 days* picks those seven days, it doesn't sign you up for a window that keeps sliding forward.\n\n\"Today\" is calculated in your business timezone from **Settings → Business**, not the server's — so the dashboard rolls over at midnight where you are.",
  },
  {
    id: "dashboard-revenue-range",
    category: "dashboard",
    keywords: ["revenue", "1d", "1w", "1m", "6m", "1y", "all", "range", "granularity", "chart"],
    question: "How do the 1D/1W/1M/6M/1Y/ALL tabs on the revenue chart work?",
    answer:
      "Those tabs change **both** the date range *and* the chart granularity at once:\n\n• **1D** — Today, daily bucket\n• **1W** — Last 7 days, daily buckets\n• **1M** — Last 30 days, daily buckets\n• **6M** — Last 6 months, weekly buckets\n• **1Y** — Last 12 months, monthly buckets\n• **ALL** — Last 3 years, monthly buckets\n\nThe big revenue figure and the chart always cover exactly the same window, so the number matches the area you see. Widgets marked with a grey badge (Agenda, Invoice Aging, Retention) keep their own fixed window.\n\nEach tab is a shortcut for **setting** a range, not a live subscription to one: pick 1W today and it stays on today's seven days next time you open the dashboard, rather than sliding forward on its own.",
  },
  {
    id: "dashboard-billed-vs-collected",
    category: "dashboard",
    keywords: ["billed", "collected", "revenue chart", "dashed line", "outstanding", "gap", "cash"],
    question: "What is the dashed line on the revenue chart?",
    answer:
      "That's **Billed** — the face value of the invoices you issued in each period. The filled orange area is **Collected** — the cash that actually arrived.\n\nThey are two different events, which is the point: the space between the dashed line and the filled area is work you have invoiced but not been paid for. Hover any point to see both figures and what is still outstanding.\n\nBilled leaves out **draft** and **void** invoices — a draft has never been sent to anyone, and a void was withdrawn — so it only counts money someone actually owes you.",
  },
  {
    id: "dashboard-week-ahead",
    category: "dashboard",
    keywords: ["week ahead", "capacity", "busy", "load", "free day", "schedule", "strip"],
    question: "What does the Week Ahead strip show?",
    answer:
      "One column per day for the coming week, stacked by what is on it: **jobs** (orange), **bookings** (teal) and **calendar events** (indigo). Today's column is outlined.\n\nIt answers what a list cannot — which day is stacked up and which day is empty. The header names your busiest day and counts the days still open. Hover a column for the breakdown, or click it to open the schedule.\n\nThe Agenda beside it lists the same items in time order, entry by entry.",
  },
  {
    id: "where-are-create-buttons",
    category: "dashboard",
    keywords: ["quick action", "shortcut", "new job", "create", "add button", "where"],
    question: "Where do I create a new job, customer or invoice?",
    answer:
      "Each page has its own create button, next to the search box on that page's list:\n\n• **New Job** — Jobs page toolbar\n• **Add Customer** — Customers page, beside the search box\n• **New Invoice** — Invoices page, beside the search box\n• **New Quote** — Quotes page, beside the search box\n• **Add Agreement**, **Add Item**, **New Template** — same place on their own pages\n\nThe top bar keeps only the date range picker, on Dashboard and Reports, because that setting governs the whole page. Buttons that create something sit next to the thing they create.",
  },

  // ═══════════════════════════════════════
  // ── Reports ──
  // ═══════════════════════════════════════
  {
    id: "reports-overview",
    category: "reports",
    keywords: ["report", "reports", "analytics", "analyse", "analyze", "insight", "trend", "chart"],
    question: "What's on the Reports page?",
    answer:
      "**Reports** (sidebar) has five tabs, each covering one part of the business over whatever date range you pick:\n\n• **Revenue** — Trend vs the previous period, revenue by service type and payment method, average job value, collection rate, top customers\n• **Jobs** — Volume over time, breakdowns by status / priority / service type, pipeline distribution, average completion time\n• **Customers** — New customers over time, active vs inactive, repeat vs one-time, top customers by job count\n• **Quotes & Invoices** — Quote conversion funnel, invoice status, aging, overdue trend, average days to payment\n• **Bookings** — Volume, service type, most popular days, booking-to-job conversion\n\nOnly the tab you're looking at is loaded, so switching tabs is quick. Customer names in the tables link straight through to that customer.",
  },
  {
    id: "reports-date-range",
    category: "reports",
    keywords: ["date range", "period", "quarter", "last month", "granularity", "day", "week", "month", "compare", "saved", "remember", "reset"],
    question: "How do I change the reporting period?",
    answer:
      "Use the **date range picker** at the top right. Presets include Today, Last 7 days, This month, Last month, Last 3 months, **This quarter**, **Last quarter**, Last 6 months, This year, **Last year**, Last 12 months and All time — or pick any custom range on the calendar.\n\n**Your selection sticks.** Reports remembers it in this browser and shows you the same window next visit, and it stays put until you change it — a preset is resolved to real dates the moment you click it, so \"Last 7 days\" stays those seven days rather than sliding forward. Clear the range to go back to the default period. Reports keeps its own range, separate from the Dashboard's.\n\nThe chart grouping adjusts itself to the range: **daily** bars for a month or less, **weekly** up to about four months, **monthly** beyond that. The subtitle under the page title always tells you the exact window and grouping being shown.\n\n\"Today\" is resolved in your business timezone from **Settings → Business**, not your browser's.",
  },
  {
    id: "reports-previous-period",
    category: "reports",
    keywords: ["previous period", "comparison", "vs", "compare", "dashed line", "trend line", "growth"],
    question: "What is the \"previous period\" line comparing against?",
    answer:
      "The dashed line on the Revenue trend is the **same length of time immediately before** the range you selected — so \"Last month\" compares against the month before it, point for point. The exact comparison window is printed in the page subtitle and in the CSV export header.\n\nIf a point has no counterpart in the earlier period the line simply stops there rather than dropping to zero.\n\nThe **New** badge on a KPI means there was nothing at all in the previous period — that isn't a \"+100%\" increase, it's the first of something.",
  },
  {
    id: "reports-export",
    category: "reports",
    keywords: ["export", "csv", "download", "excel", "spreadsheet", "accountant", "share"],
    question: "How do I export a report?",
    answer:
      "Click **Export** at the top right of the Reports page. You get a CSV of **every** chart and table on the tab you're viewing — not just what's on screen — with a header block recording the period, the comparison period and the grouping.\n\nThe filename includes the date range (for example `revenue-report-2026-01-01_to_2026-03-31.csv`), so exporting two different periods on the same day gives you two clearly-named files.\n\nThe file opens correctly in Excel, Google Sheets and Numbers, including accented names.",
  },
  {
    id: "reports-vs-dashboard",
    category: "reports",
    keywords: ["difference", "dashboard vs reports", "archived", "which page", "numbers don't match"],
    question: "What's the difference between the Dashboard and Reports?",
    answer:
      "**Dashboard** answers *what needs doing today* — fixed, operational windows. **Reports** answers *how did we do over a period* — any date range, with period-over-period comparison and CSV export.\n\nBoth read the same underlying data and follow the same counting rules:\n\n• **Archived** jobs, bookings, customers, invoices and quotes are excluded from every count, so the totals match the list pages\n• **Payments you've already received are always counted**, even if the invoice was later archived — archiving hides a document, it doesn't un-collect the money\n• An invoice is **overdue** when its due date has passed and it isn't fully paid\n\nIf a report fails to load you'll see an error with a **Try again** button — an empty chart always means there genuinely was no activity.",
  },


  // ═══════════════════════════════════════
  // ── Job Costing & Profitability ──
  // ═══════════════════════════════════════
  {
    id: "costing-overview",
    category: "jobs",
    keywords: ["cost", "costing", "margin", "profit", "profitability", "make money", "markup", "made on this job"],
    question: "How do I see what a job actually made me?",
    answer:
      "Open any job and go to the **Costs** tab. It shows what you charged, what the work cost, and the margin between them.\n\nThe cost side has three parts:\n\n• **Parts & materials** — the cost of each line item, from your catalog or typed on the line\n• **Time on site** — the hours you record, priced at your labour cost rate\n• **Expenses** — anything no line item covers: a parts run, a subcontractor, a permit fee\n\nRevenue is what you **invoiced** for the job. If there's no invoice yet, the job's own total stands in and the tab says so.",
  },
  {
    id: "costing-provisional",
    category: "jobs",
    keywords: ["provisional", "incomplete", "not proven", "hatched", "missing cost", "why no margin", "estimate"],
    question: "Why does my margin say it's provisional?",
    answer:
      "Because part of the cost side hasn't been entered, so the margin can't be stated as fact.\n\nA missing cost doesn't make a job cheaper — it makes the total **unknown**. If we filled the gap with zero, an uncosted job would look like pure profit, which is the one thing a costing tool must never do.\n\nThe Costs tab lists exactly what's missing, and the bar shows the margin hatched rather than solid until it's complete. Usually it's one of:\n\n• A line item with no cost set — add one on the **Line Items** tab, or set the cost on the catalog item so it fills in automatically next time\n• No hours recorded — enter them under **Time on site**\n• No labour cost rate — set one in **Settings → Business**, or per person in **Settings → Team**",
  },
  {
    id: "costing-expenses",
    category: "jobs",
    keywords: ["expense", "expenses", "receipt", "subcontractor", "permit", "fuel", "rental", "extra cost"],
    question: "How do I add an expense to a job?",
    answer:
      "On the job's **Costs** tab, click **Add expense**. Give it a description, a category, the date and the amount — a supplier is optional.\n\nCategories: Materials, Subcontractor, Permits & fees, Fuel & travel, Equipment rental, Other.\n\nExpenses come straight off the job's margin. They're for costs no line item accounts for, so you don't double-count anything you already billed as a line.",
  },
  {
    id: "costing-labor-rate",
    category: "settings",
    keywords: ["labour rate", "labor rate", "hourly cost", "cost rate", "what an hour costs", "wage", "burden", "overhead"],
    question: "What is the labour cost rate, and where do I set it?",
    answer:
      "It's what an hour of work **costs you** — wages plus overhead — not what you charge the customer. It's what turns hours on a job into a cost.\n\nSet a business-wide default in **Settings → Business**. To give one person a different rate, use **Settings → Team → Cost Rates**; anyone without their own rate uses the default.\n\nWhen you save hours on a job, the rate is **copied onto that job**. Giving somebody a raise later changes future jobs only — it never rewrites margins you've already reported.\n\nLeaving it blank is allowed. Jobs then report labour as a missing input rather than as free.",
  },
  {
    id: "costing-catalog-cost",
    category: "catalog",
    keywords: ["item cost", "unit cost", "what it costs me", "buy price", "wholesale", "supplier price"],
    question: "Can I record what a catalog item costs me?",
    answer:
      "Yes — each catalog item has a **Your cost** field alongside its price. Fill it in and every job that uses the item picks up that cost automatically, so margins work without extra typing.\n\nYou can still change the cost on an individual job line: a supplier price that moved this week belongs on that job, not on the catalog record.\n\nLeaving it blank is fine, but jobs using the item will report an incomplete margin. The catalog table marks uncosted items as **no cost** so you can see what's left to fill in.",
  },
  {
    id: "reports-profitability",
    category: "reports",
    keywords: ["profitability", "margin report", "which jobs make money", "most profitable", "losing money", "by customer", "by assignee"],
    question: "What's on the Profitability tab?",
    answer:
      "It answers *what did we keep* over the period, grouped four ways:\n\n• **Thinnest margins** — the jobs where least of what you charged stayed with you. Click one to open it\n• **By service type** — which kinds of work pay\n• **By customer** — your biggest accounts, and what they leave behind\n• **By assignee** — what each person's work returns once their time is costed\n\nA job counts here when it was **completed** in the range, whatever day it was scheduled.\n\n**Jobs with incomplete costs are left out of the figures**, and the page tells you how many. Including them would treat the missing costs as free and make every margin look better than it is. Open a job's Costs tab to see what it's missing.\n\nIf you haven't set any costs yet, the tab shows you the two things to set up instead of a made-up number.",
  },
  // ═══════════════════════════════════════
  // ── Customers ──
  // ═══════════════════════════════════════
  {
    id: "customers-create",
    category: "customers",
    keywords: ["create", "add", "new", "customer", "client", "contact"],
    question: "How do I add a new customer?",
    answer:
      'Go to **Customers** in the sidebar. Click **"+ New Customer"** in the toolbar. Enter at least a first and last name. You can also add email, phone, address, city, state, and zip code.\n\nOr use the chatbot: say "Create customer name: John Smith, phone: 555-1234, email: john@email.com".',
  },
  {
    id: "customers-detail",
    category: "customers",
    keywords: ["detail", "view", "profile", "info", "customer page", "edit", "inline"],
    question: "How do I view and edit customer details?",
    answer:
      "Click a **customer name** in the list to open their detail page. You'll see:\n\n• **Header** — Name, phone, email and address. Click any of them to **edit inline**; invalid emails and phone numbers are rejected before saving\n• **Summary line** — Total jobs, outstanding balance, lifetime value and last job date\n• **Quick actions** — New Job, New Quote, New Invoice, all pre-filled with this customer\n• **Tabs** — Overview, Jobs, Invoices, Quotes, Assets, Agreements, Photos, Messages, Activity, Notes\n\nThe tab you're on is kept in the address bar, so you can bookmark or share a link straight to a customer's invoices.",
  },
  {
    id: "customers-notes",
    category: "customers",
    keywords: ["note", "notes", "comment", "write", "add note"],
    question: "How do I add notes to a customer?",
    answer:
      'There are two kinds:\n\n• **Notes tab** — dated entries, each stamped with the author. Use these for "called about the noise on 3 June". Write one in the box at the top and press **Add Note** (or Ctrl+Enter). You can edit or delete any of them; deleting asks for confirmation first.\n• **The Notes field in the customer dialog** — one always-visible note on the customer, for standing facts like a gate code or a preferred contact time.',
  },
  {
    id: "customers-tags",
    category: "customers",
    keywords: ["tag", "tags", "label", "categorize", "group"],
    question: "How do I tag customers?",
    answer:
      'Open a customer detail page and click **"Add Tag"** in the header. Pick an existing tag or type a new name to create one.\n\nTags show as chips on the **Customers** list, and **clicking a chip filters the list to everyone carrying that tag** — so they work for grouping by type ("VIP", "Commercial", "Residential") and pulling up that group later.',
  },
  {
    id: "customers-archive-delete",
    category: "customers",
    keywords: ["delete customer", "remove customer", "archive customer", "restore customer", "cannot delete"],
    question: "How do I archive or delete a customer?",
    answer:
      "**Archive** is what you usually want. It hides the customer from the Active tab without touching their history. Use the row menu or select several and click **Archive**. The **Archived** tab lists them, and each row has a **Restore** action.\n\n**Delete is permanent and is refused while the customer still has any job, invoice or quote — archived ones included.** The message tells you exactly what's blocking it. This is deliberate: jobs are linked to the customer, so deleting one would take its line items, photos and checklists with it.\n\nIf you delete several at once, anyone who is blocked is skipped and reported back to you — the toast says how many actually went through.",
  },
  {
    id: "customers-unsubscribe",
    category: "customers",
    keywords: [
      "unsubscribe",
      "opt out",
      "opted out",
      "stop emails",
      "marketing email",
      "email preferences",
      "resubscribe",
      "unsubscribed",
    ],
    question: "What happens when a customer unsubscribes?",
    answer:
      "Every marketing email you send carries an unsubscribe link in the footer, and one-click unsubscribe in Gmail and Outlook works too. When a customer uses it:\n\n• They stop receiving **review requests**, **contract renewal reminders**, and any automation step marked as *a marketing or follow-up message*\n• They **keep** receiving estimates, invoices, receipts and booking confirmations — those are about work they asked for, so they're not something to unsubscribe from\n• They also keep receiving automation steps marked *about a transaction they are party to*. An overdue invoice reminder still reaches somebody who unsubscribed, because it's about money they owe rather than marketing — that setting is on each Send email step and defaults to marketing\n\n**Where to see it:** an amber **Unsubscribed** badge appears next to their email address on the customer page, with the date. The **Unsubscribed** tab on the Customers list shows everyone you can no longer email.\n\n**Resubscribing** isn't a link they can click by accident — if a customer asks to start receiving emails again, that has to be done deliberately from their record.\n\nThis is per business: unsubscribing from you doesn't affect any other business using Zaxvio.",
  },
  {
    id: "customers-duplicates",
    category: "customers",
    keywords: ["duplicate customer", "same email", "two customers", "merge customer"],
    question: "What happens if two customers have the same email?",
    answer:
      "It's allowed — a couple sharing one address is normal — but when you type an email that's already in use, the dialog warns you and offers a link to open the existing customer instead.\n\nWorth heeding: when someone books through your public booking page, we match them to an existing customer **by email**. Two customers with the same address means the booking attaches to whichever one is found first, and that customer's history ends up split across two records.",
  },
  {
    id: "customers-search",
    category: "customers",
    keywords: ["search", "find", "filter", "look up", "customer search"],
    question: "How do I search for a customer?",
    answer:
      "On the **Customers** page, use the search bar at the top of the table. It searches first name, last name, **full name** (\"Jane Doe\" works), email and phone. Results update as you type.\n\nYou can also **sort** by clicking the Name, Email or Added column headers, and switch between the **Active** and **Archived** tabs.",
  },
  {
    id: "customers-stats",
    category: "customers",
    keywords: ["customer stats", "total customers", "customer count", "overview"],
    question: "How do I see customer statistics?",
    answer:
      "At the top of the **Customers** page, you'll see **stats cards** showing: Total Customers, Customers with Email, Customers with Phone, and Customers with Address.\n\nThese count **active** customers only — the same ones the table below shows — so archiving somebody changes both together.",
  },
  {
    id: "customers-jobs-tab",
    category: "customers",
    keywords: ["customer jobs", "job history", "customer work"],
    question: "How do I see all jobs for a customer?",
    answer:
      "Open the customer detail page and click the **Jobs** tab. It shows all jobs associated with that customer — you can see job number, status, scheduled date, and total amount. Click any job to open its detail page.",
  },
  {
    id: "customers-create-from-detail",
    category: "customers",
    keywords: ["create job from customer", "new job customer", "quick create"],
    question: "How do I create a job/invoice/quote from a customer page?",
    answer:
      'Open the customer detail page. In the right sidebar, you\'ll see quick action buttons:\n\n• **New Job** — Creates a job pre-filled with this customer\n• **New Quote** — Creates a quote pre-filled with this customer\n• **New Invoice** — Creates an invoice pre-filled with this customer',
  },

  // ═══════════════════════════════════════
  // ── Jobs ──
  // ═══════════════════════════════════════
  {
    id: "jobs-create",
    category: "jobs",
    keywords: ["create", "new", "add", "job", "work order", "service call", "make"],
    question: "How do I create a new job?",
    answer:
      'Go to **Jobs** in the sidebar. Click the **"+ New Job"** button in the toolbar. Fill in:\n\n• **Customer** (required) — Search and select\n• **Service Type** (required) — e.g., repair, maintenance, installation\n• **Title** (required) — Brief description\n• **Scheduled Date** (required)\n• **Priority** — Standard, Urgent, or Emergency\n• **Start/End Time**, **Address**, **Notes** (optional)\n\nThe job appears on your Kanban board in the first pipeline stage.',
  },
  {
    id: "jobs-kanban",
    category: "jobs",
    keywords: ["kanban", "board", "drag", "columns", "pipeline", "board view"],
    question: "How does the Kanban board work?",
    answer:
      "The **Kanban board** shows jobs as cards in columns (one per pipeline stage). You can:\n\n• **Switch pipelines** using the dropdown at the top (if you have multiple)\n• **Drag cards** between columns to change their status\n• **Click a card** to open the job detail sheet\n• Toggle between **compact** and **default** card sizes\n• Switch to **Table view** using the toggle in the toolbar\n\nEach column shows the count of **active** jobs in that stage — archived jobs are excluded.\n\n**Filter** by priority, service type or **assignee** with the funnel icon. If a pipeline holds more jobs than the board loads at once, a banner tells you how many are hidden — use a filter or the table view to reach the rest.",
  },
  {
    id: "jobs-table",
    category: "jobs",
    keywords: ["table", "list", "view", "sort", "job table"],
    question: "How do I view jobs in a table?",
    answer:
      'On the **Jobs** page, click the **Table** view toggle (next to Board). The table shows Job #, Customer, Title, Scheduled Date, Status, Priority, and Amount. Click any column header to sort. Click a row to open the job detail.',
  },
  {
    id: "jobs-status",
    category: "jobs",
    keywords: ["status", "move", "stage", "pipeline", "progress", "workflow"],
    question: "How do job statuses work?",
    answer:
      'Jobs move through **custom pipeline stages** on the Kanban board. Drag a card between columns, or open the job detail and use the **status dropdown**. You can also click the **"Move to [next stage]"** button in the detail page.\n\nMoves follow the stage\'s **type**: a *Scheduled* job can go to *In Progress* or *Cancelled*; an *In Progress* job can be *Completed* or *Cancelled*; *Completed* is final; a *Cancelled* job can be re-scheduled. Moving between two columns of the same type is always allowed. If a move is refused the board says why and puts the card back.\n\nCompleting a job — from the board, the detail page, or a bulk action — requires every **required** checklist item to be ticked, and sends the customer a completion email.\n\nCustomize your stages via **Manage Pipeline** (gear icon on Jobs page).',
  },
  {
    id: "jobs-pipeline-custom",
    category: "jobs",
    keywords: ["pipeline", "customize", "manage", "stages", "columns", "reorder", "color"],
    question: "How do I customize pipeline stages?",
    answer:
      'On the **Jobs** page, click the **gear icon** or **"Manage Pipeline"** button. In the dialog:\n\n• **Add stages** with a label, color, and **stage type**\n• **Drag to reorder** stages (uses drag-and-drop)\n• **Edit** stage label, color and type inline\n• **Delete** stages (only if no jobs are in that stage — archived jobs count too)\n\n**Stage type** tells the app what a job sitting in that column actually is: *Scheduled*, *In Progress*, *Completed* or *Cancelled*. Name a column anything you like — "Awaiting Parts", "Ready to Invoice" — and set its type so everything else behaves correctly. A column typed *Completed* will demand the required checklist items and email the customer; one typed *In Progress* will not. New stages default to *Scheduled*.\n\n8 color presets available: blue, brand, green, red, purple, amber, gray, teal.',
  },
  {
    id: "jobs-multi-pipeline",
    category: "jobs",
    keywords: ["multiple pipelines", "multi pipeline", "create pipeline", "pipeline settings", "different workflows"],
    question: "Can I have multiple pipelines?",
    answer:
      'Yes! Go to **Settings > Pipelines** to create multiple pipelines (e.g., "Residential", "Commercial", "Maintenance"). Each pipeline has its own set of stages. On the **Jobs** page, use the **pipeline dropdown** to switch between pipelines. New jobs are assigned to the currently selected pipeline. One pipeline is always marked as **default**.',
  },
  {
    id: "jobs-line-items",
    category: "jobs",
    keywords: ["line item", "parts", "labor", "cost", "price", "add item", "charge"],
    question: "How do I add line items to a job?",
    answer:
      'Open a job detail, go to the **Line Items** tab. Click **"Add Item"**:\n\n• Type a description manually, OR\n• Click **"From Catalog"** to pick from your service catalog (auto-fills price)\n• Set **quantity** and **unit price**\n\nSubtotal calculates automatically. Tax is applied based on the job\'s tax rate.',
  },
  {
    id: "jobs-checklist",
    category: "jobs",
    keywords: ["checklist", "template", "items", "complete", "check", "task list"],
    question: "How do checklists work on jobs?",
    answer:
      "When you create a job with a service type that has a **checklist template**, the checklist is automatically attached. Open the job and go to the **Checklist** tab:\n\n• Check off items as you complete them\n• Items linked to **catalog items** automatically add line items to the job when checked\n• A **progress bar** shows completion percentage\n• **Required items** are marked — all must be checked before completing the job",
  },
  {
    id: "jobs-photos",
    category: "jobs",
    keywords: ["photo", "photos", "image", "picture", "upload", "before after"],
    question: "How do I add photos to a job?",
    answer:
      'Open the job detail, go to the **Photos** tab. Click **"Add Photo"** to upload images. You can add a caption and timestamp. Photos are useful for before/after documentation.',
  },
  {
    id: "jobs-activity",
    category: "jobs",
    keywords: ["activity", "history", "timeline", "log", "job activity"],
    question: "How do I see job activity history?",
    answer:
      "Open the job detail, go to the **Activity** tab. It shows a timeline of all changes: status updates, line item additions, checklist completions, notes, and more. Each entry shows who made the change and when.",
  },
  {
    id: "jobs-complete",
    category: "jobs",
    keywords: ["complete", "finish", "done", "close", "mark complete"],
    question: "How do I complete a job?",
    answer:
      'Move the job to your completion stage on the Kanban board (drag it), or open the job detail and click **"Move to [next stage]"** or use the status dropdown. If the job has a **required checklist**, all required items must be checked first.',
  },
  {
    id: "jobs-filters",
    category: "jobs",
    keywords: ["filter", "priority", "service type", "search jobs"],
    question: "How do I filter jobs?",
    answer:
      "On the **Jobs** page toolbar:\n\n• **Search** — Type to search by job title or customer name\n• **Priority filter** — Show only standard, urgent, or emergency jobs\n• **Service type filter** — Filter by repair, maintenance, installation, etc.\n\nFilters work on both Board and Table views.",
  },
  {
    id: "jobs-stats",
    category: "jobs",
    keywords: ["job stats", "stats bar", "job count", "pipeline value"],
    question: "What do the stats at the top of the Jobs page show?",
    answer:
      "The **stats bar** at the top of the Jobs page shows: Total Jobs, Today's Jobs, Urgent/Emergency count, and total Pipeline Value (sum of all active job amounts).",
  },
  {
    id: "jobs-generate-invoice",
    category: "jobs",
    keywords: ["generate invoice", "job to invoice", "invoice from job", "bill job"],
    question: "How do I create an invoice from a job?",
    answer:
      'Open the job detail page. In the sidebar, click **"Generate Invoice"**. This creates a new invoice with the same customer, copies all line items, and applies the job\'s tax rate. The invoice starts in Draft status.',
  },
  {
    id: "jobs-calendar",
    category: "jobs",
    keywords: ["calendar", "schedule", "view", "drag", "reschedule", "week", "month", "day"],
    question: "How do I see jobs on the calendar?",
    answer:
      "Go to **Schedule** in the sidebar. Jobs with a scheduled date appear on the calendar as color-coded cards (by priority). You can:\n\n• **Switch views** — Month, Week, or Day\n• **Drag jobs** to reschedule them\n• **Click a job** to open its detail panel\n• **Filter** by priority or service type\n• **Toggle bookings** visibility on/off",
  },

  // ═══════════════════════════════════════
  // ── Invoices ──
  // ═══════════════════════════════════════
  {
    id: "invoices-create",
    category: "invoices",
    keywords: ["create", "new", "invoice", "bill", "generate", "make"],
    question: "How do I create an invoice?",
    answer:
      'Go to **Invoices** in the sidebar. Click **"+ New Invoice"**:\n\n• Select a **customer** (required)\n• Set **due date** and **tax rate**\n• Optionally add a **discount amount** and **notes**\n\nYou can also generate an invoice directly from a completed job (open job → **"Generate Invoice"** in the sidebar).',
  },
  {
    id: "invoices-statuses",
    category: "invoices",
    keywords: ["status", "draft", "sent", "paid", "overdue", "void", "invoice status"],
    question: "What are the invoice statuses?",
    answer:
      "Invoices follow this workflow:\n\n• **Draft** — Just created, fully editable. Line items, tax and discount can only be changed here\n• **Sent** — Emailed to the customer, waiting for payment\n• **Partially Paid** — Some payment received, balance remaining\n• **Paid** — Fully paid. Final — to reverse it, delete the payment\n• **Overdue** — Past its due date and not fully paid\n• **Void** — Cancelled. Final, and the PDF is watermarked VOID\n\n**Partially Paid and Paid are set by recording a payment**, not by changing the status by hand — that way the status can never disagree with the payments on file. **Overdue** is worked out from the due date every time it is shown, so it is correct the moment a due date passes.\n\nUse the **status filter** tabs at the top of the Invoices page to filter.",
  },
  {
    id: "invoices-send",
    category: "invoices",
    keywords: ["send", "email", "deliver", "invoice email"],
    question: "How do I send an invoice to a customer?",
    answer:
      'Open the invoice detail page and click **"Send Invoice"**. This emails the invoice PDF to the customer\'s email and changes the status from Draft to Sent. Make sure the customer has an **email address** on file.',
  },
  {
    id: "invoices-payment",
    category: "invoices",
    keywords: ["payment", "pay", "record", "receive", "paid", "track", "record payment"],
    question: "How do I record a payment?",
    answer:
      '**Paid in full?** Click **Mark paid** in the invoice header, or **"Mark paid in full"** on the Payments tab. One tap records a payment for exactly the balance.\n\n**Part payment?** Payments tab → **"Record partial payment"**:\n\n• Enter the **amount** — "1,000.00" and "$50" both work\n• Select **payment method** (cash, check, card, etc.)\n• Set the **payment date** — defaults to today in your business timezone\n• Optionally add a **reference number** and **notes**\n\nThe status updates automatically: **Partially Paid** if a balance remains, **Paid** if fully covered. If you take more than the balance, the extra is kept as a **credit on the invoice** rather than being thrown away.\n\n**Send an invoice before recording a payment against it** — a draft has never reached the customer, so a receipt for one would only confuse them. Removing a payment asks you to confirm first, then recalculates the balance and the status.',
  },
  {
    id: "invoices-pdf",
    category: "invoices",
    keywords: ["pdf", "download", "print", "document", "invoice pdf"],
    question: "How do I download an invoice PDF?",
    answer:
      'Open the invoice detail page and click **"Download PDF"**. The PDF includes: your business info, logo (if uploaded), customer details, line items with quantities and prices, subtotal, tax, discount, total, payment terms, payment instructions, terms & conditions, and custom footer message.',
  },
  {
    id: "invoices-line-items",
    category: "invoices",
    keywords: ["line item", "add item", "invoice item", "service", "parts"],
    question: "How do I add line items to an invoice?",
    answer:
      'Open the invoice detail (must be in **Draft** status). Go to the **Line Items** tab. Click **"Add Item"** — type a description or pick from your catalog. Set quantity and unit price. You can edit or remove items anytime while in Draft.',
  },
  {
    id: "invoices-void",
    category: "invoices",
    keywords: ["void", "cancel", "void invoice"],
    question: "How do I void an invoice?",
    answer:
      'Open the invoice and click **Void** — you will be asked to confirm, because voiding cannot be undone. A void invoice cannot be edited, sent or paid, and its PDF is re-issued with a **VOID** watermark so a customer holding an old link cannot mistake it for a bill. Any invoice that has not been paid can be voided.\n\nTo void several at once, tick them on the list and choose **Void** in the toolbar. Any that cannot be voided are reported back with the reason.',
  },
  {
    id: "invoices-sorting",
    category: "invoices",
    keywords: ["sort", "order", "column", "sort invoices", "filter invoices", "outstanding"],
    question: "Can I sort or filter the invoice list?",
    answer:
      "Yes. Click any column header — Invoice #, Status, Issued, Due, Total or Balance — to sort by it, and click again to reverse. The arrow shows which column is sorting.\n\nAbove the table: the **Active / Archived** toggle, **status tabs**, and search across invoice number, notes and customer name. The four KPI cards double as filters. Below them, **Outstanding** and **Overdue** show how much money is actually owed, not just how many documents there are.\n\nIf something goes wrong loading the page you'll see an error with a **Try again** button — an empty table always means there genuinely are no matching invoices.",
  },
  {
    id: "invoices-credit",
    category: "invoices",
    keywords: ["credit", "overpaid", "overpayment", "too much", "refund"],
    question: "What happens if a customer overpays?",
    answer:
      "The extra is held as a **credit on the invoice** and shown on the Payments tab, in the summary and on the PDF. Nothing is lost or quietly rounded away.\n\nWhen you type an amount larger than the balance the app warns you first, since it is usually a typo. If it was, remove the payment and record it again — the balance and status are recalculated either way.",
  },
  {
    id: "invoices-overdue",
    category: "invoices",
    keywords: ["overdue", "past due", "late", "overdue invoice", "reminder", "chase"],
    question: "How do I manage overdue invoices?",
    answer:
      'Overdue invoices are highlighted on the **Dashboard** with an amber alert banner, and the **Invoices** page shows an **Overdue** total in dollars beside Outstanding. Use the **Overdue** status filter to list them.\n\nReminder emails go out automatically, at most once a day per invoice — including to customers who paid part of the balance and then stopped. To chase someone **now**, open the invoice and click **Remind**. Archived invoices are never chased.\n\nAn invoice needs a **due date** before it can be overdue or reminded about. Set your **payment terms** in Settings → Invoices (e.g. "Net 30") and every new invoice gets its due date worked out for you.',
  },
  {
    id: "invoices-from-job",
    category: "invoices",
    keywords: ["from job", "generate", "convert", "job to invoice"],
    question: "How do I create an invoice from a job?",
    answer:
      'Open the job detail page and click **"Generate Invoice"** in the sidebar. This creates a new draft invoice with the same customer, copies all line items and quantities, and applies the job\'s tax rate.',
  },
  {
    id: "invoices-customize",
    category: "invoices",
    keywords: ["customize", "template", "invoice settings", "footer", "terms"],
    question: "How do I customize invoice templates?",
    answer:
      "Go to **Settings > Business**. Scroll to the invoice section to set:\n\n• **Payment terms** (e.g., Net 30)\n• **Payment instructions** (e.g., bank details)\n• **Terms & conditions**\n• **Footer message** (e.g., Thank you for your business)\n• **License number** (appears on PDF)\n\nAll are optional — if left blank, they won't appear on the PDF.",
  },

  // ═══════════════════════════════════════
  // ── Quotes ──
  // ═══════════════════════════════════════
  {
    id: "quotes-create",
    category: "quotes",
    keywords: ["create", "new", "quote", "estimate", "proposal", "bid"],
    question: "How do I create a quote?",
    answer:
      'Go to **Quotes** in the sidebar. Click **"+ New Quote"**:\n\n• Select a **customer** (required)\n• Set an **expiry date** (defaults to 30 days from now)\n• Set **tax rate** and optional **discount**\n• Add **notes**\n\nAfter creating, add line items in the detail page.',
  },
  {
    id: "quotes-statuses",
    category: "quotes",
    keywords: ["status", "draft", "sent", "accepted", "declined", "expired", "quote status"],
    question: "What are the quote statuses?",
    answer:
      "Quotes follow this workflow:\n\n• **Draft** — Just created, editable. Only drafts can be edited or deleted\n• **Sent** — Emailed to the customer with a PDF and a private acceptance link\n• **Accepted** — Customer accepted, online or by phone\n• **Declined** — Customer declined, optionally with a reason\n• **Expired** — Past the expiry date without a response\n\nA quote becomes **Sent** only by pressing Send — that's what generates the PDF and the customer's link — so the status can't be set directly, in bulk or otherwise. From Sent it can move to Accepted, Declined or Expired; those three are final.\n\nExpiry is judged in **your business timezone**, so a quote valid \"until the 1st\" stays live through the whole of the 1st where you are.",
  },
  {
    id: "quotes-convert",
    category: "quotes",
    keywords: ["convert", "accept", "job", "quote to job", "turn into"],
    question: "How do I convert a quote to a job?",
    answer:
      "Open the quote detail page and click **\"Convert to Job\"**. This:\n\n• Creates a new job with the same customer\n• Copies all line items and prices\n• Auto-attaches a checklist (if one exists for the service type)\n• If the quote was in \"Sent\" status, it is automatically marked as \"Accepted\"\n\nA confirmation dialog warns you before converting.",
  },
  {
    id: "quotes-send",
    category: "quotes",
    keywords: ["send", "email", "deliver", "quote email"],
    question: "How do I send a quote to a customer?",
    answer:
      'Open the quote detail page and click **"Send Quote"**. This generates the PDF, emails it to the customer, and gives them a private link where they can accept or decline online. The status changes from Draft to Sent, after which the quote can no longer be edited.\n\nIf you switch **online acceptance** off in Settings → Quotes, links you already sent stop working too — not just new ones.',
  },
  {
    id: "quotes-sort",
    category: "quotes",
    keywords: ["sort", "order", "sort quotes", "newest", "oldest"],
    question: "How do I sort quotes?",
    answer:
      "On the **Quotes** page, click the **sort button** in the toolbar. You can sort by: Date Created, Quote Number, Amount, Issued Date, Expiry Date, or Status. Toggle ascending/descending order.",
  },
  {
    id: "quotes-customize",
    category: "quotes",
    keywords: ["customize", "template", "quote settings", "footer", "terms"],
    question: "How do I customize quote templates?",
    answer:
      "Go to **Settings > Quotes** (under Documents group). Set:\n\n• **Terms & conditions** for quotes\n• **Footer message**\n• **Default validity period**\n\nIf no quote-specific settings are set, the system falls back to your invoice settings.",
  },

  // ═══════════════════════════════════════
  // ── Bookings ──
  // ═══════════════════════════════════════
  {
    id: "bookings-how",
    category: "bookings",
    keywords: ["booking", "book", "portal", "public", "online", "how"],
    question: "How do bookings work?",
    answer:
      "Customers book services through your **public booking portal** (a unique URL for your business). Each booking creates a request that appears on your **Bookings** page. You can:\n\n• **Review** booking details\n• **Confirm** the booking\n• **Convert to Job** to schedule it\n• **Cancel** to decline\n\nYour booking portal link is shown at the top of the Bookings page.",
  },
  {
    id: "bookings-portal",
    category: "bookings",
    keywords: ["portal", "link", "share", "booking url", "customer portal"],
    question: "How do I share my booking portal with customers?",
    answer:
      'Go to **Bookings** in the sidebar. At the top, you\'ll see your **Booking Portal Card** with your unique URL. Click **"Copy Link"** to copy it. You can share this link on your website, social media, or via email. Click **"Preview"** to see what customers see.',
  },
  {
    id: "bookings-manage",
    category: "bookings",
    keywords: ["manage", "view", "pending", "booking", "confirm"],
    question: "How do I manage incoming bookings?",
    answer:
      'Go to **Bookings** in the sidebar. You\'ll see all bookings with customer info, service type, and requested date. Use the **Active / Archived** tabs and the **status filter tabs** (Pending, Confirmed, Completed, Cancelled). Click a booking to view details.\n\n• **Confirm** — Accept the booking (emails the customer)\n• **Convert to Job** — Create a scheduled job from it\n• **Cancel** — Decline the booking (also emails the customer)\n\nSelect several with the checkboxes for bulk **Archive**, **Restore**, status changes or **Delete**.',
  },
  {
    id: "bookings-archive-vs-delete",
    category: "bookings",
    keywords: ["archive", "delete", "remove", "restore", "hide booking", "undo"],
    question: "Should I archive or delete a booking?",
    answer:
      "**Archive** in almost every case. It hides the booking from your active list and keeps everything — you can restore it any time from the **Archived** tab, and archived bookings stop counting toward your stat cards.\n\n**Delete** is permanent and cannot be undone. A booking that has already been **converted to a job** can't be deleted at all — that would leave the job with no record of where it came from. Archive it instead.",
  },
  {
    id: "bookings-convert",
    category: "bookings",
    keywords: ["convert", "booking to job", "create job from booking"],
    question: "How do I convert a booking to a job?",
    answer:
      'Open a booking and click **"Convert to Job"**. This creates a new job with the customer info, service type, and scheduled date from the booking, and you can pick which pipeline stage it lands in. If the booking came from an accepted quote, the quote\'s line items and totals are copied across too.\n\nOnce converted, the button is replaced by a link to the job, so a booking can only ever produce one job.',
  },
  {
    id: "bookings-reschedule",
    category: "bookings",
    keywords: ["reschedule", "change date", "move booking", "change time", "force"],
    question: "Can I change a booking's date or time?",
    answer:
      "Yes — open the booking and edit the date or time. The same rules the booking portal uses are checked first: the day has to be open, the time has to be on the hour and inside your working hours, and the slot must not already be full.\n\nIf you need to override that — squeezing someone in on a day you're closed, for example — the app will tell you what's blocking it and let you confirm anyway. Every reschedule is recorded in the booking's Activity timeline.",
  },
  {
    id: "bookings-activity",
    category: "bookings",
    keywords: ["activity", "history", "timeline", "who changed", "audit", "log"],
    question: "Can I see who confirmed or changed a booking?",
    answer:
      "Yes. Open any booking and scroll to **Activity** at the bottom of the panel. It lists every status change, reschedule, conversion and cancellation, newest first, with who did it and when.",
  },
  {
    id: "bookings-emails",
    category: "bookings",
    keywords: ["email", "confirmation", "notify customer", "cancellation email", "status page"],
    question: "What emails does a customer get about their booking?",
    answer:
      "Three, automatically:\n\n• **When they book** — a confirmation with the details, plus a link to a status page they can check any time\n• **When you confirm it** — an \"appointment confirmed\" email\n• **When you cancel it** — a cancellation notice with a link to book a new time\n\nYou also get an email whenever a new booking comes in.",
  },

  // ═══════════════════════════════════════
  // ── Schedule & Calendar ──
  // ═══════════════════════════════════════
  {
    id: "schedule-views",
    category: "schedule",
    keywords: ["view", "month", "week", "day", "calendar view", "switch"],
    question: "What calendar views are available?",
    answer:
      "The **Schedule** page offers three views:\n\n• **Month** — Overview of the entire month\n• **Week** — Default, shows most detail with time slots\n• **Day** — Detailed single-day view\n\nSwitch using the view buttons in the toolbar. Your preference is **saved automatically**.",
  },
  {
    id: "schedule-events",
    category: "schedule",
    keywords: ["event", "calendar", "create event", "appointment", "meeting", "reminder"],
    question: "How do I create a calendar event?",
    answer:
      'Go to **Schedule** in the sidebar. Click on any **empty time slot** to create a quick event. Fill in title, date, time, and optionally a contact name and color.\n\nOr use the chatbot: say "Create an event tomorrow at 3PM for team meeting".\n\nEvents are lightweight — for billable work, create a **Job** instead.',
  },
  {
    id: "schedule-drag",
    category: "schedule",
    keywords: ["drag", "reschedule", "move", "drop", "calendar drag"],
    question: "How do I reschedule a job on the calendar?",
    answer:
      "On the **Schedule** page, simply **drag a job card** to a new time slot or date. The scheduled date and time update automatically. Bookings are locked and cannot be dragged — open the booking to change its date or time.",
  },
  {
    id: "schedule-availability",
    category: "schedule",
    keywords: ["availability", "hours", "working hours", "business hours", "available"],
    question: "How do I set my availability?",
    answer:
      "Go to **Settings > Scheduling** (or click the availability button on the Bookings page). Set your **working hours** for each day of the week (Monday–Sunday). Time slots outside your availability appear **greyed out** on the calendar and are hidden from the booking portal.\n\nSaving takes effect on both straight away — your calendar and what customers can book always agree.",
  },
  {
    id: "schedule-capacity",
    category: "schedule",
    keywords: ["capacity", "two jobs", "same time", "overlap", "team", "double book", "concurrent"],
    question: "Can two appointments be booked at the same time?",
    answer:
      "By default no — one appointment per time slot. If you have more than one person on the road, go to **Settings > Scheduling** and raise **Booking Capacity** to the number of jobs you can run at once.\n\nA slot is offered to customers only when fewer than that many things overlap it, counting **bookings, jobs and calendar events** together — so a day you filled from phone calls won't be sold again through the portal.",
  },
  {
    id: "schedule-timezone",
    category: "schedule",
    keywords: ["timezone", "wrong time", "time zone", "travelling", "different times"],
    question: "Why does the calendar show a different day than my computer?",
    answer:
      "It shouldn't — the calendar uses your **business timezone** from **Settings → Business**, not your computer's. That's deliberate: if you're travelling, or your laptop's clock is set to somewhere else, your schedule still matches your customers' appointments and the dashboard agenda.\n\nIf the timezone itself looks wrong, change it in **Settings → Business**.",
  },
  {
    id: "schedule-overrides",
    category: "schedule",
    keywords: ["override", "holiday", "day off", "special hours", "exception"],
    question: "How do I set schedule overrides for holidays or special days?",
    answer:
      'Go to **Settings > Scheduling**. Below the weekly schedule, click **"Add Override"**. Set:\n\n• **Date** — The specific date\n• **Available** — Toggle on/off (off = day off)\n• **Custom hours** — If available, set special start/end times\n• **Reason** — Optional note (e.g., "Holiday", "Training day")\n\nOverrides take precedence over your weekly schedule.',
  },
  {
    id: "schedule-filters",
    category: "schedule",
    keywords: ["filter", "calendar filter", "priority", "bookings toggle"],
    question: "How do I filter what shows on the calendar?",
    answer:
      "On the **Schedule** page toolbar:\n\n• **Priority filter** — Show only certain priority jobs\n• **Service type filter** — Filter by service category\n• **Bookings toggle** — Show/hide booking entries\n\nFilters help you focus on specific types of work.",
  },
  {
    id: "schedule-event-colors",
    category: "schedule",
    keywords: ["color", "event color", "calendar colors", "priority color"],
    question: "What do the calendar colors mean?",
    answer:
      "Calendar items are color-coded:\n\n• **Blue** — Standard priority jobs\n• **Amber** — Urgent priority jobs\n• **Red** — Emergency priority jobs\n• **Teal/dashed** — Bookings (pending)\n• **Custom colors** — Calendar events (you choose: purple, blue, green, amber, red, teal)",
  },

  // ═══════════════════════════════════════
  // ── Catalog ──
  // ═══════════════════════════════════════
  {
    id: "catalog-manage",
    category: "catalog",
    keywords: ["catalog", "service catalog", "items", "prices", "parts", "labor", "manage"],
    question: "How do I manage my service catalog?",
    answer:
      'Go to **Catalog** in the sidebar. Here you manage all your reusable **parts, labor, and flat-rate items** with standard prices. These items can be quickly added to jobs, invoices, and quotes.\n\nClick **"+ New Item"** to add, or click any item to edit.',
  },
  {
    id: "catalog-create",
    category: "catalog",
    keywords: ["create", "add", "new", "catalog item", "part", "service item"],
    question: "How do I add a catalog item?",
    answer:
      'On the **Catalog** page, click **"+ New Item"**. Fill in:\n\n• **Name** (required) — e.g., "Diagnostic Fee", "Air Filter"\n• **Type** (required) — Parts, Labor, or Flat Rate\n• **Unit Price** (required) — Default price\n• **Unit** — Each, Hour, Foot, etc.\n• **Category** — Custom grouping (e.g., "Filters", "Labor Rates")\n• **Description** — Optional details',
  },
  {
    id: "catalog-archive",
    category: "catalog",
    keywords: ["archive", "inactive", "hide", "disable", "catalog archive"],
    question: "How do I archive or hide catalog items?",
    answer:
      'Click any catalog item to edit it, then toggle **"Archive"**. Archived items don\'t appear in line item pickers but remain in the system. Toggle **"Show Archived"** on the Catalog page to see and restore them.',
  },
  {
    id: "catalog-filters",
    category: "catalog",
    keywords: ["filter", "search", "category", "type", "catalog filter"],
    question: "How do I filter catalog items?",
    answer:
      "On the **Catalog** page:\n\n• **Search** — By name or description\n• **Type filter** — Parts, Labor, or Flat Rate\n• **Category filter** — Your custom categories\n• **Show Archived** — Toggle to include archived items",
  },

  // ═══════════════════════════════════════
  // ── Checklists ──
  // ═══════════════════════════════════════
  {
    id: "checklists-manage",
    category: "checklists",
    keywords: ["checklist", "template", "manage", "create template"],
    question: "How do I create checklist templates?",
    answer:
      'Go to **Checklists** in the sidebar. Click **"+ New Template"**. Set:\n\n• **Name** — Template name (e.g., "AC Maintenance Checklist")\n• **Service Type** — Which service type this applies to\n• **Active** — Toggle on/off\n• **Items** — Add checklist items, mark required ones, link to catalog items\n\nDrag items to reorder. Templates auto-attach to new jobs matching the service type.',
  },
  {
    id: "checklists-auto-attach",
    category: "checklists",
    keywords: ["auto attach", "automatic", "checklist job", "assign checklist"],
    question: "How do checklists automatically attach to jobs?",
    answer:
      "When you create a job with a **service type** that has an **active checklist template**, the checklist is automatically attached. The checklist appears in the job's **Checklist** tab. Items linked to catalog items will auto-add line items when checked.",
  },
  {
    id: "checklists-catalog-link",
    category: "checklists",
    keywords: ["catalog link", "auto line item", "checklist catalog"],
    question: "How do checklist items auto-add line items?",
    answer:
      'When creating a checklist template, you can **link items to catalog entries**. When a technician checks off that item on a job, the corresponding catalog item is **automatically added as a line item** to the job with its default price. This automates billing for standard procedures.',
  },

  // ═══════════════════════════════════════
  // ── Equipment / Assets ──
  // ═══════════════════════════════════════
  {
    id: "equipment-add",
    category: "equipment",
    keywords: ["equipment", "asset", "add", "unit", "machine", "device", "new equipment"],
    question: "How do I add equipment?",
    answer:
      'Go to **Assets** in the sidebar, or open a customer detail page → **Equipment** tab. Click **"+ Add Equipment"**. Enter:\n\n• **Customer** (required)\n• **Equipment Type** (required)\n• **Brand**, **Model**, **Serial Number**\n• **Install Date**, **Warranty Expiry**\n• **Location**, **Notes**\n\nEquipment can be linked to jobs for service history tracking.',
  },
  {
    id: "equipment-history",
    category: "equipment",
    keywords: ["history", "service history", "maintenance", "repairs", "track equipment"],
    question: "How do I track equipment service history?",
    answer:
      "Open any equipment/asset detail page (click from the **Assets** list or a customer's Equipment tab). The **Service History** section shows all jobs linked to that equipment. When creating a job, you can select the equipment being serviced.",
  },
  {
    id: "equipment-warranty",
    category: "equipment",
    keywords: ["warranty", "expiry", "warranty tracking"],
    question: "How do I track warranty dates?",
    answer:
      "When adding equipment, set the **Warranty Expiry** date. You can see warranty status on the asset detail page and in the assets list. This helps you know which equipment is still under warranty when scheduling service.",
  },
  {
    id: "equipment-refrigerant",
    category: "equipment",
    keywords: ["refrigerant", "log", "epa", "tracking", "refrigerant log"],
    question: "How do refrigerant logs work?",
    answer:
      'Open an equipment detail page. Click **"Add Refrigerant Log"** to record:\n\n• **Refrigerant Type** (e.g., R-410A)\n• **Action** (add, recover, reclaim)\n• **Quantity** and **Unit**\n• **Technician Name** and **EPA Cert Number**\n• **Linked Job** (optional)\n\nThis helps maintain EPA compliance records.',
  },

  // ═══════════════════════════════════════
  // ── Service Agreements ──
  // ═══════════════════════════════════════
  {
    id: "agreements-create",
    category: "service agreements",
    keywords: ["service agreement", "maintenance contract", "contract", "agreement", "recurring"],
    question: "How do I create a service agreement?",
    answer:
      'Go to **Service Agreements** in the sidebar. Click **"+ New Agreement"**:\n\n• **Customer** (required)\n• **Contract Name** (required)\n• **Start/End Dates** (required)\n• **Frequency** — Weekly, Monthly, Quarterly, Semi-Annual, or Annual\n• **Visits Per Year**\n• **Annual Price**\n• **Linked Equipment** (optional)\n• **Notes**',
  },
  {
    id: "agreements-manage",
    category: "service agreements",
    keywords: ["manage", "view", "active", "expired", "agreement list"],
    question: "How do I manage service agreements?",
    answer:
      "Go to **Service Agreements** in the sidebar. The list shows all agreements with customer name, contract name, frequency, annual price, and status. You can **edit**, **delete**, or toggle **active/inactive** status. Expiring agreements are flagged automatically.",
  },

  // ═══════════════════════════════════════
  // ── Notifications ──
  // ═══════════════════════════════════════
  {
    id: "notifications-bell",
    category: "notifications",
    keywords: ["notification", "bell", "alerts", "unread", "new notification"],
    question: "How do notifications work?",
    answer:
      "Click the **bell icon** in the top-right navbar. A dropdown shows your recent notifications with:\n\n• New bookings received\n• Job status changes\n• Invoice payments\n• Quote acceptances/declines\n• Team member joins\n\nUnread notifications show a **red badge** on the bell. Click a notification to navigate to the related item. Click **\"Mark all as read\"** to clear them.",
  },
  {
    id: "notifications-preferences",
    category: "notifications",
    keywords: ["notification preferences", "notification settings", "channels", "email notification"],
    question: "How do I customize notification preferences?",
    answer:
      "Go to **Settings > Notifications**. You'll see a grid of notification types and channels:\n\n• **In-App** — Shows in the bell dropdown\n• **Email** — Sends to your email\n• **SMS** / **Voice** — Coming soon (disabled)\n\nToggle each combination on/off. For example, you might want email for invoice payments but only in-app for booking requests.",
  },

  // ═══════════════════════════════════════
  // ── Team Management ──
  // ═══════════════════════════════════════
  {
    id: "team-invite",
    category: "team",
    keywords: ["team", "invite", "member", "add user", "colleague", "staff"],
    question: "How do I invite team members?",
    answer:
      'Go to **Settings > Team**. Click **"Invite Member"**:\n\n• Enter their **email address**\n• Select a **role**: Admin or Member\n• Click **Send Invitation**\n\nThey\'ll receive an email with a link to join. Invitations expire after 7 days. You can resend or cancel pending invitations.',
  },
  {
    id: "team-roles",
    category: "team",
    keywords: ["role", "admin", "member", "owner", "permissions", "access"],
    question: "What are the team roles?",
    answer:
      "Three roles with different permissions:\n\n• **Owner** — Full access, can manage billing, delete organization\n• **Admin** — Full access except billing and organization deletion. Can manage team, settings, and all features\n• **Member** — Day-to-day operations: manage jobs, customers, invoices, quotes. Cannot access team settings or billing\n\nSettings pages are **role-filtered** — Members don't see Business or Billing settings.",
  },
  {
    id: "team-manage",
    category: "team",
    keywords: ["remove member", "change role", "manage team"],
    question: "How do I manage existing team members?",
    answer:
      "Go to **Settings > Team**. The member list shows everyone with their name, email, role, and join date.\n\n• **Change role** — Use the role dropdown (Owner/Admin only)\n• **Remove member** — Click the remove button (requires confirmation)\n• **Pending invitations** — Shown separately with resend/cancel options",
  },

  // ═══════════════════════════════════════
  // ── Settings ──
  // ═══════════════════════════════════════
  {
    id: "settings-business",
    category: "settings",
    keywords: ["settings", "business", "profile", "company", "info", "logo"],
    question: "How do I update my business info?",
    answer:
      "Go to **Settings > Business**. Update:\n\n• **Business name**, **owner name**\n• **Email**, **phone**\n• **Address**, **city**, **state**, **zip**\n• **License number**\n• **Default tax rate** (auto-fills on new jobs/invoices)\n• **Logo** (appears on PDFs)\n• **Invoice customization** — Payment terms, instructions, T&C, footer\n• **Google review link** (for automated review requests)",
  },
  {
    id: "settings-profile",
    category: "settings",
    keywords: ["profile", "name", "email", "password", "avatar", "account"],
    question: "How do I update my profile?",
    answer:
      "Go to **Settings > Profile**. You can:\n\n• **Edit name** and **email**\n• **Upload avatar**\n• **Change password** — Enter current password, new password, and confirm. A strength indicator helps you choose a strong password.\n\nThe sidebar shows your role, organization, and membership date.",
  },
  {
    id: "settings-tax",
    category: "settings",
    keywords: ["tax", "tax rate", "default tax", "sales tax"],
    question: "How do I set a default tax rate?",
    answer:
      "Go to **Settings > Business**. Set the **Default Tax Rate** field (e.g., 0.08 for 8%). This rate auto-fills when creating new jobs, invoices, and quotes. You can still override it per item.",
  },
  {
    id: "settings-overview",
    category: "settings",
    keywords: ["settings", "all settings", "configuration", "settings page"],
    question: "What settings are available?",
    answer:
      "**Settings** is organized into groups:\n\n• **Account** — Profile (name, email, password, avatar)\n• **Organization** — Business info, Team management\n• **Documents** — Invoice templates, Quote templates\n• **Scheduling** — Availability hours, Schedule overrides\n• **Notifications** — Channel preferences per notification type\n\nAccess via the **Settings** item at the bottom of the sidebar.",
  },

  // ═══════════════════════════════════════
  // ── Troubleshooting & Tips ──
  // ═══════════════════════════════════════
  {
    id: "tips-line-items",
    category: "tips",
    keywords: ["line item", "catalog picker", "quick add", "from catalog"],
    question: "How do I quickly add line items from the catalog?",
    answer:
      'When adding line items to a job, invoice, or quote, click **"From Catalog"** (or the catalog icon). A picker shows your catalog items — click one to auto-fill the description, unit price, and type. You can adjust the quantity and price after adding.',
  },
  {
    id: "tips-keyboard",
    category: "tips",
    keywords: ["shortcut", "keyboard", "quick", "tips"],
    question: "Are there any tips for working faster?",
    answer:
      "Speed tips:\n\n• Use the **chatbot** (this!) to create customers, events, and jobs quickly\n• Create records from the button beside the search box on each page\n• **Drag jobs** on the calendar to reschedule\n• **Drag cards** on the Kanban board to change status\n• Use **catalog items** in line items for consistent pricing\n• Set a **default tax rate** to avoid typing it every time\n• Link **checklist items to catalog** for auto-billing",
  },
  {
    id: "tips-mobile",
    category: "tips",
    keywords: ["mobile", "phone", "responsive", "small screen"],
    question: "Can I use the app on my phone?",
    answer:
      "Yes! The app is fully responsive. On mobile:\n\n• The **sidebar** collapses into a hamburger menu\n• **Tables** adapt to smaller screens\n• The **chatbot** goes full-screen on mobile\n• **Calendar** works in all views but Week/Day are most useful on mobile\n\nAll features are available on mobile — nothing is desktop-only.",
  },
];

/** Search knowledge base for the best matching entry */
export function searchKnowledgeBase(query: string): KnowledgeEntry | null {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return null;

  let bestMatch: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of entries) {
    let score = 0;

    for (const word of words) {
      for (const keyword of entry.keywords) {
        if (keyword === word) {
          score += 3;
        } else if (keyword.includes(word) || word.includes(keyword)) {
          score += 1;
        }
      }
      if (entry.question.toLowerCase().includes(word)) {
        score += 0.5;
      }
    }

    const normalizedScore = score / Math.sqrt(entry.keywords.length);

    if (normalizedScore > 0 && (!bestMatch || normalizedScore > bestMatch.score)) {
      bestMatch = { entry, score: normalizedScore };
    }
  }

  if (bestMatch && bestMatch.score >= 1.5) {
    return bestMatch.entry;
  }

  return null;
}

/** Raw entries for AI system prompt context */
export { entries as KNOWLEDGE_BASE_ENTRIES };

/** Get all available categories */
export function getCategories(): string[] {
  return [...new Set(entries.map((e) => e.category))];
}
