"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  IconLayoutDashboard,
  IconUsers,
  IconBriefcase,
  IconFileDescription,
  IconReceipt,
  IconCalendarWeek,
  IconCalendarPlus,
  IconListDetails,
  IconChecklist,
  IconFileCheck,
  IconDevices2,
  IconChevronDown,
  IconChartBar,
  IconMessageCircle,
  IconRobot,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  JOBS_PIPELINE_EVENT,
  readJobsPipeline,
} from "@/lib/jobs-pipeline-preference";
import { Button } from "@/components/ui/button";
import { SidebarNavItem, RAIL_INDICATOR_ID } from "./sidebar-nav-item";

/**
 * The navigation itself, separate from the chrome around it.
 *
 * It used to live inside `Sidebar`, which is a fixed rail that only exists from
 * `lg` up. The phone drawer (`MobileNav`) needs the same groups, the same
 * active-state rules and the same Jobs link, so the list moved here and both
 * containers render it. Anything about the container (width, hover-expand,
 * the collapse toggle) stays with the container.
 */

type NavItem = { href: string; label: string; icon: typeof IconLayoutDashboard; badge?: string };
type NavGroup = { label: string; items: NavItem[]; defaultOpen?: boolean };

const standaloneItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/reports", label: "Reports", icon: IconChartBar },
];

const navGroups: NavGroup[] = [
  {
    label: "Schedule",
    defaultOpen: true,
    items: [
      { href: "/schedule", label: "Calendar", icon: IconCalendarWeek },
      { href: "/bookings", label: "Bookings", icon: IconCalendarPlus },
    ],
  },
  {
    label: "Manage",
    defaultOpen: true,
    items: [
      { href: "/customers", label: "Customers", icon: IconUsers },
      { href: "/jobs", label: "Jobs", icon: IconBriefcase },
      { href: "/conversations", label: "Conversations", icon: IconMessageCircle, badge: "Dev" },
    ],
  },
  {
    label: "Finance",
    defaultOpen: true,
    items: [
      { href: "/quotes", label: "Quotes", icon: IconFileDescription },
      { href: "/invoices", label: "Invoices", icon: IconReceipt },
      { href: "/service-agreements", label: "Agreements", icon: IconFileCheck },
    ],
  },
  {
    label: "Automate",
    defaultOpen: true,
    items: [
      { href: "/automations", label: "Automations", icon: IconRobot },
    ],
  },
  {
    label: "Reference",
    defaultOpen: false,
    items: [
      { href: "/catalog", label: "Catalog", icon: IconListDetails },
      { href: "/checklists", label: "Checklists", icon: IconChecklist },
      { href: "/assets", label: "Assets", icon: IconDevices2 },
    ],
  },
];

/** Extract pathname portion from href (strips query string) */
function basePath(href: string): string {
  const idx = href.indexOf("?");
  return idx >= 0 ? href.slice(0, idx) : href;
}

const COLLAPSED_GROUPS_KEY = "zaxvio-sidebar-groups";

function loadCollapsedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

interface SidebarNavProps {
  /** Show labels and the collapsible group headers. False is the icon rail. */
  expanded: boolean;
  /** The rail is collapsed (not merely hover-expanded); items drop their labels. */
  collapsedRail: boolean;
  /** Icon-only items explain themselves with a tooltip. Needs a TooltipProvider above. */
  useTooltip: boolean;
  /** Called when any link in the nav is activated, so a drawer can close itself. */
  onNavigate?: () => void;
  /**
   * Layout id of the active-item indicator, which glides between the items that
   * share it. Each container that can be mounted alongside another needs its
   * own: the rail keeps the default and the phone drawer passes a different one,
   * because a shared id would let the highlight fly between the two.
   */
  indicatorId?: string;
}

