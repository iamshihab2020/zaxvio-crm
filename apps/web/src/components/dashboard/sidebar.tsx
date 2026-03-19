"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconBriefcase,
  IconFileInvoice,
  IconFileText,
  IconCalendar,
  IconSettings,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutSidebar,
  IconTooltip,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import { useSidebar, type SidebarMode } from "./sidebar-provider";
import { SidebarNavItem } from "./sidebar-nav-item";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/customers", label: "Customers", icon: IconUsers },
  { href: "/jobs", label: "Jobs", icon: IconBriefcase },
  { href: "/quotes", label: "Quotes", icon: IconFileText },
  { href: "/invoices", label: "Invoices", icon: IconFileInvoice },
  { href: "/schedule", label: "Schedule", icon: IconCalendar },
];

const allItems = [
  ...navItems,
  { href: "/settings", label: "Settings", icon: IconSettings },
];

const modeOptions: { value: SidebarMode; icon: typeof IconLayoutSidebar; label: string }[] = [
  { value: "hover-expand", icon: IconLayoutSidebar, label: "Hover to expand" },
  { value: "icon-tooltip", icon: IconTooltip, label: "Icon + tooltips" },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    isCollapsed,
    mode,
    isHoverExpanded,
    toggleCollapsed,
    setMode,
    setHoverExpanded,
  } = useSidebar();

  const isEffectivelyExpanded = !isCollapsed || isHoverExpanded;
  const showLabel = isEffectivelyExpanded;
  const useTooltipMode = isCollapsed && !isHoverExpanded && mode === "icon-tooltip";

  // Refs for all nav items (including settings)
  const itemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const sidebarRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ top: 0, height: 0, opacity: 0 });
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  const getActiveHref = useCallback(() => {
    return allItems.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
    )?.href ?? null;
  }, [pathname]);

  const updateIndicator = useCallback(
    (targetHref: string | null) => {
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
    },
    [],
  );

  // Update indicator position when active route or sidebar expansion changes
  const activeHref = getActiveHref();
  const targetHref = hoveredHref ?? activeHref;

  useEffect(() => {
    // Small delay to let DOM settle after sidebar expand/collapse
    const timer = setTimeout(() => updateIndicator(targetHref), 30);
    return () => clearTimeout(timer);
  }, [targetHref, updateIndicator, isEffectivelyExpanded]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => updateIndicator(targetHref);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [targetHref, updateIndicator]);

  const handleMouseEnter = () => {
    if (isCollapsed && mode === "hover-expand") {
      setHoverExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (isHoverExpanded) {
      setHoverExpanded(false);
    }
    setHoveredHref(null);
  };

  function setItemRef(href: string) {
    return (el: HTMLAnchorElement | null) => {
      if (el) {
        itemRefs.current.set(href, el);
      } else {
        itemRefs.current.delete(href);
      }
    };
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out",
          isEffectivelyExpanded ? "w-60" : "w-16",
          isHoverExpanded && "shadow-xl",
        )}
      >
        {/* Sliding indicator */}
        <div
          className="absolute left-3 right-3 rounded-md bg-brand-light transition-all duration-300 ease-in-out"
          style={{
            top: indicator.top,
            height: indicator.height,
            opacity: indicator.opacity,
          }}
        />

        {/* Header: Logo + Collapse toggle */}
        <div className="relative z-10 flex h-14 items-center border-b border-border px-3">
          <Link href="/dashboard" className="flex-1 overflow-hidden">
            <Logo size="sm" showText={showLabel} asLink={false} />
          </Link>
          {isEffectivelyExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
            >
              <IconChevronsLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <SidebarNavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                isCollapsed={isCollapsed && !isHoverExpanded}
                showLabel={showLabel}
                useTooltip={useTooltipMode}
                itemRef={setItemRef(item.href)}
                onMouseEnter={() => setHoveredHref(item.href)}
                onMouseLeave={() => setHoveredHref(null)}
              />
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="relative z-10 flex flex-col gap-1 p-3">
          {/* Expand button when collapsed (no hover-expand) */}
          {isCollapsed && !isHoverExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-muted-foreground"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
            >
              <IconChevronsRight className="h-5 w-5" />
            </Button>
          )}

          {/* Mode selector - visible only when fully expanded */}
          {isEffectivelyExpanded && (
            <div className="mb-1 flex items-center gap-1">
              {modeOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={mode === opt.value ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMode(opt.value)}
                  aria-label={opt.label}
                  title={opt.label}
                >
                  <opt.icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          )}

          {/* Settings */}
          <SidebarNavItem
            href="/settings"
            label="Settings"
            icon={IconSettings}
            isActive={
              pathname === "/settings" || pathname.startsWith("/settings/")
            }
            isCollapsed={isCollapsed && !isHoverExpanded}
            showLabel={showLabel}
            useTooltip={useTooltipMode}
            itemRef={setItemRef("/settings")}
            onMouseEnter={() => setHoveredHref("/settings")}
            onMouseLeave={() => setHoveredHref(null)}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
