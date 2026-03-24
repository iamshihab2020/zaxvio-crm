"use client";

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  draft: { label: "Draft", bg: "bg-muted", text: "text-muted-foreground" },
  sent: { label: "Sent", bg: "bg-blue-100", text: "text-blue-700" },
  paid: { label: "Paid", bg: "bg-green-100", text: "text-green-700" },
  partially_paid: {
    label: "Partially Paid",
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  overdue: { label: "Overdue", bg: "bg-red-100", text: "text-red-700" },
  void: { label: "Void", bg: "bg-muted", text: "text-muted-foreground/60" },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
      )}
    >
      {config.label}
    </span>
  );
}
