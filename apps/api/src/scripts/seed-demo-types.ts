/**
 * The shape of the demo dataset. Types only — no values, no database.
 *
 * Every relationship in the dataset is an *index* into a sibling array
 * (`job.customer` is a position in `customers`), never an id, because ids do not
 * exist until the writer has inserted the rows. The writer maps index -> id as it
 * goes, and a dangling index throws instead of writing a half-connected record.
 *
 * Every date is a day OFFSET from "today" in the tenant's timezone (negative =
 * past, 0 = today, positive = ahead) plus an `HH:MM` wall-clock time, so a
 * freshly seeded tenant looks the same whenever the script is run. Nothing here
 * ever holds an absolute date.
 */

export type Money = number;

export type ItemType = "labor" | "part" | "material" | "service_call" | "other";
export type ServiceType =
  | "installation"
  | "repair"
  | "maintenance"
  | "inspection"
  | "emergency"
  | "consultation"
  | "other";
export type Priority = "standard" | "urgent" | "emergency";
export type Lifecycle = "scheduled" | "in_progress" | "completed" | "cancelled";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type BookingSource = "portal" | "embed" | "widget";
export type PaymentMethod =
  | "cash"
  | "check"
  | "credit_card"
  | "bank_transfer"
  | "other";
export type Frequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "semi_annual"
  | "annual";
export type ExpenseCategory =
  | "material"
  | "subcontractor"
  | "permit"
  | "fuel"
  | "equipment_rental"
  | "other";
export type NotificationType =
  | "booking_received"
  | "booking_cancelled"
  | "job_status_changed"
  | "invoice_paid"
  | "customer_created"
  | "quote_accepted"
  | "quote_declined"
  | "invoice_overdue";
export type CalendarColor =
  | "purple"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "teal";

/** A moment: a day offset plus a wall-clock `HH:MM` in the tenant's timezone. */
export interface When {
  day: number;
  time: string;
}

export interface TenantProfile {
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  licenseNumber: string;
  /** numeric(5,4) as text: "0.0825" is 8.25%. */
  defaultTaxRate: string;
  invoicePaymentTerms: string;
  invoicePaymentInstructions: string;
  invoiceTermsConditions: string;
  invoiceFooterMessage: string;
  quoteTermsConditions: string;
  quoteFooterMessage: string;
  googleReviewUrl: string;
  bookingSlotCapacity: number;
}

export interface CatalogSpec {
  name: string;
  itemType: ItemType;
  unitPrice: Money;
  /** NULL = unknown, never zero. A few parts are left NULL on purpose. */
  unitCost: Money | null;
  unit: string;
  category: string;
  description: string;
}

export interface TagSpec {
  name: string;
  /** A hex colour — the Customers UI renders tag colours as CSS values. */
  color: string;
}

/**
 * A line item with everything already resolved. `unitPrice` and `unitCost` are
 * copied from the catalog entry when the line is built — exactly what the app
 * does when a catalog item is added to a job — and may then differ per line, the
 * way a real supplier price drifts. `unitCost` is ignored by quotes and invoices,
 * which carry no cost column.
 */
export interface LineSpec {
  catalog: string | null;
  itemType: ItemType;
  description: string;
  quantity: number;
  unitPrice: Money;
  unitCost: Money | null;
}

export type CustomerSource = "portal" | "phone" | "referral";
export type CustomerSegment = "residential" | "landlord" | "commercial";

export interface CustomerSpec {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  joined: When;
  source: CustomerSource;
  segment: CustomerSegment;
  tags: string[];
  notes: string | null;
  archivedAt: When | null;
  emailOptOutAt: When | null;
}

export interface CustomerNoteSpec {
  customer: number;
  at: When;
  content: string;
}

export interface EquipmentSpec {
  customer: number;
  equipmentType: string;
  brand: string;
  model: string;
  serialNumber: string;
  installDay: number;
  warrantyDay: number;
  location: string;
  notes: string | null;
  created: When;
}

export interface ContractSpec {
  customer: number;
  equipment: number | null;
  name: string;
  startDay: number;
  endDay: number;
  frequency: Frequency;
  visitsPerYear: number;
  annualPrice: Money;
  notes: string | null;
  renewalReminderDay: number | null;
}

export interface ChecklistTemplateSpec {
  serviceType: ServiceType;
  name: string;
  items: { label: string; required: boolean }[];
}

export interface TimeEntrySpec {
  /** Index into the org's members (0 = the owner). */
  member: number;
  day: number;
  start: string;
  end: string;
  note: string | null;
}

export interface ExpenseSpec {
  category: ExpenseCategory;
  description: string;
  amount: Money;
  day: number;
  vendor: string;
  member: number;
}

