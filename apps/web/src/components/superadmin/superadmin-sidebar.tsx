"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconBuilding,
  IconChartBar,
  IconHeadset,
  IconUsers,
  IconServer,
  IconChevronsLeft,
  IconChevronsRight,
  IconShieldLock,
  IconUserShield,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSuperadminSidebar } from "./superadmin-sidebar-provider";

const navItems = [
  { href: "/superadmin/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/superadmin/tenants", label: "Tenants", icon: IconBuilding },
  { href: "/superadmin/analytics", label: "Analytics", icon: IconChartBar },
  { href: "/superadmin/support", label: "Support", icon: IconHeadset },
  { href: "/superadmin/affiliates", label: "Affiliates", icon: IconUsers },
  { href: "/superadmin/system", label: "System", icon: IconServer },
  { href: "/superadmin/admins", label: "Admins", icon: IconUserShield },
];

export function SuperadminSidebar() {
  const pathname = usePathname();
  const { isCollapsed, isHoverExpanded, toggleCollapsed, setHoverExpanded } =
    useSuperadminSidebar();

  const isExpanded = !isCollapsed || isHoverExpanded;
  const sidebarRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicator, setIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const getActiveHref = useCallback(() => {
    return (
      navItems.find(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + "/"),
      )?.href ?? null
    );
  }, [pathname]);

  const updateIndicator = useCallback((targetHref: string | null) => {
    if (!targetHref) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = itemRefs.current.get(targetHref);
    const sidebar = sidebarRef.current;
    if (el && sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({
        top: elRect.top - sidebarRect.top,
        height: elRect.height,
        opacity: 1,
      });
    }
  }, []);

  const activeHref = getActiveHref();
  const targetHref = hoveredHref ?? activeHref;

  useEffect(() => {
    const timer = setTimeout(() => updateIndicator(targetHref), 30);
    return () => clearTimeout(timer);
  }, [targetHref, updateIndicator, isExpanded]);

  useEffect(() => {
    const handleResize = () => updateIndicator(targetHref);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [targetHref, updateIndicator]);

  function setItemRef(href: string) {
    return (el: HTMLAnchorElement | null) => {
      if (el) itemRefs.current.set(href, el);
      else itemRefs.current.delete(href);
    };
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        ref={sidebarRef}
        onMouseEnter={() => {
          if (isCollapsed) setHoverExpanded(true);
        }}
        onMouseLeave={() => {
          if (isHoverExpanded) setHoverExpanded(false);
          setHoveredHref(null);
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-red-900/20 bg-admin-sidebar-bg transition-[width] duration-300 ease-in-out dark:border-red-800/20",
          isExpanded ? "w-60" : "w-16",
          isHoverExpanded && "shadow-xl",
        )}
      >
        {/* Active indicator */}
        <div
          className="absolute left-3 right-3 rounded-md bg-admin-accent/15 transition-all duration-300 ease-in-out"
          style={{
            top: indicator.top,
            height: indicator.height,
            opacity: indicator.opacity,
          }}
        />

        {/* Header */}
        <div className="relative z-10 flex h-14 items-center border-b border-red-900/20 px-3 dark:border-red-800/20">
          <Link
            href="/superadmin/dashboard"
            className="flex flex-1 items-center gap-2 overflow-hidden"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-admin-accent">
              <IconShieldLock className="h-4 w-4 text-white" />
            </div>
            {isExpanded && (
              <span className="truncate font-heading text-sm font-bold text-admin-sidebar-foreground">
                Admin Panel
              </span>
            )}
          </Link>
          {isExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-admin-sidebar-foreground/60 hover:bg-admin-accent/20 hover:text-admin-sidebar-foreground"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
            >
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Admin navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const link = (
              <Link
                ref={setItemRef(item.href)}
                href={item.href}
                onMouseEnter={() => setHoveredHref(item.href)}
                onMouseLeave={() => setHoveredHref(null)}
                className={cn(
                  "relative z-10 flex h-10 w-full items-center rounded-md px-3 text-sm font-medium font-body transition-colors duration-200",
                  isExpanded ? "justify-start gap-3" : "justify-center px-0",
                  isActive
                    ? "text-admin-accent"
                    : "text-admin-sidebar-foreground/70 hover:text-admin-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="truncate">{item.label}</span>}
              </Link>
            );

            if (isCollapsed && !isHoverExpanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{link}</div>;
          })}
        </nav>

        {/* Expand button (collapsed state) */}
        {isCollapsed && !isHoverExpanded && (
          <div className="p-3">
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-admin-sidebar-foreground/60 hover:bg-admin-accent/20 hover:text-admin-sidebar-foreground"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
            >
              <IconChevronsRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
