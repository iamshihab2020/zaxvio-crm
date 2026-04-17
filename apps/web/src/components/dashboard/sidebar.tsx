"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconBriefcase,
  IconFileDescription,
  IconReceipt,
  IconCalendarWeek,
  IconCalendarPlus,
  IconListDetails,
  IconChecklist,
  IconFileCheck,
  IconDevices2,
  IconSettings,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutSidebar,
  IconTooltip,
  IconChevronDown,
  IconChartBar,
  IconMessageCircle,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import { useSidebar, type SidebarMode } from "./sidebar-provider";
import { SidebarNavItem } from "./sidebar-nav-item";

type NavItem = { href: string; label: string; icon: typeof IconLayoutDashboard; badge?: string };
type NavGroup = { label: string; items: NavItem[]; defaultOpen?: boolean };

const standaloneItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/reports", label: "Reports", icon: IconChartBar },
];

const navGroups: NavGroup[] = [
  {
    label: "Schedule",
    defaultOpen: true,
    items: [
      { href: "/schedule", label: "Calendar", icon: IconCalendarWeek },
      { href: "/bookings", label: "Bookings", icon: IconCalendarPlus },
    ],
  },
  {
    label: "Manage",
    defaultOpen: true,
    items: [
      { href: "/customers", label: "Customers", icon: IconUsers },
      { href: "/jobs", label: "Jobs", icon: IconBriefcase },
      { href: "/conversations", label: "Conversations", icon: IconMessageCircle, badge: "Dev" },
    ],
  },
  {
    label: "Finance",
    defaultOpen: true,
    items: [
      { href: "/quotes", label: "Quotes", icon: IconFileDescription },
      { href: "/invoices", label: "Invoices", icon: IconReceipt },
      { href: "/service-agreements", label: "Agreements", icon: IconFileCheck },
    ],
  },
  {
    label: "Reference",
    defaultOpen: false,
    items: [
      { href: "/catalog", label: "Catalog", icon: IconListDetails },
      { href: "/checklists", label: "Checklists", icon: IconChecklist },
      { href: "/assets", label: "Assets", icon: IconDevices2 },
    ],
  },
];

const modeOptions: { value: SidebarMode; icon: typeof IconLayoutSidebar; label: string }[] = [
  { value: "hover-expand", icon: IconLayoutSidebar, label: "Hover to expand" },
  { value: "icon-tooltip", icon: IconTooltip, label: "Icon + tooltips" },
];

/** Extract pathname portion from href (strips query string) */
function basePath(href: string): string {
  const idx = href.indexOf("?");
  return idx >= 0 ? href.slice(0, idx) : href;
}

const COLLAPSED_GROUPS_KEY = "zaxvio-sidebar-groups";

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

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

  // Resolve Jobs href with last-used pipeline from localStorage
  const [jobsPipelineId, setJobsPipelineId] = useState<string | null>(null);
  useEffect(() => {
    setJobsPipelineId(localStorage.getItem("jobs-pipeline-id"));
  }, []);

  const resolvedNavGroups = useMemo(() => {
    if (!jobsPipelineId) return navGroups;
    return navGroups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === "/jobs"
          ? { ...item, href: `/jobs?pipeline=${jobsPipelineId}` }
          : item,
      ),
    }));
  }, [jobsPipelineId]);

  // Collapsible group state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupsMounted, setGroupsMounted] = useState(false);

  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups());
    setGroupsMounted(true);
  }, []);

  useEffect(() => {
    if (!groupsMounted) return;
    localStorage.setItem(
      COLLAPSED_GROUPS_KEY,
      JSON.stringify([...collapsedGroups]),
    );
  }, [collapsedGroups, groupsMounted]);

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  const handleMouseEnter = () => {
    if (isCollapsed && mode === "hover-expand") {
      setHoverExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (isHoverExpanded) {
      setHoverExpanded(false);
    }
  };

  // Shift sidebar down when impersonation bar is visible
  const [isImpersonating, setIsImpersonating] = useState(false);
  useEffect(() => {
    setIsImpersonating(document.cookie.includes("x-impersonation-id="));
  }, []);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed left-0 z-30 flex flex-col border-r border-border bg-card transition-[width,top] duration-300 ease-in-out",
          isImpersonating ? "top-10 bottom-0" : "inset-y-0",
          isEffectivelyExpanded ? "w-56" : "w-16",
          isHoverExpanded && "shadow-xl",
        )}
      >
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

        {/* Nav items — scrollable */}
        <ScrollArea
          className={cn(
            "flex-1",
            !isEffectivelyExpanded && "scrollbar-none [&_[data-radix-scroll-area-scrollbar]]:hidden",
          )}
        >
          <nav className="flex flex-col p-3 gap-0.5" aria-label="Main navigation">
            {/* Dashboard (standalone) */}
            {standaloneItems.map((item) => {
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
                  badge={item.badge}
                />
              );
            })}

            {/* Grouped sections — collapsible */}
            {resolvedNavGroups.map((group) => {
              const isGroupCollapsed =
                isEffectivelyExpanded &&
                (groupsMounted
                  ? collapsedGroups.has(group.label)
                  : !group.defaultOpen);

              // When sidebar is collapsed, just show items without group headers
              if (!isEffectivelyExpanded) {
                return (
                  <div key={group.label} className="mt-1">
                    <div className="mx-3 mb-0.5 border-t border-border" />
                    <div className="flex flex-col">
                      {group.items.map((item) => {
                        const base = basePath(item.href);
                        const isActive =
                          pathname === base ||
                          pathname.startsWith(base + "/");
                        return (
                          <SidebarNavItem
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            icon={item.icon}
                            isActive={isActive}
                            isCollapsed
                            showLabel={false}
                            useTooltip={useTooltipMode}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Expanded sidebar — collapsible groups
              return (
                <div key={group.label} className="mt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between px-3 py-1 group h-auto"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-heading select-none">
                      {group.label}
                    </span>
                    <IconChevronDown
                      className={cn(
                        "h-3 w-3 text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground",
                        isGroupCollapsed && "-rotate-90",
                      )}
                    />
                  </Button>
                  <div
                    className={cn(
                      "flex flex-col gap-0.5 overflow-hidden transition-all duration-200",
                      isGroupCollapsed
                        ? "max-h-0 opacity-0"
                        : "max-h-[500px] opacity-100 mt-0.5",
                    )}
                  >
                    {group.items.map((item) => {
                      const base = basePath(item.href);
                      const isActive =
                        pathname === base ||
                        pathname.startsWith(base + "/");
                      return (
                        <SidebarNavItem
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          isActive={isActive}
                          isCollapsed={false}
                          showLabel
                          useTooltip={false}
                          badge={item.badge}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        <div className="relative z-10 flex flex-col gap-1 border-t border-border p-3">
          {/* Expand button when collapsed */}
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
            href="/settings/profile"
            label="Settings"
            icon={IconSettings}
            isActive={
              pathname === "/settings" || pathname.startsWith("/settings/")
            }
            isCollapsed={isCollapsed && !isHoverExpanded}
            showLabel={showLabel}
            useTooltip={useTooltipMode}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
