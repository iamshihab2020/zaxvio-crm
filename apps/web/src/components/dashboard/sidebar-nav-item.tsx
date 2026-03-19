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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
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
  onMouseEnter,
  onMouseLeave,
  itemRef,
}: SidebarNavItemProps) {
  const link = (
    <Link
      ref={itemRef}
      href={href}
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
      {showLabel && <span className="truncate">{label}</span>}
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
