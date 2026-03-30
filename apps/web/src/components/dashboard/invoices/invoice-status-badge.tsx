"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft: {
    label: "Draft",
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  sent: {
    label: "Sent",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  paid: {
    label: "Paid",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    dot: "bg-green-500",
  },
  partially_paid: {
    label: "Partially Paid",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  overdue: {
    label: "Overdue",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
  void: {
    label: "Void",
    bg: "bg-muted",
    text: "text-muted-foreground/60",
    dot: "bg-muted-foreground/40",
  },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge
      className={cn(
        "gap-1.5 px-2 py-0.5 font-medium",
        config.bg,
        config.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}
