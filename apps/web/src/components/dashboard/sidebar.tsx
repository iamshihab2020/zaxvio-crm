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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/customers", label: "Customers", icon: IconUsers },
  { href: "/jobs", label: "Jobs", icon: IconBriefcase },
  { href: "/invoices", label: "Invoices", icon: IconFileInvoice },
  { href: "/quotes", label: "Quotes", icon: IconFileText },
  { href: "/schedule", label: "Schedule", icon: IconCalendar },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-bold text-foreground"
        >
          HVAC<span className="text-brand">Pro</span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Button
              key={item.href}
              variant="ghost"
              asChild
              className={cn(
                "justify-start gap-3 font-body text-sm font-medium",
                isActive
                  ? "bg-brand-light text-brand hover:bg-brand-light hover:text-brand"
                  : "text-muted-foreground",
              )}
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3">
        <Separator className="mb-3" />

        {/* Settings */}
        <Button
          variant="ghost"
          asChild
          className={cn(
            "w-full justify-start gap-3 font-body text-sm font-medium",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-brand-light text-brand hover:bg-brand-light hover:text-brand"
              : "text-muted-foreground",
          )}
        >
          <Link href="/settings">
            <IconSettings className="h-5 w-5" />
            Settings
          </Link>
        </Button>
      </div>
    </aside>
  );
}
