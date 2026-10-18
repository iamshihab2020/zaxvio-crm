"use client";

import React from "react";
import Link from "next/link";
import { motion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The layout id the desktop rail's active indicator shares. Every item that
 * should be able to hand the indicator to another item uses the same id; the
 * rail's nav links and its Settings link all do, so the highlight glides
 * between them.
 *
 * The phone drawer must use a different id (see `MobileNav`): both navs are in
 * the tree at once, and a shared id would let the indicator fly between a
 * hidden rail and the drawer.
 */
export const RAIL_INDICATOR_ID = "sidebar-rail-indicator";

// Stiff and well damped: it arrives quickly and does not overshoot, so the
// highlight reads as the page changing hands and not as something bouncing.
const INDICATOR_SPRING: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.8,
};

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isCollapsed: boolean;
  showLabel: boolean;
  useTooltip: boolean;
  badge?: string;
  /** Layout id of the active indicator; items sharing one hand it to each other. */
  indicatorId?: string;
}

export function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  showLabel,
  useTooltip,
  badge,
  indicatorId = RAIL_INDICATOR_ID,
}: SidebarNavItemProps) {
  const link = (
    <Link
      href={href}
      // `isolate` (with the existing `z-10`) makes the link its own stacking
      // context, so the indicator's `-z-10` sits behind the label and icon but
      // stays inside this item instead of dropping behind the sidebar.
      className={cn(
        "relative isolate z-10 flex h-10 w-full items-center rounded-md px-3 text-sm font-medium font-body transition-colors duration-200",
        showLabel ? "justify-start gap-3" : "justify-center px-0",
        isActive
          ? "text-brand-ink"
          : "text-muted-foreground hover:text-brand-ink hover:bg-brand-light/50",
      )}
    >
      {/* The active tint is one element that moves, not a background each item
          switches on and off. Only the active item renders it, and a shared
          `layoutId` makes motion carry it from the item that lost it to the
          one that gained it. First paint has no previous item, so it simply
          appears. Reduced motion (MotionConfig in the dashboard layout) swaps
          it without the glide. */}
      {isActive && (
        <motion.span
          layoutId={indicatorId}
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-md bg-brand-light"
          transition={INDICATOR_SPRING}
        />
      )}
      <Icon className="h-5 w-5 shrink-0" />
      {showLabel && (
        <span className="flex flex-1 items-center gap-2 truncate">
          <span className="truncate">{label}</span>
          {badge && (
            <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );

  if (isCollapsed && useTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
