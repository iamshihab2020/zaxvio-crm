"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconUser,
  IconBuilding,
  IconUsersGroup,
  IconFileInvoice,
  IconFileDescription,
  IconCalendarEvent,
  IconCreditCard,
  IconBell,
  IconLayoutColumns,
  IconShare,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Icon } from "@tabler/icons-react";

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/settings/profile", icon: IconUser },
      { label: "Notifications", href: "/settings/notifications", icon: IconBell },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Business", href: "/settings/business", icon: IconBuilding, roles: ["owner", "admin"] },
      { label: "Team", href: "/settings/team", icon: IconUsersGroup },
      { label: "Billing", href: "/settings/billing", icon: IconCreditCard, roles: ["owner"] },
    ],
  },
  {
    label: "Documents",
    items: [
      { label: "Invoices", href: "/settings/invoices", icon: IconFileInvoice },
      { label: "Quotes", href: "/settings/quotes", icon: IconFileDescription },
    ],
  },
  {
    label: "Jobs",
    items: [
      { label: "Pipelines", href: "/settings/pipelines", icon: IconLayoutColumns },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { label: "Bookings", href: "/settings/bookings", icon: IconCalendarEvent },
      { label: "Share", href: "/settings/share", icon: IconShare },
    ],
  },
];

interface SettingsNavProps {
  /**
   * Organization membership role — `owner` | `admin` | `member` — resolved by
   * the settings layout on the server. It arrives as a prop rather than from a
   * hook on purpose: this used to be `useOrgRole()`, a bare useEffect fetch, so
   * `orgRole` was null through the server render and the whole first paint.
   * Business and Billing are gated on it, which meant every reload rendered a
   * nav missing two items and then reflowed once the round trip finished.
   *
   * `null` means no elevated access. It is never "not known yet" — the server
   * has already resolved it by the time this renders — so there is nothing to
   * show a skeleton for.
   */
  orgRole: string | null;
}

export function SettingsNav({ orgRole }: SettingsNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Filter nav groups based on user's org role
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (orgRole && item.roles.includes(orgRole)),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const allItems = filteredGroups.flatMap((g) => g.items);
  const activeItem = allItems.find((item) => pathname.startsWith(item.href));
  const activeHref = activeItem?.href ?? "";

  return (
    <>
      {/* Mobile: Select dropdown */}
      <div className="md:hidden px-6 pt-6">
        <Select
          value={activeHref}
          onValueChange={(value) => router.push(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              {activeItem && (
                <span className="flex items-center gap-2 font-body text-sm">
                  <activeItem.icon className="h-4 w-4" />
                  {activeItem.label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <SelectItem key={item.href} value={item.href}>
                    <span className="flex items-center gap-2 font-body">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Grouped sidebar */}
      <nav
        className="hidden md:block w-56 shrink-0 border-r border-border"
        aria-label="Settings navigation"
      >
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <div className="relative p-4 space-y-5">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "relative z-10 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 font-body",
                          isActive
                            ? "text-brand bg-brand-light"
                            : "text-muted-foreground hover:text-foreground hover:bg-brand-light/50",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </nav>
    </>
  );
}
