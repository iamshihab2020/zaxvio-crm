"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

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

  return (
    <main key={pathname} className={className}>
      {children}
    </main>
  );
}
