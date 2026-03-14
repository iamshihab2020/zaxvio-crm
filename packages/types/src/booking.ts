import type { bookings } from "@hvac-saas/database";

export type Booking = typeof bookings.$inferSelect;
export type BookingInsert = typeof bookings.$inferInsert;
export type BookingUpdate = Partial<BookingInsert>;
