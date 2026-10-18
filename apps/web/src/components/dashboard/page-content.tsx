"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRouteArrival } from "@/hooks/use-route-arrival";

export function PageContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const prevPathname = useRef(pathname);

  useEffect(() => {
    // On back/forward, pathname changes but Next.js 14 serves cached RSC payload.
    // router.refresh() forces a fresh server render, bypassing the router cache.
    // Skips initial mount (prevPathname === pathname).
    // Forward nav via Links is handled by staleTimes: { dynamic: 0 } in next.config.
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      router.refresh();
    }
  }, [pathname, router]);

  // Every dashboard route arrives the same way: content rises 8px into place
  // on navigation, never on first paint. One call here covers all of them, and
  // any route added later. `<main>` is keyed by pathname, so the ref points at
  // the new element by the time the hook's layout effect reads it.
  //
  // A page opts into a sequenced arrival by putting `data-stagger` on its
  // top-level containers (the contract is in the hook's docblock). The hook
  // reads the new `<main>`'s DOM at navigation time, which is why the marker
  // lives in the page and nothing has to be passed through here.
  const mainRef = useRef<HTMLElement>(null);
  useRouteArrival(mainRef);

  return (
    <main key={pathname} ref={mainRef} className={className}>
      {children}
    </main>
  );
}