/** How much of the attached checklist has been ticked. */
export type ChecklistTick = "none" | "partial" | "required" | "all";

export interface JobSpec {
  /** Which job template produced it. Diagnostics only — never persisted. */
  kind: string;
  customer: number;
  equipment: number | null;
  lifecycle: Lifecycle;
  priority: Priority;
  serviceType: ServiceType;
  title: string;
  description: string;
  notes: string | null;
  day: number;
  start: string;
  end: string;
  /** Index into the org's members (0 = the owner). */
  assignee: number;
  lines: LineSpec[];
  created: When;
  /** When it left "scheduled" for "in progress". Null if it never paused there. */
  startedAt: When | null;
  completed: When | null;
  cancelled: { at: When; reason: string } | null;
  time: TimeEntrySpec[];
  expenses: ExpenseSpec[];
  checklist: ChecklistTick;
  /** Index into `quotes` when the job was converted from one. */
  quote: number | null;
  /** Index into `bookings` when the job was converted from one. */
  booking: number | null;
}

/**
 * A payment states its *intent*, not a pre-computed figure: `share` is a fraction
 * of the invoice total, and `"rest"` settles whatever is outstanding. The writer
 * resolves both against the total it just summed from the line items, so
 * "paid in full" can never quietly become "partially paid" when a price changes.
 * `extra` deliberately overpays by that many dollars.
 */
export interface PaymentSpec {
  share: number | "rest";
  extra: Money;
  day: number;
  method: PaymentMethod;
  reference: string | null;
}

export interface InvoiceSpec {
  job: number | null;
  customer: number;
  issued: When;
  /** False = a draft nobody has sent. */
  sent: boolean;
  /** The only status a seed may assert; everything else is derived. */
  void: boolean;
  lines: LineSpec[];
  discount: Money;
  payments: PaymentSpec[];
  notes: string | null;
}

export interface QuoteSpec {
  customer: number;
  equipment: number | null;
  status: QuoteStatus;
  issued: When;
  lines: LineSpec[];
  discount: Money;
  notes: string | null;
  declineReason: string | null;
  sent: When | null;
  viewed: When | null;
  responded: When | null;
  /** True when the customer answered on the public portal, false by phone. */
  respondedOnline: boolean;
  /** Index into `jobs` when an accepted quote became one. */
  job: number | null;
}

export interface BookingSpec {
  customer: number;
  serviceType: ServiceType;
  day: number;
  time: string;
  description: string;
  status: BookingStatus;
  source: BookingSource;
  created: When;
  /** Index into `jobs` when converted. */
  job: number | null;
  confirmedAt: When | null;
  /** Set when a confirmed/pending booking was cancelled. */
  cancelled: { at: When; was: "pending" | "confirmed" } | null;
  /** Set when the visit date was moved after the booking was made. */
  rescheduled: { at: When; fromDay: number; fromTime: string } | null;
  /** When staff marked a converted booking completed. */
  completedAt: When | null;
  notes: string | null;
}

export interface CalendarEventSpec {
  title: string;
  description: string | null;
  day: number;
  start: string;
  end: string;
  color: CalendarColor;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  notes: string | null;
  customer: number | null;
  job: number | null;
}

export interface ScheduleOverrideSpec {
  day: number;
  reason: string;
}

export type NotificationRef =
  | { kind: "job"; index: number }
  | { kind: "invoice"; index: number }
  | { kind: "quote"; index: number }
  | { kind: "booking"; index: number }
  | { kind: "customer"; index: number };

export interface NotificationSpec {
  type: NotificationType;
  ref: NotificationRef;
  at: When;
  read: boolean;
  /** For invoice_paid: which of the invoice's payments this announces. */
  payment: number;
}

export interface MemberRateSpec {
  /** Index into the org's members (0 = the owner). */
  member: number;
  rate: Money;
}

export interface DemoDataset {
  tenant: TenantProfile;
  /** Loaded hourly labour cost applied to anyone without a member rate. */
  defaultLaborCostRate: Money;
  memberRates: MemberRateSpec[];
  catalog: CatalogSpec[];
  tags: TagSpec[];
  customers: CustomerSpec[];
  customerNotes: CustomerNoteSpec[];
  equipment: EquipmentSpec[];
  contracts: ContractSpec[];
  checklists: ChecklistTemplateSpec[];
  quotes: QuoteSpec[];
  bookings: BookingSpec[];
  jobs: JobSpec[];
  invoices: InvoiceSpec[];
  calendarEvents: CalendarEventSpec[];
  scheduleOverrides: ScheduleOverrideSpec[];
  notifications: NotificationSpec[];
}
