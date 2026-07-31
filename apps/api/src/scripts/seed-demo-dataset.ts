/**
 * The demo dataset, kept separate from the writer in seed-demo-data.ts.
 *
 * This file is pure data with no database access, so the rules that matter —
 * how invoice status is derived, how money is summed, how a stage maps to
 * `jobs.status` — all live in one place next to the inserts, and cannot be
 * quietly contradicted by a literal down here.
 *
 * The tenant is "Shihab Roofing Corp", so the content is roofing work. Nothing
 * about the platform is roofing-specific; only these strings are.
 *
 * All dates are RELATIVE, expressed in days from the moment the seed runs:
 * negative is the past, positive is booked ahead. That keeps a freshly seeded
 * tenant looking alive whenever it is run — jobs today, invoices ageing into
 * overdue, bookings next week.
 */

export type Money = number;

type ItemType = "labor" | "part" | "material" | "service_call" | "other";
type ServiceType =
  | "installation"
  | "repair"
  | "maintenance"
  | "inspection"
  | "emergency"
  | "consultation"
  | "other";
type Priority = "standard" | "urgent" | "emergency";
type Lifecycle = "scheduled" | "in_progress" | "completed";
type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
type PaymentMethod = "cash" | "check" | "credit_card" | "bank_transfer" | "other";
type Frequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";
type NotificationType =
  | "booking_received"
  | "booking_cancelled"
  | "job_status_changed"
  | "invoice_paid"
  | "customer_created"
  | "quote_accepted"
  | "quote_declined"
  | "invoice_overdue"
  | "team_member_joined"
  | "message_received";

interface Line {
  itemType: ItemType;
  description: string;
  quantity: number;
  unitPrice: Money;
  /** Links the line back to a catalog item by name, as the UI does. */
  catalog?: string;
}

/**
 * The shape is declared explicitly rather than inferred with `as const`.
 * `as const` turns every array into a tuple of literal object types, so a
 * property that only some members carry (`notes`, `catalog`, `convertedJob`)
 * is absent from the union and unreachable at the call site. Declaring the
 * element types keeps optional fields optional and still type-checks every
 * enum value against the database schema.
 */
interface Demo {
  tenant: {
    ownerName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    licenseNumber: string;
    defaultTaxRate: string;
    invoicePaymentTerms: string;
    invoicePaymentInstructions: string;
    invoiceTermsConditions: string;
    invoiceFooterMessage: string;
    quoteTermsConditions: string;
    quoteFooterMessage: string;
    googleReviewUrl: string;
    bookingSlotCapacity: number;
  };
  catalog: {
    name: string;
    itemType: ItemType;
    unitPrice: Money;
    unit: string;
    category: string;
    description: string;
  }[];
  tags: { name: string; color: string }[];
  customers: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    createdDaysAgo: number;
    tags: string[];
    notes?: string;
    archived?: boolean;
  }[];
  customerNotes: { customer: number; daysAgo: number; content: string }[];
  equipment: {
    customer: number;
    equipmentType: string;
    brand: string;
    model: string;
    serialNumber: string;
    installedDaysAgo: number;
    warrantyDaysAhead: number;
    location: string;
    notes?: string;
  }[];
  checklists: { serviceType: ServiceType; name: string; items: string[] }[];
  jobs: {
    customer: number;
    lifecycle: Lifecycle;
    priority: Priority;
    serviceType: ServiceType;
    title: string;
    description: string;
    dayOffset: number;
    start: string;
    end: string;
    lines: Line[];
    notes?: string;
  }[];
  invoices: {
    customer: number;
    job?: number;
    sent: boolean;
    void?: boolean;
    issuedDayOffset: number;
    dueDayOffset?: number;
    discount?: Money;
    lines: Line[];
    /**
     * A payment states its *intent*, not a pre-computed figure. `rest` settles
     * whatever is outstanding and `over` deliberately overpays by that much;
     * the writer resolves both against the total it just summed from the line
     * items. Hardcoding amounts here meant "paid in full" quietly became
     * "partially paid" the moment a unit price changed — and since invoice
     * status is derived from the payment rows, the seeded status would flip
     * with it.
     */
    payments: (
      | { amount: Money; method: PaymentMethod; dayOffset: number; reference?: string }
      | { rest: true; method: PaymentMethod; dayOffset: number; reference?: string }
      | { over: Money; method: PaymentMethod; dayOffset: number; reference?: string }
    )[];
    notes?: string;
  }[];
  quotes: {
    customer: number;
    status: QuoteStatus;
    job?: number;
    issuedDayOffset: number;
    lines: Line[];
    notes?: string;
    declineReason?: string;
  }[];
  bookings: {
    customer?: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    serviceType: ServiceType;
    dayOffset: number;
    time: string;
    address: string;
    description: string;
    status: BookingStatus;
    source: string;
    convertedJob?: number;
  }[];
  calendarEvents: {
    title: string;
    description: string;
    dayOffset: number;
    start: string;
    end: string;
    color: string;
    contactName?: string;
    address?: string;
  }[];
  contracts: {
    customer: number;
    name: string;
    startedDaysAgo: number;
    endsInDays: number;
    frequency: Frequency;
    visitsPerYear: number;
    annualPrice: Money;
    notes?: string;
  }[];
  dayOff: { dayOffset: number; reason: string }[];
  notifications: {
    type: NotificationType;
    title: string;
    description: string;
    daysAgo: number;
  }[];
}

