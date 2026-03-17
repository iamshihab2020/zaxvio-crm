"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconUser,
  IconListDetails,
  IconChecklist,
  IconBuilding,
  IconCreditCard,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Profile", href: "/settings/profile", icon: IconUser },
  { label: "Service Catalog", href: "/settings/catalog", icon: IconListDetails },
  { label: "Checklists", href: "/settings/checklists", icon: IconChecklist },
  { label: "Business", href: "/settings/business", icon: IconBuilding },
  { label: "Billing", href: "/settings/billing", icon: IconCreditCard },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 border-b border-border" aria-label="Settings tabs">
      <div className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors font-body",
                isActive
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
