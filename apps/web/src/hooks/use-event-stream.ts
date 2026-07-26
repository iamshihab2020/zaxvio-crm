"use client";

import { useEffect, useRef } from "react";
import { subscribeToEvent, type EventChannel } from "@/lib/event-stream";

/**
 * Subscribe to a single SSE event. Replaces the Supabase Realtime
 * `.channel(...).on("broadcast", { event }, handler)` pattern.
 *
 * The handler is held in a ref, so callers may pass an inline arrow function
 * without re-subscribing on every render.
 *
 * @param enabled pass false (or omit the tenant id) to skip subscribing —
 *                several callers only know their tenant after an async fetch.
 */
export function useEventStream<T = Record<string, unknown>>(
  channel: EventChannel,
  event: string,
  handler: (payload: T) => void,
  enabled: boolean = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToEvent(channel, event, (payload) => {
      handlerRef.current(payload as T);
    });

    return unsubscribe;
  }, [channel, event, enabled]);
}
