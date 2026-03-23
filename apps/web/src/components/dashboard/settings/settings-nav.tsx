"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconUser,
  IconListDetails,
  IconChecklist,
  IconBuilding,
  IconCreditCard,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Profile", href: "/settings/profile", icon: IconUser },
  { label: "Service Catalog", href: "/settings/catalog", icon: IconListDetails },
  { label: "Checklists", href: "/settings/checklists", icon: IconChecklist },
  { label: "Business", href: "/settings/business", icon: IconBuilding },
  { label: "Billing", href: "/settings/billing", icon: IconCreditCard },
];

export function SettingsNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeIndex = tabs.findIndex((tab) => pathname.startsWith(tab.href));

  const updateIndicatorTo = useCallback(
    (index: number) => {
      const el = tabRefs.current[index];
      const navEl = navRef.current;
      if (el && navEl) {
        const navRect = navEl.getBoundingClientRect();
        const tabRect = el.getBoundingClientRect();
        setIndicator({
          left: tabRect.left - navRect.left + navEl.scrollLeft,
          width: tabRect.width,
        });
        if (!ready) setReady(true);
      }
    },
    [ready],
  );

  // Move indicator to hovered tab or active tab
  const targetIndex = hoveredIndex ?? activeIndex;

  useEffect(() => {
    if (targetIndex >= 0) {
      updateIndicatorTo(targetIndex);
    }
  }, [targetIndex, updateIndicatorTo, pathname]);

  // Recalculate on resize
  useEffect(() => {
    const onResize = () => {
      if (targetIndex >= 0) updateIndicatorTo(targetIndex);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [targetIndex, updateIndicatorTo]);

  return (
    <nav className="mt-4 border-b border-border" aria-label="Settings tabs">
      <div
        ref={navRef}
        className="relative -mb-px flex gap-6 overflow-x-auto"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {/* Sliding indicator */}
        <div
          className={cn(
            "absolute bottom-0 h-[2px] bg-brand",
            ready ? "transition-all duration-300 ease-in-out" : "",
          )}
          style={{ left: indicator.left, width: indicator.width }}
        />
        {tabs.map((tab, i) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap px-1 pb-3 text-sm font-medium transition-colors duration-200 font-body",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
