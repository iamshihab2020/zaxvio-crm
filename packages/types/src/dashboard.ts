export interface DashboardKpis {
  jobsToday: { count: number; emergencyCount: number; yesterdayCount: number };
  openInvoices: { count: number; previousCount: number };
  outstandingBalance: { amount: number; previousAmount: number };
  thisMonthRevenue: { amount: number; previousAmount: number };
  activeCustomers: { count: number };
  upcomingBookings: { count: number };
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
  amount: number;
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

export interface DashboardTodayJob {
  id: string;
  jobNumber: string;
  customerName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  priority: string;
  serviceType: string;
}

export interface DashboardAgingBucket {
  bucket: "current" | "30" | "60" | "90plus";
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

export interface DashboardSparklinePoint {
  day: string;
  value: number;
}

export interface DashboardStats {
  kpis: DashboardKpis;
  overdueInvoices: DashboardOverdueInvoices;
  jobPipeline: DashboardPipelineItem[];
  revenueTrend: DashboardRevenueTrendItem[];
  recentActivity: DashboardActivityItem[];
  todaySchedule: DashboardTodayJob[];
  invoiceAging: DashboardAgingBucket[];
  quoteSummary: DashboardQuoteSummary;
  weeklyJobVolume: DashboardSparklinePoint[];
  weeklyRevenue: DashboardSparklinePoint[];
  retentionTrend: DashboardRetentionPoint[];
  revenueGranularity: DashboardRevenueGranularity;
  priorityBreakdown: DashboardCategoryCount[];
  serviceBreakdown: DashboardCategoryCount[];
  selectedPipelineId: string | null;
  serviceRevenue: DashboardServiceRevenue[];
  topCustomers: DashboardTopCustomer[];
  agenda: DashboardAgenda;
}
