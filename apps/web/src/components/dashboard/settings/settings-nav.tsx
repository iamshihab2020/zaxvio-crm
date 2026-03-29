"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconUser,
  IconBuilding,
  IconFileInvoice,
  IconFileDescription,
  IconCalendarEvent,
  IconCreditCard,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Icon } from "@tabler/icons-react";

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/settings/profile", icon: IconUser },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Business", href: "/settings/business", icon: IconBuilding },
      { label: "Billing", href: "/settings/billing", icon: IconCreditCard },
    ],
  },
  {
    label: "Documents",
    items: [
      { label: "Invoices", href: "/settings/invoices", icon: IconFileInvoice },
      { label: "Quotes", href: "/settings/quotes", icon: IconFileDescription },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { label: "Bookings", href: "/settings/bookings", icon: IconCalendarEvent },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Indicator state for desktop sidebar
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const containerRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const activeHref = allItems.find((item) => pathname.startsWith(item.href))?.href ?? "";
  const targetHref = hoveredHref ?? activeHref;

  const updateIndicator = useCallback(
    (href: string) => {
      const el = itemRefs.current.get(href);
      const container = containerRef.current;
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setIndicator({
          top: elRect.top - containerRect.top,
          height: elRect.height,
        });
        if (!ready) setReady(true);
      }
    },
    [ready],
  );

  useEffect(() => {
    if (targetHref) updateIndicator(targetHref);
  }, [targetHref, updateIndicator, pathname]);

  useEffect(() => {
    const onResize = () => {
      if (targetHref) updateIndicator(targetHref);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [targetHref, updateIndicator]);

  const activeItem = allItems.find((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Mobile: Select dropdown */}
      <div className="md:hidden px-6 pt-6">
        <Select
          value={activeHref}
          onValueChange={(value) => router.push(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {activeItem && (
                <span className="flex items-center gap-2 font-body text-sm">
                  <activeItem.icon className="h-4 w-4" />
                  {activeItem.label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <SelectItem key={item.href} value={item.href}>
                    <span className="flex items-center gap-2 font-body">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Grouped sidebar */}
      <nav
        ref={containerRef}
        className="hidden md:block w-56 shrink-0 border-r border-border"
        aria-label="Settings navigation"
        onMouseLeave={() => setHoveredHref(null)}
      >
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="relative p-4 space-y-5">
            {/* Sliding indicator */}
            <div
              className={cn(
                "absolute left-4 right-4 rounded-md bg-brand-light",
                ready
                  ? "transition-all duration-200 ease-in-out"
                  : "opacity-0",
              )}
              style={{ top: indicator.top, height: indicator.height }}
            />

            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        ref={(el) => {
                          if (el) itemRefs.current.set(item.href, el);
                        }}
                        onMouseEnter={() => setHoveredHref(item.href)}
                        className={cn(
                          "relative z-10 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 font-body",
                          isActive
                            ? "text-brand"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </nav>
    </>
  );
}
