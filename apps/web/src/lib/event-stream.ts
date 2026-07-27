"use client";

import { getClientEnv } from "./env";

/**
 * Shared SSE connection to the API, replacing Supabase Realtime.
 * See docs/claude/reference/decisions.md (ADR-001).
 *
 * One EventSource per browser tab, multiplexed across all channels — six
 * components subscribe independently, so opening a connection per component
 * would waste six sockets. The connection opens on the first subscriber and
 * closes when the last one leaves.
 *
 * Reconnection is handled by EventSource itself; the server sends a `retry`
 * interval and a periodic heartbeat so idle proxies do not drop the stream.
 */

export type EventChannel = "notifications" | "conversations" | "quotes" | "impersonation";

type Handler = (payload: Record<string, unknown>) => void;

/** Keyed "channel:event" — matches the old Supabase `.on("broadcast", { event })`. */
const handlers = new Map<string, Set<Handler>>();

let source: EventSource | null = null;
/** Channels we have already attached a DOM listener for. */
const boundChannels = new Set<EventChannel>();

function key(channel: EventChannel, event: string): string {
  return `${channel}:${event}`;
}

function bindChannel(eventSource: EventSource, channel: EventChannel): void {
  if (boundChannels.has(channel)) return;
  boundChannels.add(channel);

  eventSource.addEventListener(channel, (message: MessageEvent<string>) => {
    let parsed: { event: string; payload: Record<string, unknown> };
    try {
      parsed = JSON.parse(message.data);
    } catch {
      console.error(`[events] malformed ${channel} frame`);
      return;
    }

    const listeners = handlers.get(key(channel, parsed.event));
    if (!listeners) return;
    for (const handler of listeners) handler(parsed.payload);
  });
}

function ensureConnection(): EventSource {
  if (source) return source;

  const { NEXT_PUBLIC_API_URL } = getClientEnv();
  // withCredentials sends the Better Auth session cookie cross-origin
  // (the API allows this via CORS `credentials: true`).
  source = new EventSource(`${NEXT_PUBLIC_API_URL}/events`, { withCredentials: true });

  source.addEventListener("error", () => {
    // EventSource reconnects on its own; log only for visibility.
    console.warn("[events] stream interrupted — reconnecting");
  });

  for (const channel of boundChannels) {
    // Re-bind on a fresh connection.
    boundChannels.delete(channel);
    bindChannel(source, channel);
  }

  return source;
}

function closeIfIdle(): void {
  for (const listeners of handlers.values()) {
    if (listeners.size > 0) return;
  }
  source?.close();
  source = null;
  boundChannels.clear();
}

/**
 * Open a standalone stream scoped to another tenant. Admin-only — the API
 * rejects the `tenantId` param for non-admins.
 *
 * Deliberately not part of the shared connection: this targets a different
 * tenant, is short-lived, and belongs to one dialog. Returns a close function.
 */
export function openTenantStream(
  tenantId: string,
  channel: EventChannel,
  event: string,
  handler: Handler,
): () => void {
  const { NEXT_PUBLIC_API_URL } = getClientEnv();
  const stream = new EventSource(
    `${NEXT_PUBLIC_API_URL}/events?tenantId=${encodeURIComponent(tenantId)}`,
    { withCredentials: true },
  );

  stream.addEventListener(channel, (message: MessageEvent<string>) => {
    try {
      const parsed: { event: string; payload: Record<string, unknown> } = JSON.parse(
        message.data,
      );
      if (parsed.event === event) handler(parsed.payload);
    } catch {
      console.error(`[events] malformed ${channel} frame`);
    }
  });

  return () => stream.close();
}

/** Subscribe to one event on one channel. Returns an unsubscribe function. */
export function subscribeToEvent(
  channel: EventChannel,
  event: string,
  handler: Handler,
): () => void {
  const eventSource = ensureConnection();
  bindChannel(eventSource, channel);

  const mapKey = key(channel, event);
  let listeners = handlers.get(mapKey);
  if (!listeners) {
    listeners = new Set();
    handlers.set(mapKey, listeners);
  }
  listeners.add(handler);

  return () => {
    listeners.delete(handler);
    if (listeners.size === 0) handlers.delete(mapKey);
    closeIfIdle();
  };
}
