"use client";

import {
  IconPlus,
  IconUserPlus,
  IconFileInvoice,
  IconCalendar,
  IconDotsVertical,
} from "@tabler/icons-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickActions() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">
        <Link href="/jobs">
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          New Job
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <IconDotsVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/customers" className="cursor-pointer">
              <IconUserPlus className="mr-2 h-4 w-4" />
              New Customer
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/invoices" className="cursor-pointer">
              <IconFileInvoice className="mr-2 h-4 w-4" />
              View Invoices
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/schedule" className="cursor-pointer">
              <IconCalendar className="mr-2 h-4 w-4" />
              View Schedule
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
