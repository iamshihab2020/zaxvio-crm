"use client";

import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { IconClock, IconDeviceFloppy } from "@tabler/icons-react";
import { DAY_NAMES } from "@/lib/constants/booking-options";

export interface ScheduleEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityWeeklyEditorProps {
  schedule: ScheduleEntry[];
  onChange: (schedule: ScheduleEntry[]) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

export function AvailabilityWeeklyEditor({
  schedule,
  onChange,
  onSave,
  saving,
  dirty,
}: AvailabilityWeeklyEditorProps) {
  const updateDay = (dayOfWeek: number, updates: Partial<ScheduleEntry>) => {
    onChange(
      schedule.map((entry) =>
        entry.dayOfWeek === dayOfWeek ? { ...entry, ...updates } : entry,
      ),
    );
  };

  // Sort by Mon-Sun (1,2,3,4,5,6,0)
  const sortedSchedule = [...schedule].sort((a, b) => {
    const orderA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const orderB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return orderA - orderB;
  });

  return (
    <SettingsSection
      icon={IconClock}
      title="Weekly Schedule"
      description="Set your regular working hours. Customers can only book during active hours."
      action={
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving || !dirty}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconDeviceFloppy className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Schedule"}
        </Button>
      }
    >
      <div className="space-y-3">
        {sortedSchedule.map((entry) => (
          <div
            key={entry.dayOfWeek}
            className="flex items-center gap-4 rounded-md border border-border px-4 py-3"
          >
            <div className="w-24 shrink-0">
              <span className="text-sm font-medium font-body">
                {DAY_NAMES[entry.dayOfWeek]}
              </span>
            </div>

            <Switch
              checked={entry.isActive}
              onCheckedChange={(checked) =>
                updateDay(entry.dayOfWeek, { isActive: checked })
              }
            />

            {entry.isActive ? (
              <div className="flex items-center gap-2">
                <div className="w-36">
                  <TimePicker
                    value={entry.startTime}
                    onChange={(v) => updateDay(entry.dayOfWeek, { startTime: v })}
                    placeholder="Start"
                  />
                </div>
                <span className="text-sm text-muted-foreground">to</span>
                <div className="w-36">
                  <TimePicker
                    value={entry.endTime}
                    onChange={(v) => updateDay(entry.dayOfWeek, { endTime: v })}
                    placeholder="End"
                  />
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
