"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2, IconShieldLock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { MEDIA, useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isSuperadminNavActive,
  superadminNavItems,
} from "./superadmin-nav-items";

/**
 * The admin sidebar below `lg`, where a fixed 240px rail would take two thirds
 * of a phone. The same pages open from the navbar's menu button in a sheet;
 * `SuperadminSidebar` is hidden at these widths, so the two are never on screen
 * together.
 *
 * Painted in the admin sidebar's own tokens, not the card surface the tenant
 * drawer uses: the red is how staff know they are outside a tenant, and the
 * drawer is the one place on a phone where that colour is a whole panel.
 * Always expanded, with no tooltip mode and no collapse toggle, which exist to
 * save width on a wide screen.
 */
export function SuperadminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery(MEDIA.lg);

  // Back and forward change the route without a click on any link here.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Rotating a tablet past `lg` swaps this drawer for the rail; an open sheet
  // would otherwise stay over the page with its trigger gone.
  useEffect(() => {
    if (isDesktop) setOpen(false);
  }, [isDesktop]);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* 40px, with a negative margin so the 20px glyph sits on the page
            gutter instead of 10px inside it. */}
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-10 w-10 shrink-0 lg:hidden"
          aria-label="Open menu"
        >
          <IconMenu2 className="!size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        aria-describedby={undefined}
        // `dvh`, not the sheet's `h-full`: on a phone the address bar slides
        // over the bottom of a fixed full-height panel and hides the last link.
        className="flex h-dvh w-72 max-w-[85vw] flex-col gap-0 border-admin-sidebar-foreground/15 bg-admin-sidebar-bg p-0"
      >
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>

        <div className="flex h-14 shrink-0 items-center border-b border-admin-sidebar-foreground/15 px-3">
          <Link
            href="/superadmin/dashboard"
            onClick={close}
            className="flex items-center gap-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-admin-accent">
              <IconShieldLock className="h-4 w-4 text-admin-accent-foreground" />
            </div>
            <span className="font-heading text-sm font-bold text-admin-sidebar-foreground">
              Admin Panel
            </span>
          </Link>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
          aria-label="Admin navigation"
        >
          {superadminNavItems.map((item) => {
            const isActive = isSuperadminNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                // Clicking the current page's link changes no pathname, so the
                // route-change effect cannot be the only thing closing this.
                onClick={close}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-md px-3 font-body text-sm font-medium transition-colors duration-200",
                  // The rail marks the current page with red text; on this
                  // panel that is about 3:1, so the drawer keeps the red tint
                  // and sets the label in the sidebar's light foreground.
                  isActive
                    ? "bg-admin-accent/25 text-admin-sidebar-foreground"
                    : "text-admin-sidebar-foreground/70 hover:bg-admin-accent/10 hover:text-admin-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
