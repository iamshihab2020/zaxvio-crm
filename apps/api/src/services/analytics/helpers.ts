// ── Parse helpers ──

export function pInt(val: string | undefined | null): number {
  return parseInt(val ?? "0", 10);
}

export function pFloat(val: string | undefined | null): number {
  return parseFloat(val ?? "0");
}

// ── Label maps ──

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Installation",
  repair: "Repair",
  maintenance: "Maintenance",
  inspection: "Inspection",
  emergency: "Emergency",
  consultation: "Consultation",
  other: "Other",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  credit_card: "Credit Card",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

export const PRIORITY_LABELS: Record<string, string> = {
  standard: "Standard",
  urgent: "Urgent",
  emergency: "Emergency",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  void: "Void",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const AGING_LABELS: Record<string, string> = {
  current: "Current",
  "30": "1–30 days",
  "60": "31–60 days",
  "90plus": "90+ days",
};

export const JOB_STATUS_COLORS: Record<string, string> = {
  scheduled: "#3b82f6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  cancelled: "#ef4444",
};
