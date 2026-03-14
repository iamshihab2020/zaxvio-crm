import type {
  availabilitySchedules,
  scheduleOverrides,
} from "@hvac-saas/database";

export type AvailabilitySchedule = typeof availabilitySchedules.$inferSelect;
export type ScheduleOverride = typeof scheduleOverrides.$inferSelect;
