export type JobStatus = string;

export const JOB_STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const JOB_STATUS_COLORS: Record<
  string,
  { dot: string; bg: string; text: string; border: string }
> = {
  scheduled: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  in_progress: {
    dot: "bg-brand",
    bg: "bg-brand-light/30",
    text: "text-brand",
    border: "border-brand/40",
  },
  completed: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  cancelled: {
    dot: "bg-muted-foreground",
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

export const JOB_PRIORITIES = ["standard", "urgent", "emergency"] as const;

export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_PRIORITY_LABELS: Record<JobPriority, string> = {
  standard: "Standard",
  urgent: "Urgent",
  emergency: "Emergency",
};

export const JOB_PRIORITY_COLORS: Record<
  JobPriority,
  { bg: string; text: string }
> = {
  standard: { bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-300" },
  urgent: { bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-300" },
  emergency: { bg: "bg-red-50 dark:bg-red-950/50", text: "text-red-700 dark:text-red-300" },
};

/**
 * Raw hex per priority, for charts and inline `style` where a Tailwind class cannot
 * be used. Keyed by `JobPriority` so adding a priority to the enum is a type error
 * here rather than a silently grey bar — the dashboard previously carried its own
 * `urgent | high | normal | low` map, none of which matched the database enum, so
 * `emergency` rendered identically to `standard`.
 */
export const JOB_PRIORITY_CHART_COLORS: Record<JobPriority, string> = {
  standard: "#60a5fa",
  urgent: "#f59e0b",
  emergency: "#ef4444",
};

export const SERVICE_TYPES = [
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  installation: "Installation",
  repair: "Repair",
  maintenance: "Maintenance",
  inspection: "Inspection",
  emergency: "Emergency",
  consultation: "Consultation",
  other: "Other",
};

export const ITEM_TYPE_LABELS: Record<string, string> = {
  labor: "Labor",
  part: "Part",
  material: "Material",
  service_call: "Service Call",
  other: "Other",
};

export const JOB_PRIORITY_BORDER_COLORS: Record<JobPriority, string> = {
  standard: "border-l-blue-400 dark:border-l-blue-500",
  urgent: "border-l-amber-400 dark:border-l-amber-500",
  emergency: "border-l-red-500 dark:border-l-red-600",
};

/** Default pipeline stages for reference */
export const DEFAULT_PIPELINE_STAGES = [
  { name: "scheduled", label: "Scheduled", color: "blue" },
  { name: "in_progress", label: "In Progress", color: "brand" },
  { name: "completed", label: "Completed", color: "green" },
  { name: "cancelled", label: "Cancelled", color: "gray" },
] as const;
