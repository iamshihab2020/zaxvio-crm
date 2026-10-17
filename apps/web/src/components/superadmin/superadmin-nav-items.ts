import {
  IconLayoutDashboard,
  IconBuilding,
  IconChartBar,
  IconHeadset,
  IconUsers,
  IconServer,
  IconUserShield,
} from "@tabler/icons-react";

/**
 * The admin navigation, shared by the desktop rail (`SuperadminSidebar`) and
 * the phone drawer (`SuperadminMobileNav`). Two copies of this list would drift
 * the first time a page was added to one and not the other.
 */
export interface SuperadminNavItem {
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
}

export const superadminNavItems: SuperadminNavItem[] = [
  { href: "/superadmin/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/superadmin/tenants", label: "Tenants", icon: IconBuilding },
  { href: "/superadmin/analytics", label: "Analytics", icon: IconChartBar },
  { href: "/superadmin/support", label: "Support", icon: IconHeadset },
  { href: "/superadmin/affiliates", label: "Affiliates", icon: IconUsers },
  { href: "/superadmin/system", label: "System", icon: IconServer },
  { href: "/superadmin/admins", label: "Admins", icon: IconUserShield },
];

export function isSuperadminNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