export const DEMO: Demo = {
  tenant: {
    ownerName: "Shihab Hossain",
    phone: "(512) 555-0147",
    address: "2214 Burnet Road, Suite B",
    city: "Austin",
    state: "TX",
    zipCode: "78756",
    licenseNumber: "TX-RC-118422",
    /** numeric(5,4): 8.25% Austin sales tax. */
    defaultTaxRate: "0.0825",
    invoicePaymentTerms: "Net 15",
    invoicePaymentInstructions:
      "Pay online with the button above, or by check made out to Shihab Roofing Corp.",
    invoiceTermsConditions:
      "Balance is due within 15 days of the invoice date. Work is warranted for 5 years on labour and per manufacturer terms on materials.",
    invoiceFooterMessage: "Thanks for trusting us with your roof.",
    quoteTermsConditions:
      "Pricing holds for 30 days. Final cost may change if hidden decking damage is found once the old roof is stripped; we will call you before doing any extra work.",
    quoteFooterMessage:
      "Questions? Call (512) 555-0147 and ask for Shihab.",
    googleReviewUrl: "https://g.page/r/shihab-roofing-austin/review",
    bookingSlotCapacity: 2,
  },

  catalog: [
    { name: "Roof inspection", itemType: "service_call" as ItemType, unitPrice: 149, unit: "each", category: "Inspections", description: "Full roof and attic inspection with photo report." },
    { name: "Emergency tarp", itemType: "service_call" as ItemType, unitPrice: 385, unit: "each", category: "Emergency", description: "Same-day temporary weatherproofing after storm damage." },
    { name: "Roofing labour", itemType: "labor" as ItemType, unitPrice: 78, unit: "hour", category: "Labour", description: "Crew rate per person, per hour." },
    { name: "Architectural shingles", itemType: "material" as ItemType, unitPrice: 128, unit: "square", category: "Shingles", description: "30-year architectural asphalt shingle, per 100 sq ft." },
    { name: "Standing seam metal panel", itemType: "material" as ItemType, unitPrice: 412, unit: "square", category: "Metal", description: "24-gauge standing seam, per 100 sq ft." },
    { name: "Synthetic underlayment", itemType: "material" as ItemType, unitPrice: 62, unit: "roll", category: "Underlayment", description: "10-square synthetic underlayment roll." },
    { name: "Ice and water shield", itemType: "material" as ItemType, unitPrice: 94, unit: "roll", category: "Underlayment", description: "Self-adhering valley and eave membrane." },
    { name: "Ridge vent", itemType: "part" as ItemType, unitPrice: 21, unit: "foot", category: "Ventilation", description: "Continuous ridge ventilation." },
    { name: "Pipe boot flashing", itemType: "part" as ItemType, unitPrice: 34, unit: "each", category: "Flashing", description: "Lead pipe boot, sized to vent." },
    { name: "Step flashing", itemType: "part" as ItemType, unitPrice: 8, unit: "foot", category: "Flashing", description: "Galvanised step flashing at wall junctions." },
    { name: "Seamless gutter", itemType: "material" as ItemType, unitPrice: 12, unit: "foot", category: "Gutters", description: "5-inch seamless aluminium gutter, installed." },
    { name: "Gutter guard", itemType: "part" as ItemType, unitPrice: 9, unit: "foot", category: "Gutters", description: "Micro-mesh leaf guard." },
    { name: "Decking replacement", itemType: "material" as ItemType, unitPrice: 68, unit: "sheet", category: "Structure", description: "1/2-inch OSB sheet, replaced where rotten." },
    { name: "Skylight reseal", itemType: "service_call" as ItemType, unitPrice: 240, unit: "each", category: "Skylights", description: "Strip, reflash and reseal an existing skylight." },
    { name: "Debris haul-away", itemType: "other" as ItemType, unitPrice: 275, unit: "each", category: "Site", description: "Dumpster and disposal of tear-off waste." },
  ],

  tags: [
    { name: "Storm damage", color: "red" },
    { name: "Insurance claim", color: "amber" },
    { name: "Repeat customer", color: "green" },
    { name: "Commercial", color: "blue" },
    { name: "Referral", color: "violet" },
    { name: "Warranty", color: "gray" },
  ],

  customers: [
    { firstName: "Marcus", lastName: "Whitfield", email: "marcus.whitfield@example.com", phone: "(512) 555-0182", address: "4417 Ramsey Ave", city: "Austin", state: "TX", zipCode: "78756", createdDaysAgo: 240, tags: ["Repeat customer", "Referral"], notes: "Gate code 4417. Dog in the back yard — friendly but loud." },
    { firstName: "Priya", lastName: "Raghavan", email: "priya.raghavan@example.com", phone: "(512) 555-0193", address: "1208 Kinney Ave", city: "Austin", state: "TX", zipCode: "78704", createdDaysAgo: 198, tags: ["Storm damage", "Insurance claim"] },
    { firstName: "Daniel", lastName: "Okonkwo", email: "daniel.okonkwo@example.com", phone: "(512) 555-0164", address: "9302 Mountain Quail Rd", city: "Austin", state: "TX", zipCode: "78758", createdDaysAgo: 176, tags: ["Repeat customer"] },
    { firstName: "Bethany", lastName: "Cruz", email: "bethany.cruz@example.com", phone: "(512) 555-0119", address: "705 W Live Oak St", city: "Austin", state: "TX", zipCode: "78704", createdDaysAgo: 154, tags: ["Referral"] },
    { firstName: "Theo", lastName: "Lindqvist", email: "theo.lindqvist@example.com", phone: "(512) 555-0136", address: "3115 Duval St", city: "Austin", state: "TX", zipCode: "78705", createdDaysAgo: 131, tags: ["Warranty"] },
    { firstName: "Amara", lastName: "Bello", email: "amara.bello@example.com", phone: "(512) 555-0158", address: "6600 Manchaca Rd", city: "Austin", state: "TX", zipCode: "78745", createdDaysAgo: 118, tags: ["Storm damage"] },
    { firstName: "Jonah", lastName: "Pruitt", email: "jonah.pruitt@example.com", phone: "(512) 555-0127", address: "12400 Anderson Mill Rd", city: "Austin", state: "TX", zipCode: "78726", createdDaysAgo: 96, tags: ["Commercial"], notes: "Property manager for three buildings — bills to the LLC, not personally." },
    { firstName: "Renata", lastName: "Silva", email: "renata.silva@example.com", phone: "(512) 555-0171", address: "802 Bouldin Ave", city: "Austin", state: "TX", zipCode: "78704", createdDaysAgo: 74, tags: ["Insurance claim"] },
    { firstName: "Curtis", lastName: "Nakamura", email: "curtis.nakamura@example.com", phone: "(512) 555-0145", address: "5511 Balcones Dr", city: "Austin", state: "TX", zipCode: "78731", createdDaysAgo: 58, tags: ["Repeat customer", "Warranty"] },
    { firstName: "Yasmin", lastName: "Haddad", email: "yasmin.haddad@example.com", phone: "(512) 555-0188", address: "2019 E Cesar Chavez St", city: "Austin", state: "TX", zipCode: "78702", createdDaysAgo: 41, tags: ["Referral"] },
    { firstName: "Gregory", lastName: "Feldman", email: "gregory.feldman@example.com", phone: "(512) 555-0102", address: "8814 Bluffstone Cv", city: "Austin", state: "TX", zipCode: "78759", createdDaysAgo: 27, tags: ["Storm damage", "Insurance claim"] },
    { firstName: "Nadia", lastName: "Osei", email: "nadia.osei@example.com", phone: "(512) 555-0199", address: "1401 Alta Vista Ave", city: "Austin", state: "TX", zipCode: "78704", createdDaysAgo: 12, tags: [] },
    { firstName: "Harold", lastName: "Vance", email: "harold.vance@example.com", phone: "(512) 555-0110", address: "3320 Red River St", city: "Austin", state: "TX", zipCode: "78705", createdDaysAgo: 310, tags: [], archived: true, notes: "Sold the property in the spring. Archived." },
  ],

  customerNotes: [
    { customer: 0, daysAgo: 210, content: "Wants the same crew as last time. Prefers a call the evening before." },
    { customer: 1, daysAgo: 60, content: "Adjuster visit scheduled — she will forward the claim number once it comes through." },
    { customer: 3, daysAgo: 45, content: "Referred by the Whitfields. Mention the referral discount on the next quote." },
    { customer: 6, daysAgo: 80, content: "Invoices must be addressed to Pruitt Property Group LLC, not to Jonah personally." },
    { customer: 8, daysAgo: 30, content: "Still under the 5-year labour warranty from the 2023 re-roof." },
    { customer: 10, daysAgo: 20, content: "Hail on the north slope. Photos taken from the drone are on the job." },
  ],

  equipment: [
    { customer: 0, equipmentType: "Asphalt shingle roof", brand: "GAF", model: "Timberline HDZ", serialNumber: "GAF-HDZ-4417", installedDaysAgo: 1180, warrantyDaysAhead: 9000, location: "Main house", notes: "22 squares. North slope replaced after the 2023 hail." },
    { customer: 0, equipmentType: "Seamless gutters", brand: "Amerimax", model: "5in K-style", serialNumber: "AM-5K-4417", installedDaysAgo: 1180, warrantyDaysAhead: 2200, location: "Full perimeter" },
    { customer: 1, equipmentType: "Asphalt shingle roof", brand: "Owens Corning", model: "Duration", serialNumber: "OC-DUR-1208", installedDaysAgo: 2400, warrantyDaysAhead: 6000, location: "Main house", notes: "Storm damage on the west face — claim in progress." },
    { customer: 2, equipmentType: "Standing seam metal roof", brand: "McElroy", model: "Maxima", serialNumber: "MCE-MAX-9302", installedDaysAgo: 640, warrantyDaysAhead: 13000, location: "Main house + carport" },
    { customer: 4, equipmentType: "Skylight", brand: "VELUX", model: "FS C06", serialNumber: "VLX-FSC06-3115", installedDaysAgo: 420, warrantyDaysAhead: 3200, location: "Kitchen" },
    { customer: 6, equipmentType: "TPO flat roof", brand: "Carlisle", model: "Sure-Weld 60mil", serialNumber: "CAR-SW60-12400", installedDaysAgo: 900, warrantyDaysAhead: 6500, location: "Building A" },
    { customer: 6, equipmentType: "TPO flat roof", brand: "Carlisle", model: "Sure-Weld 60mil", serialNumber: "CAR-SW60-12401", installedDaysAgo: 900, warrantyDaysAhead: 6500, location: "Building B" },
    { customer: 8, equipmentType: "Asphalt shingle roof", brand: "CertainTeed", model: "Landmark Pro", serialNumber: "CT-LMP-5511", installedDaysAgo: 800, warrantyDaysAhead: 8200, location: "Main house", notes: "Under our 5-year labour warranty." },
    { customer: 9, equipmentType: "Seamless gutters", brand: "Amerimax", model: "6in K-style", serialNumber: "AM-6K-2019", installedDaysAgo: 300, warrantyDaysAhead: 2900, location: "Rear elevation" },
    { customer: 10, equipmentType: "Asphalt shingle roof", brand: "GAF", model: "Timberline HDZ", serialNumber: "GAF-HDZ-8814", installedDaysAgo: 3100, warrantyDaysAhead: 1400, location: "Main house", notes: "Hail bruising across the north slope." },
  ],

  checklists: [
    {
      serviceType: "installation" as ServiceType,
      name: "Full roof replacement",
      items: [
        "Protect landscaping and set up dumpster",
        "Tear off old roof to decking",
        "Inspect decking and replace rotten sheets",
        "Install ice and water shield at valleys and eaves",
        "Install synthetic underlayment",
        "Install drip edge and flashing",
        "Install shingles to manufacturer spec",
        "Install ridge vent",
        "Magnet sweep the property for nails",
        "Walk the finished roof with the customer",
      ],
    },
    {
      serviceType: "inspection" as ServiceType,
      name: "Roof inspection",
      items: [
        "Photograph all four elevations",
        "Check flashing at every penetration",
        "Inspect attic for daylight and moisture",
        "Check gutters and downspouts for flow",
        "Measure remaining shingle life",
        "Write up findings and send the report",
      ],
    },
    {
      serviceType: "repair" as ServiceType,
      name: "Leak repair",
      items: [
        "Locate the entry point from inside the attic",
        "Photograph the damage before touching it",
        "Dry and clear the work area",
        "Replace damaged decking and underlayment",
        "Reflash and seal the penetration",
        "Water-test the repair before leaving",
      ],
    },
    {
      serviceType: "maintenance" as ServiceType,
      name: "Annual maintenance visit",
      items: [
        "Clear gutters and downspouts",
        "Reseal exposed fastener heads",
        "Check and reseat loose shingles",
        "Trim back overhanging branches",
        "Photograph and log the roof condition",
      ],
    },
  ],

  /* Jobs. `dayOffset` is relative to today: negative = done or in progress,
     0 = on the board today, positive = scheduled ahead. */
  jobs: [
    { customer: 0, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "Annual maintenance — Ramsey Ave", description: "Gutter clear, fastener reseal, condition photos.", dayOffset: -46, start: "08:00:00", end: "11:00:00", lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "part" as ItemType, description: "Gutter guard replacement section", quantity: 40, unitPrice: 9, catalog: "Gutter guard" },
    ] },
    { customer: 2, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "inspection" as ServiceType, title: "Pre-purchase inspection — Mountain Quail", description: "Full inspection with photo report for the buyer.", dayOffset: -38, start: "09:00:00", end: "10:30:00", lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ] },
    { customer: 1, lifecycle: "completed" as Lifecycle, priority: "emergency" as Priority, serviceType: "emergency" as ServiceType, title: "Storm tarp — Kinney Ave", description: "West face opened up in the hail storm. Same-day tarp.", dayOffset: -31, start: "17:00:00", end: "19:00:00", notes: "Insurance claim opened the same evening.", lines: [
      { itemType: "service_call" as ItemType, description: "Emergency tarp and weatherproofing", quantity: 1, unitPrice: 385, catalog: "Emergency tarp" },
      { itemType: "labor" as ItemType, description: "After-hours labour (2 crew x 2h)", quantity: 4, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 1, lifecycle: "completed" as Lifecycle, priority: "urgent" as Priority, serviceType: "installation" as ServiceType, title: "Full re-roof — Kinney Ave", description: "Complete tear-off and replacement, 26 squares, insurance approved.", dayOffset: -24, start: "07:00:00", end: "17:00:00", lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 26, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 3, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "material" as ItemType, description: "Ice and water shield", quantity: 4, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "material" as ItemType, description: "Decking replacement — rotten sheets", quantity: 7, unitPrice: 68, catalog: "Decking replacement" },
      { itemType: "part" as ItemType, description: "Ridge vent", quantity: 46, unitPrice: 21, catalog: "Ridge vent" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 10h)", quantity: 40, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ] },
    { customer: 4, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "repair" as ServiceType, title: "Skylight leak — Duval St", description: "Kitchen skylight leaking at the head flashing.", dayOffset: -19, start: "10:00:00", end: "13:00:00", lines: [
      { itemType: "service_call" as ItemType, description: "Skylight strip, reflash and reseal", quantity: 1, unitPrice: 240, catalog: "Skylight reseal" },
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 6, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "TPO inspection — Building A", description: "Annual flat-roof check, seam inspection, drain clear.", dayOffset: -14, start: "08:00:00", end: "11:00:00", lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
      { itemType: "labor" as ItemType, description: "Seam probe and drain clear", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 8, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "repair" as ServiceType, title: "Warranty callback — Balcones Dr", description: "Two lifted shingles on the south ridge. Covered by warranty.", dayOffset: -9, start: "09:00:00", end: "10:30:00", notes: "No charge — inside the 5-year labour warranty.", lines: [] },
    { customer: 5, lifecycle: "completed" as Lifecycle, priority: "urgent" as Priority, serviceType: "repair" as ServiceType, title: "Valley leak — Manchaca Rd", description: "Water staining on the ceiling below the north valley.", dayOffset: -6, start: "13:00:00", end: "16:00:00", lines: [
      { itemType: "material" as ItemType, description: "Ice and water shield", quantity: 1, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "material" as ItemType, description: "Architectural shingles — patch", quantity: 2, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 3, lifecycle: "completed" as Lifecycle, priority: "standard" as Priority, serviceType: "installation" as ServiceType, title: "Gutter replacement — Live Oak St", description: "Full perimeter seamless gutter with leaf guard.", dayOffset: -4, start: "08:00:00", end: "15:00:00", lines: [
      { itemType: "material" as ItemType, description: "Seamless gutter", quantity: 168, unitPrice: 12, catalog: "Seamless gutter" },
      { itemType: "part" as ItemType, description: "Gutter guard", quantity: 168, unitPrice: 9, catalog: "Gutter guard" },
      { itemType: "labor" as ItemType, description: "Roofing labour (3 crew x 7h)", quantity: 21, unitPrice: 78, catalog: "Roofing labour" },
    ] },

    { customer: 10, lifecycle: "in_progress" as Lifecycle, priority: "urgent" as Priority, serviceType: "installation" as ServiceType, title: "Hail re-roof — Bluffstone Cv", description: "Insurance-approved full replacement, 31 squares. Day 2 of 3.", dayOffset: -1, start: "07:00:00", end: "17:00:00", lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 31, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 4, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "material" as ItemType, description: "Ice and water shield", quantity: 5, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "part" as ItemType, description: "Ridge vent", quantity: 52, unitPrice: 21, catalog: "Ridge vent" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 24h)", quantity: 96, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ] },
    { customer: 7, lifecycle: "in_progress" as Lifecycle, priority: "standard" as Priority, serviceType: "repair" as ServiceType, title: "Chimney flashing — Bouldin Ave", description: "Strip and rebuild the chimney step flashing.", dayOffset: 0, start: "09:00:00", end: "14:00:00", lines: [
      { itemType: "part" as ItemType, description: "Step flashing", quantity: 32, unitPrice: 8, catalog: "Step flashing" },
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 5h)", quantity: 10, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 9, lifecycle: "in_progress" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "Gutter clear — Cesar Chavez St", description: "Autumn clear-out and downspout flush.", dayOffset: 0, start: "15:00:00", end: "16:30:00", lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ] },

    { customer: 11, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "inspection" as ServiceType, title: "New customer inspection — Alta Vista", description: "First visit. Full inspection and quote for the re-roof.", dayOffset: 1, start: "10:00:00", end: "11:30:00", lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ] },
    { customer: 6, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "TPO inspection — Building B", description: "Second of the three Pruitt buildings.", dayOffset: 2, start: "08:00:00", end: "11:00:00", lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ] },
    { customer: 2, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "repair" as ServiceType, title: "Metal panel fastener reseal", description: "Reseal exposed fasteners on the carport run.", dayOffset: 3, start: "13:00:00", end: "16:00:00", lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 5, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "installation" as ServiceType, title: "Re-roof — Manchaca Rd", description: "Full replacement, 24 squares. Booked after the valley repair.", dayOffset: 6, start: "07:00:00", end: "17:00:00", lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 24, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 3, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 10h)", quantity: 40, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ] },
    { customer: 0, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "Annual maintenance — Ramsey Ave", description: "Next visit under the maintenance contract.", dayOffset: 9, start: "08:00:00", end: "11:00:00", lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
    ] },
    { customer: 8, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "consultation" as ServiceType, title: "Solar-ready consult — Balcones Dr", description: "Walk the roof with the solar installer before panel layout.", dayOffset: 12, start: "11:00:00", end: "12:00:00", lines: [] },
    { customer: 6, lifecycle: "scheduled" as Lifecycle, priority: "standard" as Priority, serviceType: "maintenance" as ServiceType, title: "TPO inspection — Building C", description: "Last of the three Pruitt buildings.", dayOffset: 16, start: "08:00:00", end: "11:00:00", lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ] },
  ],

  /* Invoices. `sent`/`void` are the only status hints; everything else is
     derived from the payments by the seed writer. Mixed on purpose: paid in
     full, part-paid, overdue, a draft, a void, and one overpayment that must
     land in credit_amount rather than being clamped away. */
  invoices: [
    { customer: 0, job: 0, sent: true, issuedDayOffset: -46, lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "part" as ItemType, description: "Gutter guard replacement section", quantity: 40, unitPrice: 9, catalog: "Gutter guard" },
    ], payments: [{ rest: true, method: "credit_card" as PaymentMethod, dayOffset: -44, reference: "ch_3PqL8" }] },

    { customer: 2, job: 1, sent: true, issuedDayOffset: -38, lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ], payments: [{ rest: true, method: "cash" as PaymentMethod, dayOffset: -38 }] },

    // Overpaid by $50 — must show a credit, not a clamped zero balance.
    { customer: 4, job: 4, sent: true, issuedDayOffset: -19, lines: [
      { itemType: "service_call" as ItemType, description: "Skylight strip, reflash and reseal", quantity: 1, unitPrice: 240, catalog: "Skylight reseal" },
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [{ over: 50, method: "check" as PaymentMethod, dayOffset: -16, reference: "Check 2841" }], notes: "Customer rounded the check up; the extra is held as a credit." },

    // Large re-roof, part-paid and now past due — the aging bucket.
    { customer: 1, job: 3, sent: true, issuedDayOffset: -24, dueDayOffset: -9, lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 26, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 3, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "material" as ItemType, description: "Ice and water shield", quantity: 4, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "material" as ItemType, description: "Decking replacement — rotten sheets", quantity: 7, unitPrice: 68, catalog: "Decking replacement" },
      { itemType: "part" as ItemType, description: "Ridge vent", quantity: 46, unitPrice: 21, catalog: "Ridge vent" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 10h)", quantity: 40, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ], payments: [{ amount: 5000, method: "bank_transfer" as PaymentMethod, dayOffset: -22, reference: "Insurance ACH 1 of 2" }], notes: "Insurance paid the first half; depreciation released on final sign-off." },

    // Sent, unpaid, past due.
    { customer: 6, job: 5, sent: true, issuedDayOffset: -14, dueDayOffset: -3, lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
      { itemType: "labor" as ItemType, description: "Seam probe and drain clear", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [], notes: "Billed to Pruitt Property Group LLC." },

    // Sent, unpaid, not yet due.
    { customer: 5, job: 7, sent: true, issuedDayOffset: -5, lines: [
      { itemType: "material" as ItemType, description: "Ice and water shield", quantity: 1, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "material" as ItemType, description: "Architectural shingles — patch", quantity: 2, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 3h)", quantity: 6, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [] },

    // Paid in two instalments.
    { customer: 3, job: 8, sent: true, issuedDayOffset: -4, lines: [
      { itemType: "material" as ItemType, description: "Seamless gutter", quantity: 168, unitPrice: 12, catalog: "Seamless gutter" },
      { itemType: "part" as ItemType, description: "Gutter guard", quantity: 168, unitPrice: 9, catalog: "Gutter guard" },
      { itemType: "labor" as ItemType, description: "Roofing labour (3 crew x 7h)", quantity: 21, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [
      { amount: 2000, method: "credit_card" as PaymentMethod, dayOffset: -3, reference: "Deposit" },
      { rest: true, method: "bank_transfer" as PaymentMethod, dayOffset: -1, reference: "Balance" },
    ] },

    // Draft — never sent, no payments. Must stay a draft.
    { customer: 10, job: 9, sent: false, issuedDayOffset: 0, lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 31, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 4, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 24h)", quantity: 96, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [], notes: "Hold until the job is signed off and the adjuster releases depreciation." },

    // Void — raised against the wrong property. Terminal; never re-derived.
    { customer: 9, sent: true, void: true, issuedDayOffset: -11, lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [], notes: "Raised against the wrong address. Voided and reissued." },

    { customer: 9, job: 11, sent: true, issuedDayOffset: -10, lines: [
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 3, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [{ rest: true, method: "cash" as PaymentMethod, dayOffset: -8 }] },

    { customer: 8, sent: true, issuedDayOffset: -60, dueDayOffset: -45, lines: [
      { itemType: "service_call" as ItemType, description: "Roof inspection with photo report", quantity: 1, unitPrice: 149, catalog: "Roof inspection" },
    ], payments: [], notes: "Long overdue — chase before the next warranty visit." },

    { customer: 7, sent: true, issuedDayOffset: -33, lines: [
      { itemType: "service_call" as ItemType, description: "Emergency tarp and weatherproofing", quantity: 1, unitPrice: 385, catalog: "Emergency tarp" },
      { itemType: "labor" as ItemType, description: "After-hours labour", quantity: 4, unitPrice: 78, catalog: "Roofing labour" },
    ], payments: [{ rest: true, method: "credit_card" as PaymentMethod, dayOffset: -30 }] },
  ],

  quotes: [
    { customer: 11, status: "sent" as QuoteStatus, issuedDayOffset: -3, lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 22, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 3, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 9h)", quantity: 36, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ], notes: "Price assumes the decking is sound. Any rotten sheets are quoted separately." },

    { customer: 5, status: "accepted" as QuoteStatus, job: 15, issuedDayOffset: -12, lines: [
      { itemType: "material" as ItemType, description: "Architectural shingles", quantity: 24, unitPrice: 128, catalog: "Architectural shingles" },
      { itemType: "material" as ItemType, description: "Synthetic underlayment", quantity: 3, unitPrice: 62, catalog: "Synthetic underlayment" },
      { itemType: "labor" as ItemType, description: "Roofing labour (4 crew x 10h)", quantity: 40, unitPrice: 78, catalog: "Roofing labour" },
      { itemType: "other" as ItemType, description: "Dumpster and haul-away", quantity: 1, unitPrice: 275, catalog: "Debris haul-away" },
    ] },

    { customer: 2, status: "accepted" as QuoteStatus, issuedDayOffset: -20, lines: [
      { itemType: "material" as ItemType, description: "Standing seam metal panel", quantity: 6, unitPrice: 412, catalog: "Standing seam metal panel" },
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 8h)", quantity: 16, unitPrice: 78, catalog: "Roofing labour" },
    ] },

    { customer: 6, status: "sent" as QuoteStatus, issuedDayOffset: -8, lines: [
      { itemType: "material" as ItemType, description: "TPO recover system — Building C", quantity: 1, unitPrice: 18400 },
      { itemType: "labor" as ItemType, description: "Roofing labour (5 crew x 32h)", quantity: 160, unitPrice: 78, catalog: "Roofing labour" },
    ], notes: "Phased over two weekends so the tenants are not disrupted." },

    { customer: 4, status: "declined" as QuoteStatus, issuedDayOffset: -27, declineReason: "Going with a cheaper bid from another contractor.", lines: [
      { itemType: "material" as ItemType, description: "Skylight replacement — VELUX FS C06", quantity: 1, unitPrice: 1240 },
      { itemType: "labor" as ItemType, description: "Roofing labour (2 crew x 6h)", quantity: 12, unitPrice: 78, catalog: "Roofing labour" },
    ] },

    { customer: 9, status: "expired" as QuoteStatus, issuedDayOffset: -70, lines: [
      { itemType: "material" as ItemType, description: "Seamless gutter", quantity: 96, unitPrice: 12, catalog: "Seamless gutter" },
      { itemType: "labor" as ItemType, description: "Roofing labour", quantity: 8, unitPrice: 78, catalog: "Roofing labour" },
    ] },

    { customer: 8, status: "draft" as QuoteStatus, issuedDayOffset: 0, lines: [
      { itemType: "material" as ItemType, description: "Solar-ready underlayment upgrade", quantity: 18, unitPrice: 94, catalog: "Ice and water shield" },
      { itemType: "labor" as ItemType, description: "Roofing labour (3 crew x 8h)", quantity: 24, unitPrice: 78, catalog: "Roofing labour" },
    ], notes: "Waiting on the panel layout from the solar installer before sending." },
  ],

  /* Bookings — what the public portal produces. Two are already converted to
     jobs, so both sides of the link get written. */
  bookings: [
    { customer: 11, customerName: "Nadia Osei", customerEmail: "nadia.osei@example.com", customerPhone: "(512) 555-0199", serviceType: "inspection" as ServiceType, dayOffset: 1, time: "10:00:00", address: "1401 Alta Vista Ave, Austin, TX 78704", description: "Roof is 19 years old — want to know how long it has left.", status: "confirmed" as BookingStatus, source: "portal", convertedJob: 12 },
    { customer: 9, customerName: "Yasmin Haddad", customerEmail: "yasmin.haddad@example.com", customerPhone: "(512) 555-0188", serviceType: "maintenance" as ServiceType, dayOffset: 0, time: "15:00:00", address: "2019 E Cesar Chavez St, Austin, TX 78702", description: "Gutters overflowing at the back corner.", status: "completed" as BookingStatus, source: "portal", convertedJob: 11 },
    { customerName: "Elena Barrios", customerEmail: "elena.barrios@example.com", customerPhone: "(512) 555-0221", serviceType: "emergency" as ServiceType, dayOffset: 0, time: "18:00:00", address: "1122 Justin Ln, Austin, TX 78757", description: "Water coming through the ceiling in the front bedroom.", status: "pending" as BookingStatus, source: "portal" },
    { customerName: "Trevor Nash", customerEmail: "trevor.nash@example.com", customerPhone: "(512) 555-0233", serviceType: "inspection" as ServiceType, dayOffset: 2, time: "09:00:00", address: "700 Sunset Trail, Austin, TX 78745", description: "Buying the house — need an inspection before closing.", status: "pending" as BookingStatus, source: "portal" },
    { customerName: "Marisol Aguilar", customerEmail: "marisol.aguilar@example.com", customerPhone: "(512) 555-0244", serviceType: "repair" as ServiceType, dayOffset: 4, time: "13:00:00", address: "3901 Avenue G, Austin, TX 78751", description: "Missing shingles after the wind last night.", status: "confirmed" as BookingStatus, source: "portal" },
    { customerName: "Owen Delacroix", customerEmail: "owen.delacroix@example.com", customerPhone: "(512) 555-0255", serviceType: "consultation" as ServiceType, dayOffset: 7, time: "11:00:00", address: "5200 Shoal Creek Blvd, Austin, TX 78756", description: "Considering metal instead of shingle. Want to talk options.", status: "confirmed" as BookingStatus, source: "portal" },
    { customerName: "Paulette Rivers", customerEmail: "paulette.rivers@example.com", customerPhone: "(512) 555-0266", serviceType: "maintenance" as ServiceType, dayOffset: -2, time: "14:00:00", address: "1809 W 35th St, Austin, TX 78703", description: "Annual gutter clear.", status: "cancelled" as BookingStatus, source: "portal" },
    { customer: 0, customerName: "Marcus Whitfield", customerEmail: "marcus.whitfield@example.com", customerPhone: "(512) 555-0182", serviceType: "maintenance" as ServiceType, dayOffset: 9, time: "08:00:00", address: "4417 Ramsey Ave, Austin, TX 78756", description: "Contract maintenance visit.", status: "confirmed" as BookingStatus, source: "phone" },
  ],

  calendarEvents: [
    { title: "Supplier pickup — shingle order", description: "Collect the Timberline order for the Bluffstone job.", dayOffset: 1, start: "06:30:00", end: "07:30:00", color: "blue", address: "ABC Supply, 8300 Cross Park Dr" },
    { title: "Adjuster meeting — Feldman claim", description: "Walk the roof with the State Farm adjuster.", dayOffset: 2, start: "14:00:00", end: "15:00:00", color: "amber", contactName: "Gregory Feldman", address: "8814 Bluffstone Cv" },
    { title: "Crew safety training", description: "Quarterly fall-protection refresher. Whole crew.", dayOffset: 5, start: "07:00:00", end: "09:00:00", color: "green" },
    { title: "Truck service", description: "Oil change and brake check on the dump trailer truck.", dayOffset: 8, start: "08:00:00", end: "10:00:00", color: "gray" },
    { title: "Quarterly tax filing", description: "Drop paperwork with the accountant.", dayOffset: 14, start: "10:00:00", end: "11:00:00", color: "violet" },
    { title: "Pruitt portfolio review", description: "Review all three buildings and agree next year's schedule.", dayOffset: 18, start: "13:00:00", end: "15:00:00", color: "blue", contactName: "Jonah Pruitt" },
  ],

  contracts: [
    { customer: 0, name: "Ramsey Ave — annual roof care", startedDaysAgo: 400, endsInDays: 330, frequency: "annual" as Frequency, visitsPerYear: 2, annualPrice: 480, notes: "Spring and autumn visits." },
    { customer: 6, name: "Pruitt Property Group — 3 buildings", startedDaysAgo: 250, endsInDays: 115, frequency: "semi_annual" as Frequency, visitsPerYear: 6, annualPrice: 3600, notes: "Two visits per building per year." },
    { customer: 8, name: "Balcones Dr — warranty plan", startedDaysAgo: 800, endsInDays: 40, frequency: "annual" as Frequency, visitsPerYear: 1, annualPrice: 240, notes: "Expires soon — renewal reminder due." },
    { customer: 2, name: "Mountain Quail — metal roof care", startedDaysAgo: 180, endsInDays: 550, frequency: "annual" as Frequency, visitsPerYear: 1, annualPrice: 320 },
  ],

  dayOff: [
    { dayOffset: 11, reason: "Crew day off — long weekend" },
    { dayOffset: 25, reason: "Public holiday" },
  ],

  notifications: [
    { type: "booking_received" as NotificationType, title: "New booking request", description: "Elena Barrios requested an emergency visit for a ceiling leak.", daysAgo: 0 },
    { type: "booking_received" as NotificationType, title: "New booking request", description: "Trevor Nash requested a pre-purchase inspection.", daysAgo: 0 },
    { type: "invoice_overdue" as NotificationType, title: "Invoice overdue", description: "Pruitt Property Group's inspection invoice is past its due date.", daysAgo: 3 },
    { type: "invoice_paid" as NotificationType, title: "Invoice paid", description: "Bethany Cruz paid the gutter replacement balance in full.", daysAgo: 1 },
    { type: "quote_accepted" as NotificationType, title: "Quote accepted", description: "Amara Bello accepted the Manchaca Rd re-roof quote.", daysAgo: 11 },
    { type: "quote_declined" as NotificationType, title: "Quote declined", description: "Theo Lindqvist declined the skylight replacement quote.", daysAgo: 26 },
    { type: "job_status_changed" as NotificationType, title: "Job completed", description: "Gutter replacement at 705 W Live Oak St was marked complete.", daysAgo: 4 },
    { type: "customer_created" as NotificationType, title: "New customer", description: "Nadia Osei was added to your customers.", daysAgo: 12 },
    { type: "booking_cancelled" as NotificationType, title: "Booking cancelled", description: "Paulette Rivers cancelled her annual gutter clear.", daysAgo: 2 },
  ],
};
