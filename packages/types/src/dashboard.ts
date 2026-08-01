export interface DashboardKpis {
  jobsToday: { count: number; emergencyCount: number; yesterdayCount: number };
  /** Every unpaid invoice, right now — not scoped to the selected date range. */
  outstandingBalance: { amount: number; invoiceCount: number };
  /**
   * Revenue collected inside the selected date range, vs the preceding equal
   * span. `billedAmount` is the face value of invoices *issued* in the same
   * range — a different event from cash received, which is the point: the gap
   * between them is the money still to chase.
   */
  rangeRevenue: { amount: number; previousAmount: number; billedAmount: number };
  /** Distinct customers with a job in the trailing 90 days. */
  activeCustomers: { count: number };
}

export interface DashboardOverdueInvoices {
  count: number;
  totalAmount: number;
}

export interface DashboardPipelineItem {
  stageName: string;
  stageLabel: string;
  stageColor: string;
  count: number;
}

export interface DashboardRevenueTrendItem {
  month: string;
  monthLabel: string;
  /** Cash received in this bucket. */
  amount: number;
  /** Face value of invoices issued in this bucket — excludes drafts and voids. */
  billed: number;
}

export type DashboardRevenueGranularity = "day" | "week" | "month";

export interface DashboardRetentionPoint {
  month: string;
  monthLabel: string;
  repeatRate: number; // 0-100
  repeatCount: number;
  totalCount: number;
}

export interface DashboardCategoryCount {
  key: string;
  label: string;
  count: number;
}

export interface DashboardServiceRevenue {
  serviceType: string;
  label: string;
  amount: number;
}

export interface DashboardTopCustomer {
  id: string;
  name: string;
  revenue: number;
  jobCount: number;
}

export interface DashboardAgendaEvent {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  contactName: string | null;
  address: string | null;
  color: string | null;
}

export interface DashboardAgendaJob {
  id: string;
  jobNumber: string;
  title: string | null;
  customerName: string | null;
  address: string | null;
  serviceType: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface DashboardAgendaBooking {
  id: string;
  customerName: string;
  serviceType: string | null;
  bookingDate: string;
  preferredTime: string | null;
  address: string | null;
  description: string | null;
}

export interface DashboardAgenda {
  from: string;
  to: string;
  events: DashboardAgendaEvent[];
  jobs: DashboardAgendaJob[];
  bookings: DashboardAgendaBooking[];
}

export interface DashboardActivityItem {
  id: string;
  type: "job" | "quote";
  action: string;
  description: string;
  entityId: string;
  entityLabel: string;
  createdAt: string;
}

/**
 * Standard AR aging. `"90"` is 61-90 days late and `"90plus"` is over 90 —
 * previously everything past 60 days was lumped into a bucket named `90plus`.
 */
export interface DashboardAgingBucket {
  bucket: "current" | "30" | "60" | "90" | "90plus";
  count: number;
  amount: number;
}

export interface DashboardQuoteSummary {
  totalQuotes: number;
  accepted: number;
  declined: number;
  pending: number;
  conversionRate: number;
}

export interface DashboardStats {
  /**
   * The range the backend actually used, resolved in the tenant's timezone.
   * The client displays this rather than recomputing "this month" from the
   * browser clock, which can land in a different month than the tenant is in.
   */
  range: { from: string; to: string };
  kpis: DashboardKpis;
  overdueInvoices: DashboardOverdueInvoices;
  jobPipeline: DashboardPipelineItem[];
  revenueTrend: DashboardRevenueTrendItem[];
  recentActivity: DashboardActivityItem[];
  invoiceAging: DashboardAgingBucket[];
  quoteSummary: DashboardQuoteSummary;
  retentionTrend: DashboardRetentionPoint[];
  revenueGranularity: DashboardRevenueGranularity;
  priorityBreakdown: DashboardCategoryCount[];
  serviceBreakdown: DashboardCategoryCount[];
  serviceRevenue: DashboardServiceRevenue[];
  topCustomers: DashboardTopCustomer[];
  agenda: DashboardAgenda;
}
