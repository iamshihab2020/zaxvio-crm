"use client";

import type { ServiceType } from "@hvac-saas/types";
import { BookingServiceCard } from "./booking-service-card";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import { IconTool } from "@tabler/icons-react";

interface BookingStepServiceProps {
  serviceTypes: string[];
  selected: ServiceType | null;
  onSelect: (type: ServiceType) => void;
}

export function BookingStepService({
  serviceTypes,
  selected,
  onSelect,
}: BookingStepServiceProps) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <IconTool className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-heading text-foreground">
            What do you need?
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            Select the type of service you need
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {serviceTypes.map((type) => (
          <BookingServiceCard
            key={type}
            serviceType={type as ServiceType}
            label={SERVICE_TYPE_LABELS[type as ServiceType] ?? type}
            selected={selected === type}
            onClick={() => onSelect(type as ServiceType)}
          />
        ))}
      </div>
    </div>
  );
}
