"use client";

import { useState, useEffect } from "react";
import {
  AvailabilityWeeklyEditor,
  type ScheduleEntry,
} from "@/components/dashboard/settings/availability-weekly-editor";
import { AvailabilityOverrideList } from "@/components/dashboard/settings/availability-override-list";
import { AvailabilityOverrideDialog } from "@/components/dashboard/settings/availability-override-dialog";
import { BookingCapacityCard } from "@/components/dashboard/settings/booking-capacity-card";
import {
  useAvailability,
  useUpdateAvailability,
  useCreateScheduleOverride,
  useDeleteScheduleOverride,
} from "@/hooks/queries";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_SCHEDULE: ScheduleEntry[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  dayOfWeek: day,
  startTime: "08:00",
  endTime: "17:00",
  isActive: day >= 1 && day <= 5,
}));

/**
 * This page sat on raw `useState`/`useEffect` + server actions, outside TanStack
 * Query entirely. Saving a new weekly schedule invalidated nothing, so the
 * calendar — which caches the same data under `queryKeys.bookings.availability()`
 * with a 5-minute staleTime — kept shading yesterday's hours with no way to force
 * a refresh (BOOK-20). Both surfaces now read and invalidate one key.
 */
export function BookingsSettingsClient() {
  const query = useAvailability();
  const updateMutation = useUpdateAvailability();
  const createOverrideMutation = useCreateScheduleOverride();
  const deleteOverrideMutation = useDeleteScheduleOverride();

  const [schedule, setSchedule] = useState<ScheduleEntry[]>(DEFAULT_SCHEDULE);
  const [savedSchedule, setSavedSchedule] = useState<ScheduleEntry[]>(DEFAULT_SCHEDULE);
  const [capacity, setCapacity] = useState(1);
  const [savedCapacity, setSavedCapacity] = useState(1);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  // Sync the editable draft whenever the server payload changes. Typed off the
  // hook's return rather than `(s: any)` ([[strict-rules]] §4).
  const serverSchedule = query.data?.weeklySchedule;
  const serverCapacity = query.data?.slotCapacity;

  useEffect(() => {
    if (!serverSchedule?.length) return;
    const mapped: ScheduleEntry[] = serverSchedule.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime?.substring(0, 5) ?? "08:00",
      endTime: s.endTime?.substring(0, 5) ?? "17:00",
      isActive: s.isActive ?? false,
    }));
    setSchedule(mapped);
    setSavedSchedule(mapped);
  }, [serverSchedule]);

  useEffect(() => {
    if (serverCapacity === undefined) return;
    setCapacity(serverCapacity);
    setSavedCapacity(serverCapacity);
  }, [serverCapacity]);

  const isDirty =
    JSON.stringify(schedule) !== JSON.stringify(savedSchedule) || capacity !== savedCapacity;

  const handleSaveSchedule = () => {
    updateMutation.mutate(
      { schedule, slotCapacity: capacity },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setSavedSchedule(schedule);
          setSavedCapacity(capacity);
        },
      },
    );
  };

  const handleAddOverride = (data: {
    overrideDate: string;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
    reason?: string;
  }) => {
    createOverrideMutation.mutate(data, {
      onSuccess: (res) => {
        if (!res.error) setOverrideDialogOpen(false);
      },
    });
  };

  const handleDeleteOverride = (id: string) => {
    deleteOverrideMutation.mutate(id);
  };

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <LoadErrorState
        title="Couldn't load your availability"
        message={query.error instanceof Error ? query.error.message : null}
        onRetry={() => query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <AvailabilityWeeklyEditor
        schedule={schedule}
        onChange={setSchedule}
        onSave={handleSaveSchedule}
        saving={updateMutation.isPending}
        dirty={isDirty}
      />

      <BookingCapacityCard value={capacity} onChange={setCapacity} />

      <AvailabilityOverrideList
        overrides={query.data.overrides}
        onAdd={() => setOverrideDialogOpen(true)}
        onDelete={handleDeleteOverride}
      />

      <AvailabilityOverrideDialog
        open={overrideDialogOpen}
        onOpenChange={setOverrideDialogOpen}
        onSave={handleAddOverride}
        saving={createOverrideMutation.isPending}
      />
    </div>
  );
}
