"use client";

import { useRef } from "react";
import { useRouteArrival } from "@/hooks/use-route-arrival";

/**
 * A layout's content area that plays the route arrival on navigation.
 *
 * For layouts that are server components (superadmin, blog, legal), which
 * cannot hold the ref themselves. The dashboard's `PageContent` calls
 * `useRouteArrival` directly, since it is already a client component.
 */
export function RouteStage({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useRouteArrival(ref);
  return (
    <main ref={ref} id={id} className={className}>
      {children}
    </main>
  );
}
