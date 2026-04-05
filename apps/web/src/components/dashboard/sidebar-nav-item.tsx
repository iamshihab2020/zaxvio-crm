"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  isCollapsed: boolean;
  showLabel: boolean;
  useTooltip: boolean;
  badge?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  itemRef?: React.RefCallback<HTMLAnchorElement>;
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
  onMouseEnter,
  onMouseLeave,
  onClick,
  itemRef,
}: SidebarNavItemProps) {
  const link = (
    <Link
      ref={itemRef}
      href={href}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "relative z-10 flex h-10 w-full items-center rounded-md px-3 text-sm font-medium font-body transition-colors duration-200",
        showLabel ? "justify-start gap-3" : "justify-center px-0",
        isActive
          ? "text-brand"
          : "text-muted-foreground hover:text-brand",
      )}
    >
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
