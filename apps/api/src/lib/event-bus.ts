import { EventEmitter } from "node:events";

/**
 * In-process pub/sub replacing Supabase Realtime broadcast.
 * See docs/claude/reference/decisions.md (ADR-001).
 *
 * Every previous Supabase usage was fire-and-forget `broadcast` — the API
 * published a message and browsers listening on a tenant channel received it.
 * Nothing ever read the Postgres WAL, so an in-process emitter plus the SSE
 * endpoint in routes/events reproduces the behaviour with no external service.
 *
 * SINGLE-INSTANCE ONLY: a second API process would not see events published by
 * the first. To scale horizontally, swap the emitter here for Redis pub/sub —
 * `publish` and `subscribe` are the entire surface, so nothing else changes.
 */

/** Mirrors the old Supabase channel names. */
export type EventChannel = "notifications" | "conversations" | "quotes" | "impersonation";

export interface TenantEvent {
  channel: EventChannel;
  /** Matches the old broadcast `event` name, e.g. "new_notification". */
  event: string;
  payload: Record<string, unknown>;
}

// Node's default limit of 10 listeners would warn once ~10 browser tabs connect.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

function topic(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/**
 * Publish an event to everyone currently streaming for this tenant.
 * Fire-and-forget, exactly like the Supabase broadcast it replaces — if nobody
 * is connected the event is simply dropped.
 */
export function publish(
  tenantId: string,
  channel: EventChannel,
  event: string,
  payload: Record<string, unknown>,
): void {
  emitter.emit(topic(tenantId), { channel, event, payload } satisfies TenantEvent);
}

/** Subscribe to a tenant's events. Returns an unsubscribe function. */
export function subscribe(
  tenantId: string,
  listener: (event: TenantEvent) => void,
): () => void {
  emitter.on(topic(tenantId), listener);
  return () => {
    emitter.off(topic(tenantId), listener);
  };
}
