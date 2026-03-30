"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-brand-light text-brand",
  admin: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  member: "bg-muted text-muted-foreground",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

interface TeamRoleBadgeProps {
  role: string;
  className?: string;
}

export function TeamRoleBadge({ role, className }: TeamRoleBadgeProps) {
  return (
    <Badge className={cn("font-medium", ROLE_STYLES[role] ?? ROLE_STYLES.member, className)}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}
