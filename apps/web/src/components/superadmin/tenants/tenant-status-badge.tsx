"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  trialing: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  past_due: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  paused: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
  expired: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
};

export function TenantStatusBadge({
  status,
  isActive,
}: {
  status: string | null;
  isActive: boolean | null;
}) {
  if (isActive === false) {
    return (
      <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400 border-0 font-body text-xs">
        Deactivated
      </Badge>
    );
  }

  const label = status ?? "unknown";
  const colorClass = STATUS_COLORS[label] ?? STATUS_COLORS.expired;

  return (
    <Badge className={`${colorClass} border-0 font-body text-xs capitalize`}>
      {label.replace("_", " ")}
    </Badge>
  );
}
