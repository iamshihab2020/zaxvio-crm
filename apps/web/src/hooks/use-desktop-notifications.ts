"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "zaxvio-desktop-notifications";

/**
 * Wraps the Browser Notification API with a simple hook.
 * Permission state persists across page loads via Notification.permission.
 */
export function useDesktopNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    "default",
  );

  // Sync with real browser permission on mount
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    try {
      localStorage.setItem(STORAGE_KEY, result);
    } catch {
      // ignore storage errors
    }
  }, []);

  const notify = useCallback(
    (title: string, body?: string) => {
      if (permission !== "granted") return;
      if (typeof Notification === "undefined") return;
      try {
        const n = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "zaxvio-message", // replaces previous notification of same tag
        });
        setTimeout(() => n.close(), 5000);
      } catch {
        // Some browsers throw if notifications aren't allowed
      }
    },
    [permission],
  );

  return { permission, requestPermission, notify };
}
