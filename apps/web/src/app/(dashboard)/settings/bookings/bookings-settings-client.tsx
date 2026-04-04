"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScheduleOverride } from "@hvac-saas/types";
import {
  AvailabilityWeeklyEditor,
  type ScheduleEntry,
} from "@/components/dashboard/settings/availability-weekly-editor";
import { AvailabilityOverrideList } from "@/components/dashboard/settings/availability-override-list";
import { AvailabilityOverrideDialog } from "@/components/dashboard/settings/availability-override-dialog";
import { SettingsFormMessage } from "@/components/dashboard/settings/settings-form-message";
import {
  getAvailability,
  updateAvailability,
  createScheduleOverride,
  deleteScheduleOverride,
} from "@/actions/bookings";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const DEFAULT_SCHEDULE: ScheduleEntry[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  startTime: "08:00",
  endTime: "17:00",
  isActive: day >= 1 && day <= 5,
}));

interface BookingsSettingsClientProps {
  initialData?: { weeklySchedule: Array<{ dayOfWeek: number; startTime: string | null; endTime: string | null; isActive: boolean }>; overrides: ScheduleOverride[] };
}

export function BookingsSettingsClient({ initialData }: BookingsSettingsClientProps) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() => {
    if (initialData?.weeklySchedule?.length) {
      return initialData.weeklySchedule.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime?.substring(0, 5) ?? "08:00",
        endTime: s.endTime?.substring(0, 5) ?? "17:00",
        isActive: s.isActive ?? false,
      }));
    }
    return DEFAULT_SCHEDULE;
  });
  const [originalSchedule, setOriginalSchedule] = useState<ScheduleEntry[]>(schedule);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>(initialData?.overrides ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getAvailability();
    if (result.data) {
      const { weeklySchedule, overrides: fetchedOverrides } = result.data;
      if (weeklySchedule.length > 0) {
        const mapped: ScheduleEntry[] = weeklySchedule.map((s: any) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime?.substring(0, 5) ?? "08:00",
          endTime: s.endTime?.substring(0, 5) ?? "17:00",
          isActive: s.isActive ?? false,
        }));
        setSchedule(mapped);
        setOriginalSchedule(mapped);
      }
      setOverrides(fetchedOverrides ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialData) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = JSON.stringify(schedule) !== JSON.stringify(originalSchedule);

  const handleSaveSchedule = async () => {
    setSaving(true);
    setMessage(null);
    const result = await updateAvailability(schedule);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Schedule saved" });
      setOriginalSchedule(schedule);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAddOverride = async (data: {
    overrideDate: string;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) => {
    setSavingOverride(true);
    const result = await createScheduleOverride(data);
    setSavingOverride(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setOverrideDialogOpen(false);
      fetchData();
      toast.success("Override added");
    }
  };

  const handleDeleteOverride = async (id: string) => {
    const result = await deleteScheduleOverride(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast.success("Override removed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && <SettingsFormMessage message={message} />}

      <AvailabilityWeeklyEditor
        schedule={schedule}
        onChange={setSchedule}
        onSave={handleSaveSchedule}
        saving={saving}
        dirty={isDirty}
      />

      <AvailabilityOverrideList
        overrides={overrides}
        onAdd={() => setOverrideDialogOpen(true)}
        onDelete={handleDeleteOverride}
      />

      <AvailabilityOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        onSave={handleAddOverride}
        saving={savingOverride}
      />
    </div>
  );
}
