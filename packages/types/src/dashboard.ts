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
}
