"use client";

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
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import { useSidebar, type SidebarMode } from "./sidebar-provider";
import { SidebarNavItem } from "./sidebar-nav-item";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/customers", label: "Customers", icon: IconUsers },
  { href: "/jobs", label: "Jobs", icon: IconBriefcase },
  { href: "/invoices", label: "Invoices", icon: IconFileInvoice },
  { href: "/quotes", label: "Quotes", icon: IconFileText },
  { href: "/schedule", label: "Schedule", icon: IconCalendar },
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
  const useTooltip = isCollapsed && !isHoverExpanded && mode === "icon-tooltip";

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

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out",
          isEffectivelyExpanded ? "w-60" : "w-16",
          isHoverExpanded && "shadow-xl",
        )}
      >
        {/* Header: Logo + Collapse toggle */}
        <div className="flex h-14 items-center border-b border-border px-3">
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
                useTooltip={useTooltip}
              />
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3">
          {/* Mode selector - visible only when fully expanded */}
          {isEffectivelyExpanded && (
            <div className="mb-3 flex items-center gap-1">
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

          <Separator className="mb-3" />

          {/* Expand button when collapsed (no hover-expand) */}
          {isCollapsed && !isHoverExpanded && (
            <Button
              variant="ghost"
              size="icon"
              className="mb-2 w-full text-muted-foreground"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
            >
              <IconChevronsRight className="h-5 w-5" />
            </Button>
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
            useTooltip={useTooltip}
          />
        </div>
      </aside>
    </TooltipProvider>
  );
}
