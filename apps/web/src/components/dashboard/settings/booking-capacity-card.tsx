"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { IconUsersGroup } from "@tabler/icons-react";

interface BookingCapacityCardProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * How many appointments the business can run at the same time.
 *
 * This was hardcoded to 1 inside the public slot query: a slot was offered only
 * if *no* booking held it, so a three-person team could sell one job an hour
 * through the portal and had no way to say otherwise (BOOK-28).
 *
 * Saved with the weekly schedule — the Save Schedule button covers both.
 */
export function BookingCapacityCard({ value, onChange }: BookingCapacityCardProps) {
  return (
    <SettingsSection
      icon={IconUsersGroup}
      title="Booking Capacity"
      description="How many appointments you can handle at the same time. Raise this if you have more than one person on the road."
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-32">
          <Label htmlFor="slot-capacity" className="sr-only">
            Appointments per time slot
          </Label>
          <Input
            id="slot-capacity"
            type="number"
            min={1}
            max={50}
            value={value}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(next)) return;
              onChange(Math.min(50, Math.max(1, next)));
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground font-body">
          {value === 1
            ? "One appointment per time slot."
            : `Up to ${value} appointments can share the same time slot.`}
        </p>
      </div>
    </SettingsSection>
  );
}
