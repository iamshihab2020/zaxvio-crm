"use client";

import Link from "next/link";
import type { Customer } from "@hvac-saas/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconChevronRight, IconPhone, IconMail } from "@tabler/icons-react";

function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const match = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return phone;
}

interface CustomerDetailHeaderProps {
  customer: Customer;
}

export function CustomerDetailHeader({ customer }: CustomerDetailHeaderProps) {
  const initials = `${customer.firstName?.[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4">
      {/* Left: breadcrumb + avatar + name + quick badges */}
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1 text-sm font-body">
          <Link
            href="/customers"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Customers
          </Link>
          <IconChevronRight className="h-4 w-4 text-muted-foreground" />
        </nav>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-brand-light text-brand text-xs font-heading">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <span className="font-medium text-foreground font-body text-sm">
            {customer.firstName} {customer.lastName}
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {customer.phone && (
              <span className="flex items-center gap-1">
                <IconPhone className="h-3 w-3" />
                {formatPhone(customer.phone)}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1">
                <IconMail className="h-3 w-3" />
                {customer.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled>
                <IconPhone className="mr-1.5 h-4 w-4" />
                Call
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" disabled>
                <IconMail className="mr-1.5 h-4 w-4" />
                Email
              </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
