"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconSettings,
  IconChevronsLeft,
  IconChevronsRight,
  IconLayoutSidebar,
  IconTooltip,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Logo } from "@/components/logo";
import { useSidebar, type SidebarMode } from "./sidebar-provider";
import { SidebarNav } from "./sidebar-nav";
import { SidebarNavItem } from "./sidebar-nav-item";

const modeOptions: { value: SidebarMode; icon: typeof IconLayoutSidebar; label: string }[] = [
  { value: "hover-expand", icon: IconLayoutSidebar, label: "Hover to expand" },
  { value: "icon-tooltip", icon: IconTooltip, label: "Icon + tooltips" },
];

/**
 * The desktop rail. Hidden below `lg`: there the same navigation opens from the
 * navbar's menu button instead (`MobileNav`), because a fixed 224px column
 * leaves a phone about 150px for the page.
 */
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
          "fixed left-0 z-30 hidden flex-col border-r border-border bg-card transition-[width,top] duration-300 ease-in-out lg:flex",
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
          <SidebarNav
            expanded={isEffectivelyExpanded}
            collapsedRail={isCollapsed && !isHoverExpanded}
            useTooltip={useTooltipMode}
          />
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
