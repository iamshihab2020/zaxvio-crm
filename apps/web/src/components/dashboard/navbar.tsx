"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { IconSettings, IconLogout } from "@tabler/icons-react";
import { NotificationBell } from "@/components/dashboard/notifications/notification-bell";
import { PageActionsSlot } from "@/components/dashboard/page-actions";
import { useSession, signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useSidebar } from "@/components/dashboard/sidebar-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/reports": "Reports",
  "/schedule": "Calendar",
  "/bookings": "Bookings",
  "/customers": "Customers",
  "/jobs": "Jobs",
  "/quotes": "Quotes",
  "/invoices": "Invoices",
  "/service-agreements": "Agreements",
  "/automations": "Automations",
  "/catalog": "Catalog",
  "/checklists": "Checklists",
  "/assets": "Assets",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match by prefix (e.g. /jobs/abc → Jobs)
  const segment = "/" + pathname.split("/")[1];
  return PAGE_TITLES[segment] ?? "";
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isCollapsed } = useSidebar();

  // Shift navbar down when impersonation bar is visible
  const [isImpersonating, setIsImpersonating] = useState(false);
  useEffect(() => {
    setIsImpersonating(document.cookie.includes("x-impersonation-id="));
  }, []);

  const userName = session?.user?.name ?? "User";
  const userEmail = session?.user?.email ?? "";
  const userRole = session?.user?.role ?? "member";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const pageTitle = getPageTitle(pathname);

  const handleLogout = async () => {
    // Clear role cookie before signing out
    document.cookie = "x-user-role=; path=/; max-age=0";
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
        },
      },
    });
  };

  return (
    <header
      className={`fixed right-0 z-20 flex h-14 items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-md px-6 transition-[left,top] duration-300 ease-in-out ${isImpersonating ? "top-10" : "top-0"}`}
      style={{ left: isCollapsed ? "4rem" : "14rem" }}
    >
      {/* Brand accent line */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand to-transparent opacity-50" />

      {/* Page title — the only <h1> on the page now that PageHeader is gone. */}
      <div className="flex min-w-0 items-center">
        {pageTitle && (
          <h1 className="truncate font-heading text-lg font-semibold text-foreground">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Page-supplied controls, portalled up from the page body. Sits between
          the title and the account controls, so per-page actions and global
          ones never mix. */}
      <PageActionsSlot className="ml-auto flex min-w-0 items-center justify-end gap-2 overflow-x-auto pl-4" />

      {/* Account controls */}
      <div className="ml-3 flex shrink-0 items-center gap-0.5 rounded-xl bg-muted/50 px-1.5 py-1">
        <ThemeToggle />

        <NotificationBell />

        <div className="mx-1 h-5 w-px bg-border/50" />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 px-2 rounded-lg"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-brand text-[10px] font-bold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="font-body text-sm font-medium text-foreground">
                {userName}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="font-body text-sm font-medium">{userName}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {userEmail || userRole}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              className="cursor-pointer gap-2"
            >
              <IconSettings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive"
            >
              <IconLogout className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
