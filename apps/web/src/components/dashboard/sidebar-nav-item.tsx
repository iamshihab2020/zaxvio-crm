"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
}

export function SidebarNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  showLabel,
  useTooltip,
}: SidebarNavItemProps) {
  const button = (
    <Button
      variant="ghost"
      asChild
      className={cn(
        "font-body text-sm font-medium",
        showLabel ? "justify-start gap-3" : "justify-center px-0",
        isActive
          ? "bg-brand-light text-brand hover:bg-brand-light hover:text-brand"
          : "text-muted-foreground",
      )}
    >
      <Link href={href}>
        <Icon className="h-5 w-5 shrink-0" />
        {showLabel && <span className="truncate">{label}</span>}
      </Link>
    </Button>
  );

  if (isCollapsed && useTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
