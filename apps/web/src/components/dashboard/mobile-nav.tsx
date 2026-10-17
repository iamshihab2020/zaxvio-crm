"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMenu2, IconSettings } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/logo";
import { MEDIA, useMediaQuery } from "@/hooks/use-media-query";
import { SidebarNav } from "./sidebar-nav";
import { SidebarNavItem } from "./sidebar-nav-item";

/**
 * The sidebar below `lg`, where a fixed 224px rail would take two thirds of a
 * phone. The same navigation opens from the navbar's menu button in a sheet;
 * `Sidebar` is hidden at these widths, so the two are never on screen together.
 *
 * Always expanded, with no tooltip mode and no collapse toggle: those exist to
 * save width on a wide screen and mean nothing in a drawer.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Back and forward change the route without a click on any link here.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // A tablet rotated past `lg` with the drawer open would keep it open over
  // the desktop sidebar, with the menu button that closes it now hidden.
  const isDesktop = useMediaQuery(MEDIA.lg);
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
        // over the bottom of a fixed full-height panel and hides Settings.
        className="flex h-dvh w-72 max-w-[85vw] flex-col gap-0 bg-card p-0"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
          <Link href="/dashboard" onClick={close}>
            <Logo size="sm" showText asLink={false} />
          </Link>
        </div>

        <ScrollArea className="flex-1">
          <SidebarNav
            expanded
            collapsedRail={false}
            useTooltip={false}
            onNavigate={close}
          />
        </ScrollArea>

        <div
          className="shrink-0 border-t border-border p-3"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) {
              close();
            }
          }}
        >
          <SidebarNavItem
            href="/settings/profile"
            label="Settings"
            icon={IconSettings}
            isActive={
              pathname === "/settings" || pathname.startsWith("/settings/")
            }
            isCollapsed={false}
            showLabel
            useTooltip={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