export function SidebarNav({
  expanded,
  collapsedRail,
  useTooltip,
  onNavigate,
  indicatorId = RAIL_INDICATOR_ID,
}: SidebarNavProps) {
  const pathname = usePathname();

  // Resolve Jobs href with last-used pipeline from localStorage
  /**
   * The Jobs link carries the pipeline you were last on, so hovering it, opening
   * it in a new tab or bookmarking it all land on the board you actually use.
   *
   * The listener matters: this nav lives in the layout and does not remount
   * on client navigation, so reading localStorage once on mount left the link
   * stale for the rest of the session — visiting /jobs seeded the value and the
   * link still read a bare `/jobs` until a full page reload.
   */
  const [jobsPipelineId, setJobsPipelineId] = useState<string | null>(null);
  useEffect(() => {
    setJobsPipelineId(readJobsPipeline());
    const onChange = (e: Event) => {
      setJobsPipelineId((e as CustomEvent<string>).detail);
    };
    window.addEventListener(JOBS_PIPELINE_EVENT, onChange);
    return () => window.removeEventListener(JOBS_PIPELINE_EVENT, onChange);
  }, []);

  const resolvedNavGroups = useMemo(() => {
    if (!jobsPipelineId) return navGroups;
    return navGroups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === "/jobs"
          ? { ...item, href: `/jobs?pipeline=${jobsPipelineId}` }
          : item,
      ),
    }));
  }, [jobsPipelineId]);

  // Collapsible group state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupsMounted, setGroupsMounted] = useState(false);

  useEffect(() => {
    setCollapsedGroups(loadCollapsedGroups());
    setGroupsMounted(true);
  }, []);

  useEffect(() => {
    if (!groupsMounted) return;
    localStorage.setItem(
      COLLAPSED_GROUPS_KEY,
      JSON.stringify([...collapsedGroups]),
    );
  }, [collapsedGroups, groupsMounted]);

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <nav
      className="flex flex-col p-3 gap-0.5"
      aria-label="Main navigation"
      // One listener on the nav rather than an onClick per item: the items are
      // shared with the desktop rail, which has nothing to close. Clicking the
      // current page's link changes no pathname, so the drawer cannot rely on
      // a route-change effect alone.
      onClick={
        onNavigate
          ? (event) => {
              if (event.target instanceof Element && event.target.closest("a")) {
                onNavigate();
              }
            }
          : undefined
      }
    >
      {/* Dashboard (standalone) */}
      {standaloneItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={isActive}
            isCollapsed={collapsedRail}
            showLabel={expanded}
            useTooltip={useTooltip}
            badge={item.badge}
            indicatorId={indicatorId}
          />
        );
      })}

      {/* Grouped sections — collapsible */}
      {resolvedNavGroups.map((group) => {
        const isGroupCollapsed =
          expanded &&
          (groupsMounted
            ? collapsedGroups.has(group.label)
            : !group.defaultOpen);

        // When sidebar is collapsed, just show items without group headers
        if (!expanded) {
          return (
            <div key={group.label} className="mt-1">
              <div className="mx-3 mb-0.5 border-t border-border" />
              <div className="flex flex-col">
                {group.items.map((item) => {
                  const base = basePath(item.href);
                  const isActive =
                    pathname === base ||
                    pathname.startsWith(base + "/");
                  return (
                    <SidebarNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      isActive={isActive}
                      isCollapsed
                      showLabel={false}
                      useTooltip={useTooltip}
                      indicatorId={indicatorId}
                    />
                  );
                })}
              </div>
            </div>
          );
        }

        // Expanded sidebar — collapsible groups
        return (
          <div key={group.label} className="mt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => toggleGroup(group.label)}
              // Below `lg` the only visible copy of this nav is the phone
              // drawer, where a 24px header is too small to hit with a thumb.
              className="flex w-full items-center justify-between px-3 py-1 group h-auto max-lg:min-h-10"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-heading select-none">
                {group.label}
              </span>
              <IconChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground",
                  isGroupCollapsed && "-rotate-90",
                )}
              />
            </Button>
            <div
              className={cn(
                "flex flex-col gap-0.5 overflow-hidden transition-all duration-200",
                isGroupCollapsed
                  ? "max-h-0 opacity-0"
                  : "max-h-[500px] opacity-100 mt-0.5",
              )}
            >
              {group.items.map((item) => {
                const base = basePath(item.href);
                const isActive =
                  pathname === base ||
                  pathname.startsWith(base + "/");
                return (
                  <SidebarNavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    isActive={isActive}
                    isCollapsed={false}
                    showLabel
                    useTooltip={false}
                    badge={item.badge}
                    indicatorId={indicatorId}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
