"use client";

import { cn } from "@/lib/utils";
import {
  IconTool,
  IconSettings,
  IconAdjustments,
  IconSearch,
  IconUrgent,
  IconMessages,
  IconDots,
} from "@tabler/icons-react";
import type { ServiceType } from "@hvac-saas/types";

const SERVICE_ICONS: Record<ServiceType, React.ComponentType<{ className?: string }>> = {
  installation: IconTool,
  repair: IconSettings,
  maintenance: IconAdjustments,
  inspection: IconSearch,
  emergency: IconUrgent,
  consultation: IconMessages,
  other: IconDots,
};

const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  installation: "New system setup",
  repair: "Fix existing issues",
  maintenance: "Regular tune-up",
  inspection: "System checkup",
  emergency: "Urgent service",
  consultation: "Expert advice",
  other: "Other service",
};

interface BookingServiceCardProps {
  serviceType: ServiceType;
  label: string;
  selected: boolean;
  onClick: () => void;
}

export function BookingServiceCard({
  serviceType,
  label,
  selected,
  onClick,
}: BookingServiceCardProps) {
  const Icon = SERVICE_ICONS[serviceType] ?? IconDots;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all duration-200",
        selected
          ? "border-brand bg-brand/5 ring-2 ring-brand/20 shadow-sm"
          : "border-border bg-card hover:border-brand/40 hover:bg-brand/5",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
          selected ? "bg-brand text-white" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-sm font-semibold font-heading">{label}</span>
      <span className="text-xs text-muted-foreground">
        {SERVICE_DESCRIPTIONS[serviceType]}
      </span>
    </button>
  );
}
