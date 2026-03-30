import { getDb, platformEvents } from "@hvac-saas/database";

type EventType =
  | "login"
  | "job_created"
  | "invoice_sent"
  | "booking_received"
  | "customer_created";

/**
 * Emit a platform event for activity tracking (DAT/WAT/MAT).
 * Fire-and-forget — does not throw on failure.
 */
export function emitPlatformEvent(
  tenantId: string,
  eventType: EventType,
  userId: string | null,
  metadata?: Record<string, unknown>,
) {
  const db = getDb();
  db.insert(platformEvents)
    .values({
      tenantId,
      eventType,
      userId,
      metadata: metadata ?? null,
    })
    .then(() => {
      // Successfully emitted — no-op
    })
    .catch((err) => {
      console.error("[platform-events] Failed to emit event:", eventType, err);
    });
}
