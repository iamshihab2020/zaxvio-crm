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
      "Use the **sidebar** on the left to navigate. It's organized into groups:\n\n• **Dashboard** — Your home overview\n• **Conversations** — Send emails to customers, view message history\n• **Schedule** group — Calendar, Bookings\n• **Manage** group — Customers, Jobs\n• **Finance** group — Quotes, Invoices, Service Agreements\n• **Reference** group — Catalog, Checklists, Assets\n• **Settings** — at the bottom\n\nYou can collapse the sidebar by clicking the toggle at the top for more screen space.",
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
      "The **Dashboard** is your home page showing key business metrics:\n\n• **KPI Pills** — Jobs today, conversion rate, avg customer value — each with a trend vs previous period\n• **Revenue Chart** — Area chart with **1D / 1W / 1M / 6M / 1Y / ALL** tabs. Switching tabs changes the date range and granularity\n• **Jobs Management** — Segmented panel with Status / Priority / Service tabs (plus a pipeline selector if you have more than one)\n• **Retention Rate** — Monthly bar chart of repeat-customer rate\n• **Invoice Aging** — Current / 1-30 / 31-60 / 60+ days outstanding, with $ per bucket\n• **Quote Funnel** — Donut of accepted / declined / pending quotes with conversion %\n• **Revenue by Service** — Horizontal bars showing which service types drive the most revenue\n• **Top Customers** — Your top 5 by revenue in the selected range, with job counts\n• **Agenda** — Events, jobs, and bookings for the next 7 days, delivered with the rest of the dashboard in a single request. Hover any row for a rich detail preview\n• **Activity Feed** — Last 10 activities across jobs and quotes\n• **Ask AI** opens this chatbot · **Customize Widget** lets you show/hide any panel",
  },
  {
    id: "dashboard-customize",
    category: "dashboard",
    keywords: ["customize", "hide", "show", "widget", "layout", "personalize", "preferences"],
    question: "Can I customize the dashboard?",
    answer:
      "Yes. Click **Customize Widget** in the dashboard toolbar. You'll get a toggle list for every widget (KPI pills, revenue chart, jobs management, retention, agenda, overdue alert, activity feed). Flip switches off to hide panels — your choices are saved in this browser and survive reloads. Click **Reset** to restore defaults.",
  },
  {
    id: "dashboard-revenue-range",
    category: "dashboard",
    keywords: ["revenue", "1d", "1w", "1m", "6m", "1y", "all", "range", "granularity", "chart"],
    question: "How do the 1D/1W/1M/6M/1Y/ALL tabs on the revenue chart work?",
    answer:
      "Those tabs change **both** the date range *and* the chart granularity at once:\n\n• **1D** — Today, hourly/day bucket\n• **1W** — Last 7 days, daily buckets\n• **1M** — Last 30 days, daily buckets\n• **6M** — Last 6 months, weekly buckets\n• **1Y** — Last 12 months, monthly buckets\n• **ALL** — Last 3 years, monthly buckets\n\nThe whole dashboard (KPIs, jobs management, agenda) reflects the same range.",
  },
  {
    id: "dashboard-quick-actions",
    category: "dashboard",
    keywords: ["quick action", "shortcut", "new job", "dashboard button"],
    question: "What are the quick action buttons on the dashboard?",
    answer:
      "The dashboard has **4 quick action buttons** at the top:\n\n• **New Job** — Opens the create job dialog\n• **New Customer** — Opens the create customer dialog\n• **View Invoices** — Navigates to the invoices page\n• **View Schedule** — Navigates to the calendar/schedule page",
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
      "Click a **customer name** in the list to open their detail page. You'll see:\n\n• **Left panel** — Contact info. Click any field to **edit it inline** (name, email, phone, address)\n• **Tabs** — Activity, Notes, Jobs, Invoices, Quotes, Equipment, Agreements\n• **Right sidebar** — Quick action buttons (New Job, New Quote, New Invoice)\n• **Breadcrumb** — Navigate back to the customer list",
  },
  {
    id: "customers-notes",
    category: "customers",
    keywords: ["note", "notes", "comment", "write", "add note"],
    question: "How do I add notes to a customer?",
    answer:
      'Open the customer detail page, go to the **Notes** tab. Click **"Add Note"**, write your note, and save. Notes are timestamped with the author name. You can **edit** or **delete** any note later.',
  },
  {
    id: "customers-tags",
    category: "customers",
    keywords: ["tag", "tags", "label", "categorize", "group"],
    question: "How do I tag customers?",
    answer:
      'Open a customer detail page. In the info panel, click **"Add Tag"**. You can select an existing tag or create a new one. Tags are reusable across all customers — great for grouping by type (e.g., "VIP", "Commercial", "Residential").',
  },
  {
    id: "customers-search",
    category: "customers",
    keywords: ["search", "find", "filter", "look up", "customer search"],
    question: "How do I search for a customer?",
    answer:
      "On the **Customers** page, use the search bar at the top of the table. It searches by name, email, and phone number. Results update as you type (debounced for performance).",
  },
  {
    id: "customers-stats",
    category: "customers",
    keywords: ["customer stats", "total customers", "customer count", "overview"],
    question: "How do I see customer statistics?",
    answer:
      "At the top of the **Customers** page, you'll see **stats cards** showing: Total Customers, Customers with Email, Customers with Phone, and Customers with Address. Click a stat card to filter the table by that criteria.",
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
      "The **Kanban board** shows jobs as cards in columns (one per pipeline stage). You can:\n\n• **Switch pipelines** using the dropdown at the top (if you have multiple)\n• **Drag cards** between columns to change their status\n• **Click a card** to open the job detail sheet\n• Toggle between **compact** and **default** card sizes\n• Switch to **Table view** using the toggle in the toolbar\n\nEach column shows the count of jobs in that stage.",
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
      'Jobs move through **custom pipeline stages** on the Kanban board. Drag a card between columns, or open the job detail and use the **status dropdown**. You can also click **"Move to [next stage]"** button in the detail page.\n\nCustomize your stages via **Manage Pipeline** (gear icon on Jobs page).',
  },
  {
    id: "jobs-pipeline-custom",
    category: "jobs",
    keywords: ["pipeline", "customize", "manage", "stages", "columns", "reorder", "color"],
    question: "How do I customize pipeline stages?",
    answer:
      'On the **Jobs** page, click the **gear icon** or **"Manage Pipeline"** button. In the dialog:\n\n• **Add stages** with a name, label, and color\n• **Drag to reorder** stages (uses drag-and-drop)\n• **Edit** stage name and color inline\n• **Delete** stages (only if no jobs are in that stage)\n\n8 color presets available: blue, brand, green, red, purple, amber, gray, teal.',
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
      "Invoices follow this workflow:\n\n• **Draft** — Just created, editable\n• **Sent** — Emailed to customer, waiting for payment\n• **Partially Paid** — Some payment received, balance remaining\n• **Paid** — Fully paid\n• **Overdue** — Past due date, not fully paid\n• **Void** — Cancelled, cannot be changed\n\nUse the **status filter** tabs at the top of the Invoices page to filter.",
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
      'Open the invoice detail, go to the **Payments** tab. Click **"Record Payment"**:\n\n• Enter the **amount**\n• Select **payment method** (cash, check, card, etc.)\n• Set the **payment date**\n• Optionally add a **reference number** and **notes**\n\nThe invoice status updates automatically: **Partially Paid** if balance remains, or **Paid** if fully covered.',
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
      'Open the invoice detail page and click **"Void Invoice"** in the actions menu. Voided invoices cannot be edited or sent. This is for invoices that were created by mistake or are no longer needed.',
  },
  {
    id: "invoices-overdue",
    category: "invoices",
    keywords: ["overdue", "past due", "late", "overdue invoice"],
    question: "How do I manage overdue invoices?",
    answer:
      "Overdue invoices are highlighted on the **Dashboard** with an amber alert banner. On the **Invoices** page, use the **Overdue** status filter to see all overdue invoices. The system automatically checks for overdue invoices and sends reminder emails (if configured).",
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
      "Quotes follow this workflow:\n\n• **Draft** — Just created, editable\n• **Sent** — Emailed to customer\n• **Accepted** — Customer accepted the quote\n• **Declined** — Customer declined\n• **Expired** — Past the expiry date without a response\n\nQuotes auto-expire when their expiry date passes.",
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
      'Open the quote detail page and click **"Send Quote"**. This emails the quote PDF to the customer and changes the status from Draft to Sent. The customer has until the expiry date to respond.',
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
      'Go to **Bookings** in the sidebar. You\'ll see all bookings with customer info, service type, and requested date. Use **status filter tabs** (Pending, Confirmed, Completed, Cancelled). Click a booking to view details.\n\n• **Confirm** — Accept the booking\n• **Convert to Job** — Create a scheduled job from it\n• **Cancel** — Decline the booking',
  },
  {
    id: "bookings-convert",
    category: "bookings",
    keywords: ["convert", "booking to job", "create job from booking"],
    question: "How do I convert a booking to a job?",
    answer:
      'Open a booking and click **"Convert to Job"**. This creates a new job with the customer info, service type, and scheduled date from the booking. You can select which pipeline stage to place the job in.',
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
      "On the **Schedule** page, simply **drag a job card** to a new time slot or date. The scheduled date and time update automatically. You can also **resize** a job card to change its duration. Bookings are locked and cannot be dragged.",
  },
  {
    id: "schedule-availability",
    category: "schedule",
    keywords: ["availability", "hours", "working hours", "business hours", "available"],
    question: "How do I set my availability?",
    answer:
      "Go to **Settings > Scheduling** (or click the availability button on the Bookings page). Set your **working hours** for each day of the week (Monday–Sunday). Time slots outside your availability appear **greyed out** on the calendar and are hidden from the booking portal.",
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
      "Speed tips:\n\n• Use the **chatbot** (this!) to create customers, events, and jobs quickly\n• Use **quick actions** on the Dashboard for common tasks\n• **Drag jobs** on the calendar to reschedule\n• **Drag cards** on the Kanban board to change status\n• Use **catalog items** in line items for consistent pricing\n• Set a **default tax rate** to avoid typing it every time\n• Link **checklist items to catalog** for auto-billing",
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
