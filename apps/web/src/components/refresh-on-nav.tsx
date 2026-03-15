"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Next.js 14's Router Cache serves stale RSC payloads on back/forward
 * navigation (popstate). staleTimes only fixes forward navigations.
 * This component forces a server re-fetch on every back/forward press.
 */
export function RefreshOnNav() {
  const router = useRouter();

  useEffect(() => {
    const onPopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}
